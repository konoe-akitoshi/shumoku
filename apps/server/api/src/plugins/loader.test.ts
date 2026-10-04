// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { lstat, mkdir, mkdtemp, readFile, rm, stat, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import AdmZip from 'adm-zip'
import { create as createTar } from 'tar'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  installPluginFromUrl,
  installPluginFromZip,
  isBundledPlugin,
  loadPluginsFromConfig,
  markBundledPlugins,
  reloadPlugins,
  removePlugin,
  setPluginEnabled,
} from './loader.js'
import { pluginRegistry } from './registry.js'

/** Reports what it can see of the host process — `'undefined'` only when sandboxed. */
const PROCESS_PROBE_BUNDLE = `
  export function register(registry) {
    registry.registerDescriptor(
      { type: 'process-probe', displayName: 'Process Probe', capabilities: ['hosts'] },
      () => ({
        type: 'process-probe',
        displayName: 'Process Probe',
        capabilities: ['hosts'],
        async testConnection() {
          return { success: true, message: 'ok' }
        },
        async getHosts() {
          return [{ id: 'probe', name: typeof process, status: 'up' }]
        },
      }),
    )
  }
`

const PROCESS_PROBE_MANIFEST = {
  id: 'process-probe',
  name: 'Process Probe',
  version: '1.0.0',
  capabilities: ['hosts'],
  entry: 'index.mjs',
}

describe('loadPluginsFromConfig', () => {
  let workDir: string
  let typesBefore: Set<string>

  beforeEach(async () => {
    workDir = await mkdtemp(join(tmpdir(), 'shumoku-loader-test-'))
    typesBefore = new Set(pluginRegistry.getRegisteredTypes().map((reg) => reg.type))
  })

  afterEach(async () => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
    pluginRegistry.removeInstance('ds-probe')
    for (const { type } of pluginRegistry.getRegisteredTypes()) {
      if (!typesBefore.has(type)) pluginRegistry.unregister(type)
    }
    markBundledPlugins([])
    await rm(workDir, { recursive: true, force: true })
  })

  async function writePlugin(dirName: string, manifest: object, bundle: string): Promise<string> {
    const pluginDir = join(workDir, dirName)
    await mkdir(pluginDir, { recursive: true })
    await writeFile(join(pluginDir, 'plugin.json'), JSON.stringify(manifest))
    await writeFile(join(pluginDir, 'index.mjs'), bundle)
    return pluginDir
  }

  // SHUMOKU_PLUGIN_SANDBOX=off was the pre-sandbox escape hatch that put every
  // external plugin back in the Server process with full privileges; it is
  // gone, and setting it must change nothing.
  it.each([
    ['unset', undefined],
    ['off', 'off'],
  ])(
    'registers an external plugin through the sandbox, usable via getInstance (SHUMOKU_PLUGIN_SANDBOX %s)',
    async (_label, sandboxEnv) => {
      if (sandboxEnv !== undefined) vi.stubEnv('SHUMOKU_PLUGIN_SANDBOX', sandboxEnv)
      await writePlugin('process-probe', PROCESS_PROBE_MANIFEST, PROCESS_PROBE_BUNDLE)
      const configPath = join(workDir, 'plugins.yaml')
      await writeFile(configPath, 'plugins:\n  - id: process-probe\n    path: ./process-probe\n')

      const [info] = await loadPluginsFromConfig(configPath)

      expect(info?.error).toBeUndefined()
      const plugin = (await pluginRegistry.getInstance(
        'ds-probe',
        'process-probe',
        {},
      )) as unknown as {
        getHosts(): Promise<Array<{ name: string }>>
      }
      await expect(plugin.getHosts()).resolves.toEqual([
        { id: 'probe', name: 'undefined', status: 'up' },
      ])
    },
  )

  it('applies the sandbox limits from the environment to external plugins', async () => {
    vi.stubEnv('SHUMOKU_PLUGIN_CALL_TIMEOUT_SEC', '1')
    vi.stubEnv('SHUMOKU_PLUGIN_MEMORY_MB', '16')
    const stuckBundle = `
      export function register(registry) {
        registry.registerDescriptor(
          { type: 'stuck-probe', displayName: 'Stuck Probe', capabilities: ['hosts'] },
          () => ({
            type: 'stuck-probe',
            displayName: 'Stuck Probe',
            capabilities: ['hosts'],
            // Fits the 64MB default, not the 16MB set above.
            async testConnection() {
              return { success: true, message: String('x'.repeat(20_000_000).length) }
            },
            getHosts() {
              return new Promise(() => {})
            },
          }),
        )
      }
    `
    await writePlugin('stuck-probe', { ...PROCESS_PROBE_MANIFEST, id: 'stuck-probe' }, stuckBundle)
    const configPath = join(workDir, 'plugins.yaml')
    await writeFile(configPath, 'plugins:\n  - id: stuck-probe\n    path: ./stuck-probe\n')

    await loadPluginsFromConfig(configPath)

    const plugin = (await pluginRegistry.getInstance('ds-probe', 'stuck-probe', {})) as unknown as {
      getHosts(): Promise<unknown[]>
      testConnection(): Promise<unknown>
    }
    await expect(plugin.getHosts()).rejects.toThrow('did not settle within 1000ms')
    await expect(plugin.testConnection()).rejects.toThrow(/out of memory/)
  })

  it('fails a plugin that is not a single file with an error asking for a single-file ESM bundle', async () => {
    const pluginDir = await writePlugin(
      'split-plugin',
      { ...PROCESS_PROBE_MANIFEST, id: 'split-plugin' },
      `import { makeHosts } from './helper.mjs'\n${PROCESS_PROBE_BUNDLE}`,
    )
    await writeFile(join(pluginDir, 'helper.mjs'), 'export const makeHosts = () => []\n')
    const configPath = join(workDir, 'plugins.yaml')
    await writeFile(configPath, 'plugins:\n  - id: split-plugin\n    path: ./split-plugin\n')

    const [info] = await loadPluginsFromConfig(configPath)

    expect(info?.enabled).toBe(false)
    expect(info?.error).toMatch(/single-file ESM/)
    expect(info?.error).toContain('helper.mjs')
  })

  it.each([
    ['a relative', () => '../outside.mjs'],
    ['an absolute', () => join(workDir, 'outside.mjs')],
  ])('refuses %s entry that points outside the plugin directory', async (_label, entryOf) => {
    const entry = entryOf()
    await writePlugin(
      'escaping-entry',
      { ...PROCESS_PROBE_MANIFEST, id: 'escaping-entry', entry },
      PROCESS_PROBE_BUNDLE,
    )
    await writeFile(join(workDir, 'outside.mjs'), PROCESS_PROBE_BUNDLE)
    const configPath = join(workDir, 'plugins.yaml')
    await writeFile(configPath, 'plugins:\n  - id: escaping-entry\n    path: ./escaping-entry\n')

    const [info] = await loadPluginsFromConfig(configPath)

    expect(info?.enabled).toBe(false)
    expect(info?.error).toContain(entry)
  })

  it('refuses a symbolic link entry outside the plugin directory', async () => {
    const pluginDir = await writePlugin(
      'linked-entry',
      { ...PROCESS_PROBE_MANIFEST, id: 'linked-entry' },
      PROCESS_PROBE_BUNDLE,
    )
    const outside = join(workDir, 'outside.mjs')
    await writeFile(outside, PROCESS_PROBE_BUNDLE)
    await rm(join(pluginDir, 'index.mjs'))
    await symlink(outside, join(pluginDir, 'index.mjs'))
    const configPath = join(workDir, 'plugins.yaml')
    await writeFile(configPath, 'plugins:\n  - id: linked-entry\n    path: ./linked-entry\n')

    const [info] = await loadPluginsFromConfig(configPath)

    expect(info?.enabled).toBe(false)
    expect(info?.error).toContain('Symbolic link')
  })

  function bundleRegistering(type: string): string {
    return PROCESS_PROBE_BUNDLE.replaceAll("'process-probe'", `'${type}'`)
  }

  it('refuses a plugin whose registered type differs from its plugin.json id', async () => {
    await writePlugin(
      'mislabeled',
      { ...PROCESS_PROBE_MANIFEST, id: 'mislabeled' },
      bundleRegistering('mislabeled-other'),
    )
    const configPath = join(workDir, 'plugins.yaml')
    await writeFile(configPath, 'plugins:\n  - id: mislabeled\n    path: ./mislabeled\n')

    const [info] = await loadPluginsFromConfig(configPath)

    expect(info?.enabled).toBe(false)
    expect(info?.error).toBe(
      'Plugin registers type "mislabeled-other", but its plugin.json id is "mislabeled"',
    )
    expect(pluginRegistry.has('mislabeled-other')).toBe(false)
  })

  // A bundled type receives that data source's config, credentials included.
  // Registering it under another id is refused by the type check above.
  it('refuses a plugin whose plugin.json id is a bundled plugin type', async () => {
    const bundledFactory = vi.fn()
    pluginRegistry.registerDescriptor(
      { type: 'bundled-probe', displayName: 'Bundled Probe', capabilities: ['hosts'] },
      bundledFactory,
    )
    markBundledPlugins(['bundled-probe'])
    await writePlugin(
      'bundled-probe',
      { ...PROCESS_PROBE_MANIFEST, id: 'bundled-probe' },
      bundleRegistering('bundled-probe'),
    )
    const configPath = join(workDir, 'plugins.yaml')
    await writeFile(configPath, 'plugins:\n  - id: bundled-probe\n    path: ./bundled-probe\n')

    const [info] = await loadPluginsFromConfig(configPath)

    expect(info?.enabled).toBe(false)
    expect(info?.error).toBe('Plugin id "bundled-probe" belongs to a bundled plugin')
    expect(pluginRegistry.getInfo('bundled-probe')?.factory).toBe(bundledFactory)
    // The failed entry keeps its id; a reload must not unregister the bundled type by it.
    await reloadPlugins()
    expect(pluginRegistry.getInfo('bundled-probe')?.factory).toBe(bundledFactory)
  })

  // Every load used to record all registered types as bundled, external ones
  // still registered from the previous load included, and a bundled plugin can
  // be neither disabled nor removed.
  it('can still disable and remove an external plugin after the config is loaded again', async () => {
    await writePlugin(
      'reloaded-probe',
      { ...PROCESS_PROBE_MANIFEST, id: 'reloaded-probe' },
      bundleRegistering('reloaded-probe'),
    )
    const configPath = join(workDir, 'plugins.yaml')
    await writeFile(configPath, 'plugins:\n  - id: reloaded-probe\n    path: ./reloaded-probe\n')
    await loadPluginsFromConfig(configPath)

    await loadPluginsFromConfig(configPath)

    expect(isBundledPlugin('reloaded-probe')).toBe(false)
    await expect(setPluginEnabled('reloaded-probe', false)).resolves.toEqual({ success: true })
    await expect(removePlugin('reloaded-probe')).resolves.toEqual({ success: true })
  })

  describe('stopping an external plugin', () => {
    type HostsPlugin = { getHosts(): Promise<Array<{ name: string }>> }

    function bundleNamingHosts(type: string, name: string): string {
      return bundleRegistering(type).replace('typeof process', JSON.stringify(name))
    }

    async function loadStoppable(): Promise<string> {
      const pluginDir = await writePlugin(
        'stoppable',
        { ...PROCESS_PROBE_MANIFEST, id: 'stoppable' },
        bundleNamingHosts('stoppable', 'v1'),
      )
      const configPath = join(workDir, 'plugins.yaml')
      await writeFile(configPath, 'plugins:\n  - id: stoppable\n    path: ./stoppable\n')
      await loadPluginsFromConfig(configPath)
      const running = (await pluginRegistry.getInstance(
        'ds-probe',
        'stoppable',
        {},
      )) as unknown as HostsPlugin
      await expect(running.getHosts()).resolves.toEqual([{ id: 'probe', name: 'v1', status: 'up' }])
      return pluginDir
    }

    it('stops data sources from using a plugin once it is disabled', async () => {
      await loadStoppable()

      await setPluginEnabled('stoppable', false)

      await expect(pluginRegistry.getInstance('ds-probe', 'stoppable', {})).rejects.toThrow(
        'Unknown plugin type: stoppable',
      )
    })

    it('stops data sources from using a plugin once it is removed', async () => {
      await loadStoppable()

      await removePlugin('stoppable')

      await expect(pluginRegistry.getInstance('ds-probe', 'stoppable', {})).rejects.toThrow(
        'Unknown plugin type: stoppable',
      )
    })

    it('runs the updated code for existing data sources after a reload', async () => {
      const pluginDir = await loadStoppable()
      await writeFile(join(pluginDir, 'index.mjs'), bundleNamingHosts('stoppable', 'v2'))

      await reloadPlugins()

      const updated = (await pluginRegistry.getInstance(
        'ds-probe',
        'stoppable',
        {},
      )) as unknown as HostsPlugin
      await expect(updated.getHosts()).resolves.toEqual([{ id: 'probe', name: 'v2', status: 'up' }])
    })
  })
})

/**
 * A plugins directory with its own (empty) plugins.yaml, loaded so that
 * addPlugin — the last step of every install — writes there and not to
 * whatever config an earlier test left behind.
 */
async function setUpPluginsDir(workDir: string): Promise<string> {
  const pluginsDir = join(workDir, 'plugins')
  await mkdir(pluginsDir)
  const configPath = join(pluginsDir, 'plugins.yaml')
  await writeFile(configPath, 'plugins: []\n')
  await loadPluginsFromConfig(configPath)
  return pluginsDir
}

const INSTALL_MANIFEST = {
  id: 'installed-probe',
  name: 'Installed Probe',
  version: '1.0.0',
  capabilities: ['hosts'],
  entry: 'index.mjs',
}

describe('installPluginFromUrl', () => {
  let workDir: string
  let pluginsDir: string

  beforeEach(async () => {
    workDir = await mkdtemp(join(tmpdir(), 'shumoku-install-test-'))
    pluginsDir = await setUpPluginsDir(workDir)
  })

  afterEach(async () => {
    vi.restoreAllMocks()
    await rm(workDir, { recursive: true, force: true })
  })

  it('does not run shell syntax embedded in a git URL', async () => {
    const marker = join(workDir, 'injected')

    // Port 1 refuses the connection at once, so the clone itself fails fast.
    const result = await installPluginFromUrl(
      `https://127.0.0.1:1/$(touch ${marker}).git`,
      pluginsDir,
    )

    expect(result.success).toBe(false)
    await expect(stat(marker)).rejects.toThrow()
  })

  it.each(['file:///nonexistent/repo.git', 'http://127.0.0.1:1/plugin.zip', 'ext::sh -c true.git'])(
    'refuses %s — only https: URLs are installed',
    async (url) => {
      const result = await installPluginFromUrl(url, pluginsDir)

      expect(result.success).toBe(false)
      expect(result.error).toMatch(/https:/)
    },
  )

  it('refuses a tar.gz whose plugin.json id climbs out of the plugins directory', async () => {
    const victim = join(workDir, 'victim')
    await mkdir(victim)
    await writeFile(join(victim, 'keep.txt'), 'keep')
    const archive = await tarGz({
      'plugin.json': JSON.stringify({ ...INSTALL_MANIFEST, id: '../victim' }),
      'index.mjs': PROCESS_PROBE_BUNDLE,
    })
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(archive))

    const result = await installPluginFromUrl('https://plugins.example/p.tar.gz', pluginsDir)

    expect(result.success).toBe(false)
    expect(result.error).toMatch(/plugin\.json id "\.\.\/victim"/)
    await expect(readFile(join(victim, 'keep.txt'), 'utf-8')).resolves.toBe('keep')
  })

  it('refuses a subdirectory that climbs out of the extracted archive', async () => {
    // A plugin that already sits on the Server, outside the archive.
    const outside = join(workDir, 'outside')
    await mkdir(outside)
    await writeFile(join(outside, 'plugin.json'), JSON.stringify(INSTALL_MANIFEST))
    await writeFile(join(outside, 'index.mjs'), PROCESS_PROBE_BUNDLE)
    const archive = await tarGz({ 'README.md': 'no plugin here' })
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(archive))

    const result = await installPluginFromUrl(
      'https://plugins.example/p.tar.gz',
      pluginsDir,
      '../../outside',
    )

    await expect(stat(join(pluginsDir, INSTALL_MANIFEST.id))).rejects.toThrow()
    expect(result.success).toBe(false)
    expect(result.error).toContain('../../outside')
  })

  it('does not carry symbolic links from an archive into the installed plugin', async () => {
    const secret = join(workDir, 'secret.txt')
    await writeFile(secret, 'secret')
    const archive = await tarGz(
      {
        'plugin.json': JSON.stringify(INSTALL_MANIFEST),
        'index.mjs': PROCESS_PROBE_BUNDLE,
      },
      { 'leak.txt': secret },
    )
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(archive))

    const result = await installPluginFromUrl('https://plugins.example/p.tar.gz', pluginsDir)

    expect(result.error).toBeUndefined()
    const installed = join(pluginsDir, INSTALL_MANIFEST.id)
    await expect(readFile(join(installed, 'index.mjs'), 'utf-8')).resolves.toBe(
      PROCESS_PROBE_BUNDLE,
    )
    await expect(lstat(join(installed, 'leak.txt'))).rejects.toThrow()
  })

  async function tarGz(
    files: Record<string, string>,
    symlinks: Record<string, string> = {},
  ): Promise<ArrayBuffer> {
    const srcDir = await mkdtemp(join(workDir, 'src-'))
    await Promise.all([
      ...Object.entries(files).map(([name, content]) => writeFile(join(srcDir, name), content)),
      ...Object.entries(symlinks).map(([name, target]) => symlink(target, join(srcDir, name))),
    ])
    const archivePath = join(workDir, 'archive.tar.gz')
    await createTar({ gzip: true, cwd: srcDir, file: archivePath }, [
      ...Object.keys(files),
      ...Object.keys(symlinks),
    ])
    return new Uint8Array(await readFile(archivePath)).buffer
  }
})

describe('installPluginFromZip', () => {
  let workDir: string
  let pluginsDir: string

  beforeEach(async () => {
    workDir = await mkdtemp(join(tmpdir(), 'shumoku-install-test-'))
    pluginsDir = await setUpPluginsDir(workDir)
  })

  afterEach(async () => {
    vi.unstubAllEnvs()
    pluginRegistry.removeInstance('ds-installed')
    await rm(workDir, { recursive: true, force: true })
  })

  it('refuses a plugin.json id that climbs out of the plugins directory', async () => {
    const zip = new AdmZip()
    zip.addFile(
      'plugin.json',
      Buffer.from(JSON.stringify({ ...INSTALL_MANIFEST, id: '../escape' })),
    )
    zip.addFile('index.mjs', Buffer.from(PROCESS_PROBE_BUNDLE))

    const result = await installPluginFromZip(zip.toBuffer(), pluginsDir)

    expect(result.success).toBe(false)
    expect(result.error).toMatch(/plugin\.json id "\.\.\/escape"/)
    await expect(stat(join(workDir, 'escape'))).rejects.toThrow()
  })

  it('refuses an entry name that climbs out of the plugin directory, writing nothing', async () => {
    const zip = new AdmZip()
    zip.addFile('plugin.json', Buffer.from(JSON.stringify(INSTALL_MANIFEST)))
    zip.addFile('index.mjs', Buffer.from(PROCESS_PROBE_BUNDLE))
    // addFile() strips the `..`; the setter keeps the raw name, as a crafted
    // archive would carry it. Named to sort after the real files, so an
    // extractor that checks each entry only as it writes it would already
    // have written those.
    zip.addFile('zz.txt', Buffer.from('evil'))
    const evil = zip.getEntry('zz.txt')
    if (evil) evil.entryName = 'zz/../../../evil.txt'

    const result = await installPluginFromZip(zip.toBuffer(), pluginsDir)

    await expect(stat(join(workDir, 'evil.txt'))).rejects.toThrow()
    expect(result.success).toBe(false)
    expect(result.error).toContain('zz/../../../evil.txt')
    await expect(stat(join(pluginsDir, INSTALL_MANIFEST.id, 'index.mjs'))).rejects.toThrow()
  })

  it.each(['directory', 'file'])(
    'refuses an existing %s symlink before writing ZIP files',
    async (kind) => {
      const outside = join(workDir, 'outside')
      await mkdir(outside)
      const victim = join(outside, 'keep.txt')
      await writeFile(victim, 'keep')
      const installed = join(pluginsDir, INSTALL_MANIFEST.id)
      await mkdir(installed)
      const link = kind === 'directory' ? join(installed, 'assets') : join(installed, 'keep.txt')
      await symlink(kind === 'directory' ? outside : victim, link)
      const zip = new AdmZip()
      zip.addFile('plugin.json', Buffer.from(JSON.stringify(INSTALL_MANIFEST)))
      zip.addFile(kind === 'directory' ? 'assets/keep.txt' : 'keep.txt', Buffer.from('changed'))

      const result = await installPluginFromZip(zip.toBuffer(), pluginsDir)

      expect(result.success).toBe(false)
      expect(result.error).toContain('Symbolic link')
      await expect(readFile(victim, 'utf-8')).resolves.toBe('keep')
      await expect(stat(join(installed, 'plugin.json'))).rejects.toThrow()
    },
  )

  it('applies the sandbox limits from the environment to a plugin it installs', async () => {
    vi.stubEnv('SHUMOKU_PLUGIN_CALL_TIMEOUT_SEC', '1')
    const zip = new AdmZip()
    zip.addFile(
      'plugin.json',
      Buffer.from(JSON.stringify({ ...INSTALL_MANIFEST, id: 'installed-stuck' })),
    )
    zip.addFile(
      'index.mjs',
      Buffer.from(`
        export function register(registry) {
          registry.registerDescriptor(
            { type: 'installed-stuck', displayName: 'Installed Stuck', capabilities: ['hosts'] },
            () => ({
              type: 'installed-stuck',
              displayName: 'Installed Stuck',
              capabilities: ['hosts'],
              async testConnection() {
                return { success: true, message: 'ok' }
              },
              getHosts() {
                return new Promise(() => {})
              },
            }),
          )
        }
      `),
    )

    const result = await installPluginFromZip(zip.toBuffer(), pluginsDir)

    expect(result.error).toBeUndefined()
    const plugin = (await pluginRegistry.getInstance(
      'ds-installed',
      'installed-stuck',
      {},
    )) as unknown as { getHosts(): Promise<unknown[]> }
    await expect(plugin.getHosts()).rejects.toThrow('did not settle within 1000ms')
  })
})

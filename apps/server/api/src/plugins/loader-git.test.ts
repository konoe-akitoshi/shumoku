// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { lstat, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { installPluginFromUrl, loadPluginsFromConfig } from './loader.js'

/** What the mocked `git clone` writes into its target directory. */
let repo: { files: Record<string, string>; symlinks: Record<string, string> } = {
  files: {},
  symlinks: {},
}

vi.mock('node:child_process', () => ({
  execFile: (
    _file: string,
    args: string[],
    _options: unknown,
    callback: (error: Error | null, result?: { stdout: string; stderr: string }) => void,
  ) => {
    const target = args.at(-1) ?? ''
    Promise.all([
      ...Object.entries(repo.files).map(([name, content]) =>
        writeFile(join(target, name), content),
      ),
      ...Object.entries(repo.symlinks).map(([name, to]) => symlink(to, join(target, name))),
    ]).then(
      () => callback(null, { stdout: '', stderr: '' }),
      (error: Error) => callback(error),
    )
  },
}))

const MANIFEST = {
  id: 'git-probe',
  name: 'Git Probe',
  version: '1.0.0',
  capabilities: ['hosts'],
  entry: 'index.mjs',
}

const BUNDLE = `
  export function register(registry) {
    registry.registerDescriptor(
      { type: 'git-probe', displayName: 'Git Probe', capabilities: ['hosts'] },
      () => ({
        type: 'git-probe',
        displayName: 'Git Probe',
        capabilities: ['hosts'],
        async testConnection() {
          return { success: true, message: 'ok' }
        },
        async getHosts() {
          return []
        },
      }),
    )
  }
`

describe('installPluginFromUrl (git)', () => {
  let workDir: string
  let pluginsDir: string

  beforeEach(async () => {
    workDir = await mkdtemp(join(tmpdir(), 'shumoku-install-test-'))
    pluginsDir = join(workDir, 'plugins')
    await mkdir(pluginsDir)
    const configPath = join(pluginsDir, 'plugins.yaml')
    await writeFile(configPath, 'plugins: []\n')
    await loadPluginsFromConfig(configPath)
  })

  afterEach(async () => {
    await rm(workDir, { recursive: true, force: true })
  })

  it('refuses a plugin.json id that climbs out of the plugins directory', async () => {
    const victim = join(workDir, 'victim')
    await mkdir(victim)
    await writeFile(join(victim, 'keep.txt'), 'keep')
    repo = {
      files: {
        'plugin.json': JSON.stringify({ ...MANIFEST, id: '../victim' }),
        'index.mjs': BUNDLE,
      },
      symlinks: {},
    }

    const result = await installPluginFromUrl('https://git.example/plugin.git', pluginsDir)

    expect(result.success).toBe(false)
    expect(result.error).toMatch(/plugin\.json id "\.\.\/victim"/)
    await expect(readFile(join(victim, 'keep.txt'), 'utf-8')).resolves.toBe('keep')
  })

  it('does not carry symbolic links from the repository into the installed plugin', async () => {
    const secret = join(workDir, 'secret.txt')
    await writeFile(secret, 'secret')
    repo = {
      files: { 'plugin.json': JSON.stringify(MANIFEST), 'index.mjs': BUNDLE },
      symlinks: { 'leak.txt': secret },
    }

    const result = await installPluginFromUrl('https://git.example/plugin.git', pluginsDir)

    expect(result.error).toBeUndefined()
    const installed = join(pluginsDir, MANIFEST.id)
    await expect(readFile(join(installed, 'index.mjs'), 'utf-8')).resolves.toBe(BUNDLE)
    await expect(lstat(join(installed, 'leak.txt'))).rejects.toThrow()
  })
})

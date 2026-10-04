/**
 * External Plugin Loader
 *
 * Loads external plugins from a configuration file (plugins.yaml).
 * Supports hot reload, adding/removing plugins without server restart.
 *
 * Each plugin is a directory containing:
 * - plugin.json: Manifest with id, name, capabilities, configSchema
 * - index.js: Entry point exporting a register(pluginRegistry) function
 */

import { lstat, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { dump as dumpYaml, load as parseYaml } from 'js-yaml'
import { pluginRegistry } from './registry.js'
import { readSandboxLimits, type SandboxLimits } from './sandbox/sandbox-limits.js'
import { loadSandboxedPlugin } from './sandbox/sandboxed-plugin.js'
import type { PluginManifest } from './types.js'

// ============================================
// Types
// ============================================

/**
 * Entry in plugins.yaml
 */
interface PluginEntry {
  /** Unique plugin identifier */
  id: string
  /** Path to plugin directory (absolute or relative to config file) */
  path: string
  /** Whether plugin is enabled (default: true) */
  enabled?: boolean
}

/**
 * plugins.yaml structure
 */
interface PluginsConfig {
  plugins?: PluginEntry[]
}

/**
 * Loaded plugin info (runtime state)
 */
export interface LoadedPluginInfo {
  id: string
  name: string
  version: string
  path: string
  capabilities: string[]
  configSchema?: PluginManifest['configSchema']
  optionsSchema?: PluginManifest['optionsSchema']
  enabled: boolean
  bundled: boolean
  error?: string
}

/**
 * Result of adding a plugin
 */
export interface AddPluginResult {
  success: boolean
  plugin?: LoadedPluginInfo
  error?: string
}

// ============================================
// Module State
// ============================================

/** Track loaded external plugins */
let loadedPlugins: LoadedPluginInfo[] = []

/** Current config file path */
let currentConfigPath: string | null = null

/** Bundled plugin IDs, recorded once at startup by registerBundledPlugins() */
let bundledPluginIds: ReadonlySet<string> = new Set()

// ============================================
// Bundled Plugin Tracking
// ============================================

/**
 * Record which plugin types are bundled: by default, everything registered so
 * far. registerBundledPlugins() calls this once, before any external plugin
 * is loaded. Loading external plugins must not call it: after a reload that
 * would record them as bundled, and bundled plugins can be neither disabled
 * nor removed.
 */
export function markBundledPlugins(
  types: readonly string[] = pluginRegistry.getRegisteredTypes().map((reg) => reg.type),
): void {
  bundledPluginIds = new Set(types)
}

/**
 * Check if a plugin ID is bundled
 */
export function isBundledPlugin(pluginId: string): boolean {
  return bundledPluginIds.has(pluginId)
}

// ============================================
// Config Management
// ============================================

/**
 * Get the current plugins config path
 */
export function getConfigPath(): string | null {
  return currentConfigPath
}

/**
 * Read plugins config from file
 */
async function readConfig(configPath: string): Promise<PluginsConfig> {
  try {
    const configStat = await stat(configPath)
    if (!configStat.isFile()) {
      return { plugins: [] }
    }
    const content = await readFile(configPath, 'utf-8')
    return (parseYaml(content) as PluginsConfig) || { plugins: [] }
  } catch {
    return { plugins: [] }
  }
}

/**
 * Write plugins config to file
 */
async function writeConfig(configPath: string, config: PluginsConfig): Promise<void> {
  const dir = dirname(configPath)
  await mkdir(dir, { recursive: true })
  const content = dumpYaml(config, { indent: 2 })
  await writeFile(configPath, content, 'utf-8')
}

// ============================================
// Plugin Loading
// ============================================

/**
 * Load external plugins from a configuration file
 */
export async function loadPluginsFromConfig(configPath: string): Promise<LoadedPluginInfo[]> {
  currentConfigPath = configPath

  const config = await readConfig(configPath)

  if (!config.plugins || config.plugins.length === 0) {
    console.log('[Plugins] No external plugins configured')
    return []
  }

  console.log('[Plugins] Loading external plugins from:', configPath)
  const limits = currentSandboxLimits()
  console.log(
    `[Plugins] Sandbox limits: ${limits.memoryLimitBytes / 1024 / 1024}MB per data source, ` +
      `${limits.methodTimeoutMs / 1000}s per call, auto-GC capped at ${limits.gcThresholdPercent}% of memory`,
  )

  const configDir = resolve(configPath, '..')
  const results: LoadedPluginInfo[] = []

  for (const entry of config.plugins) {
    const info = await loadPluginEntry(entry, configDir, limits)
    results.push(info)
  }

  loadedPlugins = results
  const successCount = results.filter((p) => !p.error && p.enabled).length
  console.log(`[Plugins] Loaded ${successCount} external plugin(s)`)

  return results
}

/**
 * Load a single plugin entry
 */
async function loadPluginEntry(
  entry: PluginEntry,
  configDir: string,
  limits: SandboxLimits = currentSandboxLimits(),
): Promise<LoadedPluginInfo> {
  const pluginPath = isAbsolute(entry.path) ? entry.path : resolve(configDir, entry.path)

  // If disabled, return without loading
  if (entry.enabled === false) {
    try {
      const manifest = await readManifest(pluginPath)
      return {
        id: manifest.id,
        name: manifest.name,
        version: manifest.version,
        path: pluginPath,
        capabilities: manifest.capabilities,
        configSchema: manifest.configSchema,
        optionsSchema: manifest.optionsSchema,
        enabled: false,
        bundled: false,
      }
    } catch {
      return {
        id: entry.id,
        name: entry.id,
        version: 'unknown',
        path: pluginPath,
        capabilities: [],
        enabled: false,
        bundled: false,
        error: 'Plugin disabled, manifest not readable',
      }
    }
  }

  try {
    // Verify directory exists
    const pluginStat = await stat(pluginPath)
    if (!pluginStat.isDirectory()) {
      throw new Error(`Plugin path is not a directory: ${pluginPath}`)
    }

    // Load manifest
    const manifest = await readManifest(pluginPath)
    if (bundledPluginIds.has(manifest.id)) {
      throw new Error(`Plugin id "${manifest.id}" belongs to a bundled plugin`)
    }

    // Load entry point module
    const entryFile = manifest.entry || 'index.js'
    const modulePath = resolveInside(pluginPath, entryFile)

    await rejectSymbolicLinks(pluginPath, modulePath)
    try {
      await stat(modulePath)
    } catch {
      throw new Error(`Entry point not found: ${modulePath}`)
    }

    await registerSandboxed(modulePath, manifest.id, limits)

    console.log(`[Plugins] Loaded: ${manifest.id} v${manifest.version} (${manifest.name})`)

    return {
      id: manifest.id,
      name: manifest.name,
      version: manifest.version,
      path: pluginPath,
      capabilities: manifest.capabilities,
      configSchema: manifest.configSchema,
      optionsSchema: manifest.optionsSchema,
      enabled: true,
      bundled: false,
    }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err)
    console.error(`[Plugins] Failed to load plugin "${entry.id}":`, errorMsg)

    return {
      id: entry.id,
      name: entry.id,
      version: 'unknown',
      path: pluginPath,
      capabilities: [],
      enabled: false,
      bundled: false,
      error: errorMsg,
    }
  }
}

/**
 * Read once per config load (and per plugin added later), so a hot reload
 * picks up a changed environment. Warns rather than fails on a bad value;
 * see readSandboxLimits.
 */
function currentSandboxLimits(): SandboxLimits {
  return readSandboxLimits(process.env, (message) => console.warn(`[Plugins] ${message}`))
}

/**
 * External plugin code never runs in the Server process itself. The entry
 * file is evaluated inside a QuickJS sandbox, and the registry only ever sees
 * a proxy whose calls cross the boundary as JSON. There is deliberately no
 * opt-out: any switch back to in-process loading would hand every external
 * plugin the Server's full privileges again.
 *
 * The type the bundle registers must be its plugin.json id. Otherwise it
 * could overwrite another plugin's type, a bundled one included, and receive
 * that type's data source config and credentials; and the plugin could not be
 * unregistered by its id.
 */
async function registerSandboxed(
  modulePath: string,
  manifestId: string,
  limits: SandboxLimits,
): Promise<void> {
  const bundleSource = await readFile(modulePath, 'utf-8')
  const { descriptor, factory } = await loadSandboxedPlugin(bundleSource, {
    fetchImpl: fetch,
    ...limits,
  })
  if (descriptor.type !== manifestId) {
    throw new Error(
      `Plugin registers type "${descriptor.type}", but its plugin.json id is "${manifestId}"`,
    )
  }
  pluginRegistry.registerDescriptor(descriptor, factory)
}

/**
 * Read plugin manifest from directory
 */
async function readManifest(pluginPath: string): Promise<PluginManifest> {
  const manifestPath = join(pluginPath, 'plugin.json')
  await rejectSymbolicLinks(pluginPath, manifestPath)
  const manifestJson = await readFile(manifestPath, 'utf-8')
  const manifest = JSON.parse(manifestJson) as PluginManifest

  // Validate manifest
  if (!manifest.id) throw new Error('plugin.json missing required field: id')
  if (!manifest.name) throw new Error('plugin.json missing required field: name')
  if (!manifest.version) throw new Error('plugin.json missing required field: version')
  if (!manifest.capabilities || manifest.capabilities.length === 0) {
    throw new Error('plugin.json missing required field: capabilities')
  }

  return manifest
}

// ============================================
// Hot Reload
// ============================================

/**
 * Reload all external plugins (hot reload)
 * Clears external plugin instances and re-loads from config
 */
export async function reloadPlugins(): Promise<LoadedPluginInfo[]> {
  if (!currentConfigPath) {
    throw new Error('No config path set. Call loadPluginsFromConfig first.')
  }

  console.log('[Plugins] Hot reloading plugins...')

  // Unregister every external plugin and dispose its instances, so disabled
  // ones stop and the rest are recreated from the code on disk. An entry that
  // failed to load may carry a bundled id; that registration is not ours.
  for (const plugin of loadedPlugins) {
    if (!bundledPluginIds.has(plugin.id)) {
      pluginRegistry.unregister(plugin.id)
    }
  }
  loadedPlugins = []

  // Reload from config
  return loadPluginsFromConfig(currentConfigPath)
}

// ============================================
// Plugin Management
// ============================================

/**
 * Add a new external plugin
 */
export async function addPlugin(path: string): Promise<AddPluginResult> {
  if (!currentConfigPath) {
    return { success: false, error: 'No config path set' }
  }

  const pluginPath = isAbsolute(path) ? path : resolve(dirname(currentConfigPath), path)

  // Verify plugin directory exists and has valid manifest
  try {
    const manifest = await readManifest(pluginPath)

    // Check if already exists
    const config = await readConfig(currentConfigPath)
    const existing = config.plugins?.find((p) => p.id === manifest.id)
    if (existing) {
      return { success: false, error: `Plugin "${manifest.id}" already exists` }
    }

    // Check if conflicts with bundled
    if (bundledPluginIds.has(manifest.id)) {
      return { success: false, error: `Plugin ID "${manifest.id}" conflicts with bundled plugin` }
    }

    // Add to config
    if (!config.plugins) config.plugins = []
    config.plugins.push({
      id: manifest.id,
      path: pluginPath,
      enabled: true,
    })

    await writeConfig(currentConfigPath, config)

    // Load the plugin
    const info = await loadPluginEntry(
      { id: manifest.id, path: pluginPath, enabled: true },
      dirname(currentConfigPath),
    )
    loadedPlugins.push(info)

    return { success: true, plugin: info }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err)
    return { success: false, error: errorMsg }
  }
}

/**
 * Remove an external plugin
 */
export async function removePlugin(
  pluginId: string,
  deleteFiles = false,
): Promise<{ success: boolean; error?: string }> {
  if (!currentConfigPath) {
    return { success: false, error: 'No config path set' }
  }

  // Check if bundled
  if (bundledPluginIds.has(pluginId)) {
    return { success: false, error: 'Cannot remove bundled plugin' }
  }

  const pluginInfo = loadedPlugins.find((p) => p.id === pluginId)
  if (!pluginInfo) {
    return { success: false, error: `Plugin "${pluginId}" not found` }
  }

  // Remove from config
  const config = await readConfig(currentConfigPath)
  config.plugins = config.plugins?.filter((p) => p.id !== pluginId) || []
  await writeConfig(currentConfigPath, config)

  // Stop it now: data sources of this type must not keep running its code
  pluginRegistry.unregister(pluginId)

  // Remove from loaded list
  loadedPlugins = loadedPlugins.filter((p) => p.id !== pluginId)

  // Optionally delete files
  if (deleteFiles && pluginInfo.path) {
    try {
      await rm(pluginInfo.path, { recursive: true })
    } catch (err) {
      console.warn(`[Plugins] Failed to delete plugin files: ${err}`)
    }
  }

  console.log(`[Plugins] Removed: ${pluginId}`)
  return { success: true }
}

/**
 * Enable or disable an external plugin
 */
export async function setPluginEnabled(
  pluginId: string,
  enabled: boolean,
): Promise<{ success: boolean; error?: string }> {
  if (!currentConfigPath) {
    return { success: false, error: 'No config path set' }
  }

  // Check if bundled
  if (bundledPluginIds.has(pluginId)) {
    return { success: false, error: 'Cannot modify bundled plugin' }
  }

  // Update config
  const config = await readConfig(currentConfigPath)
  const entry = config.plugins?.find((p) => p.id === pluginId)
  if (!entry) {
    return { success: false, error: `Plugin "${pluginId}" not found in config` }
  }

  entry.enabled = enabled
  await writeConfig(currentConfigPath, config)

  // Reload to apply changes
  await reloadPlugins()

  return { success: true }
}

/**
 * Install plugin from URL
 * Supports: ZIP files, tar.gz files, and git repositories
 */
export async function installPluginFromUrl(
  url: string,
  pluginsDir: string,
  subdirectory?: string,
): Promise<AddPluginResult> {
  if (!isHttpsUrl(url)) {
    return { success: false, error: 'Plugin URL must be an https: URL' }
  }

  try {
    console.log(`[Plugins] Installing from URL: ${url}`)

    // Determine type from URL
    const urlLower = url.toLowerCase()
    const isZip = urlLower.endsWith('.zip') || urlLower.includes('/archive/')
    const isTarGz = urlLower.endsWith('.tar.gz') || urlLower.endsWith('.tgz')
    const isGit =
      urlLower.endsWith('.git') ||
      urlLower.includes('github.com') ||
      urlLower.includes('gitlab.com')

    if (isZip || (!isTarGz && !isGit)) {
      // Download as ZIP
      const response = await fetch(url)
      if (!response.ok) {
        return { success: false, error: `Failed to download: HTTP ${response.status}` }
      }
      const buffer = Buffer.from(await response.arrayBuffer())
      return installPluginFromZip(buffer, pluginsDir, subdirectory)
    }

    if (isTarGz) {
      // Download and extract tar.gz
      const response = await fetch(url)
      if (!response.ok) {
        return { success: false, error: `Failed to download: HTTP ${response.status}` }
      }
      const buffer = Buffer.from(await response.arrayBuffer())
      return installPluginFromTarGz(buffer, pluginsDir, subdirectory)
    }

    if (isGit) {
      // Git clone
      return installPluginFromGit(url, pluginsDir, subdirectory)
    }

    return { success: false, error: 'Unsupported URL format' }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err)
    return { success: false, error: `Failed to install from URL: ${errorMsg}` }
  }
}

/**
 * Only https: reaches fetch or git. Other schemes would let a URL read the
 * Server's own files (file:) or pick a git transport that runs commands (ext::).
 */
function isHttpsUrl(url: string): boolean {
  return URL.parse(url)?.protocol === 'https:'
}

/**
 * Install plugin from tar.gz file
 */
async function installPluginFromTarGz(
  buffer: Buffer,
  pluginsDir: string,
  subdirectory?: string,
): Promise<AddPluginResult> {
  try {
    const { createGunzip } = await import('node:zlib')
    const { Readable } = await import('node:stream')
    const { pipeline } = await import('node:stream/promises')
    const tar = await import('tar')

    // Create temp directory for extraction
    const tempDir = join(pluginsDir, `.tmp-${Date.now()}`)
    await mkdir(tempDir, { recursive: true })

    try {
      // Extract tar.gz
      const gunzip = createGunzip()
      const extract = tar.extract({ cwd: tempDir })

      await pipeline(Readable.from(buffer), gunzip, extract)

      // Find plugin.json
      const { findPluginRoot, movePluginToFinal } = await getPluginHelpers()
      const pluginRoot = await findPluginRoot(tempDir, subdirectory)

      if (!pluginRoot) {
        return { success: false, error: 'Could not find plugin.json in archive' }
      }

      // Read manifest to get plugin ID
      const manifest = await readManifest(pluginRoot)
      const finalPath = installPathFor(pluginsDir, manifest.id)

      // Move to final location
      await movePluginToFinal(pluginRoot, finalPath)

      // Add the plugin
      return addPlugin(finalPath)
    } finally {
      // Cleanup temp directory
      try {
        await rm(tempDir, { recursive: true })
      } catch {
        // Ignore cleanup errors
      }
    }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err)
    return { success: false, error: `Failed to extract tar.gz: ${errorMsg}` }
  }
}

/**
 * Install plugin from git repository
 */
async function installPluginFromGit(
  gitUrl: string,
  pluginsDir: string,
  subdirectory?: string,
): Promise<AddPluginResult> {
  try {
    const { execFile } = await import('node:child_process')
    const { promisify } = await import('node:util')

    // Create temp directory for clone
    const tempDir = join(pluginsDir, `.tmp-git-${Date.now()}`)
    await mkdir(tempDir, { recursive: true })

    try {
      // No shell: the URL reaches git as one argument, and `--` keeps it from
      // being read as an option.
      await promisify(execFile)('git', ['clone', '--depth', '1', '--', gitUrl, tempDir], {
        timeout: 60000, // 60 second timeout
      })

      // Find plugin root
      const { findPluginRoot, movePluginToFinal } = await getPluginHelpers()
      const pluginRoot = await findPluginRoot(tempDir, subdirectory)

      if (!pluginRoot) {
        return { success: false, error: 'Could not find plugin.json in repository' }
      }

      // Read manifest to get plugin ID
      const manifest = await readManifest(pluginRoot)
      const finalPath = installPathFor(pluginsDir, manifest.id)

      // Move to final location
      await movePluginToFinal(pluginRoot, finalPath)

      // Add the plugin
      return addPlugin(finalPath)
    } finally {
      // Cleanup temp directory
      try {
        await rm(tempDir, { recursive: true })
      } catch {
        // Ignore cleanup errors
      }
    }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err)
    return { success: false, error: `Failed to clone git repository: ${errorMsg}` }
  }
}

const PLUGIN_ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/

/**
 * Where an installed plugin lands: `<pluginsDir>/<id>`. The id comes from the
 * downloaded plugin.json, and the install deletes (tar.gz, git) or writes into
 * (ZIP) that directory, so an id that is not a plain name (`..`, `/`) would
 * reach outside pluginsDir. Only install checks this; loading an installed
 * plugin never builds a path from its id.
 */
function installPathFor(pluginsDir: string, id: string): string {
  if (!PLUGIN_ID_PATTERN.test(id)) {
    throw new Error(
      `plugin.json id "${id}" must be lowercase letters, digits and hyphens (up to 64 characters)`,
    )
  }
  return join(pluginsDir, id)
}

/**
 * Resolve `path` against `base`, refusing any result outside `base`. Paths
 * taken from a downloaded plugin (archive entry names, plugin.json fields) or
 * from the API go through this before touching the filesystem.
 */
function resolveInside(base: string, path: string): string {
  const target = resolve(base, path)
  const fromBase = relative(base, target)
  if (fromBase === '..' || fromBase.startsWith(`..${sep}`) || isAbsolute(fromBase)) {
    throw new Error(`Path "${path}" points outside ${base}`)
  }
  return target
}

/** Refuse existing links before reading or writing paths supplied by a plugin. */
async function rejectSymbolicLinks(base: string, target: string): Promise<void> {
  const root = resolve(base)
  resolveInside(root, target)
  const parts = relative(root, target).split(sep).filter(Boolean)
  let current = root
  for (const part of ['', ...parts]) {
    current = join(current, part)
    try {
      if ((await lstat(current)).isSymbolicLink()) {
        throw new Error(`Symbolic link is not allowed: ${current}`)
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') continue
      throw error
    }
  }
}

/**
 * Helper functions for plugin installation
 */
async function getPluginHelpers() {
  const { readdir, cp } = await import('node:fs/promises')

  /**
   * Find the directory containing plugin.json
   */
  async function findPluginRoot(baseDir: string, subdirectory?: string): Promise<string | null> {
    // If subdirectory specified, look there first. It comes from the API
    // caller, so it must stay inside the extracted archive.
    if (subdirectory) {
      const subPath = resolveInside(baseDir, subdirectory)
      await rejectSymbolicLinks(baseDir, subPath)
      try {
        await stat(join(subPath, 'plugin.json'))
        return subPath
      } catch {
        // Not found in subdirectory
      }
    }

    // Check base directory
    try {
      await stat(join(baseDir, 'plugin.json'))
      return baseDir
    } catch {
      // Not in base
    }

    // Search one level deep (common for archives that have a root folder)
    const entries = await readdir(baseDir, { withFileTypes: true })
    for (const entry of entries) {
      if (entry.isDirectory() && !entry.name.startsWith('.')) {
        const dirPath = join(baseDir, entry.name)

        // Check if subdirectory is inside this folder
        if (subdirectory) {
          const subPath = resolveInside(dirPath, subdirectory)
          await rejectSymbolicLinks(baseDir, subPath)
          try {
            await stat(join(subPath, 'plugin.json'))
            return subPath
          } catch {
            // Continue searching
          }
        }

        // Check this directory directly
        try {
          await stat(join(dirPath, 'plugin.json'))
          return dirPath
        } catch {
          // Continue searching
        }
      }
    }

    return null
  }

  /**
   * Move plugin to final location
   */
  async function movePluginToFinal(source: string, destination: string): Promise<void> {
    // Remove existing if present
    try {
      await rm(destination, { recursive: true })
    } catch {
      // Didn't exist
    }

    // Copy to final location. Symbolic links from the archive or repository
    // are dropped: one could point the plugin's files anywhere on the Server.
    await cp(source, destination, {
      recursive: true,
      filter: async (path) => !(await lstat(path)).isSymbolicLink(),
    })
  }

  return { findPluginRoot, movePluginToFinal }
}

/**
 * Install plugin from ZIP file
 */
export async function installPluginFromZip(
  zipBuffer: Buffer,
  pluginsDir: string,
  subdirectory?: string,
): Promise<AddPluginResult> {
  try {
    const { default: AdmZip } = await import('adm-zip')
    const zip = new AdmZip(zipBuffer)
    const entries = zip.getEntries()

    // Find plugin.json, considering subdirectory if specified
    const manifestEntry = entries.find((e) => {
      if (subdirectory) {
        // Look for plugin.json inside the subdirectory
        return (
          e.entryName.includes(`${subdirectory}/plugin.json`) ||
          e.entryName.includes(`${subdirectory}\\plugin.json`)
        )
      }
      return e.entryName.endsWith('plugin.json')
    })

    if (!manifestEntry) {
      return {
        success: false,
        error: `ZIP does not contain plugin.json${subdirectory ? ` in ${subdirectory}` : ''}`,
      }
    }

    const manifestJson = manifestEntry.getData().toString('utf-8')
    const manifest = JSON.parse(manifestJson) as PluginManifest

    if (!manifest.id) {
      return { success: false, error: 'plugin.json missing id field' }
    }

    const pluginPath = installPathFor(pluginsDir, manifest.id)

    // Determine root directory for extraction
    // This is the path prefix to strip from entry names
    const manifestDir = manifestEntry.entryName.replace(/plugin\.json$/, '')

    // Only extract files that are within the plugin directory. Every target
    // is checked before anything is written, so a bad entry leaves no files.
    const files = entries
      .filter((entry) => !entry.isDirectory && entry.entryName.startsWith(manifestDir))
      .map((entry) => ({ entry, relativePath: entry.entryName.slice(manifestDir.length) }))
      .filter(({ relativePath }) => relativePath !== '')
      .map(({ entry, relativePath }) => ({
        entry,
        targetPath: resolveInside(pluginPath, relativePath),
      }))

    for (const { targetPath } of files) {
      await rejectSymbolicLinks(pluginsDir, targetPath)
    }
    await mkdir(pluginPath, { recursive: true })
    for (const { entry, targetPath } of files) {
      await mkdir(dirname(targetPath), { recursive: true })
      await writeFile(targetPath, entry.getData())
    }

    // Add the plugin
    return addPlugin(pluginPath)
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err)
    return { success: false, error: `Failed to extract ZIP: ${errorMsg}` }
  }
}

// ============================================
// Query Functions
// ============================================

/**
 * Get list of all plugins (bundled + external)
 */
export function getAllPlugins(): LoadedPluginInfo[] {
  // Get bundled plugins from registry
  const bundledPlugins: LoadedPluginInfo[] = []
  for (const reg of pluginRegistry.getRegisteredTypes()) {
    if (bundledPluginIds.has(reg.type)) {
      bundledPlugins.push({
        id: reg.type,
        name: reg.displayName,
        version: reg.version ?? 'bundled',
        path: '',
        capabilities: [...reg.capabilities],
        // Bundled plugins now self-describe via registerDescriptor, so their
        // schemas flow through the registry the same as external plugins'.
        configSchema: reg.configSchema,
        optionsSchema: reg.optionsSchema,
        enabled: true,
        bundled: true,
      })
    }
  }

  return [...bundledPlugins, ...loadedPlugins]
}

/**
 * Get list of loaded external plugins only
 */
export function getLoadedPlugins(): readonly LoadedPluginInfo[] {
  return loadedPlugins
}

/**
 * Check if a plugin is external (vs bundled)
 */
export function isExternalPlugin(pluginId: string): boolean {
  return loadedPlugins.some((p) => p.id === pluginId)
}

/**
 * Get plugin manifest for an external plugin
 */
export async function getPluginManifest(pluginId: string): Promise<PluginManifest | null> {
  const info = loadedPlugins.find((p) => p.id === pluginId)
  if (!info) {
    return null
  }

  try {
    return await readManifest(info.path)
  } catch {
    return null
  }
}

/**
 * Get plugins directory (parent of config file)
 */
export function getPluginsDir(): string | null {
  if (!currentConfigPath) return null
  return dirname(currentConfigPath)
}

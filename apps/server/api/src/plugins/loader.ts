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

import { readFile, writeFile, stat, mkdir, rm } from 'node:fs/promises'
import { join, resolve, isAbsolute, dirname } from 'node:path'
import { load as parseYaml, dump as dumpYaml } from 'js-yaml'
import type { PluginManifest } from './types.js'
import { pluginRegistry } from './registry.js'

// ============================================
// Types
// ============================================

/**
 * Entry in plugins.yaml
 */
export interface PluginEntry {
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
  enabled: boolean
  builtin: boolean
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

/** Builtin plugin IDs (registered before external plugins) */
const builtinPluginIds = new Set<string>()

// ============================================
// Builtin Plugin Tracking
// ============================================

/**
 * Mark current registered plugins as builtin
 * Call this after registerBuiltinPlugins() and before loading external plugins
 */
export function markBuiltinPlugins(): void {
  builtinPluginIds.clear()
  for (const reg of pluginRegistry.getRegisteredTypes()) {
    builtinPluginIds.add(reg.type)
  }
}

/**
 * Check if a plugin ID is builtin
 */
export function isBuiltinPlugin(pluginId: string): boolean {
  return builtinPluginIds.has(pluginId)
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

  // Mark builtin plugins before loading externals
  markBuiltinPlugins()

  const config = await readConfig(configPath)

  if (!config.plugins || config.plugins.length === 0) {
    console.log('[Plugins] No external plugins configured')
    return []
  }

  console.log('[Plugins] Loading external plugins from:', configPath)

  const configDir = resolve(configPath, '..')
  const results: LoadedPluginInfo[] = []

  for (const entry of config.plugins) {
    const info = await loadPluginEntry(entry, configDir)
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
async function loadPluginEntry(entry: PluginEntry, configDir: string): Promise<LoadedPluginInfo> {
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
        enabled: false,
        builtin: false,
      }
    } catch {
      return {
        id: entry.id,
        name: entry.id,
        version: 'unknown',
        path: pluginPath,
        capabilities: [],
        enabled: false,
        builtin: false,
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

    // Load entry point module
    const entryFile = manifest.entry || 'index.js'
    const modulePath = join(pluginPath, entryFile)

    try {
      await stat(modulePath)
    } catch {
      throw new Error(`Entry point not found: ${modulePath}`)
    }

    // Import the module (with cache busting for reload)
    const moduleUrl = `file://${modulePath}?t=${Date.now()}`
    const module = await import(moduleUrl)

    // Validate and call register function
    if (typeof module.register !== 'function') {
      throw new Error(`Plugin module does not export a register() function`)
    }

    // Register the plugin
    module.register(pluginRegistry)

    console.log(`[Plugins] Loaded: ${manifest.id} v${manifest.version} (${manifest.name})`)

    return {
      id: manifest.id,
      name: manifest.name,
      version: manifest.version,
      path: pluginPath,
      capabilities: manifest.capabilities,
      configSchema: manifest.configSchema,
      enabled: true,
      builtin: false,
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
      builtin: false,
      error: errorMsg,
    }
  }
}

/**
 * Read plugin manifest from directory
 */
async function readManifest(pluginPath: string): Promise<PluginManifest> {
  const manifestPath = join(pluginPath, 'plugin.json')
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

  // Clear cached instances for external plugins
  for (const plugin of loadedPlugins) {
    if (!plugin.builtin) {
      pluginRegistry.removeInstance(plugin.id)
    }
  }

  // Clear external plugin registrations
  // Note: We can't truly unregister, but we'll overwrite on reload
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

    // Check if conflicts with builtin
    if (builtinPluginIds.has(manifest.id)) {
      return { success: false, error: `Plugin ID "${manifest.id}" conflicts with builtin plugin` }
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

  // Check if builtin
  if (builtinPluginIds.has(pluginId)) {
    return { success: false, error: 'Cannot remove builtin plugin' }
  }

  const pluginInfo = loadedPlugins.find((p) => p.id === pluginId)
  if (!pluginInfo) {
    return { success: false, error: `Plugin "${pluginId}" not found` }
  }

  // Remove from config
  const config = await readConfig(currentConfigPath)
  config.plugins = config.plugins?.filter((p) => p.id !== pluginId) || []
  await writeConfig(currentConfigPath, config)

  // Remove cached instance
  pluginRegistry.removeInstance(pluginId)

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

  // Check if builtin
  if (builtinPluginIds.has(pluginId)) {
    return { success: false, error: 'Cannot modify builtin plugin' }
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
      const finalPath = join(pluginsDir, manifest.id)

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
    const { execSync } = await import('node:child_process')

    // Create temp directory for clone
    const tempDir = join(pluginsDir, `.tmp-git-${Date.now()}`)
    await mkdir(tempDir, { recursive: true })

    try {
      // Git clone with depth 1
      execSync(`git clone --depth 1 "${gitUrl}" "${tempDir}"`, {
        stdio: 'pipe',
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
      const finalPath = join(pluginsDir, manifest.id)

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

/**
 * Helper functions for plugin installation
 */
async function getPluginHelpers() {
  const { readdir, cp } = await import('node:fs/promises')

  /**
   * Find the directory containing plugin.json
   */
  async function findPluginRoot(baseDir: string, subdirectory?: string): Promise<string | null> {
    // If subdirectory specified, look there first
    if (subdirectory) {
      const subPath = join(baseDir, subdirectory)
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
          const subPath = join(dirPath, subdirectory)
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

    // Copy to final location
    await cp(source, destination, { recursive: true })
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
    let manifestEntry = entries.find((e) => {
      if (subdirectory) {
        // Look for plugin.json inside the subdirectory
        return (
          e.entryName.includes(subdirectory + '/plugin.json') ||
          e.entryName.includes(subdirectory + '\\plugin.json')
        )
      }
      return e.entryName.endsWith('plugin.json')
    })

    if (!manifestEntry) {
      return {
        success: false,
        error: 'ZIP does not contain plugin.json' + (subdirectory ? ` in ${subdirectory}` : ''),
      }
    }

    const manifestJson = manifestEntry.getData().toString('utf-8')
    const manifest = JSON.parse(manifestJson) as PluginManifest

    if (!manifest.id) {
      return { success: false, error: 'plugin.json missing id field' }
    }

    // Create plugin directory
    const pluginPath = join(pluginsDir, manifest.id)
    await mkdir(pluginPath, { recursive: true })

    // Determine root directory for extraction
    // This is the path prefix to strip from entry names
    const manifestDir = manifestEntry.entryName.replace(/plugin\.json$/, '')

    for (const entry of entries) {
      if (entry.isDirectory) continue

      // Only extract files that are within the plugin directory
      if (!entry.entryName.startsWith(manifestDir)) continue

      const relativePath = entry.entryName.slice(manifestDir.length)
      if (!relativePath) continue

      const targetPath = join(pluginPath, relativePath)
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
 * Get list of all plugins (builtin + external)
 */
export function getAllPlugins(): LoadedPluginInfo[] {
  // Get builtin plugins from registry
  const builtinPlugins: LoadedPluginInfo[] = []
  for (const reg of pluginRegistry.getRegisteredTypes()) {
    if (builtinPluginIds.has(reg.type)) {
      builtinPlugins.push({
        id: reg.type,
        name: reg.displayName,
        version: 'builtin',
        path: '',
        capabilities: [...reg.capabilities],
        enabled: true,
        builtin: true,
      })
    }
  }

  return [...builtinPlugins, ...loadedPlugins]
}

/**
 * Get list of loaded external plugins only
 */
export function getLoadedPlugins(): readonly LoadedPluginInfo[] {
  return loadedPlugins
}

/**
 * Check if a plugin is external (vs builtin)
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

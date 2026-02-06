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
    const info = await loadPluginEntry({ id: manifest.id, path: pluginPath, enabled: true }, dirname(currentConfigPath))
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
export async function removePlugin(pluginId: string, deleteFiles = false): Promise<{ success: boolean; error?: string }> {
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
export async function setPluginEnabled(pluginId: string, enabled: boolean): Promise<{ success: boolean; error?: string }> {
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
 * Install plugin from ZIP file
 */
export async function installPluginFromZip(
  zipBuffer: Buffer,
  pluginsDir: string,
): Promise<AddPluginResult> {
  // Extract ZIP to temp location, validate, then move to plugins dir
  // For now, we'll use a simple approach with AdmZip or similar

  try {
    const { default: AdmZip } = await import('adm-zip')
    const zip = new AdmZip(zipBuffer)
    const entries = zip.getEntries()

    // Find plugin.json to get plugin ID
    const manifestEntry = entries.find((e) => e.entryName.endsWith('plugin.json'))
    if (!manifestEntry) {
      return { success: false, error: 'ZIP does not contain plugin.json' }
    }

    const manifestJson = manifestEntry.getData().toString('utf-8')
    const manifest = JSON.parse(manifestJson) as PluginManifest

    if (!manifest.id) {
      return { success: false, error: 'plugin.json missing id field' }
    }

    // Create plugin directory
    const pluginPath = join(pluginsDir, manifest.id)
    await mkdir(pluginPath, { recursive: true })

    // Extract files
    // Handle both flat and nested ZIP structures
    const rootDir = manifestEntry.entryName.replace('plugin.json', '')
    for (const entry of entries) {
      if (entry.isDirectory) continue

      const relativePath = entry.entryName.startsWith(rootDir)
        ? entry.entryName.slice(rootDir.length)
        : entry.entryName

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

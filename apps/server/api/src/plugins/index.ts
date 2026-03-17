/**
 * Plugins Module
 *
 * Data source plugin system for Shumoku.
 */

export * from './types.js'
export * from './registry.js'
export {
  // Types
  type PluginEntry,
  type LoadedPluginInfo,
  type AddPluginResult,
  // Functions
  loadPluginsFromConfig,
  reloadPlugins,
  addPlugin,
  removePlugin,
  setPluginEnabled,
  installPluginFromZip,
  installPluginFromUrl,
  getAllPlugins,
  getLoadedPlugins,
  getPluginManifest,
  getPluginsDir,
  getConfigPath,
  isExternalPlugin,
  isBundledPlugin,
  markBundledPlugins,
} from './loader.js'

// Re-export plugin classes from bundled plugins
export { NetBoxPlugin } from 'shumoku-plugin-netbox'
export { ZabbixPlugin } from 'shumoku-plugin-zabbix'
export { PrometheusPlugin } from 'shumoku-plugin-prometheus'
export { GrafanaPlugin } from 'shumoku-plugin-grafana'

// Register bundled plugins
import { pluginRegistry } from './registry.js'
import { register as registerNetBox } from 'shumoku-plugin-netbox'
import { register as registerZabbix } from 'shumoku-plugin-zabbix'
import { register as registerPrometheus } from 'shumoku-plugin-prometheus'
import { register as registerGrafana } from 'shumoku-plugin-grafana'

export function registerBundledPlugins(): void {
  registerNetBox(pluginRegistry)
  registerZabbix(pluginRegistry)
  registerPrometheus(pluginRegistry)
  registerGrafana(pluginRegistry)

  console.log('[Plugins] Bundled plugins registered')
}

/**
 * Plugins Module
 *
 * Data source plugin system for Shumoku.
 */

export { GrafanaPlugin } from 'shumoku-plugin-grafana'
// Re-export plugin classes from bundled plugins
export { NetBoxPlugin } from 'shumoku-plugin-netbox'
export { PrometheusPlugin } from 'shumoku-plugin-prometheus'
export { ZabbixPlugin } from 'shumoku-plugin-zabbix'
export {
  addPlugin,
  getAllPlugins,
  getConfigPath,
  getLoadedPlugins,
  getPluginManifest,
  getPluginsDir,
  installPluginFromUrl,
  installPluginFromZip,
  isBundledPlugin,
  isExternalPlugin,
  loadPluginsFromConfig,
  markBundledPlugins,
  reloadPlugins,
  removePlugin,
  setPluginEnabled,
} from './loader.js'
export * from './registry.js'
export * from './types.js'

import { register as registerGrafana } from 'shumoku-plugin-grafana'
import { register as registerNetBox } from 'shumoku-plugin-netbox'
import { register as registerPrometheus } from 'shumoku-plugin-prometheus'
import { register as registerZabbix } from 'shumoku-plugin-zabbix'
// Register bundled plugins
import { pluginRegistry } from './registry.js'

export function registerBundledPlugins(): void {
  registerNetBox(pluginRegistry)
  registerZabbix(pluginRegistry)
  registerPrometheus(pluginRegistry)
  registerGrafana(pluginRegistry)

  console.log('[Plugins] Bundled plugins registered')
}

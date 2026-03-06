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
export { NetBoxPlugin } from '../../../plugins/netbox/index.js'
export { ZabbixPlugin } from '../../../plugins/zabbix/index.js'
export { PrometheusPlugin } from '../../../plugins/prometheus/index.js'
export { GrafanaPlugin } from '../../../plugins/grafana/index.js'

// Register bundled plugins
import { pluginRegistry } from './registry.js'
import { register as registerNetBox } from '../../../plugins/netbox/index.js'
import { register as registerZabbix } from '../../../plugins/zabbix/index.js'
import { register as registerPrometheus } from '../../../plugins/prometheus/index.js'
import { register as registerGrafana } from '../../../plugins/grafana/index.js'

export function registerBundledPlugins(): void {
  registerNetBox(pluginRegistry)
  registerZabbix(pluginRegistry)
  registerPrometheus(pluginRegistry)
  registerGrafana(pluginRegistry)

  console.log('[Plugins] Bundled plugins registered')
}

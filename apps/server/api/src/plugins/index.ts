/**
 * Plugins Module
 *
 * Data source plugin system for Shumoku.
 */

export { ArubaInstantOnPlugin } from 'shumoku-plugin-aruba-instant-on'
export { GrafanaPlugin } from 'shumoku-plugin-grafana'
// Re-export plugin classes from bundled plugins
export { NetBoxPlugin } from 'shumoku-plugin-netbox'
export { PrometheusPlugin } from 'shumoku-plugin-prometheus'
export { SnmpLldpPlugin } from 'shumoku-plugin-snmp-lldp'
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

import { register as registerArubaInstantOn } from 'shumoku-plugin-aruba-instant-on'
import { register as registerGrafana } from 'shumoku-plugin-grafana'
import { register as registerNetBox } from 'shumoku-plugin-netbox'
import { register as registerPrometheus } from 'shumoku-plugin-prometheus'
import { register as registerSnmpLldp } from 'shumoku-plugin-snmp-lldp'
import { register as registerZabbix } from 'shumoku-plugin-zabbix'
import { registerManualPlugin } from './manual-plugin.js'
// Register bundled plugins
import { pluginRegistry } from './registry.js'

export function registerBundledPlugins(): void {
  registerManualPlugin(pluginRegistry)
  registerNetBox(pluginRegistry)
  registerZabbix(pluginRegistry)
  registerPrometheus(pluginRegistry)
  registerGrafana(pluginRegistry)
  registerArubaInstantOn(pluginRegistry)
  registerSnmpLldp(pluginRegistry)

  console.log('[Plugins] Bundled plugins registered')
}

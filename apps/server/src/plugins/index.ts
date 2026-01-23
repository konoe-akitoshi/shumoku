/**
 * Plugins Module
 *
 * Data source plugin system for Shumoku.
 */

export * from './types.js'
export * from './registry.js'
export { ZabbixPlugin } from './zabbix.js'
export { NetBoxPlugin } from './netbox.js'

// Register built-in plugins
import { pluginRegistry } from './registry.js'
import { ZabbixPlugin } from './zabbix.js'
import { NetBoxPlugin } from './netbox.js'

export function registerBuiltinPlugins(): void {
  // Zabbix - metrics, hosts, auto-mapping
  pluginRegistry.register('zabbix', 'Zabbix', ['metrics', 'hosts', 'auto-mapping'], (config) => {
    const plugin = new ZabbixPlugin()
    plugin.initialize(config)
    return plugin
  })

  // NetBox - topology, hosts
  pluginRegistry.register('netbox', 'NetBox', ['topology', 'hosts'], (config) => {
    const plugin = new NetBoxPlugin()
    plugin.initialize(config)
    return plugin
  })

  // TODO: Prometheus - metrics
  // pluginRegistry.register('prometheus', 'Prometheus', ['metrics'], (config) => {
  //   const plugin = new PrometheusPlugin()
  //   plugin.initialize(config)
  //   return plugin
  // })

  console.log('[Plugins] Built-in plugins registered')
}

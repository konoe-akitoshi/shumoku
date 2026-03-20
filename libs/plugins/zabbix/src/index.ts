export { ZabbixPlugin } from './plugin.js'
export type { ZabbixHost, ZabbixItem, ZabbixPluginConfig } from './types.js'

import type { PluginRegistryInterface } from '@shumoku/core'
import { ZabbixPlugin } from './plugin.js'

export function register(registry: PluginRegistryInterface): void {
  registry.register(
    'zabbix',
    'Zabbix',
    ['metrics', 'hosts', 'auto-mapping', 'alerts'],
    (config) => {
      const plugin = new ZabbixPlugin()
      plugin.initialize(config)
      return plugin
    },
  )
}

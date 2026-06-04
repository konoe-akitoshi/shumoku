export { ZabbixPlugin } from './plugin.js'
export type { ZabbixHost, ZabbixItem, ZabbixPluginConfig } from './types.js'

import type { PluginConfigSchema, PluginRegistryInterface } from '@shumoku/core'
import { ZabbixPlugin } from './plugin.js'

/** Self-description: the host renders this form and validates config from it. */
const configSchema: PluginConfigSchema = {
  type: 'object',
  required: ['url', 'token'],
  properties: {
    url: {
      type: 'string',
      format: 'uri',
      title: 'Zabbix URL',
      placeholder: 'https://zabbix.example.com',
    },
    token: { type: 'string', format: 'password', title: 'API token' },
    insecure: {
      type: 'boolean',
      title: 'Skip TLS verification',
      default: false,
      warning: 'Disables certificate validation. Self-signed certs in trusted networks only.',
    },
    pollInterval: {
      type: 'number',
      title: 'Polling interval',
      default: 60000,
      oneOf: [
        { const: 5000, title: '5 seconds' },
        { const: 10000, title: '10 seconds' },
        { const: 30000, title: '30 seconds' },
        { const: 60000, title: '1 minute' },
        { const: 300000, title: '5 minutes' },
      ],
    },
  },
}

export function register(registry: PluginRegistryInterface): void {
  registry.registerDescriptor(
    {
      type: 'zabbix',
      displayName: 'Zabbix',
      capabilities: ['metrics', 'hosts', 'alerts'],
      configSchema,
    },
    (config) => {
      const plugin = new ZabbixPlugin()
      plugin.initialize(config)
      return plugin
    },
  )
}

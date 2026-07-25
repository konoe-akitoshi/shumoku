export { HuaweiNceCampusPlugin } from './plugin.js'
export type { HuaweiNceCampusConfig } from './types.js'

import type { PluginConfigSchema, PluginRegistryInterface } from '@shumoku/core'
import { HuaweiNceCampusPlugin } from './plugin.js'

/** Self-description: the host renders this form and validates config from it. */
const configSchema: PluginConfigSchema = {
  type: 'object',
  required: ['baseUrl', 'userName', 'password'],
  properties: {
    baseUrl: {
      type: 'string',
      format: 'uri',
      title: 'NBI base URL',
      placeholder: 'https://nce.example.com:18002',
      help: 'The controller northbound API base (default port 18002).',
    },
    userName: {
      type: 'string',
      title: 'Username',
      help: 'Third-party account attached to the NBI User Group role.',
    },
    password: { type: 'string', secret: true, title: 'Password' },
    siteId: {
      type: 'string',
      title: 'Site ID',
      help: 'Optional — scope topology and hosts to one site (UUID). Empty polls every site the account can see.',
    },
    insecure: {
      type: 'boolean',
      title: 'Skip TLS verification',
      default: false,
      warning:
        'Disables certificate validation. On-prem NCE controllers often serve a self-signed Huawei platform cert — trusted networks only.',
    },
  },
}

export function register(registry: PluginRegistryInterface): void {
  registry.registerDescriptor(
    {
      type: 'huawei-nce-campus',
      displayName: 'Huawei iMaster NCE-Campus',
      capabilities: ['topology', 'hosts', 'metrics', 'alerts'],
      configSchema,
    },
    (config) => {
      const plugin = new HuaweiNceCampusPlugin()
      plugin.initialize(config)
      return plugin
    },
  )
}

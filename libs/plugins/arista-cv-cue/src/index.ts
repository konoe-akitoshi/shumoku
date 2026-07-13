export { AristaCvCuePlugin } from './plugin.js'
export type { AristaCvCueConfig } from './types.js'

import type { PluginConfigSchema, PluginRegistryInterface } from '@shumoku/core'
import { AristaCvCuePlugin } from './plugin.js'

/** Self-description: the host renders this form and validates config from it. */
const configSchema: PluginConfigSchema = {
  type: 'object',
  required: ['baseUrl', 'keyId', 'keyValue'],
  properties: {
    baseUrl: {
      type: 'string',
      format: 'uri',
      title: 'API base URL',
      placeholder: 'https://awm17001-c4.srv.wifi.arista.com/wifi/api',
      help: 'The CV-CUE Open API base, ending in /wifi/api (per tenant/region).',
    },
    keyId: {
      type: 'string',
      title: 'API key ID',
      placeholder: 'KEY-XXXXXXXX-NN',
      help: 'From CV-CUE → Manage API Keys.',
    },
    keyValue: { type: 'string', secret: true, title: 'API key value' },
    customerId: {
      type: 'string',
      title: 'Customer ID (CID)',
      help: 'Only needed when the key has access to more than one customer.',
    },
    locationId: {
      type: 'number',
      title: 'Location ID',
      default: 0,
      help: 'Scope queries to a location subtree. 0 is the root.',
    },
  },
}

export function register(registry: PluginRegistryInterface): void {
  registry.registerDescriptor(
    {
      type: 'arista-cv-cue',
      displayName: 'Arista CV-CUE',
      capabilities: ['topology', 'hosts', 'metrics', 'alerts'],
      configSchema,
    },
    (config) => {
      const plugin = new AristaCvCuePlugin()
      plugin.initialize(config)
      return plugin
    },
  )
}

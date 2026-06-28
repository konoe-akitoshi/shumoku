export { ArubaInstantOnPlugin } from './plugin.js'
export type { ArubaInstantOnConfig } from './types.js'

import type { PluginConfigSchema, PluginRegistryInterface } from '@shumoku/core'
import { ArubaInstantOnPlugin } from './plugin.js'

/** Self-description: the host renders this form and validates config from it. */
const configSchema: PluginConfigSchema = {
  type: 'object',
  required: ['username', 'password'],
  properties: {
    username: {
      type: 'string',
      format: 'email',
      title: 'Portal email',
      warning: 'The account must NOT have MFA enabled.',
    },
    password: { type: 'string', secret: true, title: 'Password' },
    siteId: {
      type: 'string',
      title: 'Site ID',
      help: 'Leave blank to poll all sites the account can see.',
    },
  },
}

export function register(registry: PluginRegistryInterface): void {
  registry.registerDescriptor(
    {
      type: 'aruba-instant-on',
      displayName: 'Aruba Instant On',
      capabilities: ['hosts', 'metrics', 'alerts'],
      configSchema,
    },
    (config) => {
      const plugin = new ArubaInstantOnPlugin()
      plugin.initialize(config)
      return plugin
    },
  )
}

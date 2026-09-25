import type { PluginRegistryInterface } from '@shumoku/core'
import { configSchema } from './config.js'
import { NewRelicPlugin } from './plugin.js'

export type { NewRelicConfig } from './config.js'
export { NewRelicPlugin } from './plugin.js'

export function register(registry: PluginRegistryInterface): void {
  registry.registerDescriptor(
    {
      type: 'newrelic',
      displayName: 'New Relic',
      capabilities: ['topology', 'hosts', 'metrics', 'alerts'],
      configSchema,
      optionsSchema: {
        type: 'object',
        properties: {
          autoBindMetrics: {
            type: 'boolean',
            title: 'Bind monitoring on source sync',
            default: true,
            help: 'Bind this source’s hosts and ports automatically. Also attach this same data source for metrics. Manual overrides remain authoritative.',
          },
        },
      },
    },
    (config) => {
      const plugin = new NewRelicPlugin()
      plugin.initialize(config)
      return plugin
    },
  )
}

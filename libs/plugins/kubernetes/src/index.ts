import type { PluginRegistryInterface } from '@shumoku/core'
import { configSchema } from './config.js'
import { KubernetesPlugin } from './plugin.js'

export { KubernetesPlugin } from './plugin.js'
export function register(registry: PluginRegistryInterface): void {
  registry.registerDescriptor(
    { type: 'kubernetes', displayName: 'Kubernetes', capabilities: ['topology'], configSchema },
    (config) => {
      const plugin = new KubernetesPlugin()
      plugin.initialize(config)
      return plugin
    },
  )
}

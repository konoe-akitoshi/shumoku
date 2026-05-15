export { ArubaInstantOnPlugin } from './plugin.js'
export type { ArubaInstantOnConfig } from './types.js'

import type { PluginRegistryInterface } from '@shumoku/core'
import { ArubaInstantOnPlugin } from './plugin.js'

export function register(registry: PluginRegistryInterface): void {
  registry.register(
    'aruba-instant-on',
    'Aruba Instant On',
    ['hosts', 'metrics', 'alerts'],
    (config) => {
      const plugin = new ArubaInstantOnPlugin()
      plugin.initialize(config)
      return plugin
    },
  )
}

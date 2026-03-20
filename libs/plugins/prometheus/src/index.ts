export { PrometheusPlugin } from './plugin.js'
export type {
  PrometheusMetricPreset,
  PrometheusCustomMetrics,
  PrometheusPluginConfig,
  PrometheusNodeMapping,
  PrometheusLinkMapping,
} from './types.js'

import type { PluginRegistryInterface } from '@shumoku/core'
import { PrometheusPlugin } from './plugin.js'

export function register(registry: PluginRegistryInterface): void {
  registry.register('prometheus', 'Prometheus', ['metrics', 'hosts', 'alerts'], (config) => {
    const plugin = new PrometheusPlugin()
    plugin.initialize(config)
    return plugin
  })
}

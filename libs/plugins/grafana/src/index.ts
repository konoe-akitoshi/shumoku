export { buildTitle, filterLabels, GrafanaPlugin, mapSeverity, SEVERITY_ORDER } from './plugin.js'
export type {
  AlertStoreService,
  GrafanaPluginConfig,
  GrafanaWebhookAlert,
  GrafanaWebhookPayload,
} from './types.js'

import type { PluginRegistryInterface } from '@shumoku/core'
import { GrafanaPlugin } from './plugin.js'

export function register(registry: PluginRegistryInterface): void {
  registry.register('grafana', 'Grafana', ['alerts'], (config) => {
    const plugin = new GrafanaPlugin()
    plugin.initialize(config)
    return plugin
  })
}

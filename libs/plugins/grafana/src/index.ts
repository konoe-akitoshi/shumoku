export { GrafanaPlugin, mapSeverity, buildTitle, filterLabels, SEVERITY_ORDER } from './plugin.js'
export type {
  GrafanaPluginConfig,
  GrafanaWebhookPayload,
  GrafanaWebhookAlert,
  AlertStoreService,
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

export {
  buildTitle,
  filterLabels,
  GrafanaPlugin,
  isGrafanaWebhookPayload,
  mapSeverity,
  SEVERITY_ORDER,
} from './plugin.js'
export type {
  AlertStoreService,
  GrafanaPluginConfig,
  GrafanaWebhookAlert,
  GrafanaWebhookPayload,
} from './types.js'

import type { PluginConfigSchema, PluginRegistryInterface } from '@shumoku/core'
import { GrafanaPlugin } from './plugin.js'

/** Self-description: the host renders this form and validates config from it. */
const configSchema: PluginConfigSchema = {
  type: 'object',
  required: ['url', 'token'],
  properties: {
    url: { type: 'string', format: 'uri', title: 'Grafana URL' },
    token: { type: 'string', format: 'password', title: 'API token' },
    useWebhook: {
      type: 'boolean',
      title: 'Receive alerts via webhook',
      default: false,
      help: 'Push from Grafana instead of polling Alertmanager.',
    },
    webhookSecret: {
      type: 'string',
      format: 'password',
      title: 'Webhook secret',
      visibleWhen: { field: 'useWebhook', equals: true },
      help: 'Leave blank to auto-generate on save.',
    },
  },
}

export function register(registry: PluginRegistryInterface): void {
  registry.registerDescriptor(
    {
      type: 'grafana',
      displayName: 'Grafana',
      capabilities: ['alerts'],
      configSchema,
      // Declares webhook ingest → the host shows the generic /api/webhooks/:type/:id
      // URL (via getConnectionInfo). Wired in Phase 5 (F6).
      webhook: true,
    },
    (config) => {
      const plugin = new GrafanaPlugin()
      plugin.initialize(config)
      return plugin
    },
  )
}

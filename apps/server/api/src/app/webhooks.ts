import { isGrafanaWebhookPayload } from 'shumoku-plugin-grafana'
import { timingSafeEqualStr } from '../lib/webhook-guard.js'
import type { DataSourceService } from '../services/datasource.js'
import type { GrafanaAlertService } from '../services/grafana-alerts.js'
import type { ObservationsService } from '../services/observations.js'
import type { TopologyService } from '../services/topology.js'
import type { TopologySourcesService } from '../services/topology-sources.js'
import type { WebhookApplicationService, WebhookResult } from './services.js'

function failure(status: 400 | 401 | 404 | 500, error: string): WebhookResult {
  return { ok: false, status, error }
}

export function createWebhookApplicationService(dependencies: {
  topologies: TopologyService
  sources: TopologySourcesService
  dataSources: DataSourceService
  observations: ObservationsService
  grafanaAlerts: GrafanaAlertService
}): WebhookApplicationService {
  const { topologies, sources, dataSources, observations, grafanaAlerts } = dependencies
  return {
    async handle(type, id, secret, payload) {
      if (!secret) return failure(401, 'Missing webhook secret')
      if (type === 'topology') {
        const source = sources.get(id)
        if (!source || source.syncMode !== 'webhook' || !source.webhookSecret) {
          return failure(404, 'Unknown or non-webhook topology source')
        }
        if (!timingSafeEqualStr(secret, source.webhookSecret)) {
          return failure(401, 'Invalid webhook secret')
        }
        try {
          const graph = await dataSources.fetchTopologyWithOptionsJson(
            source.dataSourceId,
            source.optionsJson,
          )
          if (!graph) return failure(400, 'Data source does not support topology')
          const recorded = await observations.record({
            topologyId: source.topologyId,
            sourceId: source.dataSourceId,
            capturedAt: Date.now(),
            status: graph.nodes.length > 0 ? 'ok' : 'empty',
            graph,
          })
          if (recorded.contributionChanged) {
            topologies.clearCacheEntry(source.topologyId)
            topologies.precompute(source.topologyId)
          }
          sources.updateLastSynced(source.id)
          return {
            ok: true,
            value: {
              success: true,
              topologyId: source.topologyId,
              nodeCount: graph.nodes.length,
              linkCount: graph.links.length,
            },
          }
        } catch (error) {
          return failure(500, error instanceof Error ? error.message : 'Failed to process webhook')
        }
      }

      const dataSource = dataSources.get(id)
      if (!dataSource || dataSource.type !== type) return failure(404, 'Unknown webhook target')
      let configuredSecret: string | undefined
      try {
        configuredSecret = (JSON.parse(dataSource.configJson) as { webhookSecret?: string })
          .webhookSecret
      } catch {
        configuredSecret = undefined
      }
      if (!configuredSecret || !timingSafeEqualStr(secret, configuredSecret)) {
        return failure(401, 'Invalid webhook secret')
      }
      if (type !== 'grafana') {
        return failure(400, `Webhooks are not supported for data source type: ${type}`)
      }
      if (!isGrafanaWebhookPayload(payload)) {
        return failure(400, 'Invalid Grafana webhook payload')
      }
      try {
        return {
          ok: true,
          value: { success: true, alertCount: grafanaAlerts.upsertFromWebhook(id, payload) },
        }
      } catch (error) {
        return failure(500, error instanceof Error ? error.message : 'Failed to process webhook')
      }
    },
  }
}

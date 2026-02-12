/**
 * Webhook API Routes
 * Receives updates from external systems like NetBox
 */

import { Hono } from 'hono'
import { DataSourceService } from '../services/datasource.js'
import { GrafanaAlertService, type GrafanaWebhookPayload } from '../services/grafana-alerts.js'
import { TopologySourcesService } from '../services/topology-sources.js'
import { getTopologyService } from './topologies.js'

// Lazy initialization to avoid database access at module load time
let _topologySourcesService: TopologySourcesService | null = null
let _dataSourceService: DataSourceService | null = null

function getTopologySourcesService() {
  if (!_topologySourcesService) {
    _topologySourcesService = new TopologySourcesService()
  }
  return _topologySourcesService
}

function getDataSourceService() {
  if (!_dataSourceService) {
    _dataSourceService = new DataSourceService()
  }
  return _dataSourceService
}

// Store for WebSocket connections (will be set from server.ts)
let broadcastTopologyUpdate: ((topologyId: string, data: unknown) => void) | null = null

export function setWebhookBroadcaster(broadcaster: (topologyId: string, data: unknown) => void) {
  broadcastTopologyUpdate = broadcaster
}

export const webhooksApi = new Hono()

/**
 * Webhook endpoint for topology updates
 * POST /api/webhooks/topology/:secret
 *
 * NetBox webhook config should point to:
 * https://your-server/api/webhooks/topology/{webhook_secret}
 */
webhooksApi.post('/topology/:secret', async (c) => {
  const { secret } = c.req.param()

  // Find the topology data source by webhook secret
  const source = getTopologySourcesService().findByWebhookSecret(secret)
  if (!source) {
    console.log('[Webhook] Invalid secret received')
    return c.json({ error: 'Invalid webhook secret' }, 401)
  }

  if (source.syncMode !== 'webhook') {
    console.log('[Webhook] Source is not in webhook mode:', source.id)
    return c.json({ error: 'Webhook mode not enabled for this source' }, 400)
  }

  console.log(
    `[Webhook] Received update for topology ${source.topologyId} from source ${source.dataSourceId}`,
  )

  // Parse the webhook body (NetBox sends JSON with event details)
  let body: unknown
  try {
    body = await c.req.json()
    if (process.env.DEBUG) {
      console.log('[Webhook] Payload:', JSON.stringify(body, null, 2))
    }
  } catch {
    return c.json({ error: 'Invalid JSON payload' }, 400)
  }

  try {
    // Fetch fresh topology from data source (with per-source options)
    const graph = await getDataSourceService().fetchTopologyWithOptionsJson(
      source.dataSourceId,
      source.optionsJson,
    )
    if (!graph) {
      console.log('[Webhook] Data source does not support topology')
      return c.json({ error: 'Data source does not support topology' }, 400)
    }

    // Update topology content
    const contentJson = JSON.stringify(graph)
    const updated = await getTopologyService().update(source.topologyId, { contentJson })
    if (!updated) {
      console.log('[Webhook] Failed to update topology')
      return c.json({ error: 'Failed to update topology' }, 500)
    }

    // Update last synced timestamp
    getTopologySourcesService().updateLastSynced(source.id)

    console.log(
      `[Webhook] Topology ${source.topologyId} updated: ${graph.nodes?.length ?? 0} nodes, ${graph.links?.length ?? 0} links`,
    )

    // Broadcast update to connected WebSocket clients
    if (broadcastTopologyUpdate) {
      broadcastTopologyUpdate(source.topologyId, {
        type: 'topology_updated',
        topologyId: source.topologyId,
        nodeCount: graph.nodes?.length ?? 0,
        linkCount: graph.links?.length ?? 0,
        timestamp: Date.now(),
      })
    }

    return c.json({
      success: true,
      topologyId: source.topologyId,
      nodeCount: graph.nodes?.length ?? 0,
      linkCount: graph.links?.length ?? 0,
    })
  } catch (error) {
    console.error('[Webhook] Error processing webhook:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

/**
 * Webhook endpoint for Grafana alerts
 * POST /api/webhooks/grafana/:secret
 *
 * Grafana Contact Point (Webhook) should point to:
 * https://your-server/api/webhooks/grafana/{webhook_secret}
 */
webhooksApi.post('/grafana/:secret', async (c) => {
  const { secret } = c.req.param()

  // Find data source by webhook secret
  const dataSource = getDataSourceService().findByWebhookSecret(secret)
  if (!dataSource || dataSource.type !== 'grafana') {
    console.log('[Webhook/Grafana] Invalid secret received')
    return c.json({ error: 'Invalid webhook secret' }, 401)
  }

  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON payload' }, 400)
  }

  try {
    const alertService = new GrafanaAlertService()
    const count = alertService.upsertFromWebhook(dataSource.id, body as GrafanaWebhookPayload)

    console.log(`[Webhook/Grafana] Upserted ${count} alerts for data source ${dataSource.id}`)

    return c.json({ success: true, alertCount: count })
  } catch (error) {
    console.error('[Webhook/Grafana] Error processing webhook:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

/**
 * Health check for webhooks
 * GET /api/webhooks/health
 */
webhooksApi.get('/health', (c) => {
  return c.json({ status: 'ok' })
})

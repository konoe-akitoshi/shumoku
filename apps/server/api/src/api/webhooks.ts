/**
 * Webhook API Routes
 *
 * One generic ingress: POST /api/webhooks/:type/:id. The source is looked up by
 * its public id (NetBox topology source, or a data source like Grafana), and
 * the secret — supplied via the `X-Webhook-Secret` header or a `?secret=` query
 * param — is compared in constant time (timingSafeEqualStr). Dispatch is by
 * type: `topology` re-fetches the graph; a data-source plugin handles its own
 * payload (Grafana validates + upserts alerts).
 */

import type { Context } from 'hono'
import { Hono } from 'hono'
import { isGrafanaWebhookPayload } from 'shumoku-plugin-grafana'
import { timingSafeEqualStr } from '../lib/webhook-guard.js'
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

/** Secret from the `X-Webhook-Secret` header (preferred) or a `?secret=` query. */
function providedSecret(c: Context): string | null {
  return c.req.header('x-webhook-secret') || c.req.query('secret') || null
}

/**
 * Generic webhook ingress: POST /api/webhooks/:type/:id
 *
 * URL forms produced by the app:
 *   - topology: /api/webhooks/topology/{topologySourceId}?secret={secret}
 *   - grafana:  /api/webhooks/grafana/{dataSourceId}?secret={secret}
 */
webhooksApi.post('/:type/:id', async (c) => {
  const { type, id } = c.req.param()
  const secret = providedSecret(c)
  if (!secret) {
    return c.json({ error: 'Missing webhook secret' }, 401)
  }

  if (type === 'topology') {
    return handleTopologyWebhook(c, id, secret)
  }
  return handleDataSourceWebhook(c, type, id, secret)
})

/** NetBox-style topology webhook: re-fetch the source's graph and record it. */
async function handleTopologyWebhook(c: Context, id: string, secret: string) {
  const source = getTopologySourcesService().get(id)
  if (!source || source.syncMode !== 'webhook' || !source.webhookSecret) {
    return c.json({ error: 'Unknown or non-webhook topology source' }, 404)
  }
  if (!timingSafeEqualStr(secret, source.webhookSecret)) {
    return c.json({ error: 'Invalid webhook secret' }, 401)
  }

  try {
    const graph = await getDataSourceService().fetchTopologyWithOptionsJson(
      source.dataSourceId,
      source.optionsJson,
    )
    if (!graph) {
      return c.json({ error: 'Data source does not support topology' }, 400)
    }

    const { ObservationsService } = await import('../services/observations.js')
    const observations = new ObservationsService()
    const recorded = await observations.record({
      topologyId: source.topologyId,
      sourceId: source.dataSourceId,
      capturedAt: Date.now(),
      status: graph.nodes && graph.nodes.length > 0 ? 'ok' : 'empty',
      graph,
    })
    // No-change gate: an unchanged webhook push keeps the current artifact.
    if (recorded.contributionChanged) {
      getTopologyService().clearCacheEntry(source.topologyId)
      getTopologyService().precompute(source.topologyId)
    }
    getTopologySourcesService().updateLastSynced(source.id)

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
    console.error('[Webhook] Error processing topology webhook:', error)
    return c.json(
      { error: error instanceof Error ? error.message : 'Failed to process webhook' },
      500,
    )
  }
}

/** Data-source plugin webhook (currently Grafana alerts). */
async function handleDataSourceWebhook(c: Context, type: string, id: string, secret: string) {
  const dataSource = getDataSourceService().get(id)
  if (!dataSource || dataSource.type !== type) {
    return c.json({ error: 'Unknown webhook target' }, 404)
  }
  let config: { webhookSecret?: string }
  try {
    config = JSON.parse(dataSource.configJson)
  } catch {
    config = {}
  }
  if (!config.webhookSecret || !timingSafeEqualStr(secret, config.webhookSecret)) {
    return c.json({ error: 'Invalid webhook secret' }, 401)
  }

  if (type === 'grafana') {
    let body: unknown
    try {
      body = await c.req.json()
    } catch {
      return c.json({ error: 'Invalid JSON payload' }, 400)
    }
    // The plugin owns its webhook shape — validate before processing.
    if (!isGrafanaWebhookPayload(body)) {
      return c.json({ error: 'Invalid Grafana webhook payload' }, 400)
    }
    try {
      const count = new GrafanaAlertService().upsertFromWebhook(
        dataSource.id,
        body as GrafanaWebhookPayload,
      )
      return c.json({ success: true, alertCount: count })
    } catch (error) {
      console.error('[Webhook/Grafana] Error processing webhook:', error)
      return c.json(
        { error: error instanceof Error ? error.message : 'Failed to process webhook' },
        500,
      )
    }
  }

  return c.json({ error: `Webhooks are not supported for data source type: ${type}` }, 400)
}

/**
 * Health check for webhooks
 * GET /api/webhooks/health
 */
webhooksApi.get('/health', (c) => {
  return c.json({ status: 'ok' })
})

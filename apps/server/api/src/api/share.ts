/**
 * Share API
 * Public endpoints for viewing shared topologies and dashboards (no auth required).
 *
 * Two doors, one rule: anything returned here goes through a projection in
 * `share-projections.ts` (never a raw entity), and a dashboard token only
 * reaches the resources its layout references (resolved once by the
 * `resolveDashboardGrant` middleware, not re-checked per handler).
 */

import { type Context, Hono } from 'hono'
import { streamSSE } from 'hono/streaming'
import type { AlertQueryOptions } from '../plugins/types.js'
import { getLatestMetrics, liveSubscriberCount, subscribeMetrics } from '../services/metrics-hub.js'
import type { MetricsData } from '../types.js'
import { getDashboardService } from './dashboards.js'
import {
  publicAlert,
  publicDashboardLayout,
  publicMetrics,
  publicTopology,
  publicTopologyContext,
  publicTopologyGraph,
} from './share-projections.js'
import { buildRenderOutput, getDataSourceService, getTopologyService } from './topologies.js'

/** Global cap on concurrent share metric streams (single-instance backstop). */
const MAX_SHARE_METRIC_STREAMS = 200

/**
 * Stream a topology's live metrics to a token-bearing viewer over SSE, projected
 * by `publicMetrics`. Reads off the central poll cache (metrics-hub) — no second
 * poll. Sends the cached snapshot immediately, then the newest tick (coalesced —
 * back-pressure safe), with an idle ping; unsubscribes on abort.
 */
function streamTopologyMetrics(c: Context, topologyId: string) {
  c.header('Cache-Control', 'no-store')
  return streamSSE(c, async (stream) => {
    let aborted = false
    let pending: MetricsData | null = getLatestMetrics(topologyId) ?? null
    const unsub = subscribeMetrics(topologyId, (m) => {
      pending = m
    })
    stream.onAbort(() => {
      aborted = true
      unsub()
    })
    let idleTicks = 0
    while (!aborted) {
      if (pending) {
        const next = pending
        pending = null
        idleTicks = 0
        await stream.writeSSE({ data: JSON.stringify(publicMetrics(next)) })
      } else {
        idleTicks++
        if (idleTicks >= 15) {
          idleTicks = 0
          await stream.writeSSE({ event: 'ping', data: '' })
        }
      }
      await stream.sleep(1000)
    }
    unsub()
  })
}

/** Set of resources a dashboard token is allowed to reach, keyed by kind. */
interface ReachableSet {
  topologyIds: Set<string>
  dataSourceIds: Set<string>
}

type ShareVars = { reachable: ReachableSet }

/**
 * Resources a shared dashboard is allowed to expose. A share token grants
 * access ONLY to the topology/datasource ids the dashboard's widgets actually
 * reference — never the full server inventory. Requests for any other id are
 * 404'd so the token can't be used to enumerate or probe unrelated resources.
 */
function referencedIds(layoutJson: string): ReachableSet {
  const topologyIds = new Set<string>()
  const dataSourceIds = new Set<string>()
  try {
    const layout = JSON.parse(layoutJson) as {
      widgets?: { config?: Record<string, unknown> }[]
    }
    for (const widget of layout.widgets ?? []) {
      const topologyId = widget.config?.['topologyId']
      if (typeof topologyId === 'string') topologyIds.add(topologyId)
      const dataSourceId = widget.config?.['dataSourceId']
      if (typeof dataSourceId === 'string') dataSourceIds.add(dataSourceId)
    }
  } catch {
    // Malformed layout → expose nothing.
  }
  return { topologyIds, dataSourceIds }
}

export function createShareApi(): Hono<{ Variables: ShareVars }> {
  const app = new Hono<{ Variables: ShareVars }>()

  // Get shared topology context data
  app.get('/topologies/:token', async (c) => {
    const token = c.req.param('token')
    const service = getTopologyService()
    const topology = service.getByShareToken(token)
    if (!topology) {
      return c.json({ error: 'Not found' }, 404)
    }

    try {
      const parsed = await service.getParsed(topology.id)
      if (!parsed) {
        const parseError = service.getParseError(topology.id)
        if (parseError) {
          // Generic message: never surface internal parse/connection detail to an
          // anonymous viewer (it can carry config text / upstream errors).
          return c.json({ error: 'Topology is currently unavailable' }, 422)
        }
        return c.json({ error: 'Failed to parse topology' }, 500)
      }
      return c.json(publicTopologyContext(parsed))
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return c.json({ error: message }, 500)
    }
  })

  // Get shared topology as raw NetworkGraph (used by the new renderer).
  app.get('/topologies/:token/graph', async (c) => {
    const token = c.req.param('token')
    const service = getTopologyService()
    const topology = service.getByShareToken(token)
    if (!topology) {
      return c.json({ error: 'Not found' }, 404)
    }
    try {
      const parsed = await service.getParsed(topology.id)
      if (!parsed) {
        const parseError = service.getParseError(topology.id)
        if (parseError) {
          // Generic message: never surface internal parse/connection detail to an
          // anonymous viewer (it can carry config text / upstream errors).
          return c.json({ error: 'Topology is currently unavailable' }, 422)
        }
        return c.json({ error: 'Failed to parse topology' }, 500)
      }
      return c.json(publicTopologyGraph(parsed))
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return c.json({ error: message }, 500)
    }
  })

  // Get shared topology render output (legacy SVG-string pipeline).
  app.get('/topologies/:token/render', async (c) => {
    const token = c.req.param('token')
    const service = getTopologyService()
    const topology = service.getByShareToken(token)
    if (!topology) {
      return c.json({ error: 'Not found' }, 404)
    }

    try {
      const parsed = await service.getParsed(topology.id)
      if (!parsed) {
        const parseError = service.getParseError(topology.id)
        if (parseError) {
          // Generic message: never surface internal parse/connection detail to an
          // anonymous viewer (it can carry config text / upstream errors).
          return c.json({ error: 'Topology is currently unavailable' }, 422)
        }
        return c.json({ error: 'Failed to parse topology' }, 500)
      }
      return c.json(await buildRenderOutput(parsed))
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return c.json({ error: message }, 500)
    }
  })

  // Live metrics (SSE) for a shared topology link. Token-scoped + projected; reads
  // the central poll cache via the metrics-hub (no second poll). The token is in the
  // path like every other share route (consistent posture). Hardening — token
  // digests, short-lived stream tickets, per-IP caps — is the deferred auth work (#412).
  app.get('/topologies/:token/metrics/stream', (c) => {
    const topology = getTopologyService().getByShareToken(c.req.param('token'))
    if (!topology) return c.json({ error: 'Not found' }, 404)
    if (liveSubscriberCount() >= MAX_SHARE_METRIC_STREAMS) {
      return c.json({ error: 'Too many concurrent streams' }, 503)
    }
    return streamTopologyMetrics(c, topology.id)
  })

  // Get shared dashboard data
  app.get('/dashboards/:token', (c) => {
    const token = c.req.param('token')
    const service = getDashboardService()
    const dashboard = service.getByShareToken(token)
    if (!dashboard) {
      return c.json({ error: 'Not found' }, 404)
    }

    return c.json({
      id: dashboard.id,
      name: dashboard.name,
      // Allow-listed layout projection — never the raw extensible layoutJson.
      layoutJson: publicDashboardLayout(dashboard.layoutJson),
    })
  })

  // --- Token-scoped data for a shared dashboard's widgets ---
  // These let a shared dashboard render live widget data without a session
  // cookie. Access is gated twice: the token must resolve to a dashboard
  // (this middleware), and the requested id must be referenced by that
  // dashboard's layout (each handler checks `reachable`). Any miss → 404, so
  // the token can't enumerate unrelated resources.
  app.use('/dashboards/:token/*', async (c, next) => {
    const dashboard = getDashboardService().getByShareToken(c.req.param('token'))
    if (!dashboard) return c.json({ error: 'Not found' }, 404)
    c.set('reachable', referencedIds(dashboard.layoutJson))
    await next()
    return
  })

  // Topology metadata (name, mappingJson) for a widget in a shared dashboard.
  app.get('/dashboards/:token/topologies/:id', async (c) => {
    const id = c.req.param('id')
    if (!c.get('reachable').topologyIds.has(id)) return c.json({ error: 'Not found' }, 404)
    const topology = getTopologyService().get(id)
    if (!topology) return c.json({ error: 'Not found' }, 404)
    // Expose the RESOLVED mapping (node bindings live as attachments post-backfill).
    const parsed = await getTopologyService().getParsed(id)
    return c.json(publicTopology(topology, parsed?.mapping))
  })

  // Raw NetworkGraph for a topology widget in a shared dashboard.
  app.get('/dashboards/:token/topologies/:id/graph', async (c) => {
    const id = c.req.param('id')
    if (!c.get('reachable').topologyIds.has(id)) return c.json({ error: 'Not found' }, 404)
    const service = getTopologyService()
    try {
      const parsed = await service.getParsed(id)
      if (!parsed) {
        const parseError = service.getParseError(id)
        if (parseError) {
          // Generic message: never surface internal parse/connection detail to an
          // anonymous viewer (it can carry config text / upstream errors).
          return c.json({ error: 'Topology is currently unavailable' }, 422)
        }
        return c.json({ error: 'Failed to parse topology' }, 500)
      }
      return c.json(publicTopologyGraph(parsed))
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return c.json({ error: message }, 500)
    }
  })

  // Context (nodes/edges/metrics) for a device-status widget in a shared dashboard.
  app.get('/dashboards/:token/topologies/:id/context', async (c) => {
    const id = c.req.param('id')
    if (!c.get('reachable').topologyIds.has(id)) return c.json({ error: 'Not found' }, 404)
    const service = getTopologyService()
    try {
      const parsed = await service.getParsed(id)
      if (!parsed) {
        const parseError = service.getParseError(id)
        if (parseError) {
          // Generic message: never surface internal parse/connection detail to an
          // anonymous viewer (it can carry config text / upstream errors).
          return c.json({ error: 'Topology is currently unavailable' }, 422)
        }
        return c.json({ error: 'Failed to parse topology' }, 500)
      }
      return c.json(publicTopologyContext(parsed))
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return c.json({ error: message }, 500)
    }
  })

  // Live metrics (SSE) for a topology widget in a shared dashboard. Same as the
  // topology door, but the id must be referenced by the dashboard's layout.
  app.get('/dashboards/:token/topologies/:id/metrics/stream', (c) => {
    const id = c.req.param('id')
    if (!c.get('reachable').topologyIds.has(id)) return c.json({ error: 'Not found' }, 404)
    if (liveSubscriberCount() >= MAX_SHARE_METRIC_STREAMS) {
      return c.json({ error: 'Too many concurrent streams' }, 503)
    }
    return streamTopologyMetrics(c, id)
  })

  // Alerts for an alert widget in a shared dashboard.
  app.get('/dashboards/:token/datasources/:id/alerts', async (c) => {
    const id = c.req.param('id')
    if (!c.get('reachable').dataSourceIds.has(id)) return c.json({ error: 'Not found' }, 404)
    const service = getDataSourceService()
    if (!service.hasAlertsCapability(id)) {
      return c.json({ error: 'Data source does not support alerts' }, 400)
    }
    const options: AlertQueryOptions = {}
    const timeRange = c.req.query('timeRange')
    if (timeRange) options.timeRange = Number.parseInt(timeRange, 10)
    if (c.req.query('activeOnly') === 'true') options.activeOnly = true
    const minSeverity = c.req.query('minSeverity')
    if (minSeverity) options.minSeverity = minSeverity as AlertQueryOptions['minSeverity']
    try {
      const alerts = await service.getAlerts(id, options)
      // Allow-listed projection — drop description / url / labels / source / hostId.
      return c.json(alerts.map(publicAlert))
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return c.json({ error: message }, 500)
    }
  })

  return app
}

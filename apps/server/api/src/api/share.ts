/**
 * Share API
 * Public endpoints for viewing shared topologies and dashboards (no auth required)
 */

import { specDeviceType } from '@shumoku/core'
import { Hono } from 'hono'
import type { AlertQueryOptions } from '../plugins/types.js'
import { getDashboardService } from './dashboards.js'
import {
  applyMappingBandwidth,
  buildRenderOutput,
  buildTopologyContext,
  getDataSourceService,
  getTopologyService,
} from './topologies.js'

/**
 * Resources a shared dashboard is allowed to expose. A share token grants
 * access ONLY to the topology/datasource ids the dashboard's widgets actually
 * reference — never the full server inventory. Requests for any other id are
 * 404'd so the token can't be used to enumerate or probe unrelated resources.
 */
function referencedIds(layoutJson: string): {
  topologyIds: Set<string>
  dataSourceIds: Set<string>
} {
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

export function createShareApi(): Hono {
  const app = new Hono()

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
          return c.json({ error: parseError.message, errorPhase: parseError.phase }, 422)
        }
        return c.json({ error: 'Failed to parse topology' }, 500)
      }

      return c.json({
        id: parsed.id,
        name: parsed.name,
        nodes: parsed.graph.nodes.map((n) => ({
          id: n.id,
          label: n.label || n.id,
          type: specDeviceType(n.spec),
        })),
        edges: parsed.graph.links.map((l, i) => ({
          id: l.id || `link-${i}`,
          from: { nodeId: l.from.node, port: l.from.port },
          to: { nodeId: l.to.node, port: l.to.port },
          standard: l.from.plug?.module?.standard ?? l.to.plug?.module?.standard,
        })),
        subgraphs: parsed.graph.subgraphs || [],
        metrics: parsed.metrics,
      })
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
          return c.json({ error: parseError.message, errorPhase: parseError.phase }, 422)
        }
        return c.json({ error: 'Failed to parse topology' }, 500)
      }
      return c.json({
        id: parsed.id,
        name: parsed.name,
        graph: applyMappingBandwidth(parsed.graph, parsed.mapping),
      })
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
          return c.json({ error: parseError.message, errorPhase: parseError.phase }, 422)
        }
        return c.json({ error: 'Failed to parse topology' }, 500)
      }
      return c.json(await buildRenderOutput(parsed))
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return c.json({ error: message }, 500)
    }
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
      layoutJson: dashboard.layoutJson,
    })
  })

  // --- Token-scoped data for a shared dashboard's widgets ---
  // These let a shared dashboard render live widget data without a session
  // cookie. Access is gated twice: the token must resolve to a dashboard, and
  // the requested id must be referenced by that dashboard's layout.

  // Resolve the dashboard for a token and assert the id is in `bucket`
  // (its referenced topology or datasource set). Returns null on any miss so
  // callers respond 404 uniformly — no existence leak.
  function authorize(token: string, id: string, bucket: 'topologyIds' | 'dataSourceIds'): boolean {
    const dashboard = getDashboardService().getByShareToken(token)
    if (!dashboard) return false
    return referencedIds(dashboard.layoutJson)[bucket].has(id)
  }

  // Topology metadata (name, mappingJson, …) for a widget in a shared dashboard.
  app.get('/dashboards/:token/topologies/:id', (c) => {
    const { token, id } = c.req.param()
    if (!authorize(token, id, 'topologyIds')) return c.json({ error: 'Not found' }, 404)
    const topology = getTopologyService().get(id)
    if (!topology) return c.json({ error: 'Not found' }, 404)
    return c.json(topology)
  })

  // Raw NetworkGraph for a topology widget in a shared dashboard.
  app.get('/dashboards/:token/topologies/:id/graph', async (c) => {
    const { token, id } = c.req.param()
    if (!authorize(token, id, 'topologyIds')) return c.json({ error: 'Not found' }, 404)
    const service = getTopologyService()
    try {
      const parsed = await service.getParsed(id)
      if (!parsed) {
        const parseError = service.getParseError(id)
        if (parseError) {
          return c.json({ error: parseError.message, errorPhase: parseError.phase }, 422)
        }
        return c.json({ error: 'Failed to parse topology' }, 500)
      }
      return c.json({
        id: parsed.id,
        name: parsed.name,
        graph: applyMappingBandwidth(parsed.graph, parsed.mapping),
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return c.json({ error: message }, 500)
    }
  })

  // Context (nodes/edges/metrics) for a device-status widget in a shared dashboard.
  app.get('/dashboards/:token/topologies/:id/context', async (c) => {
    const { token, id } = c.req.param()
    if (!authorize(token, id, 'topologyIds')) return c.json({ error: 'Not found' }, 404)
    const service = getTopologyService()
    try {
      const parsed = await service.getParsed(id)
      if (!parsed) {
        const parseError = service.getParseError(id)
        if (parseError) {
          return c.json({ error: parseError.message, errorPhase: parseError.phase }, 422)
        }
        return c.json({ error: 'Failed to parse topology' }, 500)
      }
      return c.json(buildTopologyContext(parsed))
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return c.json({ error: message }, 500)
    }
  })

  // Alerts for an alert widget in a shared dashboard.
  app.get('/dashboards/:token/datasources/:id/alerts', async (c) => {
    const { token, id } = c.req.param()
    if (!authorize(token, id, 'dataSourceIds')) return c.json({ error: 'Not found' }, 404)
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
      return c.json(alerts)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return c.json({ error: message }, 500)
    }
  })

  return app
}

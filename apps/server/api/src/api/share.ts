/**
 * Share API
 * Public endpoints for viewing shared topologies and dashboards (no auth required)
 */

import { Hono } from 'hono'
import { getTopologyService, buildRenderOutput } from './topologies.js'
import { getDashboardService } from './dashboards.js'

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
        return c.json({ error: 'Failed to parse topology' }, 500)
      }

      return c.json({
        id: parsed.id,
        name: parsed.name,
        nodes: parsed.graph.nodes.map((n) => ({
          id: n.id,
          label: n.label || n.id,
          type: n.type,
        })),
        edges: parsed.graph.links.map((l, i) => ({
          id: l.id || `link-${i}`,
          from:
            typeof l.from === 'string'
              ? { nodeId: l.from }
              : { nodeId: l.from.node, port: l.from.port },
          to: typeof l.to === 'string' ? { nodeId: l.to } : { nodeId: l.to.node, port: l.to.port },
          bandwidth: l.bandwidth,
        })),
        subgraphs: parsed.graph.subgraphs || [],
        metrics: parsed.metrics,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return c.json({ error: message }, 500)
    }
  })

  // Get shared topology render output
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

  return app
}

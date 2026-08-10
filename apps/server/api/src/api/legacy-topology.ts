import type { Hono } from 'hono'
import { generateMetricsHtml } from '../html-generator.js'
import { authMiddleware } from '../middleware/auth.js'
import type { TopologyManager } from '../topology.js'
import type { WeathermapConfig } from '../types.js'

type LegacyTopologyLookup = Pick<TopologyManager, 'getTopology'>

/**
 * Register the file-backed topology endpoints retained for compatibility.
 *
 * These routes live outside the `/api` router, so they must install the same
 * authentication boundary explicitly. Keeping registration in one function
 * prevents a legacy endpoint from being added without its auth middleware.
 */
export function registerLegacyTopologyRoutes(
  app: Hono,
  topologyManager: LegacyTopologyLookup,
  weathermap: WeathermapConfig,
): void {
  app.use('/api/topology/*', authMiddleware)
  app.use('/topology/*', authMiddleware)

  app.get('/api/topology/:name', (c) => {
    const name = c.req.param('name')
    const instance = topologyManager.getTopology(name)
    if (!instance) {
      return c.json({ error: 'Topology not found' }, 404)
    }
    return c.json({
      name: instance.name,
      graph: instance.graph,
      metrics: instance.metrics,
    })
  })

  app.get('/topology/:name', (c) => {
    const name = c.req.param('name')
    const instance = topologyManager.getTopology(name)
    if (!instance) {
      return c.html('<h1>Topology not found</h1>', 404)
    }

    return c.html(generateMetricsHtml(instance, { weathermap }))
  })
}

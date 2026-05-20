/**
 * Topology Observations API
 *
 * Endpoints around the observation model (foundation v1):
 *   POST /sources/:id/scan              — ad-hoc autoscan of a source
 *   GET  /topologies/:id/observations   — recent snapshot history
 *   GET  /topologies/:id/resolved       — resolved NetworkGraph
 *
 * Design refs:
 *   - apps/server/docs/design/topology-foundation.md
 *   - apps/server/docs/design/topology-foundation-resolve.md
 */

import { type NetworkGraph, resolve, type SnapshotEntry } from '@shumoku/core'
import { Hono } from 'hono'
import { hasAutoscanCapability } from '../plugins/types.js'
import { DataSourceService } from '../services/datasource.js'
import { ObservationsService } from '../services/observations.js'
import { getTopologyService } from './topologies.js'

/**
 * POST /api/sources/:id/scan
 * Ad-hoc autoscan against the source (must implement AutoscanCapable).
 * The snapshot is persisted to `topology_observations` if the request
 * supplies a `topologyId` in the body — otherwise the snapshot is
 * returned but not stored (useful for previews / testing).
 */
export function createScanRoute(): Hono {
  const app = new Hono()
  const dataSources = new DataSourceService()
  const observations = new ObservationsService()

  app.post('/:id/scan', async (c) => {
    const id = c.req.param('id')
    let topologyId: string | undefined
    try {
      const body = await c.req.json<{ topologyId?: string; seeds?: string[] }>()
      topologyId = body.topologyId

      const plugin = dataSources.getPlugin(id)
      if (!plugin) {
        return c.json({ error: 'data source not found' }, 404)
      }

      if (!hasAutoscanCapability(plugin)) {
        return c.json({ error: 'Source does not implement autoscan' }, 400)
      }

      const snapshot = await plugin.scan({
        seeds: body.seeds ?? [],
      })

      // Persist if a topology context was provided
      if (topologyId) {
        const observation = await observations.record({
          topologyId,
          sourceId: id,
          capturedAt: snapshot.capturedAt,
          status: snapshot.status,
          statusMessage: snapshot.statusMessage,
          graph: snapshot.graph,
        })
        // Update retraction hysteresis counter
        observations.updateHysteresis(
          topologyId,
          id,
          snapshot.status === 'failed' ? 'failed' : 'ok',
          snapshot.capturedAt,
        )
        return c.json({ snapshot, observation })
      }

      return c.json({ snapshot })
    } catch (err) {
      return c.json({ error: err instanceof Error ? err.message : String(err) }, 500)
    }
  })

  return app
}

/**
 * GET /api/topologies/:id/observations
 * GET /api/topologies/:id/resolved
 * Mounted under `/api/topologies` so URL structure stays consistent
 * with the existing topology endpoints.
 */
export function createObservationsRoute(): Hono {
  const app = new Hono()
  const observations = new ObservationsService()

  // History — recent observations across all sources of this topology
  app.get('/:id/observations', (c) => {
    const id = c.req.param('id')
    const limit = Number.parseInt(c.req.query('limit') ?? '50', 10) || 50
    const rows = observations.listForTopology(id, limit)
    // Don 't ship the full graph_json on every list call — that 's huge.
    // The detail endpoint serves the graph.
    return c.json(
      rows.map((o) => ({
        id: o.id,
        topologyId: o.topologyId,
        sourceId: o.sourceId,
        capturedAt: o.capturedAt,
        status: o.status,
        statusMessage: o.statusMessage,
        nodeCount: o.nodeCount,
        linkCount: o.linkCount,
        portCount: o.portCount,
        createdAt: o.createdAt,
      })),
    )
  })

  // Single observation with full graph
  app.get('/:id/observations/:obsId', (c) => {
    const obsId = c.req.param('obsId')
    const o = observations.get(obsId)
    if (!o) return c.json({ error: 'not found' }, 404)
    return c.json(o)
  })

  // Resolved graph — authored layer + latest snapshot per source,
  // folded through resolve().
  app.get('/:id/resolved', async (c) => {
    const id = c.req.param('id')
    try {
      const topologyService = getTopologyService()
      const parsed = await topologyService.getParsed(id)
      if (!parsed) return c.json({ error: 'not found' }, 404)

      const authored: NetworkGraph = parsed.graph
      const latest = observations.latestPerSource(id)
      const snapshots: SnapshotEntry[] = latest.map((o) => ({
        sourceId: o.sourceId,
        capturedAt: o.capturedAt,
        status: o.status,
        graph: o.graph,
      }))

      const resolved = resolve(authored, snapshots)
      return c.json({ graph: resolved, snapshotCount: snapshots.length })
    } catch (err) {
      return c.json({ error: err instanceof Error ? err.message : String(err) }, 500)
    }
  })

  return app
}

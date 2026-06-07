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

import type { NetworkGraph } from '@shumoku/core'
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
        // Invalidate the parsed-topology cache so the next /render / /graph
        // call re-runs resolve() with the new snapshot.
        getTopologyService().clearCacheEntry(topologyId)
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
  // Every source — external feed AND a hand-drawn Manual source — saves/loads its
  // graph through the same observation path (record → materialize). No per-type
  // branch; the human is just the "scanner" for a Manual source.
  // Note: the per-source sync endpoint
  // `POST /:topologyId/sources/:sourceId/sync` lives in
  // `topology-sources.ts` — that route is registered earlier on the
  // same path prefix and would shadow anything we put here anyway.

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

  // Latest snapshot for a specific source attached to this topology.
  // This is how the editor (and any future per-source viewers) reads
  // the graph the user typed into a given source — separate from the
  // resolved project graph below.
  app.get('/:topologyId/sources/:sourceId/latest-snapshot', (c) => {
    const { topologyId, sourceId } = c.req.param()
    // Every source — including a hand-drawn Manual source — reads its latest graph
    // from the observation log; no manual-specific branch.
    const latest = observations.latestPerSource(topologyId).find((o) => o.sourceId === sourceId)
    if (!latest) {
      // Source attached but no observation yet — return an empty
      // canvas so the editor can open without a 404 dance.
      return c.json({ graph: null, capturedAt: null })
    }
    return c.json({
      graph: latest.graph,
      capturedAt: latest.capturedAt,
      status: latest.status,
      observationId: latest.id,
    })
  })

  // Record a new observation against a specific source. Used by the
  // Manual editor on save; also fine for any caller that wants to
  // push a snapshot in.
  app.post('/:topologyId/sources/:sourceId/observation', async (c) => {
    const { topologyId, sourceId } = c.req.param()
    try {
      const body = await c.req.json<{ graph: unknown; status?: string }>()
      // Light validation — we let resolve() / parser surface errors
      // downstream; here we just want nodes + links shaped sensibly.
      if (!body.graph || typeof body.graph !== 'object') {
        return c.json({ error: 'graph is required' }, 400)
      }
      const graph = body.graph as NetworkGraph
      if (!Array.isArray(graph.nodes) || !Array.isArray(graph.links)) {
        return c.json({ error: 'graph.nodes and graph.links must be arrays' }, 400)
      }
      // Every source saves the same way — record an observation, which materializes
      // into the contribution store. A hand-drawn Manual source's editor save comes
      // through here too (the human is the "scanner"); no manual-specific branch.
      // (Operator curation — exclusions/bindings/overrides — does NOT come through
      // here; it goes to the project overlay via the discovery-policy / mapping APIs.)
      const observation = await observations.record({
        topologyId,
        sourceId,
        capturedAt: Date.now(),
        status: (body.status as 'ok' | 'partial' | 'failed' | 'empty') ?? 'ok',
        graph,
      })
      // Invalidate parsed-topology cache so the next /render runs
      // resolve() against the new observation.
      getTopologyService().clearCacheEntry(topologyId)
      return c.json({ observation }, 201)
    } catch (err) {
      return c.json({ error: err instanceof Error ? err.message : String(err) }, 500)
    }
  })

  // Resolved graph — the project 's current rendered graph.
  // `TopologyService.parseTopology()` already runs `resolve()` over the project
  // overlay + every attached source 's contribution, so `parsed.graph` IS the
  // resolved graph. The previous version of this endpoint re-ran `resolve()` with
  // `parsed.graph` as the `authored` input AND the same latest snapshots again,
  // which double-counted every link (a snapshot of 7 links came out as 14).
  // Just hand back what parseTopology already computed.
  app.get('/:id/resolved', async (c) => {
    const id = c.req.param('id')
    try {
      const topologyService = getTopologyService()
      const parsed = await topologyService.getParsed(id)
      if (!parsed) return c.json({ error: 'not found' }, 404)

      // snapshotCount stays useful — it tells the UI how many sources
      // were folded in beyond the project overlay.
      const snapshotCount = observations
        .latestPerSource(id)
        .filter((o) => o.sourceId !== parsed.topologySourceId || o.graph !== null).length

      return c.json({ graph: parsed.graph, snapshotCount })
    } catch (err) {
      return c.json({ error: err instanceof Error ? err.message : String(err) }, 500)
    }
  })

  // Topology display settings (edge style / spline mode). These are project-level
  // presentation prefs, NOT source content, so they live on the project overlay's
  // graph-level `settings`. Read-modify-write the overlay's settings only — never
  // touches nodes/exclusions/bindings (no clobber). No Manual source involved.
  app.get('/:id/display-settings', (c) => {
    const id = c.req.param('id')
    const overlay = getTopologyService().readProjectOverlay(id)
    const settings = (overlay?.settings ?? {}) as Record<string, unknown>
    return c.json({
      edgeStyle: settings['edgeStyle'] ?? 'orthogonal',
      splineMode: settings['splineMode'] ?? 'sloppy',
      hideDisconnected: settings['hideDisconnected'] ?? false,
    })
  })

  app.put('/:id/display-settings', async (c) => {
    const id = c.req.param('id')
    try {
      const body = await c.req.json<{
        edgeStyle?: string
        splineMode?: string
        hideDisconnected?: boolean
      }>()
      const svc = getTopologyService()
      const overlay: NetworkGraph = svc.readProjectOverlay(id) ?? {
        version: '1',
        nodes: [],
        links: [],
      }
      const settings = { ...(overlay.settings ?? {}) } as Record<string, unknown>
      if (body.edgeStyle !== undefined) settings['edgeStyle'] = body.edgeStyle
      if (body.edgeStyle === 'splines') settings['splineMode'] = body.splineMode ?? 'sloppy'
      else if (body.edgeStyle !== undefined) delete settings['splineMode']
      if (body.hideDisconnected !== undefined) settings['hideDisconnected'] = body.hideDisconnected
      await svc.writeProjectOverlay(id, { ...overlay, settings })
      return c.json({ ok: true })
    } catch (err) {
      return c.json({ error: err instanceof Error ? err.message : String(err) }, 500)
    }
  })

  return app
}

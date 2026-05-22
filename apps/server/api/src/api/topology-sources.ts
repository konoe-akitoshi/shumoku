/**
 * Topology Data Sources API Routes
 * Manages the relationship between topologies and data sources
 */

import type { NetworkGraph } from '@shumoku/core'
import { Hono } from 'hono'
import { hasAutoscanCapability, hasTopologyCapability } from '../plugins/types.js'
import { DataSourceService } from '../services/datasource.js'
import { ObservationsService } from '../services/observations.js'
import { TopologySourcesService } from '../services/topology-sources.js'
import type { SyncMode, TopologyDataSourceInput } from '../types.js'
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

export const topologySourcesApi = new Hono()

/**
 * List all data sources for a topology
 * GET /api/topologies/:topologyId/sources
 */
topologySourcesApi.get('/:topologyId/sources', async (c) => {
  const { topologyId } = c.req.param()

  // Verify topology exists
  const topology = getTopologyService().get(topologyId)
  if (!topology) {
    return c.json({ error: 'Topology not found' }, 404)
  }

  const sources = getTopologySourcesService().listByTopology(topologyId)
  return c.json(sources)
})

/**
 * Add a data source to a topology
 * POST /api/topologies/:topologyId/sources
 */
topologySourcesApi.post('/:topologyId/sources', async (c) => {
  const { topologyId } = c.req.param()

  // Verify topology exists
  const topology = getTopologyService().get(topologyId)
  if (!topology) {
    return c.json({ error: 'Topology not found' }, 404)
  }

  const body = await c.req.json<TopologyDataSourceInput>()

  // Validate required fields
  if (!body.dataSourceId || !body.purpose) {
    return c.json({ error: 'dataSourceId and purpose are required' }, 400)
  }

  // Verify data source exists
  const dataSource = getDataSourceService().get(body.dataSourceId)
  if (!dataSource) {
    return c.json({ error: 'Data source not found' }, 404)
  }

  // Check if already exists
  const existing = getTopologySourcesService().find(topologyId, body.dataSourceId, body.purpose)
  if (existing) {
    return c.json({ error: 'This data source is already linked with this purpose' }, 409)
  }

  try {
    const source = await getTopologySourcesService().add(topologyId, body)
    return c.json(source, 201)
  } catch (error) {
    return c.json(
      { error: error instanceof Error ? error.message : 'Failed to add data source' },
      500,
    )
  }
})

/**
 * Update a topology data source
 * PUT /api/topologies/:topologyId/sources/:sourceId
 */
topologySourcesApi.put('/:topologyId/sources/:sourceId', async (c) => {
  const { topologyId, sourceId } = c.req.param()

  // Verify topology exists
  const topology = getTopologyService().get(topologyId)
  if (!topology) {
    return c.json({ error: 'Topology not found' }, 404)
  }

  const existing = getTopologySourcesService().get(sourceId)
  if (!existing || existing.topologyId !== topologyId) {
    return c.json({ error: 'Topology data source not found' }, 404)
  }

  const body = await c.req.json<{ syncMode?: SyncMode; priority?: number; optionsJson?: string }>()

  const updated = getTopologySourcesService().update(sourceId, body)
  if (!updated) {
    return c.json({ error: 'Failed to update' }, 500)
  }

  return c.json(updated)
})

/**
 * Remove a data source from a topology
 * DELETE /api/topologies/:topologyId/sources/:sourceId
 */
topologySourcesApi.delete('/:topologyId/sources/:sourceId', async (c) => {
  const { topologyId, sourceId } = c.req.param()

  // Verify topology exists
  const topology = getTopologyService().get(topologyId)
  if (!topology) {
    return c.json({ error: 'Topology not found' }, 404)
  }

  const existing = getTopologySourcesService().get(sourceId)
  if (!existing || existing.topologyId !== topologyId) {
    return c.json({ error: 'Topology data source not found' }, 404)
  }

  const deleted = getTopologySourcesService().remove(sourceId)
  if (!deleted) {
    return c.json({ error: 'Failed to delete' }, 500)
  }

  return c.json({ success: true })
})

/**
 * Bulk replace all sources for a topology
 * PUT /api/topologies/:topologyId/sources
 */
topologySourcesApi.put('/:topologyId/sources', async (c) => {
  const { topologyId } = c.req.param()

  // Verify topology exists
  const topology = getTopologyService().get(topologyId)
  if (!topology) {
    return c.json({ error: 'Topology not found' }, 404)
  }

  const body = await c.req.json<{ sources: TopologyDataSourceInput[] }>()

  if (!Array.isArray(body.sources)) {
    return c.json({ error: 'sources array is required' }, 400)
  }

  // Validate all data sources exist
  for (const source of body.sources) {
    if (!source.dataSourceId || !source.purpose) {
      return c.json({ error: 'Each source must have dataSourceId and purpose' }, 400)
    }
    const ds = getDataSourceService().get(source.dataSourceId)
    if (!ds) {
      return c.json({ error: `Data source ${source.dataSourceId} not found` }, 404)
    }
  }

  try {
    const sources = await getTopologySourcesService().replaceAll(topologyId, body.sources)
    return c.json(sources)
  } catch (error) {
    return c.json(
      { error: error instanceof Error ? error.message : 'Failed to update sources' },
      500,
    )
  }
})

/**
 * Sync ONE attached topology source.
 *
 * POST /api/topologies/:topologyId/sources/:sourceId/sync
 *
 * `:sourceId` refers to the underlying **data_source.id** (the source
 * type configuration, e.g. one Network Discovery setup), not the
 * `topology_data_sources.id` junction-row id. We disambiguate by
 * looking up the attachment via `(topologyId, dataSourceId, 'topology')`.
 *
 * Capability dispatch (autoscan → scan(), else fetchTopology()),
 * records the result as an observation snapshot, updates the
 * retraction hysteresis counter, and invalidates the parsed-topology
 * cache so the next render runs resolve(). `content_json` is never
 * touched here — that 's the authored layer, owned by the editor.
 *
 * Replaces the legacy multi-source-merge implementation; multi-source
 * folding now happens at read time inside `resolve()`. Use
 * `/sync-from-source` for the "all sources at once" operation.
 */
topologySourcesApi.post('/:topologyId/sources/:sourceId/sync', async (c) => {
  const { topologyId, sourceId } = c.req.param()

  const topology = getTopologyService().get(topologyId)
  if (!topology) {
    return c.json({ error: 'Topology not found' }, 404)
  }

  // Resolve the attachment by (topology, dataSource, purpose='topology').
  const attached = getTopologySourcesService().find(topologyId, sourceId, 'topology')
  if (!attached) {
    return c.json({ error: 'Source is not attached to this topology with topology purpose' }, 404)
  }

  const plugin = getDataSourceService().getPlugin(sourceId)
  if (!plugin) {
    return c.json({ error: 'Data source not found' }, 404)
  }

  const capturedAt = Date.now()
  let graph: NetworkGraph | null = null
  let status: 'ok' | 'partial' | 'failed' | 'empty' = 'ok'
  let statusMessage: string | undefined
  let warnings: string[] | undefined

  try {
    if (hasAutoscanCapability(plugin)) {
      const snapshot = await plugin.scan({ seeds: [] })
      graph = snapshot.graph
      status = snapshot.status
      statusMessage = snapshot.statusMessage
      warnings = snapshot.warnings
    } else if (hasTopologyCapability(plugin)) {
      const opts = attached.optionsJson ? JSON.parse(attached.optionsJson) : undefined
      graph = await plugin.fetchTopology(opts)
      status = graph && graph.nodes && graph.nodes.length > 0 ? 'ok' : 'empty'
    } else {
      return c.json(
        {
          error: `Plugin ${plugin.type} cannot supply topology (no autoscan or topology capability)`,
        },
        400,
      )
    }
  } catch (err) {
    status = 'failed'
    statusMessage = err instanceof Error ? err.message : String(err)
    graph = null
  }

  const observations = new ObservationsService()
  const observation = await observations.record({
    topologyId,
    sourceId,
    capturedAt,
    status,
    statusMessage,
    graph,
  })
  observations.updateHysteresis(
    topologyId,
    sourceId,
    status === 'failed' ? 'failed' : 'ok',
    capturedAt,
  )
  getTopologyService().clearCacheEntry(topologyId)
  // Stamp the legacy lastSyncedAt for UI surfaces that read it.
  getTopologySourcesService().updateLastSynced(attached.id)

  return c.json({
    observation,
    snapshot: {
      status,
      statusMessage,
      capturedAt,
      warnings,
      graph,
    },
  })
})

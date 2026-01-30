/**
 * Topology Data Sources API Routes
 * Manages the relationship between topologies and data sources
 */

import { Hono } from 'hono'
import { TopologySourcesService } from '../services/topology-sources.js'
import { DataSourceService } from '../services/datasource.js'
import type { TopologyDataSourceInput, SyncMode } from '../types.js'
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
 * Sync topology from a specific source
 * POST /api/topologies/:topologyId/sources/:sourceId/sync
 */
topologySourcesApi.post('/:topologyId/sources/:sourceId/sync', async (c) => {
  const { topologyId, sourceId } = c.req.param()

  // Verify topology exists
  const topology = getTopologyService().get(topologyId)
  if (!topology) {
    return c.json({ error: 'Topology not found' }, 404)
  }

  const source = getTopologySourcesService().get(sourceId)
  if (!source || source.topologyId !== topologyId) {
    return c.json({ error: 'Topology data source not found' }, 404)
  }

  if (source.purpose !== 'topology') {
    return c.json({ error: 'Can only sync from topology sources' }, 400)
  }

  try {
    // Fetch topology from data source (with per-source options)
    const graph = await getDataSourceService().fetchTopologyWithOptionsJson(
      source.dataSourceId,
      source.optionsJson,
    )
    if (!graph) {
      return c.json({ error: 'Data source does not support topology' }, 400)
    }

    // Update topology content
    const contentJson = JSON.stringify(graph)
    const updated = await getTopologyService().update(topologyId, { contentJson })
    if (!updated) {
      return c.json({ error: 'Failed to update topology' }, 500)
    }

    // Update last synced timestamp
    getTopologySourcesService().updateLastSynced(sourceId)

    return c.json({
      topology: updated,
      nodeCount: graph.nodes?.length ?? 0,
      linkCount: graph.links?.length ?? 0,
    })
  } catch (error) {
    return c.json(
      { error: error instanceof Error ? error.message : 'Failed to sync from source' },
      500,
    )
  }
})

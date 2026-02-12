/**
 * Topology Data Sources API Routes
 * Manages the relationship between topologies and data sources
 */

import { Hono } from 'hono'
import { DataSourceService } from '../services/datasource.js'
import { TopologySourcesService } from '../services/topology-sources.js'
import type { SyncMode, TopologyDataSourceInput, TopologySourceMergeConfig } from '../types.js'
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
    console.error('[TopologySources] Error adding data source:', error)
    return c.json({ error: 'Internal server error' }, 500)
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
    console.error('[TopologySources] Error updating sources:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

/**
 * Sync topology from all sources (with merge)
 * POST /api/topologies/:topologyId/sources/:sourceId/sync
 *
 * Note: Although this endpoint takes a sourceId, it actually syncs from ALL
 * topology sources and merges them. The sourceId is used to update the
 * lastSyncedAt timestamp for tracking purposes.
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
    // Get ALL topology sources for this topology
    const allSources = getTopologySourcesService().listByPurpose(topologyId, 'topology')

    if (allSources.length === 0) {
      return c.json({ error: 'No topology sources configured' }, 400)
    }

    // If only one source, just fetch and update directly
    if (allSources.length === 1) {
      const graph = await getDataSourceService().fetchTopologyWithOptionsJson(
        source.dataSourceId,
        source.optionsJson,
      )
      if (!graph) {
        return c.json({ error: 'Data source does not support topology' }, 400)
      }

      const contentJson = JSON.stringify(graph)
      const updated = await getTopologyService().update(topologyId, { contentJson })
      if (!updated) {
        return c.json({ error: 'Failed to update topology' }, 500)
      }

      getTopologySourcesService().updateLastSynced(sourceId)

      return c.json({
        topology: updated,
        nodeCount: graph.nodes?.length ?? 0,
        linkCount: graph.links?.length ?? 0,
      })
    }

    // Multiple sources - fetch all and merge
    console.log('[sync] Fetching from', allSources.length, 'sources for merge')

    const fetchResults = await Promise.allSettled(
      allSources.map(async (s) => {
        const graph = await getDataSourceService().fetchTopologyWithOptionsJson(
          s.dataSourceId,
          s.optionsJson,
        )
        if (!graph) {
          throw new Error(`Failed to fetch from ${s.dataSourceId}`)
        }
        return { sourceId: s.dataSourceId, graph, optionsJson: s.optionsJson }
      }),
    )

    const successfulFetches: Array<{
      sourceId: string
      graph: import('@shumoku/core').NetworkGraph
      optionsJson?: string
    }> = []

    for (const result of fetchResults) {
      if (result.status === 'fulfilled') {
        successfulFetches.push(result.value)
        console.log(
          `[sync] Got graph from ${result.value.sourceId}:`,
          result.value.graph.nodes.length,
          'nodes,',
          result.value.graph.links.length,
          'links',
        )
      } else {
        console.error('[sync] Failed to fetch:', result.reason)
      }
    }

    if (successfulFetches.length === 0) {
      return c.json({ error: 'Failed to fetch from any source' }, 500)
    }

    // Import merge function
    const { mergeWithOverlays } = await import('@shumoku/core')

    // Parse merge configs from optionsJson
    const sourceConfigs = new Map<string, TopologySourceMergeConfig>()
    for (const fetch of successfulFetches) {
      if (fetch.optionsJson) {
        try {
          sourceConfigs.set(fetch.sourceId, JSON.parse(fetch.optionsJson))
        } catch (err) {
          console.warn('[TopologySources] Failed to parse optionsJson:', err)
        }
      }
    }

    // Find base source
    const baseSourceId =
      Array.from(sourceConfigs.entries()).find(([, cfg]) => cfg.isBase)?.[0] ??
      successfulFetches[0]!.sourceId
    const baseIndex = successfulFetches.findIndex((f) => f.sourceId === baseSourceId)

    console.log('[sync] Base source:', baseSourceId)

    // Build overlay configs
    const overlayConfigs: Array<{
      sourceId: string
      match: 'id' | 'name' | 'attribute' | 'manual'
      matchAttribute?: string
      idMapping?: Record<string, string>
      onMatch: 'merge-properties' | 'keep-base' | 'keep-overlay'
      onUnmatched: 'add-to-root' | 'add-to-subgraph' | 'ignore'
      subgraphName?: string
    }> = []

    for (const fetch of successfulFetches) {
      if (fetch.sourceId === baseSourceId) continue

      const cfg = sourceConfigs.get(fetch.sourceId)
      overlayConfigs.push({
        sourceId: fetch.sourceId,
        match: cfg?.match ?? 'name',
        matchAttribute: cfg?.matchAttribute,
        idMapping: cfg?.idMapping,
        onMatch: cfg?.onMatch ?? 'merge-properties',
        onUnmatched: cfg?.onUnmatched ?? 'add-to-subgraph',
        subgraphName: cfg?.subgraphName,
      })
    }

    console.log(
      '[sync] Overlay configs:',
      overlayConfigs.map((o) => `${o.sourceId}(${o.match})`).join(', '),
    )

    // Merge
    const mergeResult = mergeWithOverlays(
      successfulFetches.map((f) => f.graph),
      successfulFetches.map((f) => f.sourceId),
      { baseIndex, overlays: overlayConfigs },
    )

    console.log('[sync] Merged result:', mergeResult.graph.nodes.length, 'nodes')
    for (const [sid, count] of mergeResult.nodeCountBySource) {
      console.log(`  ${sid}: ${count} nodes`)
    }

    // Update topology with merged content
    const contentJson = JSON.stringify(mergeResult.graph)
    const updated = await getTopologyService().update(topologyId, { contentJson })
    if (!updated) {
      return c.json({ error: 'Failed to update topology' }, 500)
    }

    // Update lastSyncedAt for all sources
    for (const s of allSources) {
      getTopologySourcesService().updateLastSynced(s.id)
    }

    return c.json({
      topology: updated,
      nodeCount: mergeResult.graph.nodes?.length ?? 0,
      linkCount: mergeResult.graph.links?.length ?? 0,
    })
  } catch (error) {
    console.error('[sync] Error:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

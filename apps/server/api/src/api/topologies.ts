/**
 * Topologies API
 * CRUD endpoints for topology management
 */

import {
  buildHierarchicalSheets,
  mergeWithOverlays,
  type NetworkGraph,
  type OverlayConfig,
} from '@shumoku/core'
import { type EmbeddableRenderOutput, renderEmbeddable } from '@shumoku/renderer'
import { Hono } from 'hono'
import { BunHierarchicalLayout } from '../layout.js'
import { DataSourceService } from '../services/datasource.js'
import { TopologyService } from '../services/topology.js'
import { TopologySourcesService } from '../services/topology-sources.js'
import type { TopologyInput, TopologySourceMergeConfig, ZabbixMapping } from '../types.js'

/**
 * Build topology context (nodes/edges) from a parsed graph
 * Shared between authenticated and public (share) endpoints
 */
export function buildTopologyContext(graph: NetworkGraph) {
  return {
    nodes: graph.nodes.map((n) => ({
      id: n.id,
      label: n.label || n.id,
      type: n.type,
    })),
    edges: graph.links.map((l, i) => ({
      id: l.id || `link-${i}`,
      from:
        typeof l.from === 'string'
          ? { nodeId: l.from }
          : { nodeId: l.from.node, port: l.from.port },
      to: typeof l.to === 'string' ? { nodeId: l.to } : { nodeId: l.to.node, port: l.to.port },
      bandwidth: l.bandwidth,
    })),
  }
}

/**
 * Build render output from a parsed topology
 * Shared between authenticated and public (share) endpoints
 */
export async function buildRenderOutput(parsed: import('../services/topology.js').ParsedTopology) {
  const hasSubgraphs = parsed.graph.subgraphs && parsed.graph.subgraphs.length > 0

  if (hasSubgraphs) {
    const layoutEngine = new BunHierarchicalLayout({
      iconDimensions: parsed.iconDimensions.byKey,
    })
    const sheets = await buildHierarchicalSheets(parsed.graph, parsed.layout, layoutEngine)

    const renderedSheets: Record<
      string,
      {
        svg: string
        css: string
        viewBox: EmbeddableRenderOutput['viewBox']
        label: string
        parentId: string | null
      }
    > = {}

    for (const [sheetId, sheetData] of sheets) {
      const output = renderEmbeddable(
        {
          graph: sheetData.graph,
          layout: sheetData.layout,
          iconDimensions: parsed.iconDimensions,
        },
        { hierarchical: true, toolbar: false },
      )

      let parentId: string | null = null
      let label = sheetData.graph.name || sheetId

      if (sheetId !== 'root') {
        parentId = 'root'
        const subgraph = parsed.graph.subgraphs?.find((sg) => sg.id === sheetId)
        if (subgraph) {
          label = subgraph.label || sheetId
        }
      }

      renderedSheets[sheetId] = {
        svg: output.svg,
        css: output.css,
        viewBox: output.viewBox,
        label,
        parentId,
      }
    }

    return {
      id: parsed.id,
      name: parsed.name,
      hierarchical: true as const,
      sheets: renderedSheets,
      rootSheetId: 'root',
      nodeCount: parsed.graph.nodes.length,
      edgeCount: parsed.graph.links.length,
    }
  }

  const output = renderEmbeddable(
    { graph: parsed.graph, layout: parsed.layout, iconDimensions: parsed.iconDimensions },
    { hierarchical: false, toolbar: false },
  )

  return {
    id: parsed.id,
    name: parsed.name,
    hierarchical: false as const,
    svg: output.svg,
    css: output.css,
    viewBox: output.viewBox,
    nodeCount: parsed.graph.nodes.length,
    edgeCount: parsed.graph.links.length,
  }
}

// Singleton instances for shared state
let _topologyService: TopologyService | null = null
let _dataSourceService: DataSourceService | null = null
let _topologySourcesService: TopologySourcesService | null = null

export function getTopologyService(): TopologyService {
  if (!_topologyService) {
    _topologyService = new TopologyService()
  }
  return _topologyService
}

function getDataSourceService(): DataSourceService {
  if (!_dataSourceService) {
    _dataSourceService = new DataSourceService()
  }
  return _dataSourceService
}

function getTopologySourcesService(): TopologySourcesService {
  if (!_topologySourcesService) {
    _topologySourcesService = new TopologySourcesService()
  }
  return _topologySourcesService
}

export function createTopologiesApi(): Hono {
  const app = new Hono()
  const service = getTopologyService()
  const dataSourceService = getDataSourceService()

  // List all topologies
  app.get('/', (c) => {
    const topologies = service.list()
    return c.json(topologies)
  })

  // Get parsed topology with graph and layout
  // NOTE: More specific routes must be defined before /:id
  app.get('/:id/parsed', async (c) => {
    const id = c.req.param('id')
    try {
      const parsed = await service.getParsed(id)
      if (!parsed) {
        return c.json({ error: 'Topology not found' }, 404)
      }

      // Convert LayoutResult Maps to plain objects for JSON serialization
      // Cytoscape converter expects { nodeId: { x, y } } format
      const layoutNodes: Record<string, { x: number; y: number }> = {}
      for (const [nodeId, layoutNode] of parsed.layout.nodes) {
        layoutNodes[nodeId] = {
          x: layoutNode.position.x,
          y: layoutNode.position.y,
        }
      }

      return c.json({
        id: parsed.id,
        name: parsed.name,
        graph: parsed.graph,
        layout: {
          nodes: layoutNodes,
          bounds: parsed.layout.bounds,
        },
        metrics: parsed.metrics,
        topologySourceId: parsed.topologySourceId,
        metricsSourceId: parsed.metricsSourceId,
        mapping: parsed.mapping,
      })
    } catch (err) {
      console.error('[Topologies] Error:', err)
      return c.json({ error: 'Internal server error' }, 500)
    }
  })

  // Render topology as embeddable output (SVG + CSS + metadata)
  // Supports hierarchical topologies with multiple sheets
  app.get('/:id/render', async (c) => {
    const id = c.req.param('id')
    try {
      const cached = service.getRenderCache(id)
      if (cached) {
        return c.json(cached)
      }
      const parsed = await service.getParsed(id)
      if (!parsed) {
        return c.json({ error: 'Topology not found' }, 404)
      }
      const output = await buildRenderOutput(parsed)
      service.setRenderCache(id, output)
      return c.json(output)
    } catch (err) {
      console.error('[Topologies] Error:', err)
      return c.json({ error: 'Internal server error' }, 500)
    }
  })

  // Get topology context (simplified - just stats from graph)
  app.get('/:id/context', async (c) => {
    const id = c.req.param('id')
    try {
      const parsed = await service.getParsed(id)
      if (!parsed) {
        return c.json({ error: 'Topology not found' }, 404)
      }

      // Return simplified context with node/edge info from graph
      return c.json({
        id: parsed.id,
        name: parsed.name,
        ...buildTopologyContext(parsed.graph),
        subgraphs: parsed.graph.subgraphs || [],
        metrics: parsed.metrics,
        topologySourceId: parsed.topologySourceId,
        metricsSourceId: parsed.metricsSourceId,
        mapping: parsed.mapping,
      })
    } catch (err) {
      console.error('[Topologies] Error:', err)
      return c.json({ error: 'Internal server error' }, 500)
    }
  })

  // Get single topology (must be after all /:id/* routes)
  app.get('/:id', (c) => {
    const id = c.req.param('id')
    const topology = service.get(id)
    if (!topology) {
      return c.json({ error: 'Topology not found' }, 404)
    }
    return c.json(topology)
  })

  // Create new topology
  app.post('/', async (c) => {
    try {
      const body = (await c.req.json()) as TopologyInput
      if (!body.name || !body.contentJson) {
        return c.json({ error: 'name and contentJson are required' }, 400)
      }

      const topology = await service.create(body)
      return c.json(topology, 201)
    } catch (err) {
      console.error('[Topologies] Error creating topology:', err)
      return c.json({ error: 'Invalid topology content' }, 400)
    }
  })

  // Update topology
  app.put('/:id', async (c) => {
    const id = c.req.param('id')
    try {
      const body = (await c.req.json()) as Partial<TopologyInput>
      const topology = await service.update(id, body)
      if (!topology) {
        return c.json({ error: 'Topology not found' }, 404)
      }
      return c.json(topology)
    } catch (err) {
      console.error('[Topologies] Error updating topology:', err)
      return c.json({ error: 'Invalid topology content' }, 400)
    }
  })

  // Update mapping
  app.put('/:id/mapping', async (c) => {
    const id = c.req.param('id')
    try {
      const mapping = (await c.req.json()) as ZabbixMapping
      const topology = service.updateMapping(id, mapping)
      if (!topology) {
        return c.json({ error: 'Topology not found' }, 404)
      }
      return c.json(topology)
    } catch (err) {
      console.error('[Topologies] Error updating mapping:', err)
      return c.json({ error: 'Invalid topology content' }, 400)
    }
  })

  // Update single node mapping (PATCH)
  app.patch('/:id/mapping/nodes/:nodeId', async (c) => {
    const id = c.req.param('id')
    const nodeId = c.req.param('nodeId')
    try {
      const nodeMapping = (await c.req.json()) as { hostId?: string; hostName?: string }
      const topology = service.get(id)
      if (!topology) {
        return c.json({ error: 'Topology not found' }, 404)
      }

      // Get existing mapping or create new one
      let mapping: ZabbixMapping = { nodes: {}, links: {} }
      if (topology.mappingJson) {
        try {
          mapping = JSON.parse(topology.mappingJson) as ZabbixMapping
        } catch (err) {
          console.warn('[Topologies] Failed to parse mapping JSON:', err)
        }
      }

      // Ensure nodes object exists
      if (!mapping.nodes) {
        mapping.nodes = {}
      }

      // Update the specific node mapping
      if (nodeMapping.hostId || nodeMapping.hostName) {
        mapping.nodes[nodeId] = {
          hostId: nodeMapping.hostId,
          hostName: nodeMapping.hostName,
        }
      } else {
        // Remove mapping if empty
        delete mapping.nodes[nodeId]
      }

      // Save updated mapping
      const updated = service.updateMapping(id, mapping)
      return c.json({
        success: true,
        topology: updated,
        nodeMapping: mapping.nodes[nodeId] || null,
      })
    } catch (err) {
      console.error('[Topologies] Error updating node mapping:', err)
      return c.json({ error: 'Invalid topology content' }, 400)
    }
  })

  // Sync topology from its topology source(s) (e.g., NetBox, OCX)
  // Supports multiple topology sources - fetches from all and merges
  app.post('/:id/sync-from-source', async (c) => {
    const id = c.req.param('id')
    try {
      console.log('[sync-from-source] Starting sync for topology:', id)

      const topology = service.get(id)
      if (!topology) {
        return c.json({ error: 'Topology not found' }, 404)
      }

      // Get all topology sources for this topology
      const topologySources = getTopologySourcesService().listByPurpose(id, 'topology')

      if (topologySources.length === 0 && !topology.topologySourceId) {
        return c.json({ error: 'No topology source configured' }, 400)
      }

      // Build list of sources to fetch from
      // Prefer topology_data_sources table, fall back to legacy topologySourceId
      const sourcesToFetch =
        topologySources.length > 0
          ? topologySources
          : [{ dataSourceId: topology.topologySourceId!, optionsJson: undefined }]

      console.log(
        '[sync-from-source] Fetching from',
        sourcesToFetch.length,
        'source(s):',
        sourcesToFetch.map((s) => s.dataSourceId).join(', '),
      )

      // Fetch topology from each source in parallel
      const fetchResults = await Promise.allSettled(
        sourcesToFetch.map(async (source) => {
          const graph = await dataSourceService.fetchTopologyWithOptionsJson(
            source.dataSourceId,
            source.optionsJson,
          )
          if (!graph) {
            throw new Error(`Failed to fetch topology from source ${source.dataSourceId}`)
          }
          return { sourceId: source.dataSourceId, graph }
        }),
      )

      // Collect successful fetches
      const successfulFetches: Array<{
        sourceId: string
        graph: import('@shumoku/core').NetworkGraph
      }> = []
      const failedSources: Array<{ sourceId: string; error: string }> = []

      for (const result of fetchResults) {
        if (result.status === 'fulfilled') {
          successfulFetches.push(result.value)
          console.log(
            `[sync-from-source] Got graph from ${result.value.sourceId}:`,
            result.value.graph.nodes.length,
            'nodes,',
            result.value.graph.links.length,
            'links',
          )
        } else {
          const error =
            result.reason instanceof Error ? result.reason.message : String(result.reason)
          failedSources.push({ sourceId: 'unknown', error })
          console.error('[sync-from-source] Failed to fetch from source:', error)
        }
      }

      if (successfulFetches.length === 0) {
        return c.json(
          {
            error: 'Failed to fetch topology from any source',
            failedSources,
          },
          500,
        )
      }

      // Merge graphs if multiple sources
      let finalGraph: import('@shumoku/core').NetworkGraph
      let mergeInfo: { skippedNodes: number; skippedLinks: number } | undefined

      if (successfulFetches.length === 1) {
        finalGraph = successfulFetches[0]!.graph
      } else {
        console.log('[sync-from-source] Merging', successfulFetches.length, 'graphs')

        // Check if we have configurable merge settings
        const sourceConfigs = new Map<string, TopologySourceMergeConfig>()
        for (const source of sourcesToFetch) {
          if (source.optionsJson) {
            try {
              const opts = JSON.parse(source.optionsJson) as TopologySourceMergeConfig
              sourceConfigs.set(source.dataSourceId, opts)
            } catch {
              // Ignore parse errors
            }
          }
        }

        // Find base source (first one marked as isBase, or first source)
        const baseSourceId =
          Array.from(sourceConfigs.entries()).find(([, cfg]) => cfg.isBase)?.[0] ??
          successfulFetches[0]!.sourceId
        const baseIndex = successfulFetches.findIndex((f) => f.sourceId === baseSourceId)

        // Build overlay configurations
        const overlayConfigs: OverlayConfig[] = []
        for (const fetch of successfulFetches) {
          if (fetch.sourceId === baseSourceId) continue

          const cfg = sourceConfigs.get(fetch.sourceId)
          overlayConfigs.push({
            sourceId: fetch.sourceId,
            match: cfg?.match ?? 'name', // Default to name matching
            matchAttribute: cfg?.matchAttribute,
            idMapping: cfg?.idMapping,
            onMatch: cfg?.onMatch ?? 'merge-properties',
            onUnmatched: cfg?.onUnmatched ?? 'add-to-subgraph',
            subgraphName: cfg?.subgraphName,
          })
        }

        console.log('[sync-from-source] Base source:', baseSourceId)
        console.log(
          '[sync-from-source] Overlay configs:',
          overlayConfigs.map((o) => `${o.sourceId}(${o.match})`).join(', '),
        )

        // Use configurable merge
        const mergeResult = mergeWithOverlays(
          successfulFetches.map((f) => f.graph),
          successfulFetches.map((f) => f.sourceId),
          {
            baseIndex,
            overlays: overlayConfigs,
          },
        )

        finalGraph = mergeResult.graph
        mergeInfo = {
          skippedNodes: mergeResult.skippedNodes.length,
          skippedLinks: mergeResult.skippedLinks.length,
        }

        console.log('[sync-from-source] Merge result by source:')
        for (const [sourceId, count] of mergeResult.nodeCountBySource) {
          console.log(`  ${sourceId}: ${count} nodes`)
        }

        if (mergeResult.skippedNodes.length > 0) {
          console.log(
            '[sync-from-source] Merge skipped',
            mergeResult.skippedNodes.length,
            'nodes:',
            mergeResult.skippedNodes
              .slice(0, 5)
              .map((n) => n.nodeId)
              .join(', '),
          )
        }
      }

      console.log(
        '[sync-from-source] Final graph:',
        finalGraph.nodes.length,
        'nodes,',
        finalGraph.links.length,
        'links',
      )

      // Update the topology content
      const updated = await service.update(id, {
        contentJson: JSON.stringify(finalGraph),
      })

      console.log('[sync-from-source] Topology updated successfully')

      return c.json({
        success: true,
        topology: updated,
        nodeCount: finalGraph.nodes.length,
        linkCount: finalGraph.links.length,
        sourcesCount: successfulFetches.length,
        failedSources: failedSources.length > 0 ? failedSources : undefined,
        mergeInfo,
      })
    } catch (err) {
      console.error('[sync-from-source] Error:', err)
      return c.json({ error: 'Internal server error' }, 500)
    }
  })

  // Get auto-mapping hints for a topology
  app.get('/:id/mapping-hints', async (c) => {
    const id = c.req.param('id')
    try {
      const parsed = await service.getParsed(id)
      if (!parsed) {
        return c.json({ error: 'Topology not found' }, 404)
      }

      if (!parsed.metricsSourceId) {
        return c.json({ error: 'No metrics source configured' }, 400)
      }

      const hints = await dataSourceService.getMappingHints(parsed.metricsSourceId, parsed.graph)
      return c.json(hints)
    } catch (err) {
      console.error('[Topologies] Error getting mapping hints:', err)
      return c.json({ error: 'Internal server error' }, 500)
    }
  })

  // Enable sharing (generate token)
  app.post('/:id/share', async (c) => {
    const id = c.req.param('id')
    const token = await service.share(id)
    if (!token) {
      return c.json({ error: 'Topology not found' }, 404)
    }
    return c.json({ shareToken: token })
  })

  // Disable sharing (remove token)
  app.delete('/:id/share', (c) => {
    const id = c.req.param('id')
    const success = service.unshare(id)
    if (!success) {
      return c.json({ error: 'Topology not found' }, 404)
    }
    return c.json({ success: true })
  })

  // Delete topology
  app.delete('/:id', (c) => {
    const id = c.req.param('id')
    const deleted = service.delete(id)
    if (!deleted) {
      return c.json({ error: 'Topology not found' }, 404)
    }
    return c.json({ success: true })
  })

  return app
}

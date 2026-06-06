/**
 * Topologies API
 * CRUD endpoints for topology management
 */

import { buildHierarchicalSheets, type NetworkGraph, specDeviceType } from '@shumoku/core'
import { type EmbeddableRenderOutput, renderEmbeddable } from '@shumoku/renderer-svg'
import { Hono } from 'hono'
import { getLayoutEngine } from '../layout.js'
import { hasAutoscanCapability, hasTopologyCapability } from '../plugins/types.js'
import { DataSourceService } from '../services/datasource.js'
import { resolveCredentialsForAutoscan } from '../services/discovery-scheduler.js'
import { ObservationsService } from '../services/observations.js'
import { type ParsedTopology, TopologyService } from '../services/topology.js'
import { TopologySourcesService } from '../services/topology-sources.js'
import type { MetricsMapping, TopologyInput } from '../types.js'

/**
 * Overlay per-link bandwidth from the metrics mapping onto the graph.
 * When the operator has set `mapping.links[id].bandwidth`, that value
 * wins over the topology's `link.bandwidth` for everything downstream
 * (stroke-width rendering, layout width, metrics capacity). Returns
 * a shallow-copied graph so callers don't mutate the service's cache.
 */
export function applyMappingBandwidth(graph: NetworkGraph, mapping?: MetricsMapping): NetworkGraph {
  if (!mapping?.links || Object.keys(mapping.links).length === 0) return graph
  let changed = false
  const links = graph.links.map((link, i) => {
    const linkId = link.id || `link-${i}`
    const override = mapping.links[linkId]?.bandwidth
    if (override === undefined) return link
    changed = true
    return { ...link, bandwidth: override }
  })
  return changed ? { ...graph, links } : graph
}

/**
 * Build render output from a parsed topology
 * Shared between authenticated and public (share) endpoints
 */
export async function buildRenderOutput(parsed: import('../services/topology.js').ParsedTopology) {
  const hasSubgraphs = parsed.graph.subgraphs && parsed.graph.subgraphs.length > 0

  if (hasSubgraphs) {
    const sheets = await buildHierarchicalSheets(parsed.graph, parsed.layout, getLayoutEngine())

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
          resolved: sheetData.resolved,
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
    {
      graph: parsed.graph,
      layout: parsed.layout,
      resolved: parsed.resolved,
      iconDimensions: parsed.iconDimensions,
    },
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

/**
 * Build the simplified context payload (nodes, edges, subgraphs, metrics)
 * served by `GET /topologies/:id/context` and its shared-dashboard twin in
 * `share.ts`. Kept here so both paths return byte-identical shapes.
 */
export function buildTopologyContext(parsed: ParsedTopology) {
  // Build a node lookup so we can resolve link endpoints to their port objects.
  const nodeById = new Map(parsed.graph.nodes.map((n) => [n.id, n]))
  const resolvePort = (nodeId: string, portId: string | undefined) => {
    if (!portId) return undefined
    const port = nodeById.get(nodeId)?.ports?.find((p) => p.id === portId)
    if (!port) return undefined
    return {
      id: port.id,
      label: port.label || undefined,
      interfaceName: port.interfaceName,
      aliases: port.aliases,
    }
  }

  return {
    id: parsed.id,
    name: parsed.name,
    nodes: parsed.graph.nodes.map((n) => ({
      id: n.id,
      label: n.label || n.id,
      type: specDeviceType(n.spec),
      // Carry discovery identity (mgmtIp / chassisId / sysName / vendorIds) so the
      // mapping UI can auto-bind a node to a host deterministically, not by name.
      ...(n.identity ? { identity: n.identity } : {}),
    })),
    edges: parsed.graph.links.map((l, i) => ({
      id: l.id || `link-${i}`,
      from: {
        nodeId: l.from.node,
        port: l.from.port,
        portInfo: resolvePort(l.from.node, l.from.port),
      },
      to: {
        nodeId: l.to.node,
        port: l.to.port,
        portInfo: resolvePort(l.to.node, l.to.port),
      },
      standard: l.from.plug?.module?.standard ?? l.to.plug?.module?.standard,
    })),
    subgraphs: parsed.graph.subgraphs || [],
    metrics: parsed.metrics,
    topologySourceId: parsed.topologySourceId,
    metricsSourceId: parsed.metricsSourceId,
    mapping: parsed.mapping,
  }
}

export function getTopologyService(): TopologyService {
  if (!_topologyService) {
    _topologyService = new TopologyService()
  }
  return _topologyService
}

export function getDataSourceService(): DataSourceService {
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
        const parseError = service.getParseError(id)
        if (parseError) {
          return c.json({ error: parseError.message, errorPhase: parseError.phase }, 422)
        }
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
        graph: applyMappingBandwidth(parsed.graph, parsed.mapping),
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
      const message = err instanceof Error ? err.message : String(err)
      return c.json({ error: message }, 500)
    }
  })

  // Get raw NetworkGraph for client-side rendering via @shumoku/renderer.
  // Layout is computed in the browser (computeNetworkLayout) so sheet
  // switching stays local to the client — matches the editor pattern.
  app.get('/:id/graph', async (c) => {
    const id = c.req.param('id')
    try {
      const parsed = await service.getParsed(id)
      if (!parsed) {
        const parseError = service.getParseError(id)
        if (parseError) {
          return c.json({ error: parseError.message, errorPhase: parseError.phase }, 422)
        }
        return c.json({ error: 'Topology not found' }, 404)
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
        const parseError = service.getParseError(id)
        if (parseError) {
          return c.json({ error: parseError.message, errorPhase: parseError.phase }, 422)
        }
        return c.json({ error: 'Topology not found' }, 404)
      }
      const output = await buildRenderOutput(parsed)
      service.setRenderCache(id, output)
      return c.json(output)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return c.json({ error: message }, 500)
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
      return c.json(buildTopologyContext(parsed))
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return c.json({ error: message }, 500)
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
      if (!body.name) {
        return c.json({ error: 'name is required' }, 400)
      }
      // contentJson is optional — when present, create() attaches a
      // Manual source and records the first observation. See
      // TopologyService.create().

      const topology = await service.create(body)
      return c.json(topology, 201)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return c.json({ error: message }, 400)
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
      const message = err instanceof Error ? err.message : String(err)
      return c.json({ error: message }, 400)
    }
  })

  // Get the resolved metrics mapping (metrics-binding attachments ∪ residual
  // mapping_json). This is the authoritative view the UI must hydrate from —
  // reading topology.mappingJson alone misses node bindings stored as
  // attachments and would strip them on the next save.
  app.get('/:id/mapping', async (c) => {
    const id = c.req.param('id')
    try {
      const parsed = await service.getParsed(id)
      if (!parsed) return c.json({ error: 'Topology not found' }, 404)
      return c.json(parsed.mapping ?? { nodes: {}, links: {} })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return c.json({ error: message }, 400)
    }
  })

  // Update mapping
  app.put('/:id/mapping', async (c) => {
    const id = c.req.param('id')
    try {
      const mapping = (await c.req.json()) as MetricsMapping
      const topology = await service.updateMapping(id, mapping)
      if (!topology) {
        return c.json({ error: 'Topology not found' }, 404)
      }
      return c.json(topology)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return c.json({ error: message }, 400)
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

      // Start from the FULL current mapping (bindings ∪ residual mapping_json),
      // not just the mapping_json blob — node bindings now live as attachments,
      // so reading the blob alone would drop them on the next save. If the graph
      // can't be resolved right now, REFUSE: reconciling against an incomplete
      // mapping would strip every existing binding for the source.
      const parsed = await service.getParsed(id)
      if (!parsed) {
        return c.json(
          { error: 'cannot resolve current mapping; refusing to patch (would drop bindings)' },
          409,
        )
      }
      const mapping: MetricsMapping = {
        nodes: { ...(parsed.mapping?.nodes ?? {}) },
        links: { ...(parsed.mapping?.links ?? {}) },
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
      const updated = await service.updateMapping(id, mapping)
      return c.json({
        success: true,
        topology: updated,
        nodeMapping: mapping.nodes[nodeId] || null,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return c.json({ error: message }, 400)
    }
  })

  /**
   * Sync ALL topology-purpose sources for this topology.
   *
   * Observation-model dispatch: each source is invoked via its capability
   * (autoscan plugins → `scan()`, others → `fetchTopology()`). Every
   * result is recorded as a row in `topology_observations` — we no
   * longer overwrite `topology.content_json` (that 's the authored
   * layer, owned by the editor). The diagram surfaces the new snapshots
   * by re-running `resolve()` on the next render call.
   *
   * The legacy "merge multiple source graphs into content_json" path is
   * gone: with observations, multi-source merging happens at read time
   * inside `resolve()` rather than at sync time.
   */
  app.post('/:id/sync-from-source', async (c) => {
    const id = c.req.param('id')
    try {
      const topology = service.get(id)
      if (!topology) {
        return c.json({ error: 'Topology not found' }, 404)
      }

      const sourcesToSync = getTopologySourcesService().listByPurpose(id, 'topology')
      if (sourcesToSync.length === 0) {
        return c.json({ error: 'No topology sources attached' }, 400)
      }

      console.log(
        `[sync-from-source] ${id}: syncing ${sourcesToSync.length} source(s):`,
        sourcesToSync.map((s) => s.dataSourceId).join(', '),
      )

      const observationsService = new ObservationsService()
      const perSourceResults: Array<{
        sourceId: string
        status: 'ok' | 'partial' | 'failed' | 'empty'
        nodeCount: number
        linkCount: number
        message?: string
      }> = []
      let totalNodes = 0
      let totalLinks = 0

      // Drive every source in parallel — slow netbox shouldn 't block fast snmp.
      const settled = await Promise.allSettled(
        sourcesToSync.map(async (source) => {
          const plugin = dataSourceService.getPlugin(source.dataSourceId)
          if (!plugin) {
            throw new Error('Data source not found / plugin failed to load')
          }
          const capturedAt = Date.now()
          let graph: NetworkGraph | null = null
          let status: 'ok' | 'partial' | 'failed' | 'empty' = 'ok'
          let statusMessage: string | undefined

          if (hasAutoscanCapability(plugin)) {
            // network-scan and other autoscan plugins return a Snapshot directly.
            const credentials = resolveCredentialsForAutoscan(id, getTopologyService())
            const snapshot = await plugin.scan({ seeds: [], credentials })
            graph = snapshot.graph
            status = snapshot.status
            statusMessage = snapshot.statusMessage
          } else if (hasTopologyCapability(plugin)) {
            // NetBox / Zabbix-topology / etc. — wrap fetchTopology in a snapshot.
            const opts = source.optionsJson ? JSON.parse(source.optionsJson) : undefined
            graph = await plugin.fetchTopology(opts)
            status = graph?.nodes && graph.nodes.length > 0 ? 'ok' : 'empty'
          } else {
            throw new Error(
              `Plugin ${plugin.type} cannot supply topology (no autoscan or topology capability)`,
            )
          }

          await observationsService.record({
            topologyId: id,
            sourceId: source.dataSourceId,
            capturedAt,
            status,
            statusMessage,
            graph,
          })
          observationsService.updateHysteresis(
            id,
            source.dataSourceId,
            status === 'failed' ? 'failed' : 'ok',
            capturedAt,
          )

          return {
            sourceId: source.dataSourceId,
            status,
            nodeCount: graph?.nodes?.length ?? 0,
            linkCount: graph?.links?.length ?? 0,
            message: statusMessage,
          }
        }),
      )

      for (const r of settled) {
        if (r.status === 'fulfilled') {
          perSourceResults.push(r.value)
          totalNodes += r.value.nodeCount
          totalLinks += r.value.linkCount
        } else {
          const message = r.reason instanceof Error ? r.reason.message : String(r.reason)
          perSourceResults.push({
            sourceId: 'unknown',
            status: 'failed',
            nodeCount: 0,
            linkCount: 0,
            message,
          })
          console.error('[sync-from-source] source failed:', message)
        }
      }

      // Invalidate parsed-topology cache so the next /render / /graph
      // call re-runs resolve() across the newly-recorded observations.
      service.clearCacheEntry(id)

      return c.json({
        success: true,
        topology,
        // Legacy keys preserved for any caller that reads them.
        nodeCount: totalNodes,
        linkCount: totalLinks,
        sourcesCount: perSourceResults.filter((r) => r.status !== 'failed').length,
        results: perSourceResults,
      })
    } catch (err) {
      console.error('[sync-from-source] Error:', err)
      const message = err instanceof Error ? err.message : String(err)
      return c.json({ error: message }, 500)
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

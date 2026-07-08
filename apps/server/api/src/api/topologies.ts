/**
 * Topologies API
 * CRUD endpoints for topology management
 */

import {
  buildHierarchicalSheets,
  type NetworkGraph,
  type ScopeFilter,
  specDeviceType,
  stringifyWithMaps,
} from '@shumoku/core'
import { type EmbeddableRenderOutput, renderEmbeddable } from '@shumoku/renderer-svg'
import { Hono } from 'hono'
import { getLayoutEngine } from '../layout.js'
import { DataSourceService } from '../services/datasource.js'
import { ObservationsService } from '../services/observations.js'
import { cancelSyncJob, getSyncJob, startSyncJob, syncJobView } from '../services/sync-job.js'
import { type ParsedTopology, TopologyService } from '../services/topology.js'
import { TopologySourcesService } from '../services/topology-sources.js'
import type {
  CompositionMode,
  MetricsMapping,
  ScopeMode,
  Topology,
  TopologyInput,
} from '../types.js'

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
        // First-ever bake still running — nothing to serve yet. 202 tells the
        // client to keep its loading state and poll.
        if (service.deriving(id)) {
          return c.json({ deriving: true }, 202)
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
        stale: parsed.stale ?? false,
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
        if (service.deriving(id)) {
          return c.json({ deriving: true }, 202)
        }
        return c.json({ error: 'Topology not found' }, 404)
      }
      return c.json({
        id: parsed.id,
        name: parsed.name,
        graph: applyMappingBandwidth(parsed.graph, parsed.mapping),
        stale: parsed.stale ?? false,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return c.json({ error: message }, 500)
    }
  })

  // Full client-view payload: graph + the SERVER-BAKED ResolvedLayout in one
  // consistent snapshot (Maps tagged via stringifyWithMaps; the client parses
  // with parseWithMaps). The interactive viewer uses this to skip its own
  // computeNetworkLayout for the root sheet — a large layout re-run on the
  // browser main thread froze the tab for minutes.
  app.get('/:id/view', async (c) => {
    const id = c.req.param('id')
    try {
      const parsed = await service.getParsed(id)
      if (!parsed) {
        const parseError = service.getParseError(id)
        if (parseError) {
          return c.json({ error: parseError.message, errorPhase: parseError.phase }, 422)
        }
        if (service.deriving(id)) {
          return c.json({ deriving: true }, 202)
        }
        return c.json({ error: 'Topology not found' }, 404)
      }
      const body = stringifyWithMaps({
        id: parsed.id,
        name: parsed.name,
        graph: applyMappingBandwidth(parsed.graph, parsed.mapping),
        resolved: parsed.resolved,
        stale: parsed.stale ?? false,
      })
      return c.body(body, 200, { 'Content-Type': 'application/json' })
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
        if (service.deriving(id)) {
          return c.json({ deriving: true }, 202)
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
        if (service.deriving(id)) {
          return c.json({ deriving: true }, 202)
        }
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

  // Topology scope (composition). A single per-topology decision. `scope` is the
  // common ScopeFilter (include/exclude criteria) the resolver enforces post-merge;
  // scopeMode/scopeSourceId is the older region-mark path, kept during transition.
  const compositionOf = (t: Topology) => ({
    scopeMode: t.scopeMode,
    scopeSourceId: t.scopeSourceId,
    scope: t.scope,
    compositionMode: t.compositionMode,
  })

  app.get('/:id/composition', (c) => {
    const id = c.req.param('id')
    const topology = service.get(id)
    if (!topology) return c.json({ error: 'Topology not found' }, 404)
    return c.json(compositionOf(topology))
  })

  app.put('/:id/composition', async (c) => {
    const id = c.req.param('id')
    try {
      const body = (await c.req.json()) as {
        scopeMode?: ScopeMode
        scopeSourceId?: string | null
        scope?: ScopeFilter
        compositionMode?: CompositionMode
      }
      let topology = service.get(id)
      if (!topology) return c.json({ error: 'Topology not found' }, 404)
      if (body.scopeMode !== undefined || body.scopeSourceId !== undefined) {
        topology = service.setScope(id, body.scopeMode ?? 'auto', body.scopeSourceId ?? undefined)
      }
      if (body.scope !== undefined) {
        topology = service.setScopeCriteria(id, body.scope)
      }
      if (body.compositionMode !== undefined) {
        topology = service.setCompositionMode(id, body.compositionMode)
      }
      if (!topology) return c.json({ error: 'Topology not found' }, 404)
      return c.json(compositionOf(topology))
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return c.json({ error: message }, 400)
    }
  })

  // Get the metrics mapping, element-keyed (node id / link id). Projected from
  // the entity-keyed `metrics_mapping` rows through the resolved graph's stamped
  // entity ids — the authoritative view the UI must hydrate from before a save.
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

  // Mapping orphans: rows whose entity is no longer present in the resolved graph
  // (a mapping pointing at a retired / disappeared element). Surfaced so the UI
  // can offer re-assignment instead of silently dropping the mapping.
  app.get('/:id/mapping/orphans', async (c) => {
    const id = c.req.param('id')
    try {
      if (!service.get(id)) return c.json({ error: 'Topology not found' }, 404)
      const orphans = await service.mappingOrphans(id)
      return c.json({ orphans })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return c.json({ error: message }, 400)
    }
  })

  // Reassign an orphaned mapping row to a live entity (Phase 4). Moves the
  // metrics_mapping row to `toEntityId` after validating it exists in the
  // current resolved graph and its kind matches — the "drift is visible, never
  // silent" repair action.
  app.post('/:id/mapping/orphans/:entityId/reassign', async (c) => {
    const id = c.req.param('id')
    const entityId = c.req.param('entityId')
    try {
      if (!service.get(id)) return c.json({ error: 'Topology not found' }, 404)
      const body = (await c.req.json()) as { toEntityId?: string }
      if (!body.toEntityId) return c.json({ error: 'toEntityId is required' }, 400)
      const result = await service.reassignOrphan(id, entityId, body.toEntityId)
      if (!result.ok) return c.json({ error: result.error }, 400)
      return c.json({ success: true })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return c.json({ error: message }, 400)
    }
  })

  // Discard an orphaned mapping row (Phase 4).
  app.delete('/:id/mapping/orphans/:entityId', (c) => {
    const id = c.req.param('id')
    const entityId = c.req.param('entityId')
    try {
      if (!service.get(id)) return c.json({ error: 'Topology not found' }, 404)
      const deleted = service.discardOrphan(id, entityId)
      if (!deleted) return c.json({ error: 'Orphan not found' }, 404)
      return c.json({ success: true })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return c.json({ error: message }, 400)
    }
  })

  // Full entity-registry reset (Phase 4). DESTRUCTIVE: wipes entity_registry,
  // its identity keys / aliases / retire counters, AND the metrics_mapping rows
  // for this topology. The next resolve re-mints fresh entities. Distinct from
  // Rebuild (which keeps the human/entity layer); guard with a confirm in the UI.
  app.post('/:id/registry/reset', (c) => {
    const id = c.req.param('id')
    try {
      if (!service.get(id)) return c.json({ error: 'Topology not found' }, 404)
      service.resetRegistry(id)
      return c.json({ success: true })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return c.json({ error: message }, 500)
    }
  })

  // Update mapping. Returns the topology PLUS `skipped` — how many node/link
  // bindings couldn't be persisted (the source didn't provide identity to anchor
  // them). The UI warns on skipped > 0 instead of reporting a clean save.
  //
  // Wave B-3 (#569): accepts either the legacy bare MetricsMapping shape or the
  // new wrapper `{ mapping: MetricsMapping, sourceId?: string }` (detected by the
  // presence of a top-level `mapping` key). The legacy shape is unchanged
  // byte-identically — existing callers that PUT a bare mapping still work.
  // `PATCH /:id/mapping/nodes/:nodeId` stays first-source (single-node quick edit).
  app.put('/:id/mapping', async (c) => {
    const id = c.req.param('id')
    try {
      const body = (await c.req.json()) as
        | MetricsMapping
        | { mapping: MetricsMapping; sourceId?: string }
      // Detect wrapper shape: presence of a `mapping` key whose value is an object.
      let mapping: MetricsMapping
      let sourceId: string | undefined
      if (
        body !== null &&
        typeof body === 'object' &&
        'mapping' in body &&
        typeof (body as { mapping?: unknown }).mapping === 'object'
      ) {
        mapping = (body as { mapping: MetricsMapping; sourceId?: string }).mapping
        sourceId = (body as { mapping: MetricsMapping; sourceId?: string }).sourceId
      } else {
        mapping = body as MetricsMapping
      }
      const result = await service.updateMapping(id, mapping, { sourceId })
      if (result.error === 'invalidSource') {
        return c.json(
          { error: 'sourceId is not an attached metrics source for this topology' },
          400,
        )
      }
      if (result.error === 'noMetricsSource') {
        return c.json(
          { error: 'no metrics source attached to this topology — attach one before mapping' },
          409,
        )
      }
      if (!result.topology) {
        return c.json({ error: 'Topology not found' }, 404)
      }
      return c.json({ ...result.topology, skipped: result.skipped })
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

      // Start from the FULL current element-keyed mapping (projected from the
      // metrics_mapping rows), so a single-node PATCH doesn't drop the other
      // entries on the next save. If the graph can't be resolved right now,
      // REFUSE: rewriting against an incomplete mapping would drop entries.
      const parsed = await service.getParsed(id)
      if (!parsed) {
        return c.json(
          { error: 'cannot resolve current mapping; refusing to patch (would drop entries)' },
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
      const result = await service.updateMapping(id, mapping)
      if (result.error === 'noMetricsSource') {
        return c.json(
          { error: 'no metrics source attached to this topology — attach one before mapping' },
          409,
        )
      }
      return c.json({
        success: true,
        topology: result.topology,
        nodeMapping: mapping.nodes[nodeId] || null,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return c.json({ error: message }, 400)
    }
  })

  // Update single link mapping (PATCH) — symmetric with per-node PATCH.
  // body = { monitoredNodeId?, interface?, bandwidth?, sourceId? } — the FULL
  // desired state for this link (replace, not merge). All mapping fields
  // absent (or body null) → row deleted for this link. 422 when the entry
  // can't be anchored to a stable entity id (never a silent drop).
  app.patch('/:id/mapping/links/:linkId', async (c) => {
    const id = c.req.param('id')
    const linkId = c.req.param('linkId')
    try {
      const body = (await c.req.json()) as {
        monitoredNodeId?: string
        interface?: string
        bandwidth?: number
        sourceId?: string
      } | null
      const topology = service.get(id)
      if (!topology) {
        return c.json({ error: 'Topology not found' }, 404)
      }

      // Refuse when the graph can't be resolved — same guard as per-node PATCH.
      const parsed = await service.getParsed(id)
      if (!parsed) {
        return c.json(
          { error: 'cannot resolve current mapping; refusing to patch (would drop entries)' },
          409,
        )
      }

      // Validate linkId exists in the current graph.
      const linkKeys = new Set(parsed.graph.links.map((l, i) => l.id || `link-${i}`))
      if (!linkKeys.has(linkId)) {
        return c.json({ error: `Link '${linkId}' not found in current resolved graph` }, 404)
      }

      const opts = body?.sourceId ? { sourceId: body.sourceId } : undefined
      const result = await service.patchLinkMapping(id, linkId, body, opts)
      if (result.error === 'invalidSource') {
        return c.json(
          { error: 'sourceId is not an attached metrics source for this topology' },
          400,
        )
      }
      if (result.error === 'noMetricsSource') {
        return c.json(
          { error: 'no metrics source attached to this topology — attach one before mapping' },
          409,
        )
      }
      if (!result.topology) {
        return c.json({ error: 'Topology not found' }, 404)
      }
      // No silent drop: a skipped write means this entry has no stable entity
      // id to anchor on (the source may not provide identity). Tell the caller
      // instead of reporting a clean success for a write that didn't land.
      const dropped = result.skipped.nodes + result.skipped.links
      if (dropped > 0) {
        return c.json(
          {
            error:
              'mapping not persisted: the link or its monitored node has no stable entity id ' +
              '(the source may not provide identity)',
          },
          422,
        )
      }
      return c.json({
        success: true,
        topology: result.topology,
        linkMapping: result.linkMapping ?? null,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return c.json({ error: message }, 400)
    }
  })

  // Bulk delete all node mappings for this topology.
  // Optional ?sourceId= restricts to rows of a specific metrics source.
  app.delete('/:id/mapping/nodes', async (c) => {
    const id = c.req.param('id')
    try {
      if (!service.get(id)) return c.json({ error: 'Topology not found' }, 404)
      const sourceId = c.req.query('sourceId') || undefined
      const result = service.deleteMappingByKind(id, 'node', sourceId ? { sourceId } : undefined)
      if (result.error === 'invalidSource') {
        return c.json(
          { error: 'sourceId is not an attached metrics source for this topology' },
          400,
        )
      }
      return c.json({ deleted: result.deleted })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return c.json({ error: message }, 400)
    }
  })

  // Bulk delete all link mappings for this topology.
  // Optional ?sourceId= restricts to rows of a specific metrics source.
  app.delete('/:id/mapping/links', async (c) => {
    const id = c.req.param('id')
    try {
      if (!service.get(id)) return c.json({ error: 'Topology not found' }, 404)
      const sourceId = c.req.query('sourceId') || undefined
      const result = service.deleteMappingByKind(id, 'link', sourceId ? { sourceId } : undefined)
      if (result.error === 'invalidSource') {
        return c.json(
          { error: 'sourceId is not an attached metrics source for this topology' },
          400,
        )
      }
      return c.json({ deleted: result.deleted })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return c.json({ error: message }, 400)
    }
  })

  // Server-side link auto-map: resolves interface via port identity, writes mapping rows.
  // Wave B-3 (#569): optional `sourceId` in body addresses a specific metrics source.
  app.post('/:id/mapping/auto-map-links', async (c) => {
    const id = c.req.param('id')
    try {
      const body = (await c.req.json().catch(() => ({}))) as {
        overwrite?: boolean
        sourceId?: string
      }
      if (!service.get(id)) return c.json({ error: 'Topology not found' }, 404)
      const result = await service.autoMapLinks(id, dataSourceService, {
        overwrite: body.overwrite ?? false,
        sourceId: body.sourceId,
      })
      if (result.error === 'invalidSource') {
        return c.json(
          { error: 'sourceId is not an attached metrics source for this topology' },
          400,
        )
      }
      return c.json(result)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return c.json({ error: message }, 400)
    }
  })

  /**
   * Sync ALL topology-purpose sources — as a TRACKED JOB.
   *
   * Starts a background sync job (per-source fetch → record observation →
   * one derivation bake) and returns its initial state immediately. The UI
   * drives a progress modal by polling `GET /:id/sync-job`, so a page reload
   * mid-sync re-attaches instead of losing the run. Cancellation via
   * `POST /:id/sync-job/cancel`.
   *
   * Observation-model dispatch (unchanged semantics): each source is invoked
   * via its capability (autoscan → `scan()`, others → `fetchTopology()`);
   * multi-source merging happens at read time inside `resolve()`.
   */
  app.post('/:id/sync-from-source', async (c) => {
    const id = c.req.param('id')
    const topology = service.get(id)
    if (!topology) {
      return c.json({ error: 'Topology not found' }, 404)
    }

    const running = getSyncJob(id)
    if (running && running.state === 'running') {
      // Already in flight — let the caller attach to it.
      return c.json({ job: syncJobView(running) }, 409)
    }

    // Manual is hand-edited, never fetched — exclude it (it has no topology/
    // autoscan capability and would just record a spurious 'failed'). Mirrors
    // the discovery scheduler, which already filters it.
    const sourcesToSync = getTopologySourcesService()
      .listByPurpose(id, 'topology')
      .filter((s) => s.dataSource?.type !== 'manual')

    console.log(
      `[sync-from-source] ${id}: starting sync job for ${sourcesToSync.length} source(s):`,
      sourcesToSync.map((s) => s.dataSourceId).join(', '),
    )

    const job = startSyncJob(id, sourcesToSync, {
      topologyService: service,
      topologySourcesService: getTopologySourcesService(),
      dataSourceService,
      observationsService: new ObservationsService(),
    })
    if (!job) {
      return c.json({ error: 'No topology sources attached' }, 400)
    }
    return c.json({ job: syncJobView(job) }, 202)
  })

  /**
   * Rebuild = blank, then re-sync. Delete every syncable source's observed data
   * and invalidate the cached layout, then run the same sync job. On the blank
   * slate every fetch is entirely "new", so the no-change gate passes and the
   * layout re-derives from scratch — no force needed. Drives the same progress
   * modal as Sync all. The human curation overlay is kept (it is a separate
   * layer from observed data; use the discovery-policy reset to drop that).
   */
  app.post('/:id/rebuild', async (c) => {
    const id = c.req.param('id')
    const topology = service.get(id)
    if (!topology) {
      return c.json({ error: 'Topology not found' }, 404)
    }
    const running = getSyncJob(id)
    if (running && running.state === 'running') {
      return c.json({ job: syncJobView(running) }, 409)
    }
    const sourcesToSync = getTopologySourcesService()
      .listByPurpose(id, 'topology')
      .filter((s) => s.dataSource?.type !== 'manual')

    // Blank: drop each source's observed data, then invalidate the artifact.
    const observationsService = new ObservationsService()
    for (const source of sourcesToSync) {
      observationsService.deleteForSource(id, source.dataSourceId)
    }
    service.clearCacheEntry(id)
    console.log(`[rebuild] ${id}: blanked ${sourcesToSync.length} source(s), re-syncing`)

    const job = startSyncJob(id, sourcesToSync, {
      topologyService: service,
      topologySourcesService: getTopologySourcesService(),
      dataSourceService,
      observationsService,
    })
    if (!job) {
      return c.json({ error: 'No topology sources attached' }, 400)
    }
    return c.json({ job: syncJobView(job) }, 202)
  })

  // Current (or last finished) sync job — the progress modal polls this, and
  // a freshly-loaded page uses it to re-attach to a run already in flight.
  app.get('/:id/sync-job', (c) => {
    const id = c.req.param('id')
    if (!service.get(id)) {
      return c.json({ error: 'Topology not found' }, 404)
    }
    const job = getSyncJob(id)
    return c.json({ job: job ? syncJobView(job) : null })
  })

  // Cancel the in-flight sync job (fetches are discarded, the derivation
  // Worker is terminated). No-op when nothing is running.
  app.post('/:id/sync-job/cancel', (c) => {
    const id = c.req.param('id')
    if (!service.get(id)) {
      return c.json({ error: 'Topology not found' }, 404)
    }
    const job = cancelSyncJob(id)
    return c.json({ job: job ? syncJobView(job) : null })
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

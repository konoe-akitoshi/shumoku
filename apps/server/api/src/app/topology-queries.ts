import { buildHierarchicalSheets, specDeviceType, stringifyWithMaps } from '@shumoku/core'
import { type EmbeddableRenderOutput, renderEmbeddable } from '@shumoku/renderer-svg'
import { getLayoutEngine } from '../layout.js'
import type { ParsedTopology, TopologyService } from '../services/topology.js'
import type { Topology } from '../types.js'
import type {
  TopologyCompositionView,
  TopologyContextView,
  TopologyQueryApplicationService,
  TopologyReadResult,
  TopologyRenderView,
} from './services.js'
import { applyMappingBandwidth } from './topology-graph.js'

export async function buildRenderOutput(parsed: ParsedTopology): Promise<TopologyRenderView> {
  if (parsed.graph.subgraphs && parsed.graph.subgraphs.length > 0) {
    const sheets = await buildHierarchicalSheets(parsed.graph, parsed.layout, getLayoutEngine())
    const renderedSheets: Extract<TopologyRenderView, { hierarchical: true }>['sheets'] = {}
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
        const subgraph = parsed.graph.subgraphs?.find((item) => item.id === sheetId)
        if (subgraph) label = subgraph.label || sheetId
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
      hierarchical: true,
      sheets: renderedSheets,
      rootSheetId: 'root',
      nodeCount: parsed.graph.nodes.length,
      edgeCount: parsed.graph.links.length,
    }
  }
  const output: EmbeddableRenderOutput = renderEmbeddable(
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
    hierarchical: false,
    svg: output.svg,
    css: output.css,
    viewBox: output.viewBox,
    nodeCount: parsed.graph.nodes.length,
    edgeCount: parsed.graph.links.length,
  }
}

function compositionOf(topology: Topology): TopologyCompositionView {
  return {
    scopeMode: topology.scopeMode,
    scopeSourceId: topology.scopeSourceId,
    scope: topology.scope,
    compositionMode: topology.compositionMode,
  }
}

function contextOf(parsed: ParsedTopology): TopologyContextView {
  const nodeById = new Map(parsed.graph.nodes.map((node) => [node.id, node]))
  const resolvePort = (nodeId: string, portId: string | undefined) => {
    if (!portId) return undefined
    const port = nodeById.get(nodeId)?.ports?.find((item) => item.id === portId)
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
    nodes: parsed.graph.nodes.map((node) => ({
      id: node.id,
      label: Array.isArray(node.label) ? node.label.join(' / ') : node.label || node.id,
      type: specDeviceType(node.spec) ?? 'unknown',
      ...(node.identity ? { identity: node.identity } : {}),
    })),
    edges: parsed.graph.links.map((link, index) => ({
      id: link.id || `link-${index}`,
      from: {
        nodeId: link.from.node,
        port: link.from.port,
        portInfo: resolvePort(link.from.node, link.from.port),
      },
      to: {
        nodeId: link.to.node,
        port: link.to.port,
        portInfo: resolvePort(link.to.node, link.to.port),
      },
      standard: link.from.plug?.module?.standard ?? link.to.plug?.module?.standard,
    })),
    subgraphs: parsed.graph.subgraphs,
    metrics: parsed.metrics,
    metricsSourceId: parsed.metricsSourceId,
    mapping: parsed.mapping,
  }
}

function missing<T>(service: TopologyService, id: string): TopologyReadResult<T> {
  const parseError = service.getParseError(id)
  if (parseError) {
    return {
      kind: 'error',
      status: 422,
      error: parseError.message,
      errorPhase: parseError.phase,
    }
  }
  if (service.deriving(id)) return { kind: 'deriving' }
  return { kind: 'error', status: 404, error: 'Topology not found' }
}

function failed(error: unknown): TopologyReadResult<never> {
  return {
    kind: 'error',
    status: 500,
    error: error instanceof Error ? error.message : String(error),
  }
}

export function createTopologyQueryApplicationService(
  service: TopologyService,
): TopologyQueryApplicationService {
  return {
    async parsed(id) {
      try {
        const parsed = await service.getParsed(id)
        if (!parsed) return missing(service, id)
        const nodes: Record<string, { x: number; y: number }> = {}
        for (const [nodeId, layoutNode] of parsed.layout.nodes) {
          nodes[nodeId] = { x: layoutNode.position.x, y: layoutNode.position.y }
        }
        return {
          kind: 'ready',
          value: {
            id: parsed.id,
            name: parsed.name,
            graph: applyMappingBandwidth(parsed.graph, parsed.mapping),
            layout: { nodes, bounds: parsed.layout.bounds },
            metrics: parsed.metrics,
            metricsSourceId: parsed.metricsSourceId,
            mapping: parsed.mapping,
            stale: parsed.stale ?? false,
          },
        }
      } catch (error) {
        return failed(error)
      }
    },
    async graph(id) {
      try {
        const parsed = await service.getParsed(id)
        if (!parsed) return missing(service, id)
        return {
          kind: 'ready',
          value: {
            id: parsed.id,
            name: parsed.name,
            graph: applyMappingBandwidth(parsed.graph, parsed.mapping),
            stale: parsed.stale ?? false,
          },
        }
      } catch (error) {
        return failed(error)
      }
    },
    async serializedView(id) {
      try {
        const parsed = await service.getParsed(id)
        if (!parsed) return missing(service, id)
        return {
          kind: 'ready',
          value: stringifyWithMaps({
            id: parsed.id,
            name: parsed.name,
            graph: applyMappingBandwidth(parsed.graph, parsed.mapping),
            resolved: parsed.resolved,
            stale: parsed.stale ?? false,
          }),
        }
      } catch (error) {
        return failed(error)
      }
    },
    async render(id) {
      try {
        const cached = service.getRenderCache(id)
        if (cached) return { kind: 'ready', value: cached as TopologyRenderView }
        const parsed = await service.getParsed(id)
        if (!parsed) return missing(service, id)
        const output = await buildRenderOutput(parsed)
        service.setRenderCache(id, output)
        return { kind: 'ready', value: output }
      } catch (error) {
        return failed(error)
      }
    },
    async context(id) {
      try {
        const parsed = await service.getParsed(id)
        if (!parsed) return missing(service, id)
        return { kind: 'ready', value: contextOf(parsed) }
      } catch (error) {
        return failed(error)
      }
    },
    getComposition(id) {
      const topology = service.get(id)
      return topology
        ? { kind: 'ready', value: compositionOf(topology) }
        : { kind: 'error', status: 404, error: 'Topology not found' }
    },
    updateComposition(id, input) {
      try {
        let topology = service.get(id)
        if (!topology) return { kind: 'error', status: 404, error: 'Topology not found' }
        if (input.scopeMode !== undefined || input.scopeSourceId !== undefined) {
          topology = service.setScope(
            id,
            input.scopeMode ?? 'auto',
            input.scopeSourceId ?? undefined,
          )
        }
        if (input.scope !== undefined) topology = service.setScopeCriteria(id, input.scope)
        if (input.compositionMode !== undefined) {
          topology = service.setCompositionMode(id, input.compositionMode)
        }
        return topology
          ? { kind: 'ready', value: compositionOf(topology) }
          : { kind: 'error', status: 404, error: 'Topology not found' }
      } catch (error) {
        return {
          kind: 'error',
          status: 400,
          error: error instanceof Error ? error.message : String(error),
        }
      }
    },
  }
}

import { darkTheme, lightTheme, specDeviceType } from '@shumoku/core'
import { renderSceneSvg } from '@shumoku/renderer/static'
import { renderSceneHtml, setIIFE } from '@shumoku/renderer-html'
import { INTERACTIVE_IIFE } from '@shumoku/renderer-html/iife-string'
import { renderSvgToPng } from '@shumoku/renderer-png'
import type { ParsedTopology, TopologyService } from '../services/topology.js'
import type { Topology } from '../types.js'
import type {
  ResolvedRecordView,
  TopologyCompositionView,
  TopologyContextView,
  TopologyExportArtifact,
  TopologyExportOptions,
  TopologyQueryApplicationService,
  TopologyReadResult,
  TopologyRenderView,
} from './services.js'
import { applyMappingBandwidth, applyMappingBandwidthToScene } from './topology-graph.js'

function safeExportName(value: string): string {
  const normalized = value
    .normalize('NFKC')
    .replace(/[<>:"/\\|?*]/g, ' ')
    .replace(/\p{Cc}/gu, ' ')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 80)
  return normalized || 'topology'
}

export async function buildTopologyExport(
  parsed: ParsedTopology,
  options: TopologyExportOptions,
): Promise<TopologyExportArtifact> {
  const extension = options.format
  const baseName = safeExportName(parsed.name)
  const filename = `${baseName}.${extension}`
  const themeType = parsed.graph.settings?.theme === 'dark' ? 'dark' : 'light'

  if (options.format === 'html') {
    setIIFE(INTERACTIVE_IIFE)
    const body = renderSceneHtml(parsed.scene, { title: parsed.name, theme: themeType })
    return { body, contentType: 'text/html', filename }
  }

  const svg = renderSceneSvg(parsed.scene, {
    theme: themeType === 'dark' ? darkTheme : lightTheme,
  })
  if (options.format === 'png') {
    const body = await renderSvgToPng(svg, { scale: options.scale })
    return { body: new Uint8Array(body), contentType: 'image/png', filename }
  }
  return { body: svg, contentType: 'image/svg+xml', filename }
}

export function buildRenderOutput(parsed: ParsedTopology): TopologyRenderView {
  const padding = 50
  const { bounds } = parsed.scene
  return {
    id: parsed.id,
    name: parsed.name,
    svg: renderSceneSvg(parsed.scene, {
      theme: parsed.graph.settings?.theme === 'dark' ? darkTheme : lightTheme,
    }),
    // Kept for API compatibility. The static SVG contains its styles.
    css: '',
    viewBox: {
      x: bounds.x - padding,
      y: bounds.y - padding,
      width: bounds.width + padding * 2,
      height: bounds.height + padding * 2,
    },
    nodeCount: parsed.graph.nodes.length,
    edgeCount: parsed.graph.links.length,
  }
}

/**
 * The record the web app reads beside the graph: per node its device attributes, provenance,
 * the sources' ids and metadata; per link its provenance. Attachments carry access settings and
 * stay on the server.
 */
function recordView(parsed: ParsedTopology): ResolvedRecordView {
  const nodes: ResolvedRecordView['nodes'] = {}
  for (const node of parsed.graph.nodes) {
    const observed = parsed.record.observation.nodes?.[node.id]
    nodes[node.id] = {
      attributes: parsed.record.attributes[node.id] ?? {},
      ...(observed?.provenance && { provenance: observed.provenance }),
      ...(observed?.vendorIds && { vendorIds: observed.vendorIds }),
      ...(observed?.metadata && { metadata: observed.metadata }),
    }
  }
  const links: ResolvedRecordView['links'] = {}
  for (const [i, link] of parsed.graph.links.entries()) {
    const key = link.id || `link-${i}`
    const observed = parsed.record.observation.links?.[key]
    links[key] = { ...(observed?.provenance && { provenance: observed.provenance }) }
  }
  return { nodes, links }
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
    nodes: parsed.graph.nodes.map((node) => {
      // The keys a hosts source can be matched on, as the host contract spells them.
      const attributes = parsed.record.attributes[node.id]
      const vendorIds = parsed.record.observation.nodes?.[node.id]?.vendorIds
      const identity = {
        ...(attributes?.address && { mgmtIp: attributes.address }),
        ...(attributes?.chassisId && { chassisId: attributes.chassisId }),
        ...(attributes?.sysName && { sysName: attributes.sysName }),
        ...(attributes?.mac && { mac: attributes.mac }),
        ...(vendorIds && { vendorIds }),
      }
      return {
        id: node.id,
        label: Array.isArray(node.label) ? node.label.join(' / ') : node.label || node.id,
        type: specDeviceType(node.spec) ?? 'unknown',
        ...(Object.keys(identity).length > 0 && { identity }),
      }
    }),
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
        for (const { node, box } of parsed.scene.nodes) {
          nodes[node.id] = { x: box.x + box.width / 2, y: box.y + box.height / 2 }
        }
        return {
          kind: 'ready',
          value: {
            id: parsed.id,
            name: parsed.name,
            graph: applyMappingBandwidth(parsed.graph, parsed.mapping),
            record: recordView(parsed),
            layout: { nodes, bounds: parsed.scene.bounds },
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
            record: recordView(parsed),
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
          value: JSON.stringify({
            id: parsed.id,
            name: parsed.name,
            graph: applyMappingBandwidth(parsed.graph, parsed.mapping),
            record: recordView(parsed),
            scene: applyMappingBandwidthToScene(parsed.scene, parsed.mapping),
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
        const output = buildRenderOutput(parsed)
        service.setRenderCache(id, output)
        return { kind: 'ready', value: output }
      } catch (error) {
        return failed(error)
      }
    },
    async export(id, options) {
      try {
        const parsed = await service.getParsed(id)
        if (!parsed) return missing(service, id)
        return { kind: 'ready', value: await buildTopologyExport(parsed, options) }
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

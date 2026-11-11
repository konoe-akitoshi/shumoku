/**
 * Public projections for shared resources.
 *
 * This module is the single, auditable surface that decides *what* an
 * anonymous (token-bearing) viewer is allowed to see. Share handlers must
 * never `c.json(<raw entity>)` — they pass the entity through a projection
 * here so internal-only fields (share tokens, data-source ids, host mappings,
 * port aliases, timestamps) never leak to an unauthenticated client.
 *
 * Mirrors Grafana's public-dashboard model: the server, not the client,
 * decides the shape of what's exposed, and that decision lives in one place
 * regardless of which door (topology link vs dashboard link) the request
 * came through.
 */

import type {
  Alert,
  DrawingScene,
  Link,
  MetricsData,
  MetricsMapping,
  NetworkGraph,
  Node,
  Subgraph,
} from '@shumoku/core'
import { specDeviceType } from '@shumoku/core'
import { applyMappingBandwidth } from '../../app/topology-graph.js'
import type { Topology } from '../../types.js'

interface ShareParsedTopology {
  id: string
  name: string
  graph: NetworkGraph
  metrics: MetricsData
  mapping?: MetricsMapping
}

/**
 * Topology metadata safe for a shared dashboard widget. The widget maps
 * node→host for status overlays from `mappingJson`, so we serialize the RESOLVED
 * mapping (derived from `metrics-binding` attachments) into that wire field —
 * there is no `mapping_json` column anymore. Drops `shareToken`, data-source
 * ids, and timestamps.
 */
export function publicTopology(
  t: Topology,
  resolvedMapping?: MetricsMapping,
): { id: string; name: string; mappingJson?: string } {
  return {
    id: t.id,
    name: t.name,
    mappingJson: resolvedMapping ? JSON.stringify(resolvedMapping) : undefined,
  }
}

/**
 * Simplified, render-only context (nodes / edges / subgraphs / metrics) for a
 * shared topology or a topology widget inside a shared dashboard. Deliberately
 * narrower than the authenticated `buildTopologyContext`: no `portInfo`
 * (interface names / aliases), no `topologySourceId` / `metricsSourceId`, no
 * raw `mapping`. Used by BOTH share doors so they expose identical shapes.
 *
 * `metrics` MUST go through `publicMetrics` — the live poll loop updates
 * `parsed.metrics` in place with full `NodeMetrics` (monitoringError = SNMP
 * timeout text / internal addrs, plus monitoring/cpu/memory/lastSeen) and
 * `warnings` (parse-error text). Shipping it raw leaked internal detail.
 */
export function publicTopologyContext(parsed: ShareParsedTopology) {
  return {
    id: parsed.id,
    name: parsed.name,
    nodes: parsed.graph.nodes.map((n) => ({
      id: n.id,
      label: n.label || n.id,
      type: specDeviceType(n.spec),
    })),
    edges: parsed.graph.links.map((l, i) => ({
      id: l.id || `link-${i}`,
      from: { nodeId: l.from.node, port: l.from.port },
      to: { nodeId: l.to.node, port: l.to.port },
      standard: l.from.plug?.module?.standard ?? l.to.plug?.module?.standard,
    })),
    subgraphs: parsed.graph.subgraphs || [],
    metrics: publicMetrics(parsed.metrics),
  }
}

/**
 * The NetworkGraph a shared diagram renders — **sanitized**. Drawing the topology needs
 * structure (nodes/links/ports/styles/positions), but NOT per-endpoint `ip`. The drawn graph
 * carries no identity, provenance, attachments (`access` holds the **SNMP community**), metadata
 * or exclusions any more — those live in the record kept beside it, which no share door serves —
 * but a graph an older artifact or a caller hands in is still stripped of them here, so a share
 * link can't exfiltrate credentials or device inventory whatever it is given.
 *
 * P0: strip the known sensitive carriers (a strict improvement). P1 promotes this
 * to an allow-list render DTO (see #412) so a future field can't leak by default.
 */
export function publicGraph(graph: NetworkGraph): NetworkGraph {
  return {
    ...without(graph, ['attachments', 'exclusions']),
    nodes: graph.nodes.map(publicNode),
    links: graph.links.map(publicLink),
    subgraphs: graph.subgraphs?.map(publicSubgraph),
  }
}

/** The carriers of identity and access an element of an older graph shape may still hold. */
const SENSITIVE = ['identity', 'provenance', 'entityId', 'attachments', 'metadata']

function without<T extends object>(value: T, keys: readonly string[]): T {
  const out: Record<string, unknown> = { ...(value as Record<string, unknown>) }
  for (const key of keys) delete out[key]
  return out as T
}

function publicNode(n: Node): Node {
  const node = without(n, SENSITIVE)
  return node.ports ? { ...node, ports: node.ports.map((p) => without(p, SENSITIVE)) } : node
}

function publicLink(l: Link): Link {
  const link = without(l, SENSITIVE)
  const { ip: _fip, ...from } = link.from
  const { ip: _tip, ...to } = link.to
  return { ...link, from, to }
}

function publicSubgraph(sg: Subgraph): Subgraph {
  return without(sg, SENSITIVE)
}

/**
 * The drawn scene of a shared diagram, through the same strip as {@link publicGraph}: the scene
 * carries the nodes, links and groups themselves, so it must not carry what the graph may not.
 */
export function publicScene(scene: DrawingScene): DrawingScene {
  return {
    ...scene,
    nodes: scene.nodes.map((n) => ({ ...n, node: publicNode(n.node) })),
    groups: scene.groups.map((g) => ({ ...g, group: publicSubgraph(g.group) })),
    wires: scene.wires.map((w) => ({ ...w, link: publicLink(w.link) })),
  }
}

export function publicTopologyGraph(parsed: ShareParsedTopology) {
  return {
    id: parsed.id,
    name: parsed.name,
    graph: publicGraph(applyMappingBandwidth(parsed.graph, parsed.mapping)),
  }
}

/**
 * Allow-listed public projection of a dashboard layout. The raw `layoutJson` is
 * extensible per-widget config that may carry queries / internal labels / future
 * unreviewed fields, so we rebuild it from a known shape: grid params + each
 * widget's id / type / position and only the config keys a public viewer needs to
 * render. Unknown config keys are dropped (deny-by-default).
 */
const PUBLIC_WIDGET_CONFIG_KEYS = [
  'topologyId',
  'dataSourceId',
  'showMetrics',
  'showLabels',
  'interactive',
  'metricType',
  'title',
] as const

export function publicDashboardLayout(layoutJson: string): string {
  try {
    const layout = JSON.parse(layoutJson) as {
      columns?: number
      rowHeight?: number
      margin?: number
      widgets?: {
        id?: string
        type?: string
        position?: { x?: number; y?: number; w?: number; h?: number }
        config?: Record<string, unknown>
      }[]
    }
    const widgets = (layout.widgets ?? []).map((w) => {
      const config: Record<string, unknown> = {}
      for (const key of PUBLIC_WIDGET_CONFIG_KEYS) {
        if (w.config && key in w.config) config[key] = w.config[key]
      }
      return { id: w.id, type: w.type, position: w.position, config }
    })
    return JSON.stringify({
      columns: layout.columns,
      rowHeight: layout.rowHeight,
      margin: layout.margin,
      widgets,
    })
  } catch {
    return JSON.stringify({ widgets: [] })
  }
}

/**
 * Allow-listed public projection of an alert. Drops fields that can carry
 * internal detail: `description` (collector errors / query text), `hostId`,
 * `source` (which monitoring system), `url` (internal deep-link), `labels`
 * (arbitrary internal key/values), `receivedAt`. Keeps only what an alert widget
 * needs to display + map to a node.
 */
export function publicAlert(a: Alert): {
  id: string
  severity: Alert['severity']
  status: Alert['status']
  title: string
  host?: string
  nodeId?: string
  startTime: number
  endTime?: number
} {
  return {
    id: a.id,
    severity: a.severity,
    status: a.status,
    title: a.title,
    ...(a.host ? { host: a.host } : {}),
    ...(a.nodeId ? { nodeId: a.nodeId } : {}),
    startTime: a.startTime,
    ...(a.endTime !== undefined ? { endTime: a.endTime } : {}),
  }
}

/**
 * Allow-listed projection of a live metrics tick for a shared viewer. Nodes keep
 * ONLY `status` (drops `monitoringError` — SNMP timeout text / internal addrs —
 * plus source observations, redundancy, `monitoring`/cpu/memory/lastSeen, none
 * of which the shared diagram renders).
 * Links keep status + the traffic numbers the diagram colors/animates with (that
 * IS the shared live data). Graph-level `warnings` (parse-error text) are dropped.
 */
export function publicMetrics(m: MetricsData): MetricsData {
  const nodes: MetricsData['nodes'] = {}
  for (const [id, n] of Object.entries(m.nodes)) nodes[id] = { status: n.status }
  const links: MetricsData['links'] = {}
  for (const [id, l] of Object.entries(m.links)) {
    links[id] = {
      status: l.status,
      ...(l.utilization !== undefined ? { utilization: l.utilization } : {}),
      ...(l.inUtilization !== undefined ? { inUtilization: l.inUtilization } : {}),
      ...(l.outUtilization !== undefined ? { outUtilization: l.outUtilization } : {}),
      ...(l.inBps !== undefined ? { inBps: l.inBps } : {}),
      ...(l.outBps !== undefined ? { outBps: l.outBps } : {}),
    }
  }
  return { nodes, links, timestamp: m.timestamp }
}

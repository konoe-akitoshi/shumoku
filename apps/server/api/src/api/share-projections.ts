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

import type { Alert, NetworkGraph } from '@shumoku/core'
import { specDeviceType } from '@shumoku/core'
import type { ParsedTopology } from '../services/topology.js'
import type { MetricsMapping, Topology } from '../types.js'
import { applyMappingBandwidth } from './topologies.js'

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
 */
export function publicTopologyContext(parsed: ParsedTopology) {
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
    metrics: parsed.metrics,
  }
}

/**
 * The NetworkGraph a shared diagram renders — **sanitized**. Drawing the topology
 * needs structure (nodes/links/ports/styles/positions), but NOT the sensitive
 * carriers: node `identity` (mgmtIp / chassisId / sysName), `attachments`
 * (`access` holds the **SNMP community**, plus policy / metrics-binding),
 * `metadata`, per-endpoint `ip`, and graph-level `attachments` (topology-default
 * access/policy) / `exclusions` (hidden nodes' mgmt identities). Those are stripped
 * here so a share link can't exfiltrate credentials or device inventory.
 *
 * P0: strip the known sensitive carriers (a strict improvement). P1 promotes this
 * to an allow-list render DTO (see #412) so a future field can't leak by default.
 */
function shareSafeGraph(graph: NetworkGraph): NetworkGraph {
  const { attachments: _ga, exclusions: _gx, ...rest } = graph
  return {
    ...rest,
    nodes: graph.nodes.map((n) => {
      const { identity: _i, attachments: _a, metadata: _m, ports, ...node } = n
      return ports
        ? {
            ...node,
            ports: ports.map((p) => {
              const { identity: _pi, attachments: _pa, ...port } = p
              return port
            }),
          }
        : node
    }),
    links: graph.links.map((l) => {
      const { metadata: _lm, ...link } = l as typeof l & { metadata?: unknown }
      const { ip: _fip, ...from } = link.from
      const { ip: _tip, ...to } = link.to
      return { ...link, from, to }
    }),
    subgraphs: graph.subgraphs?.map((sg) => {
      const { attachments: _sa, ...subgraph } = sg
      return subgraph
    }),
  }
}

export function publicTopologyGraph(parsed: ParsedTopology) {
  return {
    id: parsed.id,
    name: parsed.name,
    graph: shareSafeGraph(applyMappingBandwidth(parsed.graph, parsed.mapping)),
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
  'sheetId',
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

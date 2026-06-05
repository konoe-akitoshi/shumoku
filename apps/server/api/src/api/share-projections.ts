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

import { specDeviceType } from '@shumoku/core'
import type { ParsedTopology } from '../services/topology.js'
import type { MetricsMapping, Topology } from '../types.js'
import { applyMappingBandwidth } from './topologies.js'

/**
 * Topology metadata safe for a shared dashboard widget. Exposes `mappingJson`
 * (the topology widget reads it to map node→host for status overlays) but drops
 * `shareToken`, data-source ids, and timestamps. Prefer the RESOLVED mapping
 * (`metrics-binding` attachments ∪ residual) over the raw `mapping_json` column,
 * which post-backfill no longer carries node bindings.
 */
export function publicTopology(
  t: Topology,
  resolvedMapping?: MetricsMapping,
): { id: string; name: string; mappingJson?: string } {
  const mappingJson = resolvedMapping ? JSON.stringify(resolvedMapping) : t.mappingJson
  return { id: t.id, name: t.name, mappingJson }
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
 * The raw NetworkGraph a shared diagram renders. The full graph is inherently
 * public on any share link (you can't draw the topology without it), so this
 * is intentionally not redacted beyond folding mapping-derived bandwidth in.
 */
export function publicTopologyGraph(parsed: ParsedTopology) {
  return {
    id: parsed.id,
    name: parsed.name,
    graph: applyMappingBandwidth(parsed.graph, parsed.mapping),
  }
}

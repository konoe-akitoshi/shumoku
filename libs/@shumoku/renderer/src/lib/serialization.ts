/**
 * Serialize / deserialize ResolvedLayout to/from JSON.
 *
 * Converts Map-based layout to plain objects for JSON storage,
 * and restores Maps from the plain object format.
 */

import type {
  ResolvedEdge,
  ResolvedLayout,
  ResolvedNode,
  ResolvedPort,
  ResolvedSubgraph,
} from '@shumoku/core'

/** JSON-serializable layout format */
export interface SerializedLayout {
  version: 1
  nodes: Record<string, ResolvedNode>
  ports: Record<string, ResolvedPort>
  edges: Record<string, ResolvedEdge>
  subgraphs: Record<string, ResolvedSubgraph>
  bounds: { x: number; y: number; width: number; height: number }
}

/** Convert ResolvedLayout (Maps) to JSON-serializable object */
export function serializeLayout(layout: ResolvedLayout): SerializedLayout {
  return {
    version: 1,
    nodes: Object.fromEntries(layout.nodes),
    ports: Object.fromEntries(layout.ports),
    edges: Object.fromEntries(layout.edges),
    subgraphs: Object.fromEntries(layout.subgraphs),
    bounds: layout.bounds,
  }
}

/** Convert JSON object back to ResolvedLayout (Maps) */
export function deserializeLayout(data: SerializedLayout): ResolvedLayout {
  return {
    nodes: new Map(Object.entries(data.nodes)),
    ports: new Map(Object.entries(data.ports)),
    edges: new Map(Object.entries(data.edges)),
    subgraphs: new Map(Object.entries(data.subgraphs)),
    bounds: data.bounds,
  }
}

/** Serialize layout to JSON string */
export function layoutToJson(layout: ResolvedLayout): string {
  return JSON.stringify(serializeLayout(layout), null, 2)
}

/** Deserialize layout from JSON string */
export function jsonToLayout(json: string): ResolvedLayout {
  return deserializeLayout(JSON.parse(json))
}

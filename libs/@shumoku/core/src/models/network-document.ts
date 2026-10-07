// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

import { z } from 'zod'
import type { NetworkGraph, Node } from './types.js'

/** A stored node without diagram position or display size.
 * Other legacy presentation fields remain; this is not a fully neutral topology model. */
export type TopologyNode = Omit<Node, 'position' | 'size'> & {
  position?: never
  size?: never
}

/** Stored graph data whose nodes exclude diagram geometry.
 * Root settings, styling and physical fields retain their existing NetworkGraph meaning. */
export type NetworkTopology = Omit<NetworkGraph, 'nodes'> & { nodes: TopologyNode[] }

/** Diagram coordinates and/or display size for a node. At least one is required.
 * Values retain Node's coordinate convention and do not describe physical dimensions. */
export type NodeGeometry = z.infer<typeof nodeGeometrySchema>

/** Explicit node diagram geometry. Omitted nodes carry no saved geometry. */
export interface NetworkPresentation {
  nodeGeometry: NodeGeometry[]
}

/** Independently stored topology and presentation, combined only for runtime consumers.
 * schemaVersion describes this envelope, independently of graph and package versions. */
export interface NetworkDocument {
  schemaVersion: '1'
  topology: NetworkTopology
  presentation: NetworkPresentation
}

const nodeIdSchema = z.string().min(1)
const positionSchema = z.strictObject({ x: z.number().finite(), y: z.number().finite() })
const sizeSchema = z.strictObject({
  width: z.number().finite().positive(),
  height: z.number().finite().positive(),
})
const nodeGeometrySchema = z.union([
  z.strictObject({ nodeId: nodeIdSchema, position: positionSchema, size: sizeSchema.optional() }),
  z.strictObject({ nodeId: nodeIdSchema, position: positionSchema.optional(), size: sizeSchema }),
])

/** Validate unknown presentation data and return an independent value.
 * @throws For unknown fields, duplicate node IDs, non-finite coordinates, missing
 * geometry or non-positive sizes. Topology references are checked during composition.
 */
export function parseNetworkPresentation(value: unknown): NetworkPresentation {
  const parsed = z.strictObject({ nodeGeometry: z.array(nodeGeometrySchema) }).parse(value)
  const seen = new Set<string>()
  for (const geometry of parsed.nodeGeometry) {
    if (seen.has(geometry.nodeId)) throw new Error(`Duplicate node geometry: ${geometry.nodeId}`)
    seen.add(geometry.nodeId)
  }
  return parsed
}

/** Separate one runtime node into storage values.
 * @param node A structured-cloneable Node, not a reactive proxy.
 * @returns Independent topology and optional geometry; automatic geometry is not invented.
 * @throws For invalid node IDs, removed rank or invalid geometry.
 */
export function separateNodeGeometry(node: Node): {
  node: TopologyNode
  geometry?: NodeGeometry
} {
  const { position, size, ...facts } = structuredClone(node)
  nodeIdSchema.parse(facts.id)
  if (Object.hasOwn(facts, 'rank')) throw new Error('Node.rank is no longer supported')
  const geometry =
    position === undefined && size === undefined
      ? undefined
      : nodeGeometrySchema.parse({
          nodeId: facts.id,
          ...(position === undefined ? {} : { position }),
          ...(size === undefined ? {} : { size }),
        })
  return { node: facts, geometry }
}

/** Compose an independent runtime node without changing either storage payload.
 * @throws If the topology contains diagram geometry or removed rank, the node ID
 * is invalid, or geometry is invalid or belongs to another node.
 */
export function combineNodeGeometry(node: TopologyNode, geometry?: NodeGeometry): Node {
  if (Object.hasOwn(node, 'position') || Object.hasOwn(node, 'size')) {
    throw new Error(`Topology node contains diagram geometry: ${node.id}`)
  }
  nodeIdSchema.parse(node.id)
  if (Object.hasOwn(node, 'rank')) throw new Error('Node.rank is no longer supported')
  const parsed = geometry === undefined ? undefined : nodeGeometrySchema.parse(geometry)
  if (parsed && parsed.nodeId !== node.id) throw new Error('Node geometry ID does not match node')
  return {
    ...structuredClone(node),
    ...(parsed?.position === undefined ? {} : { position: parsed.position }),
    ...(parsed?.size === undefined ? {} : { size: parsed.size }),
  }
}

/** Separate diagram geometry from a structured-cloneable runtime graph.
 * Other graph fields, including physical data, are preserved. No input is mutated.
 * @throws For duplicate/invalid node IDs, removed rank, invalid geometry or values
 * that structuredClone cannot copy (such as reactive proxies).
 * @example
 * const document = separateNetworkGraph(graph)
 * const json = JSON.stringify(document)
 */
export function separateNetworkGraph(graph: NetworkGraph): NetworkDocument {
  const { nodes, ...rest } = structuredClone(graph)
  const topologyNodes: TopologyNode[] = []
  const nodeGeometry: NodeGeometry[] = []
  const seen = new Set<string>()
  for (const node of nodes) {
    if (seen.has(node.id)) throw new Error(`Duplicate topology node: ${node.id}`)
    seen.add(node.id)
    const separated = separateNodeGeometry(node)
    topologyNodes.push(separated.node)
    if (separated.geometry) nodeGeometry.push(separated.geometry)
  }
  return {
    schemaVersion: '1',
    topology: { ...rest, nodes: topologyNodes },
    presentation: { nodeGeometry },
  }
}

/** Compose an independent graph for existing layout, renderer and editor consumers.
 * No missing coordinates or sizes are generated; changes to the returned graph
 * cannot change the input document. This does not validate the entire topology.
 * @throws For an unsupported document version, invalid/duplicate node IDs,
 * geometry in topology, removed rank, invalid geometry or stale geometry references.
 * @example
 * const graph = combineNetworkDocument(document)
 * // Saving edited diagram geometry requires an explicit separateNetworkGraph(graph).
 */
export function combineNetworkDocument(document: NetworkDocument): NetworkGraph {
  if (document.schemaVersion !== '1') throw new Error('Unsupported network document version')
  const presentation = parseNetworkPresentation(document.presentation)
  const geometry = new Map(presentation.nodeGeometry.map((entry) => [entry.nodeId, entry]))
  const topology = structuredClone(document.topology)
  const seen = new Set<string>()
  const nodes = topology.nodes.map((node) => {
    if (seen.has(node.id)) throw new Error(`Duplicate topology node: ${node.id}`)
    seen.add(node.id)
    return combineNodeGeometry(node, geometry.get(node.id))
  })
  for (const nodeId of geometry.keys()) {
    if (!seen.has(nodeId)) throw new Error(`Missing presentation node: ${nodeId}`)
  }
  return { ...topology, nodes }
}

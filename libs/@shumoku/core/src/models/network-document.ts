// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

import { z } from 'zod'
import type { NetworkGraph, Node, Position, Size } from './types.js'

/** First storage separation: diagram position and footprint are not node facts.
 * Styles and the other existing model responsibilities are separate follow-up work.
 * Node / NetworkGraph remain the composed runtime contract for existing consumers. */
export type TopologyNode = Omit<Node, 'position' | 'size'> & {
  position?: never
  size?: never
}

export type NetworkTopology = Omit<NetworkGraph, 'nodes'> & { nodes: TopologyNode[] }

export interface NodeGeometry {
  nodeId: string
  position?: Position
  size?: Size
}

export interface NetworkPresentation {
  nodeGeometry: NodeGeometry[]
}

export interface NetworkDocument {
  schemaVersion: '1'
  topology: NetworkTopology
  presentation: NetworkPresentation
}

const nodeGeometrySchema = z
  .strictObject({
    nodeId: z.string().min(1),
    position: z.strictObject({ x: z.number().finite(), y: z.number().finite() }).optional(),
    size: z
      .strictObject({
        width: z.number().finite().positive(),
        height: z.number().finite().positive(),
      })
      .optional(),
  })
  .refine((value) => value.position !== undefined || value.size !== undefined, {
    message: 'Node geometry must specify position or size',
  })

/** Checks presentation values only; it does not validate the full topology model. */
export function parseNetworkPresentation(value: unknown): NetworkPresentation {
  const parsed = z.strictObject({ nodeGeometry: z.array(nodeGeometrySchema) }).parse(value)
  const seen = new Set<string>()
  for (const geometry of parsed.nodeGeometry) {
    if (seen.has(geometry.nodeId)) throw new Error(`Duplicate node geometry: ${geometry.nodeId}`)
    seen.add(geometry.nodeId)
  }
  return parsed
}

/** Split a serializable runtime node without sharing mutable data with the source. */
export function separateNodeGeometry(node: Node): {
  node: TopologyNode
  geometry?: NodeGeometry
} {
  const { position, size, ...facts } = structuredClone(node)
  if (!facts.id) throw new Error('Missing node ID')
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

/** Build an independent runtime node; the topology is never a write-back target. */
export function combineNodeGeometry(node: TopologyNode, geometry?: NodeGeometry): Node {
  if (Object.hasOwn(node, 'position') || Object.hasOwn(node, 'size')) {
    throw new Error(`Topology node contains diagram geometry: ${node.id}`)
  }
  if (!node.id) throw new Error('Missing node ID')
  const parsed = geometry === undefined ? undefined : nodeGeometrySchema.parse(geometry)
  if (parsed && parsed.nodeId !== node.id) throw new Error('Node geometry ID does not match node')
  return {
    ...structuredClone(node),
    ...(parsed?.position === undefined ? {} : { position: parsed.position }),
    ...(parsed?.size === undefined ? {} : { size: parsed.size }),
  }
}

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

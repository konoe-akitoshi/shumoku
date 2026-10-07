// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

import { z } from 'zod'
import type { Link, NetworkGraph, Node, Subgraph } from './types.js'

/** Stored node facts. Diagram geometry, shape and style belong to presentation. */
export type TopologyNode = Omit<Node, 'position' | 'size' | 'shape' | 'style'> & {
  position?: never
  size?: never
  shape?: never
  style?: never
}
/** Stored connection facts. A styled link requires a stable id. */
export type TopologyLink = Omit<Link, 'style'> & { style?: never }
/** Stored group data without style. Derived bounds and root layout settings
 * retain their existing meaning and are separate follow-up work. */
export type TopologySubgraph = Omit<Subgraph, 'style'> & { style?: never }
export type NetworkTopology = Omit<NetworkGraph, 'nodes' | 'links' | 'subgraphs'> & {
  nodes: TopologyNode[]
  links: TopologyLink[]
  subgraphs?: TopologySubgraph[]
}

const idSchema = z.string().min(1)
const positionSchema = z.strictObject({ x: z.number().finite(), y: z.number().finite() })
const sizeSchema = z.strictObject({
  width: z.number().finite().positive(),
  height: z.number().finite().positive(),
})
const nonnegative = z.number().finite().nonnegative()
const nodeStyleSchema = z.strictObject({
  fill: z.string().optional(),
  stroke: z.string().optional(),
  strokeWidth: nonnegative.optional(),
  strokeDasharray: z.string().optional(),
  textColor: z.string().optional(),
  fontSize: z.number().finite().positive().optional(),
  fontWeight: z.enum(['normal', 'bold']).optional(),
  opacity: z.number().finite().min(0).max(1).optional(),
})
const linkStyleSchema = z.strictObject({
  stroke: z.string().optional(),
  strokeWidth: nonnegative.optional(),
  strokeDasharray: z.string().optional(),
  opacity: z.number().finite().min(0).max(1).optional(),
  minLength: nonnegative.optional(),
})
const subgraphStyleSchema = z.strictObject({
  fill: z.string().optional(),
  stroke: z.string().optional(),
  strokeWidth: nonnegative.optional(),
  strokeDasharray: z.string().optional(),
  labelPosition: z.enum(['top', 'bottom', 'left', 'right']).optional(),
  labelFontSize: z.number().finite().positive().optional(),
  padding: nonnegative.optional(),
  nodeSpacing: nonnegative.optional(),
  rankSpacing: nonnegative.optional(),
})
const shapeSchema = z.enum([
  'rect',
  'rounded',
  'circle',
  'diamond',
  'hexagon',
  'cylinder',
  'stadium',
  'trapezoid',
])
const nodeFields = {
  nodeId: idSchema,
  position: positionSchema.optional(),
  size: sizeSchema.optional(),
  shape: shapeSchema.optional(),
  style: nodeStyleSchema.optional(),
}
const nodePresentationSchema = z.union([
  z.strictObject({ ...nodeFields, position: positionSchema }),
  z.strictObject({ ...nodeFields, size: sizeSchema }),
  z.strictObject({ ...nodeFields, shape: shapeSchema }),
  z.strictObject({ ...nodeFields, style: nodeStyleSchema }),
])
const linkPresentationSchema = z.strictObject({ linkId: idSchema, style: linkStyleSchema })
const subgraphPresentationSchema = z.strictObject({
  subgraphId: idSchema,
  style: subgraphStyleSchema,
})

/** Saved diagram geometry and/or appearance. At least one field is required.
 * Coordinates and display size retain Node's convention, not physical dimensions. */
export type NodePresentation = z.infer<typeof nodePresentationSchema>
export type LinkPresentation = z.infer<typeof linkPresentationSchema>
export type SubgraphPresentation = z.infer<typeof subgraphPresentationSchema>

/** Explicit per-entity display overrides. Omitted entities use existing defaults. */
export interface NetworkPresentation {
  nodes: NodePresentation[]
  links: LinkPresentation[]
  subgraphs: SubgraphPresentation[]
}
/** Stored topology and presentation. Envelope, graph, archive, database and package
 * versions are independent contracts. */
export interface NetworkDocument {
  schemaVersion: '2'
  topology: NetworkTopology
  presentation: NetworkPresentation
}

function assertUnique(ids: Iterable<string>, kind: string): void {
  const seen = new Set<string>()
  for (const id of ids) {
    idSchema.parse(id)
    if (seen.has(id)) throw new Error(`Duplicate ${kind}: ${id}`)
    seen.add(id)
  }
}
function assertNoPresentation(value: object, fields: string[], kind: string): void {
  if (fields.some((field) => Object.hasOwn(value, field))) {
    throw new Error(`Topology ${kind} contains presentation data`)
  }
}

/** Validate and copy unknown presentation data.
 * @throws For unknown fields, duplicate IDs, invalid geometry, shape or style.
 * References to topology are checked during composition. Colors and dash patterns
 * retain the renderer's string vocabulary; numeric style values must be finite.
 */
export function parseNetworkPresentation(value: unknown): NetworkPresentation {
  const parsed = z
    .strictObject({
      nodes: z.array(nodePresentationSchema),
      links: z.array(linkPresentationSchema),
      subgraphs: z.array(subgraphPresentationSchema),
    })
    .parse(value)
  assertUnique(
    parsed.nodes.map((entry) => entry.nodeId),
    'node presentation',
  )
  assertUnique(
    parsed.links.map((entry) => entry.linkId),
    'link presentation',
  )
  assertUnique(
    parsed.subgraphs.map((entry) => entry.subgraphId),
    'subgraph presentation',
  )
  return parsed
}

/** Split a structured-cloneable runtime node into independent storage values.
 * @throws For invalid IDs, removed rank, invalid presentation or uncloneable values.
 * Reactive callers must provide a plain snapshot. No automatic values are generated.
 */
export function separateNodePresentation(node: Node): {
  node: TopologyNode
  presentation?: NodePresentation
} {
  const { position, size, shape, style, ...facts } = structuredClone(node)
  idSchema.parse(facts.id)
  if (Object.hasOwn(facts, 'rank')) throw new Error('Node.rank is no longer supported')
  const supplied = Object.fromEntries(
    Object.entries({ position, size, shape, style }).filter(([, value]) => value !== undefined),
  )
  return {
    node: facts,
    ...(Object.keys(supplied).length === 0
      ? {}
      : {
          presentation: nodePresentationSchema.parse({ nodeId: facts.id, ...supplied }),
        }),
  }
}
/** Compose an independent runtime node without changing stored payloads.
 * @throws For presentation in topology, removed rank, invalid IDs/overrides or
 * a presentation referring to another node.
 */
export function combineNodePresentation(node: TopologyNode, presentation?: NodePresentation): Node {
  assertNoPresentation(node, ['position', 'size', 'shape', 'style'], 'node')
  idSchema.parse(node.id)
  if (Object.hasOwn(node, 'rank')) throw new Error('Node.rank is no longer supported')
  if (!presentation) return structuredClone(node)
  const { nodeId, ...overrides } = nodePresentationSchema.parse(presentation)
  if (nodeId !== node.id) throw new Error('Node presentation ID does not match node')
  return { ...structuredClone(node), ...overrides }
}

/** Split connection style from facts. Unstyled idless links are preserved.
 * @throws For invalid presentation or a styled link without a stable ID.
 */
export function separateLinkPresentation(link: Link): {
  link: TopologyLink
  presentation?: LinkPresentation
} {
  const { style, ...facts } = structuredClone(link)
  if (facts.id !== undefined) idSchema.parse(facts.id)
  if (style !== undefined && facts.id === undefined)
    throw new Error('Styled links require a stable ID')
  return {
    link: facts,
    ...(style === undefined
      ? {}
      : {
          presentation: linkPresentationSchema.parse({ linkId: facts.id, style }),
        }),
  }
}
/** Compose an independent connection; style does not change endpoints or physical data.
 * @throws For style in topology, invalid style/ID, or a mismatched target ID.
 */
export function combineLinkPresentation(link: TopologyLink, presentation?: LinkPresentation): Link {
  assertNoPresentation(link, ['style'], 'link')
  if (link.id !== undefined) idSchema.parse(link.id)
  if (!presentation) return structuredClone(link)
  const parsed = linkPresentationSchema.parse(presentation)
  if (parsed.linkId !== link.id) throw new Error('Link presentation ID does not match link')
  return { ...structuredClone(link), style: parsed.style }
}
/** Split group style from membership and other group data.
 * @throws For invalid group IDs or display values.
 */
export function separateSubgraphPresentation(subgraph: Subgraph): {
  subgraph: TopologySubgraph
  presentation?: SubgraphPresentation
} {
  const { style, ...facts } = structuredClone(subgraph)
  idSchema.parse(facts.id)
  return {
    subgraph: facts,
    ...(style === undefined
      ? {}
      : {
          presentation: subgraphPresentationSchema.parse({ subgraphId: facts.id, style }),
        }),
  }
}
/** Compose an independent group with its display override.
 * @throws For style in topology, invalid style/ID, or a mismatched target ID.
 */
export function combineSubgraphPresentation(
  subgraph: TopologySubgraph,
  presentation?: SubgraphPresentation,
): Subgraph {
  assertNoPresentation(subgraph, ['style'], 'subgraph')
  idSchema.parse(subgraph.id)
  if (!presentation) return structuredClone(subgraph)
  const parsed = subgraphPresentationSchema.parse(presentation)
  if (parsed.subgraphId !== subgraph.id)
    throw new Error('Subgraph presentation ID does not match subgraph')
  return { ...structuredClone(subgraph), style: parsed.style }
}

/** Separate geometry, node shape and entity styles from a runtime graph.
 * Other data, including physical records, is copied without changing the input.
 * @throws For duplicate/invalid IDs, styled idless links, removed rank, invalid display
 * values or uncloneable inputs such as reactive proxies.
 * @example
 * const json = JSON.stringify(separateNetworkGraph(graph))
 */
export function separateNetworkGraph(graph: NetworkGraph): NetworkDocument {
  const { nodes, links, subgraphs, ...rest } = structuredClone(graph)
  assertUnique(
    nodes.map((node) => node.id),
    'topology node',
  )
  assertUnique(
    links.flatMap((link) => (link.id === undefined ? [] : [link.id])),
    'topology link',
  )
  assertUnique(
    (subgraphs ?? []).map((group) => group.id),
    'topology subgraph',
  )
  const nodeParts = nodes.map(separateNodePresentation)
  const linkParts = links.map(separateLinkPresentation)
  const subgraphParts = subgraphs?.map(separateSubgraphPresentation)
  return {
    schemaVersion: '2',
    topology: {
      ...rest,
      nodes: nodeParts.map((entry) => entry.node),
      links: linkParts.map((entry) => entry.link),
      ...(subgraphParts === undefined
        ? {}
        : { subgraphs: subgraphParts.map((entry) => entry.subgraph) }),
    },
    presentation: {
      nodes: nodeParts.flatMap((entry) => (entry.presentation ? [entry.presentation] : [])),
      links: linkParts.flatMap((entry) => (entry.presentation ? [entry.presentation] : [])),
      subgraphs: (subgraphParts ?? []).flatMap((entry) =>
        entry.presentation ? [entry.presentation] : [],
      ),
    },
  }
}

/** Compose an independent graph for existing layout, renderer and editor consumers.
 * This checks the presentation boundary, not the entire topology schema.
 * @throws For unsupported versions, duplicate/invalid IDs, presentation in topology,
 * removed rank, invalid overrides or stale references.
 * @example
 * const graph = combineNetworkDocument(document)
 * // Persist edits explicitly with separateNetworkGraph(graph).
 */
export function combineNetworkDocument(document: NetworkDocument): NetworkGraph {
  if (document.schemaVersion !== '2') throw new Error('Unsupported network document version')
  const presentation = parseNetworkPresentation(document.presentation)
  const topology = structuredClone(document.topology)
  assertUnique(
    topology.nodes.map((node) => node.id),
    'topology node',
  )
  assertUnique(
    topology.links.flatMap((link) => (link.id === undefined ? [] : [link.id])),
    'topology link',
  )
  assertUnique(
    (topology.subgraphs ?? []).map((group) => group.id),
    'topology subgraph',
  )
  const nodes = new Map(presentation.nodes.map((entry) => [entry.nodeId, entry]))
  const links = new Map(presentation.links.map((entry) => [entry.linkId, entry]))
  const subgraphs = new Map(presentation.subgraphs.map((entry) => [entry.subgraphId, entry]))
  const result: NetworkGraph = {
    ...topology,
    nodes: topology.nodes.map((node) => {
      const combined = combineNodePresentation(node, nodes.get(node.id))
      nodes.delete(node.id)
      return combined
    }),
    links: topology.links.map((link) => {
      const combined = combineLinkPresentation(
        link,
        link.id === undefined ? undefined : links.get(link.id),
      )
      if (link.id !== undefined) links.delete(link.id)
      return combined
    }),
    ...(topology.subgraphs === undefined
      ? {}
      : {
          subgraphs: topology.subgraphs.map((group) => {
            const combined = combineSubgraphPresentation(group, subgraphs.get(group.id))
            subgraphs.delete(group.id)
            return combined
          }),
        }),
  }
  for (const [kind, entries] of [
    ['node', nodes],
    ['link', links],
    ['subgraph', subgraphs],
  ] as const) {
    if (entries.size > 0)
      throw new Error(`Missing presentation ${kind}: ${entries.keys().next().value}`)
  }
  return result
}

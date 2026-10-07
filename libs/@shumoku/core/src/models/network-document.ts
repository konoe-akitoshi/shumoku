// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

import { z } from 'zod'
import type { GraphSettings, Link, NetworkGraph, Node, NodePort, Subgraph } from './types.js'

/** Stored owned port facts; display placement belongs to presentation. */
export type TopologyNodePort = Omit<NodePort, 'placement'> & { placement?: never }
/** Stored node facts. Geometry, appearance and port placement belong to presentation. */
export type TopologyNode = Omit<Node, 'position' | 'size' | 'shape' | 'style' | 'ports'> & {
  ports?: TopologyNodePort[]
  position?: never
  size?: never
  shape?: never
  style?: never
}
/** Stored connection facts. A styled link requires a stable id. */
export type TopologyLink = Omit<Link, 'style'> & { style?: never }
/** Stored group facts; bounds are derived and are never persisted. */
export type TopologySubgraph = Omit<Subgraph, 'style' | 'direction' | 'bounds'> & {
  style?: never
  direction?: never
  bounds?: never
}
export type NetworkTopology = Omit<NetworkGraph, 'nodes' | 'links' | 'subgraphs' | 'settings'> & {
  settings?: never
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
const directionSchema = z.enum(['TB', 'BT', 'LR', 'RL'])
const graphSettingsSchema = z.strictObject({
  direction: directionSchema.optional(),
  theme: z.enum(['light', 'dark']).optional(),
  edgeStyle: z.enum(['polyline', 'orthogonal', 'splines', 'straight']).optional(),
  splineMode: z.enum(['sloppy', 'conservative', 'conservative_soft']).optional(),
  nodeSpacing: nonnegative.optional(),
  rankSpacing: nonnegative.optional(),
  subgraphPadding: nonnegative.optional(),
  canvas: z
    .strictObject({
      preset: z
        .enum([
          'A0',
          'A1',
          'A2',
          'A3',
          'A4',
          'B0',
          'B1',
          'B2',
          'B3',
          'B4',
          'letter',
          'legal',
          'tabloid',
        ])
        .optional(),
      orientation: z.enum(['portrait', 'landscape']).optional(),
      width: z.number().finite().positive().optional(),
      height: z.number().finite().positive().optional(),
      dpi: z.number().finite().positive().optional(),
      fit: z.boolean().optional(),
      padding: nonnegative.optional(),
    })
    .optional(),
  legend: z
    .union([
      z.boolean(),
      z.strictObject({
        enabled: z.boolean().optional(),
        position: z.enum(['top-left', 'top-right', 'bottom-left', 'bottom-right']).optional(),
        showDeviceTypes: z.boolean().optional(),
        showBandwidth: z.boolean().optional(),
        showCableTypes: z.boolean().optional(),
        showVlans: z.boolean().optional(),
      }),
    ])
    .optional(),
  hideDisconnected: z.boolean().optional(),
})
const portPresentationSchema = z.strictObject({
  portId: idSchema,
  placement: z.strictObject({
    side: z.enum(['top', 'bottom', 'left', 'right']).optional(),
    order: z.number().finite().optional(),
  }),
})
export type PortPresentation = z.infer<typeof portPresentationSchema>
const portOverridesSchema = z.tuple([portPresentationSchema]).rest(portPresentationSchema)
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
  ports: portOverridesSchema.optional(),
}
const nodePresentationSchema = z.union([
  z.strictObject({ ...nodeFields, position: positionSchema }),
  z.strictObject({ ...nodeFields, size: sizeSchema }),
  z.strictObject({ ...nodeFields, shape: shapeSchema }),
  z.strictObject({ ...nodeFields, style: nodeStyleSchema }),
  z.strictObject({ ...nodeFields, ports: portOverridesSchema }),
])
const linkPresentationSchema = z.strictObject({ linkId: idSchema, style: linkStyleSchema })
const subgraphFields = {
  subgraphId: idSchema,
  style: subgraphStyleSchema.optional(),
  direction: directionSchema.optional(),
}
const subgraphPresentationSchema = z.union([
  z.strictObject({ ...subgraphFields, style: subgraphStyleSchema }),
  z.strictObject({ ...subgraphFields, direction: directionSchema }),
])

/** Saved geometry, appearance and/or owned port placement. At least one field is required.
 * Coordinates and display size retain Node's convention, not physical dimensions. */
export type NodePresentation = z.infer<typeof nodePresentationSchema>
export type LinkPresentation = z.infer<typeof linkPresentationSchema>
export type SubgraphPresentation = z.infer<typeof subgraphPresentationSchema>

/** Explicit graph settings and per-entity display overrides. Omitted values use existing defaults. */
export interface NetworkPresentation {
  settings?: GraphSettings
  nodes: NodePresentation[]
  links: LinkPresentation[]
  subgraphs: SubgraphPresentation[]
}
/** Stored topology and presentation. Envelope, graph, archive, database and package
 * versions are independent contracts. */
export interface NetworkDocument {
  schemaVersion: '3'
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
 * @throws For unknown fields, duplicate IDs, invalid geometry, shape, style or settings.
 * References to topology are checked during composition. Colors and dash patterns
 * retain the renderer's string vocabulary; numeric style values must be finite.
 */
export function parseNetworkPresentation(value: unknown): NetworkPresentation {
  const parsed = z
    .strictObject({
      settings: graphSettingsSchema.optional(),
      nodes: z.array(nodePresentationSchema),
      links: z.array(linkPresentationSchema),
      subgraphs: z.array(subgraphPresentationSchema),
    })
    .parse(value)
  for (const node of parsed.nodes) {
    assertUnique(
      (node.ports ?? []).map((port) => port.portId),
      'port presentation',
    )
  }
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
  const { position, size, shape, style, ports, ...facts } = structuredClone(node)
  idSchema.parse(facts.id)
  if (Object.hasOwn(facts, 'rank')) throw new Error('Node.rank is no longer supported')
  assertUnique(
    (ports ?? []).map((port) => port.id),
    'topology port',
  )
  const portOverrides: PortPresentation[] = []
  const topologyPorts = ports?.map(({ placement, ...port }) => {
    if (placement !== undefined)
      portOverrides.push(portPresentationSchema.parse({ portId: port.id, placement }))
    return port
  })
  const supplied = Object.fromEntries(
    Object.entries({
      position,
      size,
      shape,
      style,
      ports: portOverrides.length > 0 ? portOverrides : undefined,
    }).filter(([, value]) => value !== undefined),
  )
  return {
    node: { ...facts, ...(topologyPorts === undefined ? {} : { ports: topologyPorts }) },
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
  assertUnique(
    (node.ports ?? []).map((port) => port.id),
    'topology port',
  )
  for (const port of node.ports ?? []) assertNoPresentation(port, ['placement'], 'port')
  if (!presentation) return structuredClone(node)
  const { nodeId, ports, ...overrides } = nodePresentationSchema.parse(presentation)
  if (nodeId !== node.id) throw new Error('Node presentation ID does not match node')
  assertUnique(
    (ports ?? []).map((port) => port.portId),
    'port presentation',
  )
  const targets = new Map((ports ?? []).map((port) => [port.portId, port.placement]))
  const result: Node = { ...structuredClone(node), ...overrides }
  if (result.ports)
    result.ports = result.ports.map((port) => {
      const placement = targets.get(port.id)
      targets.delete(port.id)
      return placement === undefined ? port : { ...port, placement }
    })
  if (targets.size > 0) throw new Error(`Missing presentation port: ${targets.keys().next().value}`)
  return result
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
/** Split group style/direction from facts; discard runtime-derived bounds.
 * @throws For invalid group IDs or display values.
 */
export function separateSubgraphPresentation(subgraph: Subgraph): {
  subgraph: TopologySubgraph
  presentation?: SubgraphPresentation
} {
  const { style, direction, bounds: _bounds, ...facts } = structuredClone(subgraph)
  idSchema.parse(facts.id)
  return {
    subgraph: facts,
    ...(style === undefined && direction === undefined
      ? {}
      : {
          presentation: subgraphPresentationSchema.parse({
            subgraphId: facts.id,
            ...(style === undefined ? {} : { style }),
            ...(direction === undefined ? {} : { direction }),
          }),
        }),
  }
}
/** Compose an independent group with its display override.
 * @throws For style/direction/bounds in topology, invalid display/ID, or a mismatched target ID.
 */
export function combineSubgraphPresentation(
  subgraph: TopologySubgraph,
  presentation?: SubgraphPresentation,
): Subgraph {
  assertNoPresentation(subgraph, ['style', 'direction', 'bounds'], 'subgraph')
  idSchema.parse(subgraph.id)
  if (!presentation) return structuredClone(subgraph)
  const { subgraphId, ...overrides } = subgraphPresentationSchema.parse(presentation)
  if (subgraphId !== subgraph.id)
    throw new Error('Subgraph presentation ID does not match subgraph')
  return { ...structuredClone(subgraph), ...overrides }
}

/** Separate geometry, shape, styles, port placement and graph settings from facts.
 * Derived group bounds are discarded; physical records are copied unchanged.
 * @throws For duplicate/invalid IDs, styled idless links, removed rank, invalid display
 * values or uncloneable inputs such as reactive proxies.
 * @example
 * const json = JSON.stringify(separateNetworkGraph(graph))
 */
export function separateNetworkGraph(graph: NetworkGraph): NetworkDocument {
  const { nodes, links, subgraphs, settings, ...rest } = structuredClone(graph)
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
    schemaVersion: '3',
    topology: {
      ...rest,
      nodes: nodeParts.map((entry) => entry.node),
      links: linkParts.map((entry) => entry.link),
      ...(subgraphParts === undefined
        ? {}
        : { subgraphs: subgraphParts.map((entry) => entry.subgraph) }),
    },
    presentation: {
      ...(settings === undefined ? {} : { settings: graphSettingsSchema.parse(settings) }),
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
  if (document.schemaVersion !== '3') throw new Error('Unsupported network document version')
  const presentation = parseNetworkPresentation(document.presentation)
  const topology = structuredClone(document.topology)
  assertNoPresentation(topology, ['settings'], 'graph')
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
    ...(presentation.settings === undefined ? {} : { settings: presentation.settings }),
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

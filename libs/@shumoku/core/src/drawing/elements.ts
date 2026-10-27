// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import type * as input from '../input/model.js'
import { analysisGraph, routingDomainRef, segmentRef } from '../structure/analysis-graph.js'
import type { GroupId, NodeId, Structure, Vertex } from '../structure/types.js'
import { commonPlace, deriveUnits, groupParents, unitRef } from '../structure/units.js'
import type { Metrics, Size } from './metrics.js'

/**
 * Layer 1. What is drawn: a card for each unit, a bus for each segment a line ends at and a
 * cloud for each routing domain a line ends at, and the lines between them. An element is named
 * by its vertex in the structure (`unit:<id>`, `segment:<id>`, `routingDomain:<id>`).
 */
export type ElementId = string

/** A member node's card inside its element, from the element's top-left corner. */
export interface Part {
  readonly node: NodeId
  readonly x: number
  readonly y: number
  readonly size: Size
}

export interface Element {
  readonly id: ElementId
  /**
   * A `fan` stands for the leaves of one parent, laid out as a block (see `fans.ts`); a `block`
   * stands for a child group and a `port` for the point where a line crosses a group's frame
   * (see `compound.ts`). Those three exist only while a level is laid out.
   */
  readonly kind: 'unit' | 'bus' | 'cloud' | 'fan' | 'block' | 'port'
  /**
   * The nodes a unit holds, side by side in this order; none for a bus or a cloud. A node that
   * runs on a host is not held by the host's unit but is a unit of its own.
   */
  readonly members: readonly NodeId[]
  /** A redundancy set is drawn inside one outline; this is the set's kind when it has one. */
  readonly hull?: { readonly kind?: string }
  /** The group it is in. A bus is in its segment's own group only; a cloud is in none. */
  readonly place?: GroupId
  readonly size: Size
  /** Where each member's card goes inside `size`. */
  readonly parts: readonly Part[]
}

/** The element a vertex of the structure is drawn as. */
export function elementIdOf(vertex: Vertex): ElementId {
  if ('unit' in vertex) return unitRef(vertex.unit)
  if ('segment' in vertex) return segmentRef(vertex.segment)
  return routingDomainRef(vertex.routingDomain)
}

export interface LineEnd {
  readonly element: ElementId
  /** The member node the line ends at, when the element is a unit. */
  readonly node?: NodeId
  /**
   * Where across the element the line really ends, from the element's centre; none when it
   * ends at the centre. A block that stands for a group sets it, because a line to it ends at
   * the element inside, and the coordinates pull from that point and not from the middle.
   */
  readonly offset?: number
}

export interface Line {
  readonly index: number
  /** The position of the written link this line is, when it is one. */
  readonly link?: number
  readonly linkId?: string
  readonly ends: readonly [LineEnd, LineEnd]
  /** The line has no cable of its own. */
  readonly virtual: boolean
  /**
   * The line only places: it keeps a hosted element under its host in the ranks, the order and
   * the coordinates, and draws no wire. The host is its first end.
   */
  readonly layoutOnly?: true
}

export interface GroupNode {
  readonly id: GroupId
  readonly label?: string
  readonly parent?: GroupId
}

export interface Elements {
  /** Units in the order the nodes are written, then segments, then routing domains. */
  readonly elements: readonly Element[]
  /** Lines between two different elements. */
  readonly lines: readonly Line[]
  /** Lines between two members of one element: drawn inside it, not between elements. */
  readonly inner: readonly Line[]
  /** The groups, a group before the groups inside it. */
  readonly groups: readonly GroupNode[]
}

export function deriveElements(
  network: input.Network,
  structure: Structure,
  metrics: Metrics,
): Elements {
  const units = deriveUnits(network)
  const unitById = new Map(units.units.map((u) => [u.id, u]))
  const unitOf = (node: NodeId) => structure.nodes[node]?.unit ?? node
  const nodeById = new Map(network.nodes.map((n) => [n.id, n]))
  const parents = groupParents(network)

  // A node is hosted when the structure folded it into its host's unit. A member of a folded
  // redundancy set is that set's, whatever it runs on.
  const hostedBy = new Map<NodeId, string>()
  for (const node of network.nodes) {
    const host = node.host
    if (host === undefined || host === node.id) continue
    const unit = unitOf(node.id)
    const hostUnit = nodeById.has(host) ? unitOf(host) : host
    if (unit === node.id || unit !== hostUnit) continue
    if (network.redundancy?.some((r) => r.id === unit && r.nodes.includes(node.id))) continue
    hostedBy.set(node.id, host)
  }
  const elementOf = (node: NodeId): ElementId =>
    hostedBy.has(node) ? unitRef(node) : unitRef(unitOf(node))
  const elementOfHost = (host: string): ElementId =>
    nodeById.has(host) ? elementOf(host) : unitRef(host)

  // Where a node stands: its own group, or its host's.
  const placeOfNode = (id: string, seen: ReadonlySet<string> = new Set()): GroupId | undefined => {
    const node = nodeById.get(id)
    if (!node || seen.has(id)) return undefined
    if (node.group !== undefined) return node.group
    const host = node.host
    if (host === undefined) return undefined
    const next = new Set(seen).add(id)
    const set = network.redundancy?.find((r) => r.id === host)
    return placeOfNode(set ? (set.nodes[0] ?? host) : host, next)
  }
  const analysis = analysisGraph(network)
  const segmentVertices = new Set(
    analysis.vertices.filter((v) => v.kind === 'segment').map((v) => v.id),
  )
  const domainVertices = new Set(
    analysis.vertices.filter((v) => v.kind === 'routingDomain').map((v) => v.id),
  )

  const endOf = (e: input.Endpoint): LineEnd => {
    if ('node' in e) return { element: elementOf(e.node), node: e.node }
    if ('segment' in e) return { element: segmentRef(e.segment) }
    return { element: routingDomainRef(e.routingDomain) }
  }

  // The lines: every written link, except a virtual one between two nodes that runs over a
  // segment that is a vertex (the structure puts both nodes in the segment instead; their
  // memberships are lines of their own below), and the memberships of segments.
  const all: Omit<Line, 'index'>[] = []
  for (const [position, link] of network.links.entries()) {
    const [a, b] = link.endpoints
    const over =
      link.virtual === true &&
      'node' in a &&
      'node' in b &&
      (link.segments ?? []).some((s) => segmentVertices.has(s))
    if (over) continue
    all.push({
      link: position,
      ...(link.id === undefined ? {} : { linkId: link.id }),
      ends: [endOf(a), endOf(b)],
      virtual: link.virtual === true,
    })
  }
  for (const edge of analysis.edges) {
    if (edge.kind !== 'member') continue
    const [a, b] = edge.ends
    const node = 'node' in a ? a : 'node' in b ? b : undefined
    const segment = 'segment' in a ? a : 'segment' in b ? b : undefined
    if (!node || !segment) continue
    all.push({
      ends: [endOf({ node: node.node }), endOf({ segment: segment.segment })],
      virtual: edge.virtual,
    })
  }
  const lines: Line[] = []
  const inner: Line[] = []
  for (const line of all) {
    const [a, b] = line.ends
    if (a.element !== b.element) lines.push({ ...line, index: lines.length })
    else if (a.node !== undefined && b.node !== undefined && a.node !== b.node)
      inner.push({ ...line, index: inner.length })
  }
  const degree = new Map<ElementId, number>()
  for (const line of lines) {
    for (const end of line.ends) degree.set(end.element, (degree.get(end.element) ?? 0) + 1)
  }

  // Hosting places a hosted element one rank beyond its host's and keeps it near; it is not a
  // wire. These come after the bus sizes are taken, which count wires.
  for (const [node, host] of hostedBy) {
    lines.push({
      index: lines.length,
      ends: [{ element: elementOfHost(host) }, { element: unitRef(node) }],
      virtual: false,
      layoutOnly: true,
    })
  }

  const elements: Element[] = []
  const made = new Set<string>()
  for (const node of network.nodes) {
    const id = hostedBy.has(node.id) ? node.id : unitOf(node.id)
    if (made.has(id)) continue
    made.add(id)
    if (hostedBy.has(node.id)) {
      elements.push(unitElement(network, id, [id], 'node', placeOfNode(id), metrics))
      continue
    }
    const unit = unitById.get(id)
    const own = (unit?.members ?? [id]).filter((m) => !hostedBy.has(m))
    const place = commonPlace(
      own.map((m) => placeOfNode(m)),
      parents,
    )
    elements.push(unitElement(network, id, own, unit?.kind, place, metrics))
  }
  for (const segment of network.segments ?? []) {
    if (!segmentVertices.has(segment.id)) continue
    const size = metrics.bus(segment.id, degree.get(segmentRef(segment.id)) ?? 0)
    elements.push({
      id: segmentRef(segment.id),
      kind: 'bus',
      members: [],
      ...(segment.group === undefined ? {} : { place: segment.group }),
      size,
      parts: [],
    })
  }
  for (const domain of network.routingDomains ?? []) {
    if (!domainVertices.has(domain.id)) continue
    elements.push({
      id: routingDomainRef(domain.id),
      kind: 'cloud',
      members: [],
      size: metrics.cloud(domain.id),
      parts: [],
    })
  }
  return { elements, lines, inner, groups: groupNodes(network.groups ?? []) }
}

/** A unit's element: its members' cards side by side, with room for the outline if it has one. */
function unitElement(
  network: input.Network,
  id: string,
  members: readonly NodeId[],
  kind: 'redundancy' | 'host' | 'node' | undefined,
  place: GroupId | undefined,
  metrics: Metrics,
): Element {
  const written = new Map(network.nodes.map((n, i) => [n.id, i]))
  const ordered = [...members].sort((a, b) => (written.get(a) ?? 0) - (written.get(b) ?? 0))
  const cards = ordered.map((node) => ({ node, size: metrics.card(node) }))
  const hull = kind === 'redundancy'
  const pad = hull ? metrics.hullPad : 0
  const height = Math.max(0, ...cards.map((c) => c.size.height)) + pad * 2
  let x = pad
  const parts: Part[] = []
  for (const card of cards) {
    parts.push({ node: card.node, x, y: (height - card.size.height) / 2, size: card.size })
    x += card.size.width + metrics.memberGap
  }
  const width = x - metrics.memberGap + pad
  const set = network.redundancy?.find((r) => r.id === id)
  return {
    id: unitRef(id),
    kind: 'unit',
    members: ordered,
    ...(hull ? { hull: set?.kind === undefined ? {} : { kind: set.kind } } : {}),
    ...(place === undefined ? {} : { place }),
    size: { width, height },
    parts,
  }
}

function groupNodes(groups: readonly input.Group[], parent?: GroupId): GroupNode[] {
  return groups.flatMap((g) => [
    {
      id: g.id,
      ...(g.label === undefined ? {} : { label: g.label }),
      ...(parent === undefined ? {} : { parent }),
    },
    ...groupNodes(g.groups ?? [], g.id),
  ])
}

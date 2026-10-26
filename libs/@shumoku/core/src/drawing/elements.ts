// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import type * as input from '../input/model.js'
import { analysisGraph, routingDomainRef, segmentRef } from '../structure/analysis-graph.js'
import type { GroupId, NodeId, Structure, Vertex } from '../structure/types.js'
import { deriveUnits, unitRef } from '../structure/units.js'
import type { Metrics, PlatformLayout, Size } from './metrics.js'

/**
 * Layer 1. What is drawn: a card for each unit, a bus for each segment a line ends at and a
 * cloud for each routing domain a line ends at, and the lines between them. A unit that holds
 * nodes running on its hosts is a platform: one card for the hosts, with the nodes counted or
 * nested inside, not a card for each. An element is named by its vertex in the structure (`unit:<id>`, `segment:<id>`, `routingDomain:<id>`).
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
  readonly kind: 'unit' | 'platform' | 'bus' | 'cloud'
  /** The nodes a unit holds, side by side in this order (a platform: hosts, then workloads). */
  readonly members: readonly NodeId[]
  /** A redundancy set is drawn inside one outline; this is the set's kind when it has one. */
  readonly hull?: { readonly kind?: string }
  /** The group it is in. A bus is in its segment's own group only; a cloud is in none. */
  readonly place?: GroupId
  readonly size: Size
  /** Where each member's card goes inside `size`; none for a platform. */
  readonly parts: readonly Part[]
  /** The hosts that have the cables and the nodes that run on them, for a platform. */
  readonly platform?: {
    readonly label: string
    readonly hosts: readonly NodeId[]
    readonly workloads: readonly NodeId[]
    readonly layout: PlatformLayout
  }
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
}

export interface Line {
  readonly index: number
  /** The position of the written link this line is, when it is one. */
  readonly link?: number
  readonly linkId?: string
  readonly ends: readonly [LineEnd, LineEnd]
  /** The line has no cable of its own. */
  readonly virtual: boolean
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
  const analysis = analysisGraph(network)
  const segmentVertices = new Set(
    analysis.vertices.filter((v) => v.kind === 'segment').map((v) => v.id),
  )
  const domainVertices = new Set(
    analysis.vertices.filter((v) => v.kind === 'routingDomain').map((v) => v.id),
  )

  const endOf = (e: input.Endpoint): LineEnd => {
    if ('node' in e) return { element: unitRef(unitOf(e.node)), node: e.node }
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

  const elements: Element[] = []
  const made = new Set<string>()
  for (const node of network.nodes) {
    const id = unitOf(node.id)
    if (made.has(id)) continue
    made.add(id)
    const unit = unitById.get(id)
    elements.push(
      unitElement(
        network,
        id,
        unit?.members ?? [id],
        unit?.kind,
        unit?.place,
        degree.get(unitRef(id)) ?? 0,
        metrics,
      ),
    )
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

/**
 * A unit's element: its members' cards side by side, with room for the outline if it has one; a
 * platform when nodes run on its hosts.
 */
function unitElement(
  network: input.Network,
  id: string,
  members: readonly NodeId[],
  kind: 'redundancy' | 'host' | 'node' | undefined,
  place: GroupId | undefined,
  lines: number,
  metrics: Metrics,
): Element {
  const written = new Map(network.nodes.map((n, i) => [n.id, i]))
  const ordered = [...members].sort((a, b) => (written.get(a) ?? 0) - (written.get(b) ?? 0))
  const set = network.redundancy?.find((r) => r.id === id)
  const hosts = kind === 'redundancy' ? ordered.filter((n) => set?.nodes.includes(n)) : [id]
  const workloads = ordered.filter((n) => !hosts.includes(n))
  if ((kind === 'redundancy' || kind === 'host') && workloads.length > 0) {
    const label = set
      ? (set.label ?? set.id)
      : (network.nodes.find((n) => n.id === id)?.label ?? id)
    const layout = metrics.platform(label, hosts, workloads, lines)
    return {
      id: unitRef(id),
      kind: 'platform',
      members: [...hosts, ...workloads],
      ...(place === undefined ? {} : { place }),
      size: layout.size,
      parts: [],
      platform: {
        label,
        hosts,
        workloads,
        layout,
      },
    }
  }
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

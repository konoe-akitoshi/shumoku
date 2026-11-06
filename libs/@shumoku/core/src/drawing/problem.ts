// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import type * as input from '../input/model.js'
import type { NetworkModel } from '../models/network-model.js'
import { toNetworkGraph } from '../models/network-model-graph.js'
import type { Link, Node, Subgraph } from '../models/types.js'
import { compare, joinKey, sorted } from '../structure/keys.js'
import type { NodeId, Structure, Vertex } from '../structure/types.js'
import { slotOf } from './ground.js'
import { drawnInPlace, hostBox, hostingOf, poolFrameId, poolsByPlace } from './hosting.js'
import type { Box, Insets, Metrics, Size } from './metrics.js'

/**
 * The drawing layout's input, in the layout's own terms: boxes inside frames, and the order,
 * the levels and the lines between them. Only `readProblem` knows what a network is; every later
 * layer reads this and nothing else, so each can be replaced without the others noticing.
 */

/** A card's id; a bus is its segment's id, a cloud its routing domain's, a unit `unit:<id>`. */
export type ItemId = string
/** A group's id; the root, which holds the whole drawing, is the empty string. */
export type FrameId = string

export const ROOT: FrameId = ''

export interface Frame {
  id: FrameId
  parent?: FrameId
  insets: Insets
  group?: Subgraph
}

interface ItemBase {
  id: ItemId
  frame: FrameId
  /** The size of what is drawn; a unit's includes the room around its members. */
  size: Size
}

/** A node drawn inside its host's box, at `at` from the box's top-left corner. */
export interface Guest {
  node: Node
  size: Size
  at: { x: number; y: number }
}

/**
 * A card, a bus or a cloud: one node, drawn as what it is. A host's card holds its `guests`: its
 * size is the whole box, and the lines to a guest end on the box's edge.
 */
export interface NodeItem extends ItemBase {
  kind: 'card' | 'bus' | 'cloud'
  node: Node
  guests?: Guest[]
  /** With guests: the height of the host's own card at the top of the box. */
  heading?: number
}

/** A redundancy set folded into one outline round its members. */
export interface UnitItem extends ItemBase {
  kind: 'unit'
  /** Their order is the order layer's to decide. */
  members: { node: Node; size: Size; guests?: Guest[]; heading?: number }[]
  /** What the unit is written as on its outline, such as ha or mlag. */
  hullKind?: string
}

export type Item = NodeItem | UnitItem

/**
 * `oriented`: the structure gives the two ends a relation, one above the other or level, so the
 * line is a hand-over down the flow or between equals, and it places its ends. `unrelated`: the
 * structure relates its ends in no way, so the line places nothing and finds its way between the
 * others. `inside`: both ends are in one unit, so the line runs between neighbours inside its
 * outline.
 */
export type LineRole = Line['role']

export interface End {
  item: ItemId
  node?: NodeId
  port?: string
}

/** How the structure puts the ends of a line: level, or one above the other. */
export type Flow = 'level' | 'a above b' | 'b above a'

interface LineBase {
  id: string
  link: Link
  a: End
  b: End
  /** The width the line is drawn at, and the room it takes across: what its neighbours keep off. */
  stroke: number
  /** Shared by twins, which run between the same two items, and by no other line. */
  family: string
}

export type Line = LineBase &
  (
    | {
        role: 'oriented'
        /** For a line down the flow, the end that stands upstream is the one named first. */
        flow: Flow
      }
    | { role: 'unrelated' }
    | { role: 'inside' }
  )

/** `lower` stands below `upper`. */
interface Above {
  upper: ItemId
  lower: ItemId
}
/** The two stand at one height. */
export interface Level {
  a: ItemId
  b: ItemId
}
/** A node that sits on a host, drawn beside it. */
interface Satellite {
  item: ItemId
  partner: ItemId
  why: 'host'
}
export interface Problem {
  metrics: Metrics
  /** The root first, a parent before its children, the same depth in id order. */
  frames: Frame[]
  /** In id order. */
  items: Item[]
  lines: Line[]
  /**
   * The room one port takes along the edge of each box, by `boxKey`: from the names written
   * beside its ports and the widest line that ends there. Known before any line is routed.
   */
  slots: Map<string, number>
  above: Above[]
  level: Level[]
  satellites: Satellite[]
  /** Items the structure gives no place in the flow and that sit on no host. */
  free: ItemId[]
  /** Directions the structure gave that would have made a cycle, left out. */
  dropped: Above[]
  /** Links that run inside a host's box (host to guest, guest to guest), by the host: not routed. */
  inner: { link: Link; host: NodeId }[]
  /** The items at the boundary points, in the order the reader wrote them. */
  boundary: ItemId[]
}

const unitId = (id: string): ItemId => `unit:${id}`

/**
 * Reads a network and its structure as a drawing problem. The one place that knows the network:
 * what a unit, a bus or a hosted node is, and which lines place things and which only lie over
 * them. Everything is processed in id order, so the same network written in another order gives
 * the same problem.
 */
export function readProblem(
  network: input.Network,
  structure: Structure,
  metrics: Metrics,
  layers: Omit<NetworkModel, 'config'> = {},
): Problem {
  // A routing domain has no node in the graph and the lines to it are left out, so it is given a
  // cloud node and its lines end there. The structure is read from the original network.
  const domains = new Map((network.routingDomains ?? []).map((d) => [d.id, d]))
  const cloudIds = sorted(
    new Set(
      network.links.flatMap((l) =>
        l.endpoints.flatMap((e) => ('routingDomain' in e ? [e.routingDomain] : [])),
      ),
    ),
  )
  const asNode = (e: input.Endpoint): input.Endpoint =>
    'routingDomain' in e ? { node: e.routingDomain } : e
  const drawn: input.Network = {
    ...network,
    nodes: [
      ...network.nodes,
      ...cloudIds.map((id): input.Node => {
        const label = domains.get(id)?.label
        return { id, type: 'cloud', ...(label && { label }) }
      }),
    ],
    links: network.links.map((l) => ({
      ...l,
      endpoints: [asNode(l.endpoints[0]), asNode(l.endpoints[1])],
    })),
  }
  const graph = toNetworkGraph({ ...layers, config: drawn })
  const graphNodes = new Map(graph.nodes.map((n) => [n.id, n]))
  const configNodes = new Map(network.nodes.map((n) => [n.id, n]))
  const sets = new Map((network.redundancy ?? []).map((r) => [r.id, r]))
  // What runs on what is drawn inside it: a node in its host's box, a cluster's guests and nodes
  // in the cluster's frame (see hosting.ts).
  const hosting = hostingOf(network)
  const guestsOf = hosting.boxes
  const hostOfGuest = new Map<NodeId, NodeId>()
  for (const [h, gs] of guestsOf) for (const g of gs) hostOfGuest.set(g, h)
  const poolOfNode = new Map<NodeId, string>()
  for (const [set, pool] of hosting.pools) {
    for (const n of [...(sets.get(set)?.nodes ?? []), ...pool.guests]) poolOfNode.set(n, set)
  }

  // ---- frames
  const frames: Frame[] = [{ id: ROOT, insets: { top: 0, right: 0, bottom: 0, left: 0 } }]
  const subgraphs = new Map((graph.subgraphs ?? []).map((g) => [g.id, g]))
  // A pool's frame hangs in the place it stands in, as a group of the drawing's own.
  const pools = poolsByPlace(hosting)
  const poolFrames = (place: string | undefined): input.Group[] =>
    (pools.get(place) ?? []).map((set) => ({
      id: poolFrameId(set),
      label: sets.get(set)?.label ?? set,
    }))
  const poolGroups = new Map(
    [...hosting.pools.keys()].map((set): [string, Subgraph] => {
      const id = poolFrameId(set)
      return [id, { id, label: sets.get(set)?.label ?? set }]
    }),
  )
  const childrenOf = (g: input.Group): input.Group[] => [...(g.groups ?? []), ...poolFrames(g.id)]
  let row: input.Group[] = [...(network.groups ?? []), ...poolFrames(undefined)]
  let parents: FrameId[] = row.map(() => ROOT)
  while (row.length > 0) {
    const order = row
      .map((g, i) => [g, parents[i] ?? ROOT] as const)
      .sort(([a], [b]) => compare(a.id, b.id))
    for (const [g, parent] of order) {
      const group = subgraphs.get(g.id) ?? poolGroups.get(g.id)
      frames.push({
        id: g.id,
        parent,
        insets: metrics.group(g.id),
        ...(group && { group }),
      })
    }
    row = order.flatMap(([g]) => childrenOf(g))
    parents = order.flatMap(([g]) => childrenOf(g).map(() => g.id))
  }
  const frameIds = new Set(frames.map((f) => f.id))

  // ---- units: a folded redundancy set is one item, a node alone or with its guests another
  const foldedSets = new Set(
    Object.values(structure.nodes)
      .map((v) => v.unit)
      .filter((u) => sets.has(u)),
  )
  const unitOfNode = (n: NodeId) => structure.nodes[n]?.unit ?? n
  const memberOfSet = (n: NodeId): string | undefined => {
    const u = unitOfNode(n)
    return foldedSets.has(u) && sets.get(u)?.nodes.includes(n) ? u : undefined
  }
  const itemOfUnit = (u: string): ItemId => (foldedSets.has(u) ? unitId(u) : u)
  const itemOfNode = (n: NodeId): ItemId => {
    if (hostOfGuest.has(n)) return itemOfNode(hostOfGuest.get(n) ?? n)
    const set = memberOfSet(n)
    return set === undefined ? n : unitId(set)
  }

  // ---- places
  const placeMemo = new Map<NodeId, FrameId | undefined>()
  const placeOf = (n: NodeId, seen: ReadonlySet<string> = new Set()): FrameId | undefined => {
    if (placeMemo.has(n)) return placeMemo.get(n)
    if (seen.has(n)) return undefined
    const node = configNodes.get(n)
    const pool = poolOfNode.get(n)
    let place = pool === undefined ? node?.group : poolFrameId(pool)
    const host = node?.host
    if (place === undefined && host !== undefined) {
      const next = new Set(seen).add(n)
      const through = configNodes.has(host) ? [host] : (sets.get(host)?.nodes ?? [])
      for (const h of through) {
        place = place ?? placeOf(h, next)
      }
    }
    place = place ?? graphNodes.get(n)?.parent
    placeMemo.set(n, place)
    return place
  }
  const frameOf = (place: string | undefined): FrameId =>
    place !== undefined && frameIds.has(place) ? place : ROOT

  // ---- items
  const contained = hosting.contained
  const drawnNode = (n: NodeId, frame: FrameId): Node | undefined => {
    const found = graphNodes.get(n)
    if (!found) return undefined
    const node = contained.has(n) ? drawnInPlace(found) : found
    const { parent: _parent, ...rest } = node
    return frame === ROOT ? rest : { ...rest, parent: frame }
  }
  const linesAt = new Map<string, number>()
  for (const l of network.links) {
    for (const e of l.endpoints) {
      const id = 'segment' in e ? e.segment : 'routingDomain' in e ? e.routingDomain : undefined
      if (id !== undefined) linesAt.set(id, (linesAt.get(id) ?? 0) + 1)
    }
  }

  /** A host's box: its card as the heading and its guests below; just the card for a node with none. */
  const boxed = (h: NodeId, frame: FrameId): { size: Size; guests?: Guest[]; heading?: number } => {
    const heading = metrics.card(h)
    const guests = (guestsOf.get(h) ?? []).flatMap((g) => {
      const node = drawnNode(g, frame)
      return node ? [{ id: g, node, size: metrics.card(g) }] : []
    })
    if (guests.length === 0) return { size: heading }
    const box = hostBox(heading, guests, { gap: metrics.memberGap, pad: metrics.hullPad })
    const nodeOf = new Map(guests.map((g) => [g.id, g.node]))
    return {
      size: box.size,
      heading: heading.height,
      guests: box.seated.flatMap((s) => {
        const node = nodeOf.get(s.id)
        return node ? [{ node, size: s.size, at: s.at }] : []
      }),
    }
  }

  const items: Item[] = []
  for (const n of network.nodes) {
    if (memberOfSet(n.id) !== undefined || hostOfGuest.has(n.id)) continue
    const frame = frameOf(placeOf(n.id))
    const node = drawnNode(n.id, frame)
    if (node) items.push({ id: n.id, kind: 'card', frame, ...boxed(n.id, frame), node })
  }
  for (const id of sorted(foldedSets)) {
    const set = sets.get(id)
    if (!set) continue
    const memberIds = sorted(set.nodes)
    const place = memberIds.map((m) => placeOf(m)).find((p) => p !== undefined)
    const frame = frameOf(place)
    const members = memberIds.flatMap((m) => {
      const node = drawnNode(m, frame)
      return node ? [{ node, ...boxed(m, frame) }] : []
    })
    const width =
      members.reduce((sum, m) => sum + m.size.width, 0) +
      Math.max(0, members.length - 1) * metrics.memberGap +
      2 * metrics.hullPad
    const height = Math.max(0, ...members.map((m) => m.size.height)) + 2 * metrics.hullPad
    items.push({
      id: unitId(id),
      kind: 'unit',
      frame,
      size: { width, height },
      members,
      ...(set.kind && { hullKind: set.kind }),
    })
  }
  for (const s of network.segments ?? []) {
    const lines = linesAt.get(s.id)
    if (lines === undefined || !graphNodes.has(s.id) || configNodes.has(s.id)) continue
    const node = graphNodes.get(s.id)
    const frame = frameOf(node?.parent)
    const drawnBus = drawnNode(s.id, frame)
    if (drawnBus)
      items.push({ id: s.id, kind: 'bus', frame, size: metrics.bus(s.id, lines), node: drawnBus })
  }
  for (const id of cloudIds) {
    const node = drawnNode(id, ROOT)
    if (node) items.push({ id, kind: 'cloud', frame: ROOT, size: metrics.cloud(id), node })
  }
  items.sort((a, b) => compare(a.id, b.id))

  // ---- what stands where, from the structure
  const vertexItem = (v: Vertex): ItemId =>
    'unit' in v ? itemOfUnit(v.unit) : 'segment' in v ? v.segment : v.routingDomain
  const near = new Set<ItemId>()
  for (const plane of structure.planes) {
    for (const [a, b] of [...plane.flows, ...plane.even]) {
      near.add(vertexItem(a))
      near.add(vertexItem(b))
    }
  }

  // A node that sits on a host is drawn as a card of its own, beside the host.
  const satellites: Satellite[] = []
  for (const n of network.nodes) {
    const u = unitOfNode(n.id)
    if (u === n.id || memberOfSet(n.id) !== undefined || hostOfGuest.has(n.id)) continue
    satellites.push({ item: n.id, partner: itemOfUnit(u), why: 'host' })
  }
  const hosted = new Map(satellites.map((s) => [s.item, s.partner]))
  const vertexOfItem = (id: ItemId): ItemId => hosted.get(id) ?? id

  // ---- lines
  // The lines are numbered in the order of what they say, not of where they are written: a tie
  // anywhere later is broken by this number, so the same links written in another order give the
  // same drawing. Two links that say the same thing are interchangeable.
  const written = network.links.flatMap((l, i) => {
    const link = graph.links[i]
    return link ? [{ l, link, key: writtenKey(l) }] : []
  })
  written.sort((p, q) => compare(p.key, q.key))
  /** The host box a node's line ends in, when the node is a guest or a host with guests. */
  const boxOfNode = (e: input.Endpoint): NodeId | undefined => {
    if (!('node' in e)) return undefined
    const host = hostOfGuest.get(e.node) ?? e.node
    return guestsOf.has(host) ? host : undefined
  }
  const rawLines = written.map(({ l, link }, i) => {
    const end = (e: input.Endpoint): End => {
      if (!('node' in e)) return { item: 'segment' in e ? e.segment : e.routingDomain }
      // A line to a guest ends on its host's box, at a port named for the guest.
      const host = hostOfGuest.get(e.node)
      if (host !== undefined)
        return {
          item: itemOfNode(host),
          node: host,
          port: e.port ? `${e.node}/${e.port}` : e.node,
        }
      return { item: itemOfNode(e.node), node: e.node, ...(e.port && { port: e.port }) }
    }
    const [ea, eb] = l.endpoints
    return {
      id: `link:${String(i).padStart(6, '0')}`,
      link,
      a: end(ea),
      b: end(eb),
      virtual: l.virtual === true,
      within:
        boxOfNode(ea) !== undefined && boxOfNode(ea) === boxOfNode(eb) ? boxOfNode(ea) : undefined,
    }
  })
  // A line between a host and its guest, or two guests of one host, runs inside the host's box:
  // the box says it, so it is not routed; it is kept as a link the box holds.
  const inner = written.flatMap(({ link }, i) => {
    const host = rawLines[i]?.within
    return host === undefined ? [] : [{ link, host }]
  })
  const routed = rawLines.filter((l) => l.within === undefined)

  // What the structure gives no place in the flow, and that is not a node sitting on a host, has
  // no height or side to be given: it is free, and the report says so.
  const placed = new Set<ItemId>([...near, ...satellites.map((s) => s.item)])
  const free = items.filter((i) => !placed.has(i.id)).map((i) => i.id)

  // ---- above and level, physical first so that a virtual direction that contradicts it is the
  // one dropped
  const aboveSeen = new Map<string, Above>()
  const dropped: Above[] = []
  const levelSeen = new Map<string, Level>()
  const planes = [...structure.planes].sort(
    (a, b) => compare(a.side, b.side) || compare(a.plane, b.plane),
  )
  for (const plane of planes) {
    for (const [near_, far] of plane.flows) {
      const n = vertexItem(near_)
      const f = vertexItem(far)
      const edge: Above =
        plane.side === 'physical' ? { upper: n, lower: f } : { upper: f, lower: n }
      if (aboveSeen.has(joinKey([edge.lower, edge.upper]))) dropped.push(edge)
      else aboveSeen.set(joinKey([edge.upper, edge.lower]), edge)
    }
    for (const [a, b] of plane.even) {
      const ia = vertexItem(a)
      const ib = vertexItem(b)
      if (ia === ib) continue
      const [x, y] = compare(ia, ib) <= 0 ? [ia, ib] : [ib, ia]
      levelSeen.set(joinKey([x, y]), { a: x, b: y })
    }
  }
  const levels = [...levelSeen.values()].sort((p, q) => compare(p.a, q.a) || compare(p.b, q.b))
  const aboveAll = [...aboveSeen.values()].sort(
    (p, q) => compare(p.upper, q.upper) || compare(p.lower, q.lower),
  )
  const { kept, cut } = acyclic(aboveAll, levels)

  // ---- lines: what the structure says of the two ends, followed through the directions it gave
  // (a line from the upper end of a chain to the lower is a hand-over down the flow however many
  // boxes lie between), is all a line is placed by. Where it says nothing, the line is its own.
  const relate = relation(kept, levels)
  const lines: Line[] = routed.map((l): Line => {
    const va = vertexOfItem(l.a.item)
    const vb = vertexOfItem(l.b.item)
    const base = {
      id: l.id,
      link: l.link,
      a: l.a,
      b: l.b,
      stroke: metrics.line(l.link),
      family: joinKey([l.a.item, l.b.item].sort(compare)),
    }
    if (va === vb) return { ...base, role: 'inside' }
    const how = relate(va, vb)
    return how === undefined
      ? { ...base, role: 'unrelated' }
      : { ...base, role: 'oriented', flow: how }
  })

  return {
    metrics,
    frames,
    items,
    lines,
    slots: slotsOf(lines, metrics),
    above: kept,
    level: levels,
    satellites: satellites.sort((a, b) => compare(a.item, b.item)),
    free,
    dropped: [...dropped, ...cut],
    inner,
    boundary: structure.boundary.map(vertexItem),
  }
}

/**
 * What the directions and the levels say of two items, followed as far as they go: they stand at
 * one height, or one stands above the other through any chain of directions (levels taken as one
 * item), or nothing is said. A chain through a shared item is the structure's own statement;
 * nothing is added to it.
 */
function relation(
  above: readonly Above[],
  level: readonly Level[],
): (a: ItemId, b: ItemId) => Flow | undefined {
  const parent = new Map<string, string>()
  const find = (x: string): string => {
    const p = parent.get(x) ?? x
    if (p === x) return x
    const r = find(p)
    parent.set(x, r)
    return r
  }
  for (const { a, b } of level) parent.set(find(a), find(b))
  const down = new Map<string, string[]>()
  for (const e of above)
    down.set(find(e.upper), [...(down.get(find(e.upper)) ?? []), find(e.lower)])
  const reached = new Map<string, Set<string>>()
  const below = (k: string): Set<string> => {
    const known = reached.get(k)
    if (known) return known
    const seen = new Set<string>()
    const stack = [...(down.get(k) ?? [])]
    for (let n = stack.pop(); n !== undefined; n = stack.pop()) {
      if (seen.has(n)) continue
      seen.add(n)
      stack.push(...(down.get(n) ?? []))
    }
    reached.set(k, seen)
    return seen
  }
  return (a, b) => {
    const [ka, kb] = [find(a), find(b)]
    if (ka === kb) return 'level'
    if (below(ka).has(kb)) return 'a above b'
    if (below(kb).has(ka)) return 'b above a'
    return undefined
  }
}

/**
 * Drops the directions that close a cycle once items at one level are taken as one. The
 * structure promises none; a cycle would leave no height to give, so it is cut here, at the
 * direction met last in id order, rather than let a layer fail on it.
 */
function acyclic(above: Above[], level: Level[]): { kept: Above[]; cut: Above[] } {
  const parent = new Map<string, string>()
  const find = (x: string): string => {
    const p = parent.get(x) ?? x
    if (p === x) return x
    const r = find(p)
    parent.set(x, r)
    return r
  }
  for (const { a, b } of level) parent.set(find(a), find(b))
  const out = new Map<string, Above[]>()
  for (const e of above) {
    const k = find(e.upper)
    out.set(k, [...(out.get(k) ?? []), e])
  }
  const state = new Map<string, 'open' | 'done'>()
  const cut = new Set<Above>()
  const visit = (k: string) => {
    state.set(k, 'open')
    for (const e of out.get(k) ?? []) {
      const next = find(e.lower)
      const s = state.get(next)
      if (next === k || s === 'open') cut.add(e)
      else if (s === undefined) visit(next)
    }
    state.set(k, 'done')
  }
  for (const k of sorted(new Set(above.map((e) => find(e.upper))))) {
    if (!state.has(k)) visit(k)
  }
  return { kept: above.filter((e) => !cut.has(e)), cut: [...cut] }
}

const lineIndex = new WeakMap<readonly Line[], ReadonlyMap<string, Line>>()

/** The problem's lines by id, built once for the problem. */
export function linesById(problem: Pick<Problem, 'lines'>): ReadonlyMap<string, Line> {
  let index = lineIndex.get(problem.lines)
  if (!index) {
    index = new Map(problem.lines.map((l) => [l.id, l]))
    lineIndex.set(problem.lines, index)
  }
  return index
}

/** The box an end is on: its node, else its item. */
export const boxKey = (end: End): string => end.node ?? end.item

function slotsOf(lines: readonly Line[], metrics: Metrics): Map<string, number> {
  const at = new Map<string, { labels: Set<string | undefined>; lines: Line[] }>()
  for (const line of lines) {
    if (line.role === 'inside') continue
    for (const end of [line.a, line.b]) {
      const here = at.get(boxKey(end)) ?? { labels: new Set<string | undefined>(), lines: [] }
      here.labels.add(end.port)
      here.lines.push(line)
      at.set(boxKey(end), here)
    }
  }
  return new Map([...at].map(([box, here]) => [box, slotOf(metrics, [...here.labels], here.lines)]))
}

/**
 * A written value as text that does not depend on the order its fields were written in: the same
 * link gives the same key wherever it stands in the file.
 */
function writtenKey(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(writtenKey).join(',')}]`
  if (value !== null && typeof value === 'object') {
    const fields = Object.entries(value)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => compare(a, b))
    return `{${fields.map(([k, v]) => `${JSON.stringify(k)}:${writtenKey(v)}`).join(',')}}`
  }
  return JSON.stringify(value) ?? 'null'
}

/** The key of one end of a line, such as `link:000001.a`. */
export const lineEnd = (line: string, end: 'a' | 'b'): string => `${line}.${end}`

/** Where everything stands. */
export interface Geometry {
  /** Items by id, frames by `frameKey`, and the members of units by node id. */
  boxes: Map<string, Box>
}

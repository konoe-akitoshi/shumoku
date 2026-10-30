// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import type * as input from '../input/model.js'
import { toNetworkGraph } from '../models/network-model-graph.js'
import type { Link, Node, Subgraph } from '../models/types.js'
import { compare, sorted } from '../structure/keys.js'
import type { NodeId, Structure, Vertex } from '../structure/types.js'
import type { Box, Insets, Metrics, Point, Size } from './metrics.js'
import type { Scene } from './scene.js'

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

export interface Item {
  id: ItemId
  kind: 'card' | 'unit' | 'bus' | 'cloud'
  frame: FrameId
  /** The size of what is drawn; a unit's includes the room around its members. */
  size: Size
  /** What a card, bus or cloud is drawn as. */
  node?: Node
  /** A unit's members; their order is the order layer's to decide. */
  members?: { node: Node; size: Size }[]
  /** What a unit is written as on its outline, such as ha or mlag. */
  hullKind?: string
}

/**
 * `oriented`: both ends have a place in the flow. `attach`: one end has none and is drawn beside
 * the other. `overlay`: laid over the drawing without placing anything. `inside`: both ends are
 * in one unit, so the line runs between neighbours inside its outline.
 */
export type LineRole = 'oriented' | 'attach' | 'overlay' | 'inside'

export interface End {
  item: ItemId
  node?: NodeId
  port?: string
}

export interface Line {
  id: string
  link: Link
  a: End
  b: End
  role: LineRole
}

/** `lower` stands below `upper`. */
export interface Above {
  upper: ItemId
  lower: ItemId
}
/** The two stand at one height. */
export interface Level {
  a: ItemId
  b: ItemId
}
/** An item with no place in the flow, drawn beside the item it is tied to. */
export interface Satellite {
  item: ItemId
  partner: ItemId
  why: 'host' | 'attach'
}
/** Items that hang off the same neighbours and lead nowhere, which may be laid out in rows. */
export interface Twins {
  id: string
  members: ItemId[]
  toward: 'down' | 'up'
}

export interface Problem {
  metrics: Metrics
  /** The root first, a parent before its children, the same depth in id order. */
  frames: Frame[]
  /** In id order. */
  items: Item[]
  lines: Line[]
  above: Above[]
  level: Level[]
  satellites: Satellite[]
  /** Items that stand in the flow nowhere and beside nothing. */
  free: ItemId[]
  twins: Twins[]
  /** The columns each twins' rows are wrapped to; absent means one row. */
  wrap: Record<string, number>
  /** Directions the structure gave that would have made a cycle, left out. */
  dropped: Above[]
}

const unitId = (id: string): ItemId => `unit:${id}`
const pairKey = (a: string, b: string) => (compare(a, b) <= 0 ? `${a}\0${b}` : `${b}\0${a}`)

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
  const graph = toNetworkGraph({ config: drawn })
  const graphNodes = new Map(graph.nodes.map((n) => [n.id, n]))
  const configNodes = new Map(network.nodes.map((n) => [n.id, n]))
  const sets = new Map((network.redundancy ?? []).map((r) => [r.id, r]))

  // ---- frames
  const frames: Frame[] = [{ id: ROOT, insets: { top: 0, right: 0, bottom: 0, left: 0 } }]
  const subgraphs = new Map((graph.subgraphs ?? []).map((g) => [g.id, g]))
  let row: input.Group[] = [...(network.groups ?? [])]
  let parents: FrameId[] = row.map(() => ROOT)
  while (row.length > 0) {
    const order = row
      .map((g, i) => [g, parents[i] ?? ROOT] as const)
      .sort(([a], [b]) => compare(a.id, b.id))
    for (const [g, parent] of order) {
      const group = subgraphs.get(g.id)
      frames.push({
        id: g.id,
        parent,
        insets: metrics.group(g.id),
        ...(group && { group }),
      })
    }
    row = order.flatMap(([g]) => g.groups ?? [])
    parents = order.flatMap(([g]) => (g.groups ?? []).map(() => g.id))
  }
  const frameIds = new Set(frames.map((f) => f.id))
  const frameParent = new Map(frames.map((f) => [f.id, f.parent]))

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
  const unitItem = (u: string): ItemId => (foldedSets.has(u) ? unitId(u) : u)
  const itemOfNode = (n: NodeId): ItemId => {
    const set = memberOfSet(n)
    return set === undefined ? n : unitId(set)
  }

  // ---- places
  const placeMemo = new Map<NodeId, FrameId | undefined>()
  const placeOf = (n: NodeId, seen: ReadonlySet<string> = new Set()): FrameId | undefined => {
    if (placeMemo.has(n)) return placeMemo.get(n)
    if (seen.has(n)) return undefined
    const node = configNodes.get(n)
    let place = node?.group
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
  const drawnNode = (n: NodeId, frame: FrameId): Node | undefined => {
    const node = graphNodes.get(n)
    if (!node) return undefined
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

  const items: Item[] = []
  for (const n of network.nodes) {
    if (memberOfSet(n.id) !== undefined) continue
    const frame = frameOf(placeOf(n.id))
    const node = drawnNode(n.id, frame)
    if (node) items.push({ id: n.id, kind: 'card', frame, size: metrics.card(n.id), node })
  }
  for (const id of sorted(foldedSets)) {
    const set = sets.get(id)
    if (!set) continue
    const memberIds = sorted(set.nodes)
    const place = memberIds.map((m) => placeOf(m)).find((p) => p !== undefined)
    const frame = frameOf(place)
    const members = memberIds.flatMap((m) => {
      const node = drawnNode(m, frame)
      return node ? [{ node, size: metrics.card(m) }] : []
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
  const itemById = new Map(items.map((i) => [i.id, i]))

  // ---- what stands where, from the structure
  const vertexItem = (v: Vertex): ItemId =>
    'unit' in v ? unitItem(v.unit) : 'segment' in v ? v.segment : v.routingDomain
  const near = new Set<ItemId>()
  const flowPairs = { physical: new Set<string>(), virtual: new Set<string>() }
  for (const plane of structure.planes) {
    for (const [a, b] of [...plane.flows, ...plane.even]) {
      near.add(vertexItem(a))
      near.add(vertexItem(b))
      flowPairs[plane.side].add(pairKey(vertexItem(a), vertexItem(b)))
    }
  }

  // A node that sits on a host is drawn as a card of its own, beside the host.
  const satellites: Satellite[] = []
  for (const n of network.nodes) {
    const u = unitOfNode(n.id)
    if (u === n.id || memberOfSet(n.id) !== undefined) continue
    satellites.push({ item: n.id, partner: unitItem(u), why: 'host' })
  }
  const hosted = new Map(satellites.map((s) => [s.item, s.partner]))
  const vertexOfItem = (id: ItemId): ItemId => hosted.get(id) ?? id

  // ---- lines
  const rawLines = network.links.flatMap((l, i) => {
    const link = graph.links[i]
    if (!link) return []
    const end = (e: input.Endpoint): End =>
      'node' in e
        ? { item: itemOfNode(e.node), node: e.node, ...(e.port && { port: e.port }) }
        : { item: 'segment' in e ? e.segment : e.routingDomain }
    const [ea, eb] = l.endpoints
    return [
      {
        id: `link:${String(i).padStart(6, '0')}`,
        link,
        a: end(ea),
        b: end(eb),
        virtual: l.virtual === true,
      },
    ]
  })
  const countBetween = new Map<string, number>()
  for (const l of rawLines) {
    const key = pairKey(vertexOfItem(l.a.item), vertexOfItem(l.b.item))
    countBetween.set(key, (countBetween.get(key) ?? 0) + 1)
  }

  // Items with no place in the flow stand beside what they are tied to, spreading outwards from
  // the items that have one, when that is within the group they stand in.
  const frameChain = (frame: FrameId): Set<FrameId> => {
    const chain = new Set<FrameId>()
    for (let f: FrameId | undefined = frame; f !== undefined; f = frameParent.get(f)) chain.add(f)
    return chain
  }
  const placed = new Set<ItemId>([...near, ...satellites.map((s) => s.item)])
  const unplaced = items.filter((i) => !placed.has(i.id)).map((i) => i.id)
  const neighbours = (id: ItemId): Map<ItemId, number> => {
    const found = new Map<ItemId, number>()
    for (const l of rawLines) {
      const a = vertexOfItem(l.a.item)
      const b = vertexOfItem(l.b.item)
      if (a === b) continue
      if (a === id) found.set(b, (found.get(b) ?? 0) + 1)
      else if (b === id) found.set(a, (found.get(a) ?? 0) + 1)
    }
    return found
  }
  const attached = new Map<ItemId, ItemId>()
  for (let progress = true; progress; ) {
    progress = false
    const reached = new Set([...placed, ...attached.keys()])
    const round: [ItemId, ItemId][] = []
    for (const id of unplaced) {
      if (attached.has(id)) continue
      const own = itemById.get(id)
      if (!own) continue
      const best = [...neighbours(id)]
        .filter(([o]) => {
          const other = itemById.get(o)
          return reached.has(o) && other && frameChain(other.frame).has(own.frame)
        })
        .sort(([ia, ca], [ib, cb]) => cb - ca || compare(ia, ib))[0]
      if (best) round.push([id, best[0]])
    }
    for (const [id, partner] of round) {
      attached.set(id, partner)
      satellites.push({ item: id, partner, why: 'attach' })
      progress = true
    }
  }
  const free = unplaced.filter((id) => !attached.has(id))

  const attachPairs = new Set(
    satellites.filter((s) => s.why === 'attach').map((s) => pairKey(s.item, s.partner)),
  )
  const lines: Line[] = rawLines.map((l) => {
    const va = vertexOfItem(l.a.item)
    const vb = vertexOfItem(l.b.item)
    const role: LineRole =
      va === vb
        ? 'inside'
        : flowPairs[l.virtual ? 'virtual' : 'physical'].has(pairKey(va, vb))
          ? 'oriented'
          : attachPairs.has(pairKey(va, vb))
            ? 'attach'
            : 'overlay'
    return { id: l.id, link: l.link, a: l.a, b: l.b, role }
  })

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
      if (aboveSeen.has(`${edge.lower}\0${edge.upper}`)) dropped.push(edge)
      else aboveSeen.set(`${edge.upper}\0${edge.lower}`, edge)
    }
    for (const [a, b] of plane.even) {
      const ia = vertexItem(a)
      const ib = vertexItem(b)
      if (ia === ib) continue
      const [x, y] = compare(ia, ib) <= 0 ? [ia, ib] : [ib, ia]
      levelSeen.set(`${x}\0${y}`, { a: x, b: y })
    }
  }
  const levels = [...levelSeen.values()].sort((p, q) => compare(p.a, q.a) || compare(p.b, q.b))
  const aboveAll = [...aboveSeen.values()].sort(
    (p, q) => compare(p.upper, q.upper) || compare(p.lower, q.lower),
  )
  const { kept, cut } = acyclic(aboveAll, levels)

  const twins = findTwins(items, lines, kept, levels, satellites, free)

  return {
    metrics,
    frames,
    items,
    lines,
    above: kept,
    level: levels,
    satellites: satellites.sort((a, b) => compare(a.item, b.item)),
    free,
    twins,
    wrap: {},
    dropped: [...dropped, ...cut],
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

/**
 * Items of one group that hang off exactly the same neighbours, all on one side of them, and
 * lead nowhere further: the only ones that may be laid out in rows without a row looking like
 * a step in the flow.
 */
function findTwins(
  items: Item[],
  lines: Line[],
  above: Above[],
  level: Level[],
  satellites: Satellite[],
  free: ItemId[],
): Twins[] {
  const tied = new Set<ItemId>([
    ...level.flatMap((l) => [l.a, l.b]),
    ...satellites.flatMap((s) => [s.item, s.partner]),
    ...free,
  ])
  for (const l of lines) {
    if (l.role === 'attach') {
      tied.add(l.a.item)
      tied.add(l.b.item)
    }
  }
  const ups = new Map<ItemId, Set<ItemId>>()
  const downs = new Map<ItemId, Set<ItemId>>()
  for (const { upper, lower } of above) {
    ups.set(lower, (ups.get(lower) ?? new Set()).add(upper))
    downs.set(upper, (downs.get(upper) ?? new Set()).add(lower))
  }
  const groups = new Map<string, { toward: 'down' | 'up'; members: ItemId[] }>()
  for (const item of items) {
    if (item.kind !== 'card' && item.kind !== 'unit') continue
    if (tied.has(item.id)) continue
    const up = ups.get(item.id)
    const down = downs.get(item.id)
    if ((up === undefined) === (down === undefined)) continue
    const toward = up ? 'down' : 'up'
    const key = `${item.frame}\0${toward}\0${setList(up ?? down)}`
    const found = groups.get(key) ?? { toward, members: [] }
    found.members.push(item.id)
    groups.set(key, found)
  }
  return [...groups.values()]
    .filter((g) => g.members.length >= 2)
    .map((g) => ({ id: `twins:${g.members[0]}`, members: g.members, toward: g.toward }))
    .sort((a, b) => compare(a.id, b.id))
}

const setList = (s: Set<string> | undefined) => sorted(s ?? []).join('\0')

/** The key a frame has among items in the maps the layers return; a group may share an item's id. */
export const frameKey = (id: FrameId): string => `\0frame:${id}`

/** What `solveVertical` hands on: the heights, in the order the layers need. */
export interface YLayout {
  /** Items by id, frames by `frameKey`. */
  top: Map<string, number>
  bottom: Map<string, number>
  /** Siblings, an item or a frame key each, whose contents were already apart and are kept so. */
  stacked: [upper: string, lower: string][]
}

/** What `orderSiblings` hands on. */
export interface Order {
  /** Each frame's elements, left to right: item ids and `frameKey`s. */
  siblings: Map<FrameId, string[]>
  /** The members of each unit, left to right. */
  members: Map<ItemId, NodeId[]>
}

/** Where everything stands. */
export interface Geometry {
  /** Items by id, frames by `frameKey`, and the members of units by node id. */
  boxes: Map<string, Box>
}

/** What the wiring asks of the layout: at least this much room between two boxes. */
export interface Demand {
  axis: 'x' | 'y'
  /** An item id or a `frameKey`: the box on the top (or left) side. */
  before: string
  after: string
  /** The room asked for between the edge of `before` and the edge of `after`. */
  min: number
}

export interface Wiring {
  wires: Map<string, Point[]>
  ports: NonNullable<Scene['ports']>
  demands: Demand[]
  /** Lines that had to be allowed through what they should avoid, and what they went through. */
  violations: { lineId: string; through: string }[]
}

// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { compare } from '../structure/keys.js'
import type { GroupId, Structure } from '../structure/types.js'
import { type Placed, placeCoords } from './coords.js'
import { type Element, type ElementId, type Elements, elementIdOf, type Line } from './elements.js'
import { layOutFans } from './fans.js'
import type { Box, Metrics, Point, Size } from './metrics.js'
import { type Ordered, orderElements } from './order.js'
import { placingLines } from './placing.js'
import { wrapLayers } from './wrap.js'

/**
 * Layer 5, over the layers below it. Each group is laid out as one block, from the inside out.
 *
 * The structure says, line by line, which end is nearer, and which pairs are as near as each
 * other. It does not say how far a thing is from the boundary as a number, that things as far
 * as each other stand at one height, or that the steps between heights are even. So no number
 * of that kind is made: holding things at one height across the whole drawing is what draws a
 * group whose inside is a tree as a pyramid, and makes sites that should read as units run
 * through one another. Inside a group, its own elements and its child groups (each already a
 * block of known size) are ordered and given coordinates by the layers below, and the group's
 * frame is the rectangle around the result and the group's insets. A group is therefore always
 * one rectangle, whatever its inside is, and what lies in one group does not stand at the
 * height of what lies in another.
 *
 * The layers of a level are a tool of the ordering step (barycentre sweeps need rows to sweep
 * between) and mean nothing outside it. They are built from that level's constraints alone:
 * its items (elements and child blocks) are the nodes, each directed line between two items is
 * an edge from the nearer to the farther, the items at the two ends of an `even` pair share a
 * node, and an item's layer is the longest path to it from the nodes nothing comes before. Where
 * the lines around blocks disagree and the edges would form a cycle, the edges are taken in the
 * order of the lines they come from (the order they are written in), and one that would close a
 * cycle with those already taken is dropped. An item none of whose lines has a direction takes
 * the layer of what its lines go to (see below), and one with no such partner is in layer 0. A
 * drawing without a boundary has no directed line, so it has no direction at all: nothing is
 * put above anything.
 *
 * Only the structure gives a line a direction (see `placingLines`, which also says which end is
 * nearer): a line to an element the structure does not reach, or between a pair it counts only
 * as `even`, pulls its ends together across a level but never pushes a layer.
 *
 * A level whose layers make it too wide for `metrics.aspect` is given rows (see `wrap.ts`)
 * before its coordinates are found.
 *
 * Down the page the layers below compact the level (see `coords.ts`): a slot starts as high as what it is joined to, and what stands where
 * it does across, allow, so layers are not bands of one height. Along every directed line the
 * farther end then stands no higher than the nearer one, within a group and across groups
 * (unless the lines around a block form a cycle, which a single block cannot keep apart).
 * An item without a direction of its own is also kept no higher than where its lines really
 * end: the block keeps how far down the line ends as well as how far across, and the layers
 * below stand the item no higher than the mean of those heights.
 *
 * A line between an element inside a block and one outside it crosses the block's frame, at
 * the top edge when the outside end is nearer and at the bottom edge when it is farther (the
 * nearer end is the one the structure's `flows` pair names first, on either side of the
 * boundary).
 * Inside the block the line runs from a port of its own at that edge (a point without size, one
 * layer beyond the block's contents) to the element, so the layers below route it, the element
 * stands under where the line enters, and two lines into one element enter at two points.
 * Outside, the line is one from the block, and it ends where it ends inside: the block keeps
 * how far across it the line crosses (or, for a line without a route, how far across the
 * element it ends at is), and the pull at the outer level aims at that point and not at the
 * block's middle. A line without a direction that crosses a frame only pulls in this way: it has no port, pushes no layer, and is drawn straight.
 */
export interface Composition {
  /** Where every element stands, from the drawing's top-left corner. */
  readonly boxes: ReadonlyMap<ElementId, Box>
  /** The rectangle of every group that has anything in it. */
  readonly frames: ReadonlyMap<GroupId, Box>
  /**
   * For each line that is routed, the points between its two ends in order, through the frames
   * it crosses; a line without a route is drawn straight.
   */
  readonly routes: ReadonlyMap<number, readonly Point[]>
}

/** A laid-out group, everything in it from its own top-left corner. */
interface Block {
  readonly size: Size
  readonly boxes: ReadonlyMap<ElementId, Box>
  /** The frames of the groups inside it, and its own at the origin when it is a group. */
  readonly frames: ReadonlyMap<GroupId, Box>
  /** For each line that leaves it, the points from the end inside to the crossing on its frame. */
  readonly legs: ReadonlyMap<number, readonly Point[]>
  /** For each line that has both ends inside it and is not inside a block of its own. */
  readonly routes: ReadonlyMap<number, readonly Point[]>
  /**
   * For each line with one end inside it and one outside, where from the block's top-left
   * corner the line ends: where it crosses the frame if it is routed, else the middle of the
   * element it ends at.
   */
  readonly ends: ReadonlyMap<number, Point>
}

type Side = 'top' | 'bottom'

/**
 * A line of one level: its key (the line it is), its two ends there with how far each is off
 * the middle of its item, and the port it enters at.
 */
interface Piece {
  readonly key: number
  readonly virtual: boolean
  readonly ends: readonly [ElementId, ElementId]
  readonly offsets: readonly [number, number]
  /** The same down the page. */
  readonly offsetsY: readonly [number, number]
  /** The line has no direction, so it places neither end above the other. */
  readonly loose: boolean
  /** Which of `ends` is the nearer one, when the line has a direction. */
  readonly near?: 0 | 1
  readonly cross?: { readonly side: Side; readonly item: ElementId }
}

const blockId = (g: GroupId): ElementId => `block:${g}`
const portId = (side: Side, key: number): ElementId => `port:${side}:${key}`
const noInsets = { top: 0, right: 0, bottom: 0, left: 0 }

const shifted = (points: readonly Point[], dx: number, dy: number): Point[] =>
  points.map((p) => ({ x: p.x + dx, y: p.y + dy }))
const moved = (b: Box, dx: number, dy: number): Box => ({ ...b, x: b.x + dx, y: b.y + dy })

export function composeLayout(
  elements: Elements,
  structure: Structure,
  metrics: Metrics,
): Composition {
  const placing = placingLines(elements, structure)
  const known = new Set(elements.groups.map((g) => g.id))
  const parents = new Map(elements.groups.map((g) => [g.id, g.parent]))
  const byId = new Map(elements.elements.map((e) => [e.id, e]))
  const start = structure.boundary.map(elementIdOf)
  /** The pairs the structure says are as near as each other. */
  const evenPairs = structure.planes.flatMap((plane) =>
    plane.even.map(([a, b]) => [elementIdOf(a), elementIdOf(b)] as const),
  )

  /** The groups an element is in, the innermost first. */
  const chains = new Map<ElementId, GroupId[]>()
  for (const e of elements.elements) {
    const chain: GroupId[] = []
    let g = e.place !== undefined && known.has(e.place) ? e.place : undefined
    while (g !== undefined) {
      chain.push(g)
      g = parents.get(g)
    }
    chains.set(e.id, chain)
  }

  const lines: Line[] = []
  /** For each line the structure gives a direction, which of its ends is the nearer. */
  const nearOf = new Map<number, 0 | 1>()
  for (const line of elements.lines) {
    if (placing.lineOf[line.index] === undefined) continue
    lines.push(line)
    const near = placing.near[line.index]
    if (near !== undefined) nearOf.set(line.index, near)
  }
  /** The groups that have an element in them. */
  const occupied = new Set([...chains.values()].flat())

  /** What stands for an element at the level of `group`: itself, or the child block around it. */
  const itemAt = (group: GroupId | undefined, id: ElementId): ElementId | undefined => {
    const chain = chains.get(id) ?? []
    if (group === undefined) {
      const outer = chain[chain.length - 1]
      return outer === undefined ? id : blockId(outer)
    }
    const at = chain.indexOf(group)
    if (at < 0) return undefined
    const inner = chain[at - 1]
    return inner === undefined ? id : blockId(inner)
  }

  const layOut = (group: GroupId | undefined): Block => {
    const children = new Map(
      elements.groups
        .filter((g) => g.parent === group && occupied.has(g.id))
        .map((g) => [g.id, layOut(g.id)] as const),
    )

    // ---- the items: what is directly here, and the child blocks ----
    const items: Element[] = []
    for (const e of elements.elements) {
      if (chains.get(e.id)?.[0] !== group) continue
      const { place: _place, ...rest } = e
      items.push(rest)
    }
    // A block is a little wider than its frame, so that neighbours keep a group gap.
    const spread = Math.max(0, metrics.groupGap - metrics.gap)
    for (const [id, child] of children) {
      const width = child.size.width + spread
      items.push({
        id: blockId(id),
        kind: 'block',
        members: [],
        size: { width, height: child.size.height },
        parts: [],
      })
    }

    // ---- the lines of this level ----
    /** How far across the middle of an item a line ends: inside a block, where it ends there. */
    const offsetOf = (item: ElementId, key: number): number => {
      const child = children.get(item.slice('block:'.length))
      const end = item.startsWith('block:') ? child?.ends.get(key) : undefined
      return child === undefined || end === undefined ? 0 : end.x - child.size.width / 2
    }
    const offsetYOf = (item: ElementId, key: number): number => {
      const child = children.get(item.slice('block:'.length))
      const end = item.startsWith('block:') ? child?.ends.get(key) : undefined
      return child === undefined || end === undefined ? 0 : end.y - child.size.height / 2
    }
    const pieces: Piece[] = []
    /** The lines that leave this group, with the item inside that each ends at. */
    const leaving: { key: number; item: ElementId }[] = []
    for (const line of lines) {
      const [a, b] = line.ends
      const ia = itemAt(group, a.element)
      const ib = itemAt(group, b.element)
      if (ia !== undefined && ib !== undefined) {
        if (ia === ib) continue
        pieces.push({
          key: line.index,
          virtual: line.virtual,
          ends: [ia, ib],
          offsets: [offsetOf(ia, line.index), offsetOf(ib, line.index)],
          offsetsY: [offsetYOf(ia, line.index), offsetYOf(ib, line.index)],
          loose: !nearOf.has(line.index),
          ...(nearOf.has(line.index) ? { near: nearOf.get(line.index) } : {}),
        })
        continue
      }
      const item = ia === undefined ? ib : ia
      if (item === undefined || group === undefined) continue
      leaving.push({ key: line.index, item })
      // A line without a direction pulls from outside and is not routed through the frame.
      const near = nearOf.get(line.index)
      if (near === undefined) continue
      const side = near === (ia === undefined ? 0 : 1) ? 'top' : 'bottom'
      pieces.push({
        key: line.index,
        virtual: false,
        ends: [portId(side, line.index), item],
        offsets: [0, offsetOf(item, line.index)],
        offsetsY: [0, offsetYOf(item, line.index)],
        loose: false,
        near: side === 'top' ? 0 : 1,
        cross: { side, item },
      })
    }

    const inside = pieces.filter((p) => p.cross === undefined)

    // ---- the layers: longest path over this level's directed pieces ----
    // The items at the two ends of an even pair share a node.
    const node = new Map(items.map((e) => [e.id, e.id]))
    const nodeOf = (id: ElementId): ElementId => {
      let at = id
      for (let next = node.get(at); next !== undefined && next !== at; next = node.get(at))
        at = next
      return at
    }
    for (const [x, y] of evenPairs) {
      const [ix, iy] = [itemAt(group, x), itemAt(group, y)]
      if (ix === undefined || iy === undefined || !node.has(ix) || !node.has(iy)) continue
      const [nx, ny] = [nodeOf(ix), nodeOf(iy)]
      if (nx !== ny) node.set(nx < ny ? ny : nx, nx < ny ? nx : ny)
    }
    // The edges nearer to farther, in the order of the lines; one that would close a cycle with
    // those already taken is dropped.
    const before = new Map<ElementId, ElementId[]>()
    const after = new Map<ElementId, ElementId[]>()
    const leadsTo = (from: ElementId, to: ElementId): boolean => {
      const queue = [from]
      const seen = new Set(queue)
      for (const at of queue) {
        if (at === to) return true
        for (const next of after.get(at) ?? []) {
          if (seen.has(next)) continue
          seen.add(next)
          queue.push(next)
        }
      }
      return false
    }
    for (const p of inside) {
      if (p.near === undefined) continue
      const [near, far] = [nodeOf(p.ends[p.near]), nodeOf(p.ends[p.near === 0 ? 1 : 0])]
      if (near === far || leadsTo(far, near)) continue
      after.set(near, [...(after.get(near) ?? []), far])
      before.set(far, [...(before.get(far) ?? []), near])
    }
    const depth = new Map<ElementId, number>()
    const depthOf = (id: ElementId): number => {
      const known = depth.get(id)
      if (known !== undefined) return known
      const d = Math.max(-1, ...(before.get(id) ?? []).map(depthOf)) + 1
      depth.set(id, d)
      return d
    }
    // An item none of whose lines has a direction has no nearer or farther of its own: it
    // stands in the layer of the items its lines go to, the partner layer nearest to the mean
    // of its partners' layers (the nearer one on a tie), so it is beside them and not after
    // them. It is resolved from the items that have a direction, outward, a round at a time;
    // a part with none is in layer 0.
    const partners = new Map<ElementId, ElementId[]>()
    for (const p of inside) {
      partners.set(p.ends[0], [...(partners.get(p.ends[0]) ?? []), p.ends[1]])
      partners.set(p.ends[1], [...(partners.get(p.ends[1]) ?? []), p.ends[0]])
    }
    const directedAt = new Set(pieces.filter((p) => !p.loose).flatMap((p) => p.ends))
    const directedNodes = new Set([...directedAt].filter((id) => node.has(id)).map(nodeOf))
    const layer = new Map<ElementId, number>()
    for (const e of items) {
      layer.set(e.id, directedNodes.has(nodeOf(e.id)) ? depthOf(nodeOf(e.id)) : 0)
    }
    const pending = new Set(
      [...partners.keys()].filter((id) => node.has(id) && !directedNodes.has(nodeOf(id))),
    )
    for (;;) {
      const resolved = [...pending].sort(compare).flatMap((id) => {
        const known = (partners.get(id) ?? []).filter((q) => !pending.has(q))
        if (known.length === 0) return []
        const layers = known.map((q) => layer.get(q) ?? 0)
        const mean = layers.reduce((sum, v) => sum + v, 0) / layers.length
        const nearest = layers.reduce((best, v) => {
          const [d, bd] = [Math.abs(v - mean), Math.abs(best - mean)]
          return d < bd || (d === bd && v < best) ? v : best
        })
        return [[id, nearest] as const]
      })
      if (resolved.length === 0) break
      for (const [id, to] of resolved) {
        layer.set(id, to)
        pending.delete(id)
      }
    }

    const reach = [...layer.values()]
    const above = Math.min(0, ...reach) - 1
    const below = Math.max(0, ...reach) + 1
    for (const p of pieces) {
      if (!p.cross || layer.has(p.ends[0])) continue
      items.push({
        id: p.ends[0],
        kind: 'port',
        members: [],
        size: { width: 0, height: 0 },
        parts: [],
      })
      layer.set(p.ends[0], p.cross.side === 'top' ? above : below)
    }

    // ---- the layers below, on this level alone ----
    const level: Elements = {
      elements: items,
      lines: pieces.map((p, index) => ({
        index,
        ends: [
          { element: p.ends[0], offset: p.offsets[0], offsetY: p.offsetsY[0] },
          { element: p.ends[1], offset: p.offsets[1], offsetY: p.offsetsY[1] },
        ],
        virtual: p.virtual,
        ...(p.loose ? { loose: true as const } : {}),
      })),
      inner: [],
      groups: [],
    }
    const fans = layOutFans(level, layer, metrics)
    const portIds = new Set(items.filter((e) => e.kind === 'port').map((e) => e.id))
    const pad = group === undefined ? noInsets : metrics.group(group)
    const seen = (id: string, b: Box): Box =>
      id.startsWith('block:') ? { ...b, x: b.x + spread / 2, width: b.width - spread } : b

    /** Where everything of the level stands once it is placed, and the frame around it. */
    const standing = (ordered: Ordered, placed: Placed) => {
      const at = (id: string): Point => ({ x: placed.x.get(id) ?? 0, y: placed.y.get(id) ?? 0 })
      const slots = new Map<ElementId, Box>()
      const members = new Map<ElementId, Box>()
      for (const e of fans.elements.elements) {
        const c = at(e.id)
        const box = {
          x: c.x - e.size.width / 2,
          y: c.y - e.size.height / 2,
          width: e.size.width,
          height: e.size.height,
        }
        slots.set(e.id, box)
        for (const cell of fans.fans.find((f) => f.id === e.id)?.cells ?? []) {
          const size = byId.get(cell.element)?.size ?? { width: 0, height: 0 }
          members.set(cell.element, { x: box.x + cell.x, y: box.y + cell.y, ...size })
        }
      }
      // The frame: the contents, and the group's insets.
      const solid = [...slots].filter(([id]) => !portIds.has(id))
      const xs = [
        ...solid.flatMap(([id, b]) => [seen(id, b).x, seen(id, b).x + seen(id, b).width]),
        ...ordered.layers.flat().flatMap((s) => (s.kind === 'dummy' ? [at(s.id).x] : [])),
        ...[...portIds].map((id) => at(id).x),
      ]
      const ys = solid.flatMap(([, b]) => [b.y, b.y + b.height])
      const ox = Math.min(...xs) - pad.left
      const oy = Math.min(...ys) - pad.top
      const size = {
        width: Math.max(...xs) + pad.right - ox,
        height: Math.max(...ys) + pad.bottom - oy,
      }
      return { at, slots, members, solid, ox, oy, size }
    }
    const first = orderElements(fans.elements, fans.layer, {
      start: start.filter((id) => layer.has(id)),
    })
    // A layer too wide for the target shape is given rows, judged by the size the level comes
    // out as when it is placed, and ordered again from the order it had.
    const wrapped = wrapLayers(fans.elements, first, metrics, (candidate) => {
      const trial =
        candidate === undefined
          ? first
          : orderElements(fans.elements, candidate.rank, { seed: candidate.seed })
      return standing(trial, placeCoords(fans.elements, trial, metrics)).size
    })
    const ordered =
      wrapped === undefined
        ? first
        : orderElements(fans.elements, wrapped.rank, { seed: wrapped.seed })
    const { at, slots, members, solid, ox, oy, size } = standing(
      ordered,
      placeCoords(fans.elements, ordered, metrics),
    )

    // ---- compose: the elements, the frames, the routes ----
    const boxes = new Map<ElementId, Box>()
    for (const [id, b] of solid) {
      if (byId.has(id)) boxes.set(id, moved(b, -ox, -oy))
    }
    for (const [id, b] of members) boxes.set(id, moved(b, -ox, -oy))
    const frames = new Map<GroupId, Box>()
    if (group !== undefined) frames.set(group, { x: 0, y: 0, ...size })
    const routes = new Map<number, readonly Point[]>()
    const legs = new Map<number, readonly Point[]>()
    const offsets = new Map<ElementId, Point>()
    for (const [id, child] of children) {
      const slot = slots.get(blockId(id))
      if (!slot) continue
      const dx = slot.x + spread / 2 - ox
      const dy = slot.y - oy
      offsets.set(blockId(id), { x: dx, y: dy })
      for (const [e, b] of child.boxes) boxes.set(e, moved(b, dx, dy))
      for (const [g, b] of child.frames) frames.set(g, moved(b, dx, dy))
      for (const [l, r] of child.routes) routes.set(l, shifted(r, dx, dy))
    }
    /** The way out of a child block for a line, in this level's frame. */
    const legOf = (item: ElementId, key: number): Point[] => {
      const offset = offsets.get(item)
      const leg = children.get(item.slice('block:'.length))?.legs.get(key)
      return offset === undefined || leg === undefined ? [] : shifted(leg, offset.x, offset.y)
    }
    const ends = new Map<number, Point>()
    for (const { key, item } of leaving) {
      const port = pieces.find((p) => p.key === key && p.cross !== undefined)
      const box = members.get(item) ?? slots.get(item)
      const middle = {
        x: (box?.x ?? 0) + (box?.width ?? 0) / 2 + offsetOf(item, key),
        y: (box?.y ?? 0) + (box?.height ?? 0) / 2 + offsetYOf(item, key),
      }
      ends.set(key, {
        x: (port ? at(port.ends[0]).x : middle.x) - ox,
        y: port ? (port.cross?.side === 'top' ? 0 : size.height) : middle.y - oy,
      })
    }
    for (const [index, p] of pieces.entries()) {
      const folded = fans.lineOf[index]
      const path = folded === undefined ? [] : (ordered.paths[folded] ?? [])
      const through = path.slice(1, -1).map((id) => {
        const c = at(id)
        return { x: c.x - ox, y: c.y - oy }
      })
      if (p.cross) {
        const x = at(p.ends[0]).x - ox
        const edge = { x, y: p.cross.side === 'top' ? 0 : size.height }
        legs.set(p.key, [...legOf(p.cross.item, p.key), ...through.reverse(), edge])
      } else if (
        p.ends.every((item) => !item.startsWith('block:') || legOf(item, p.key).length > 0)
      ) {
        routes.set(p.key, [
          ...legOf(p.ends[0], p.key),
          ...through,
          ...legOf(p.ends[1], p.key).reverse(),
        ])
      }
    }
    return { size, boxes, frames, legs, routes, ends }
  }

  const root = layOut(undefined)
  return { boxes: root.boxes, frames: root.frames, routes: root.routes }
}

// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import type { GroupId, Structure } from '../structure/types.js'
import { placeCoords } from './coords.js'
import { type Element, type ElementId, type Elements, elementIdOf, type Line } from './elements.js'
import { layOutFans } from './fans.js'
import type { Box, Metrics, Point, Size } from './metrics.js'
import { orderElements } from './order.js'
import { placingLines } from './placing.js'
import { wrapLayers } from './wrap.js'

/**
 * Layer 5, over the layers below it. Each group is laid out as one block, from the inside out.
 *
 * A rank says which of two ends of a line is nearer the boundary. It does not say that two
 * elements as near as each other stand at one height, and holding them there across the whole
 * drawing is what draws a group whose inside is a tree as a pyramid, and makes sites that
 * should read as units run through one another. So the ranks are kept for what they say and no
 * more: inside a group, its own elements and its child groups (each already a block of known
 * size) are ordered and given coordinates by the layers below, as the whole drawing used to
 * be, and the group's frame is the rectangle around the result and the group's insets. A group
 * is therefore always one rectangle, whatever its inside is, and what lies in one group does
 * not stand at the height of what lies in another.
 *
 * Only the structure gives a line a direction (see `placingLines`): a line to an element the
 * structure does not reach, or between a pair it counts only as `even`, pulls its ends together
 * across a level but never pushes a layer, whatever the ranks the drawing guessed for its ends.
 * An element the structure does not reach keeps its rank only as the layer it starts in inside
 * its own level.
 *
 * A level whose layers make it too wide for `metrics.aspect` is given rows (see `wrap.ts`)
 * before its coordinates are found.
 *
 * A block takes the layer of the nearest rank it holds, and is pushed past what it must come
 * after or before along the directed lines. Down the page the layers below then compact the
 * level (see `coords.ts`): a slot starts as high as what it is joined to, and what stands where
 * it does across, allow, so layers are not bands of one height. Along every directed line the
 * farther end then stands no higher than the nearer one, within a group and across groups
 * (unless the lines around a block form a cycle, which a single block cannot keep apart).
 *
 * A line between an element inside a block and one outside it crosses the block's frame, at
 * the top edge when the outside end is nearer and at the bottom edge when it is farther.
 * Inside the block the line runs from a port at that edge (a point without size, one layer
 * beyond the block's contents) to the element, so the layers below route it and the element
 * stands under where the line enters. Outside, the line is one from the block. A line without a
 * direction (or between ends of one rank) that crosses a frame is not routed and is drawn
 * straight.
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
}

type Side = 'top' | 'bottom'

/** A line of one level: its key (the line it is), its two ends there, and the port it enters at. */
interface Piece {
  readonly key: number
  readonly virtual: boolean
  readonly ends: readonly [ElementId, ElementId]
  readonly cross?: { readonly side: Side; readonly item: ElementId }
}

const blockId = (g: GroupId): ElementId => `block:${g}`
const portId = (side: Side, item: ElementId): ElementId => `port:${side}:${item}`
const noInsets = { top: 0, right: 0, bottom: 0, left: 0 }

const shifted = (points: readonly Point[], dx: number, dy: number): Point[] =>
  points.map((p) => ({ x: p.x + dx, y: p.y + dy }))
const moved = (b: Box, dx: number, dy: number): Box => ({ ...b, x: b.x + dx, y: b.y + dy })

export function composeLayout(
  elements: Elements,
  structure: Structure,
  rank: ReadonlyMap<ElementId, number>,
  metrics: Metrics,
): Composition {
  const placing = placingLines(elements, structure)
  const known = new Set(elements.groups.map((g) => g.id))
  const parents = new Map(elements.groups.map((g) => [g.id, g.parent]))
  const rankOf = (id: ElementId) => rank.get(id) ?? 0
  const byId = new Map(elements.elements.map((e) => [e.id, e]))
  const start = structure.boundary.map(elementIdOf)

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

  // The lines that place, except those without a direction that cross a frame: nothing says
  // which edge of the block such a line would enter by.
  const lines: Line[] = []
  const directed = new Set<number>()
  for (const line of elements.lines) {
    if (placing.lineOf[line.index] === undefined) continue
    const [a, b] = line.ends
    const across = chains.get(a.element)?.[0] !== chains.get(b.element)?.[0]
    const carries = placing.directed[line.index] === true && rankOf(a.element) !== rankOf(b.element)
    if (across && !carries) continue
    lines.push(line)
    if (carries) directed.add(line.index)
  }

  /** The nearest rank held in a group, which is where its block is entered. */
  const entry = new Map<GroupId, number>()
  for (const e of elements.elements) {
    for (const g of chains.get(e.id) ?? []) {
      entry.set(g, Math.min(entry.get(g) ?? rankOf(e.id), rankOf(e.id)))
    }
  }

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
        .filter((g) => g.parent === group && entry.has(g.id))
        .map((g) => [g.id, layOut(g.id)] as const),
    )

    // ---- the items: what is directly here, and the child blocks ----
    const items: Element[] = []
    const layer = new Map<ElementId, number>()
    for (const e of elements.elements) {
      if (chains.get(e.id)?.[0] !== group) continue
      const { place: _place, ...rest } = e
      items.push(rest)
      layer.set(e.id, rankOf(e.id))
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
      layer.set(blockId(id), entry.get(id) ?? 0)
    }

    // ---- the lines of this level ----
    const pieces: Piece[] = []
    for (const line of lines) {
      const [a, b] = line.ends
      const ia = itemAt(group, a.element)
      const ib = itemAt(group, b.element)
      if (ia !== undefined && ib !== undefined) {
        if (ia !== ib) pieces.push({ key: line.index, virtual: line.virtual, ends: [ia, ib] })
        continue
      }
      const [inner, outer, item] = ia === undefined ? [b, a, ib] : [a, b, ia]
      if (item === undefined || group === undefined) continue
      const side = rankOf(outer.element) < rankOf(inner.element) ? 'top' : 'bottom'
      pieces.push({
        key: line.index,
        virtual: false,
        ends: [portId(side, item), item],
        cross: { side, item },
      })
    }

    // A block comes after what is nearer to an element in it, and before what is farther.
    const direction = (p: Piece) => {
      const line = directed.has(p.key) ? lines.find((l) => l.index === p.key) : undefined
      const [ra, rb] = (line?.ends ?? []).map((e) => rankOf(e.element))
      return ra === undefined || rb === undefined || ra === rb ? 0 : ra < rb ? 1 : -1
    }
    const inside = pieces.filter((p) => p.cross === undefined)
    for (let pass = 0; pass <= items.length; pass++) {
      let changed = false
      for (const p of inside) {
        const d = direction(p)
        const [near, far] = d > 0 ? p.ends : [p.ends[1], p.ends[0]]
        if (d === 0) continue
        const need = (layer.get(near) ?? 0) + 1
        if ((layer.get(far) ?? 0) < need) {
          layer.set(far, need)
          changed = true
        }
      }
      if (!changed) break
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
        ends: [{ element: p.ends[0] }, { element: p.ends[1] }],
        virtual: p.virtual,
      })),
      inner: [],
      groups: [],
    }
    const fans = layOutFans(level, layer, metrics)
    const first = orderElements(fans.elements, fans.rank, {
      start: start.filter((id) => layer.has(id)),
    })
    // A layer too wide for the target shape is given rows, and ordered again from the order it
    // had.
    const wrapped = wrapLayers(fans.elements, first, metrics)
    const ordered =
      wrapped === undefined
        ? first
        : orderElements(fans.elements, wrapped.rank, { seed: wrapped.seed })
    const placed = placeCoords(fans.elements, ordered, metrics)
    const at = (id: string): Point => ({ x: placed.x.get(id) ?? 0, y: placed.y.get(id) ?? 0 })

    // ---- where everything stands at this level ----
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

    // ---- the frame: the contents, and the group's insets ----
    const portIds = new Set(items.filter((e) => e.kind === 'port').map((e) => e.id))
    const solid = [...slots].filter(([id]) => !portIds.has(id))
    const seen = (id: string, b: Box): Box =>
      id.startsWith('block:') ? { ...b, x: b.x + spread / 2, width: b.width - spread } : b
    const xs = [
      ...solid.flatMap(([id, b]) => [seen(id, b).x, seen(id, b).x + seen(id, b).width]),
      ...ordered.layers.flat().flatMap((s) => (s.kind === 'dummy' ? [at(s.id).x] : [])),
      ...[...portIds].map((id) => at(id).x),
    ]
    const ys = solid.flatMap(([, b]) => [b.y, b.y + b.height])
    const pad = group === undefined ? noInsets : metrics.group(group)
    const ox = Math.min(...xs) - pad.left
    const oy = Math.min(...ys) - pad.top
    const size = {
      width: Math.max(...xs) + pad.right - ox,
      height: Math.max(...ys) + pad.bottom - oy,
    }

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
      } else {
        routes.set(p.key, [
          ...legOf(p.ends[0], p.key),
          ...through,
          ...legOf(p.ends[1], p.key).reverse(),
        ])
      }
    }
    return { size, boxes, frames, legs, routes }
  }

  const root = layOut(undefined)
  return { boxes: root.boxes, frames: root.frames, routes: root.routes }
}

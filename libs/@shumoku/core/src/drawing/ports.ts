// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { compare } from '../structure/keys.js'
import type { Anchor, Dir, GlobalRoutes } from './global.js'
import type { Box, Point } from './metrics.js'
import { boxKey, type End, type Geometry, itemOfBox, lineEnd, type Problem } from './problem.js'
import type { Room } from './rooms.js'
import type { Side } from './scene.js'
import { round } from './tolerance.js'

export const centre = (b: Box): Point => ({ x: b.x + b.width / 2, y: b.y + b.height / 2 })

/** Which way each side faces. */
export const outward: Record<Side, Point> = {
  top: { x: 0, y: -1 },
  bottom: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
}

/** Drops repeated points and points in the middle of a straight run. */
export function simplify(points: readonly Point[]): Point[] {
  const out: Point[] = []
  for (const p of points) {
    const last = out[out.length - 1]
    if (last && last.x === p.x && last.y === p.y) continue
    out.push(p)
  }
  return out.filter((p, i) => {
    const a = out[i - 1]
    const b = out[i + 1]
    if (!a || !b) return true
    return (p.x - a.x) * (b.y - p.y) - (p.y - a.y) * (b.x - p.x) !== 0
  })
}

/** A port's id: the name the port has, else one a line makes for its end alone. */
export const portId = (
  node: string,
  port: string | undefined,
  line: string,
  end: 'a' | 'b',
): string => (port ? `${node}/${port}` : `${node}#${lineEnd(line, end)}`)

/** The item that holds a box and the item's box, if it has one. */
export function ownerOf(
  problem: Pick<Problem, 'items'>,
  geometry: Geometry,
  key: string,
): { item: string; box: Box } | undefined {
  const item = itemOfBox(problem, key)
  const box = item === undefined ? undefined : geometry.boxes.get(item)
  return item !== undefined && box ? { item, box } : undefined
}

/** The box an end is on: its card, bus or cloud, or the member of a unit. */
export const boxOf = (geometry: Geometry, end: End): Box | undefined =>
  geometry.boxes.get(boxKey(end)) ?? geometry.boxes.get(end.item)

/**
 * A point where lines meet a box: the lines that name one port of a box meet at one point, and
 * an end that names none has a point of its own. The side and the cell it stands in are the ways
 * the routes took, which the routes see to agree on for the ends of one port.
 */
export interface PortEntity {
  /** What the scene calls it. */
  id: string
  nodeId: string
  /** The name written beside it, when it has one. */
  label?: string
  /** The key of the box in the geometry. */
  box: string
  rect: Box
  side: Side
  /** The cell the line leaves it through, and the way out. */
  cell: number
  out: Dir
  ends: { line: string; end: 'a' | 'b'; anchor: Anchor }[]
  /** Where the route estimated it, along the edge it stands on. */
  est: number
}

/**
 * Where a port stands across its side. A member of a unit is drawn inside the unit's hull, which
 * lies `hullPad` outside its box all round except where it meets its neighbour; the port stands
 * on the outer edge of that, so that its mark, label and lead-out begin outside the hull. The
 * rest of the box is the box.
 */
function standing(problem: Problem, geometry: Geometry, ref: End, rect: Box, side: Side): Box {
  const unit = problem.items.find((i) => i.members?.some((m) => m.node.id === ref.node))
  const frame = unit ? geometry.boxes.get(unit.id) : undefined
  if (!frame) return rect
  const { hullPad: pad } = problem.metrics
  const grown: Box =
    side === 'top'
      ? { ...rect, y: rect.y - pad, height: rect.height + pad }
      : side === 'bottom'
        ? { ...rect, height: rect.height + pad }
        : side === 'left'
          ? { ...rect, x: rect.x - pad, width: rect.width + pad }
          : { ...rect, width: rect.width + pad }
  // A side that faces a neighbour of the unit is the seam, which has no outer edge: the hull
  // reaches the frame of the unit only where nothing is beside the member.
  if (side === 'left' && round(grown.x) !== round(frame.x)) return rect
  if (side === 'right' && round(grown.x + grown.width) !== round(frame.x + frame.width)) return rect
  return grown
}

/** The ports the routes settled on, one for each point a line meets a box at, in id order. */
export function portEntities(
  problem: Problem,
  geometry: Geometry,
  routes: GlobalRoutes,
): PortEntity[] {
  const found = new Map<string, PortEntity>()
  for (const line of problem.lines) {
    const route = routes.routes.get(line.id)
    if (!route) continue
    for (const [end, ref, anchor] of [
      ['a', line.a, route.from],
      ['b', line.b, route.to],
    ] as const) {
      const box = geometry.boxes.get(boxKey(ref)) ?? geometry.boxes.get(ref.item)
      if (!box) continue
      const rect = standing(problem, geometry, ref, box, anchor.side)
      const nodeId = ref.node ?? ref.item
      const key = portId(nodeId, ref.port, line.id, end)
      const known = found.get(key)
      if (known) {
        known.ends.push({ line: line.id, end, anchor })
        continue
      }
      found.set(key, {
        id: key,
        nodeId,
        ...(ref.port && { label: ref.port }),
        box: boxKey(ref),
        rect,
        side: anchor.side,
        cell: anchor.cell,
        out: anchor.out,
        ends: [{ line: line.id, end, anchor }],
        est: anchor.side === 'top' || anchor.side === 'bottom' ? anchor.port.x : anchor.port.y,
      })
    }
  }
  return [...found.values()].sort((p, q) => compare(p.id, q.id))
}

/** The stretch of its side a port may stand on, a half slot in from the corners, or the middle if the side is too short. */
export function portRoom(
  rect: Box,
  side: Side,
  slot: number,
  /** The item the box belongs to, and its box, if the ends are to say whose edges they are. */
  own?: { item: string; box: Box },
): Room {
  const along = side === 'top' || side === 'bottom'
  const [e0, e1] = along ? [rect.x, rect.x + rect.width] : [rect.y, rect.y + rect.height]
  const lo = e0 + slot / 2
  const hi = e1 - slot / 2
  if (lo > hi) return { lo: (e0 + e1) / 2, hi: (e0 + e1) / 2 }
  if (!own) return { lo, hi }
  const [i0, i1] = along
    ? [own.box.x, own.box.x + own.box.width]
    : [own.box.y, own.box.y + own.box.height]
  return {
    lo,
    hi,
    loBy: [{ item: own.item, edge: i0, at: 'low', own: true }],
    hiBy: [{ item: own.item, edge: i1, at: 'high', own: true }],
  }
}

/**
 * How long each box's edges must be to hold the ports on them a slot apart, and from the corners,
 * for the sides given: the layout makes the box larger and asks again.
 */
function portExtents(
  problem: Problem,
  ports: readonly PortEntity[],
  along: readonly Side[],
): Map<string, number> {
  const counts = new Map<string, Map<Side, number>>()
  for (const p of ports) {
    if (along.includes(p.side)) {
      const sides = counts.get(p.box) ?? new Map<Side, number>()
      sides.set(p.side, (sides.get(p.side) ?? 0) + 1)
      counts.set(p.box, sides)
    }
  }
  const extents = new Map<string, number>()
  for (const [box, sides] of counts) {
    const slot = problem.slots.get(box) ?? 0
    extents.set(box, (Math.max(...sides.values()) + 1) * slot)
  }
  return extents
}

/** How wide each box must be to hold the ports on its top and bottom edges. */
export function portWidths(problem: Problem, ports: readonly PortEntity[]): Map<string, number> {
  return portExtents(problem, ports, ['top', 'bottom'])
}

/**
 * How high each box must be to hold the ports on its left and right edges, which are those of
 * the lines between equals, the only lines that leave a box by its sides.
 */
export function portHeights(problem: Problem, ports: readonly PortEntity[]): Map<string, number> {
  return portExtents(problem, ports, ['left', 'right'])
}

/** The problem with every box at least as wide and as high as `widths` and `heights` ask, and units refitted. */
export function widen(
  problem: Problem,
  widths: ReadonlyMap<string, number>,
  heights: ReadonlyMap<string, number> = new Map(),
): Problem {
  const { metrics } = problem
  const grow = (id: string, size: { width: number; height: number }) => {
    const w = widths.get(id) ?? 0
    const h = heights.get(id) ?? 0
    return w > size.width || h > size.height
      ? { width: Math.max(w, size.width), height: Math.max(h, size.height) }
      : size
  }
  const items = problem.items.map((item) => {
    if (item.kind !== 'unit') return { ...item, size: grow(item.id, item.size) }
    const members = (item.members ?? []).map((m) => ({ ...m, size: grow(m.node.id, m.size) }))
    const width =
      members.reduce((sum, m) => sum + m.size.width, 0) +
      Math.max(0, members.length - 1) * metrics.memberGap +
      2 * metrics.hullPad
    const height = Math.max(0, ...members.map((m) => m.size.height)) + 2 * metrics.hullPad
    return { ...item, members, size: { width, height } }
  })
  return { ...problem, items }
}

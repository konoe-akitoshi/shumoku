// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { compare } from '../structure/keys.js'
import type { Anchor, Dir, GlobalRoutes } from './global.js'
import type { Box, Point } from './metrics.js'
import type { End, Geometry, Problem } from './problem.js'
import type { Room } from './rooms.js'
import type { Side } from './scene.js'

/** Coordinates are matched after rounding, so that equal edges of different boxes are one line. */
export const round = (v: number) => Math.round(v * 1e4) / 1e4

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

export const boxKey = (end: End) => end.node ?? end.item

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
      const rect = geometry.boxes.get(boxKey(ref)) ?? geometry.boxes.get(ref.item)
      if (!rect) continue
      const nodeId = ref.node ?? ref.item
      const key = ref.port ? `${nodeId}/${ref.port}` : `${nodeId}#${line.id}.${end}`
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
 * The room one port takes along the edge of each box, from the names written beside its ports. It
 * is known before any line is routed, since the lines that end at a box and the names they give
 * are the problem's.
 */
export function portSlots(problem: Problem): Map<string, number> {
  const labels = new Map<string, Set<string | undefined>>()
  for (const line of problem.lines) {
    if (line.role === 'inside') continue
    for (const end of [line.a, line.b]) {
      const set = labels.get(boxKey(end)) ?? new Set<string | undefined>()
      set.add(end.port)
      labels.set(boxKey(end), set)
    }
  }
  return new Map([...labels].map(([box, set]) => [box, problem.metrics.portSlot([...set])]))
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
  const labels = new Map<string, (string | undefined)[]>()
  const counts = new Map<string, Map<Side, number>>()
  for (const p of ports) {
    labels.set(p.box, [...(labels.get(p.box) ?? []), p.label])
    if (along.includes(p.side)) {
      const sides = counts.get(p.box) ?? new Map<Side, number>()
      sides.set(p.side, (sides.get(p.side) ?? 0) + 1)
      counts.set(p.box, sides)
    }
  }
  const extents = new Map<string, number>()
  for (const [box, sides] of counts) {
    const slot = problem.metrics.portSlot(labels.get(box) ?? [])
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

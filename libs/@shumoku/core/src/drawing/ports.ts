// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import type { Box, Point } from './metrics.js'
import { boxKey, type End, type Geometry, lineEnd, type Problem } from './problem.js'
import type { Side } from './scene.js'

export const centre = (b: Box): Point => ({ x: b.x + b.width / 2, y: b.y + b.height / 2 })

/** Which way each side faces. */
export const outward: Record<Side, Point> = {
  top: { x: 0, y: -1 },
  bottom: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
}

/** Drops repeated points and points exactly in the middle of a straight run, the wires as the ports leave them. */
export function dropCollinear(points: readonly Point[]): Point[] {
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

/** The box an end is on: its card, bus or cloud, or the member of a unit. */
export const boxOf = (geometry: Geometry, end: End): Box | undefined =>
  geometry.boxes.get(boxKey(end)) ?? geometry.boxes.get(end.item)

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
    const members = item.members.map((m) => ({ ...m, size: grow(m.node.id, m.size) }))
    const width =
      members.reduce((sum, m) => sum + m.size.width, 0) +
      Math.max(0, members.length - 1) * metrics.memberGap +
      2 * metrics.hullPad
    const height = Math.max(0, ...members.map((m) => m.size.height)) + 2 * metrics.hullPad
    return { ...item, members, size: { width, height } }
  })
  return { ...problem, items }
}

// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import type { Box, Point, PortSideLayout } from './metrics.js'
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

/** The least distance between the first and the last port's centre and the ends of their edge. */
export function marginsOf(layout: PortSideLayout | undefined, slot: number) {
  return {
    lead: Math.max(layout?.leadMargin ?? 0, slot / 2),
    trail: Math.max(layout?.trailMargin ?? 0, slot / 2),
  }
}

/**
 * The least centre-to-centre distance for each pair of ports on an edge that has `n`, as
 * `(from, to, d)`: every neighbouring pair keeps at least the room of its line (`slot`), and a
 * pair the layout names keeps what it asks.
 */
export function gapsOf(
  layout: PortSideLayout | undefined,
  slot: number,
  n: number,
): { from: number; to: number; d: number }[] {
  const out: { from: number; to: number; d: number }[] = []
  for (let from = 0; from + 1 < n; from++) {
    const min = layout?.gaps.find((g) => g.from === from && g.to === from + 1)?.min ?? 0
    out.push({ from, to: from + 1, d: Math.max(slot, min) })
  }
  for (const g of layout?.gaps ?? []) {
    if (g.to - g.from === 2 && g.to < n) out.push({ from: g.from, to: g.to, d: g.min })
  }
  return out
}

/**
 * How long an edge must be to hold its `n` ports: each neighbouring gap between them, and at
 * each end twice the least margin. The ports are held only the margin from the ends; the other
 * margin is play, which lets a port stand level with the port it is joined to on a neighbour.
 */
export function extentOf(layout: PortSideLayout | undefined, slot: number, n: number): number {
  const { lead, trail } = marginsOf(layout, slot)
  return (
    2 * lead +
    2 * trail +
    gapsOf(layout, slot, n)
      .filter((g) => g.to - g.from === 1)
      .reduce((sum, g) => sum + g.d, 0)
  )
}

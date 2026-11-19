// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { haloOf } from './ground.js'
import type { PortKey } from './keys.js'
import type { Box, Point, PortSideLayout } from './metrics.js'
import { boxKey, type End, type Geometry, lineEnd, linesById, type Problem } from './problem.js'
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

/**
 * The room the ports along one edge take for their lines, in order along the edge: the white kept
 * between two lines (`apart`) and the ground of each port's line (`halos`, the widest line ending
 * there; see `haloOf`). Two neighbouring ports stand as far apart as their own two lines ask, the
 * same as two lines running side by side (`pitchOf`), so a wide line widens the room of its own
 * port and no other: a 100G uplink on one edge of a switch spaces neither the 1G ports beside it
 * nor those on its other edges.
 */
export interface PortRoom {
  readonly apart: number
  readonly halos: readonly number[]
}

/** The room of the ports `list` names, by the widest line that ends at each. */
export function portRoom(
  problem: Pick<Problem, 'lines' | 'metrics'>,
  ends: (port: PortKey) => readonly { line: string }[],
  list: readonly PortKey[],
): PortRoom {
  const byLine = linesById(problem)
  const halos = list.map((id) =>
    Math.max(
      0,
      ...ends(id).map((e) => {
        const line = byLine.get(e.line)
        return line ? haloOf(line) : 0
      }),
    ),
  )
  return { apart: problem.metrics.gapApart, halos }
}

/** The least distance between the first and the last port's centre and the ends of their edge. */
export function marginsOf(layout: PortSideLayout | undefined, room: PortRoom) {
  const end = (halo: number | undefined) => room.apart / 2 + (halo ?? 0)
  return {
    lead: Math.max(layout?.leadMargin ?? 0, end(room.halos[0])),
    trail: Math.max(layout?.trailMargin ?? 0, end(room.halos[room.halos.length - 1])),
  }
}

/**
 * The least centre-to-centre distance for each pair of ports on an edge, as `(from, to, d)`:
 * every neighbouring pair keeps at least the room of its two lines, and a pair the layout names
 * keeps what it asks.
 */
export function gapsOf(
  layout: PortSideLayout | undefined,
  room: PortRoom,
): { from: number; to: number; d: number }[] {
  const n = room.halos.length
  const out: { from: number; to: number; d: number }[] = []
  for (const [from, halo] of room.halos.slice(0, -1).entries()) {
    const min = layout?.gaps.find((g) => g.from === from && g.to === from + 1)?.min ?? 0
    const lines = room.apart + halo + (room.halos[from + 1] ?? 0)
    out.push({ from, to: from + 1, d: Math.max(lines, min) })
  }
  for (const g of layout?.gaps ?? []) {
    if (g.to - g.from === 2 && g.to < n) out.push({ from: g.from, to: g.to, d: g.min })
  }
  return out
}

/**
 * How long an edge must be to hold its ports: each neighbouring gap between them, and at each end
 * twice the least margin. The ports are held only the margin from the ends; the other margin is
 * play, which lets a port stand level with the port it is joined to on a neighbour.
 */
export function extentOf(layout: PortSideLayout | undefined, room: PortRoom): number {
  const { lead, trail } = marginsOf(layout, room)
  return (
    2 * lead +
    2 * trail +
    gapsOf(layout, room)
      .filter((g) => g.to - g.from === 1)
      .reduce((sum, g) => sum + g.d, 0)
  )
}

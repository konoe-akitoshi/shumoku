// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { compare } from '../structure/keys.js'
import type { Box, Point } from './metrics.js'
import type { End, Geometry, Line, Problem, Wiring } from './problem.js'
import type { Side } from './scene.js'

const centre = (b: Box): Point => ({ x: b.x + b.width / 2, y: b.y + b.height / 2 })

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

/** The side of its own box a line leaves by, given where the other end is. */
export function sideToward(own: Box, other: Box): Side {
  if (other.y >= own.y + own.height) return 'bottom'
  if (other.y + other.height <= own.y) return 'top'
  return centre(other).x >= centre(own).x ? 'right' : 'left'
}

export const outward: Record<Side, Point> = {
  top: { x: 0, y: -1 },
  bottom: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
}

interface Slot {
  line: Line
  end: 'a' | 'b'
  box: Box
  side: Side
  along: number
}

/** A stand-in for the wiring: every line a plain Z from port to port, ports spread evenly. */
export function simpleWires(problem: Problem, geometry: Geometry): Wiring {
  const { metrics } = problem
  const boxOf = (end: End): Box | undefined =>
    geometry.boxes.get(end.node ?? end.item) ?? geometry.boxes.get(end.item)

  const slots: Slot[] = []
  const inside: Line[] = []
  for (const line of problem.lines) {
    const a = boxOf(line.a)
    const b = boxOf(line.b)
    if (!a || !b) continue
    if (line.role === 'inside') {
      inside.push(line)
      continue
    }
    for (const [end, own, other] of [
      ['a', a, b],
      ['b', b, a],
    ] as const) {
      const side = sideToward(own, other)
      const c = centre(other)
      slots.push({
        line,
        end,
        box: own,
        side,
        along: side === 'top' || side === 'bottom' ? c.x : c.y,
      })
    }
  }

  // Ports on one side of one box are spread evenly, in the order their lines lead.
  const groups = new Map<string, Slot[]>()
  for (const s of slots) {
    const key = `${s.box.x}\0${s.box.y}\0${s.side}`
    groups.set(key, [...(groups.get(key) ?? []), s])
  }
  const at = new Map<Slot, Point>()
  for (const group of groups.values()) {
    group.sort((p, q) => p.along - q.along || compare(p.line.id, q.line.id))
    for (const [k, s] of group.entries()) {
      const f = (k + 1) / (group.length + 1)
      const { box } = s
      at.set(
        s,
        s.side === 'top'
          ? { x: box.x + box.width * f, y: box.y }
          : s.side === 'bottom'
            ? { x: box.x + box.width * f, y: box.y + box.height }
            : { x: s.side === 'left' ? box.x : box.x + box.width, y: box.y + box.height * f },
      )
    }
  }

  const wires = new Map<string, Point[]>()
  const ports: Wiring['ports'] = []
  const named = new Set<string>()
  const addPort = (end: End, point: Point, side: Side) => {
    if (end.node === undefined || !end.port) return
    const id = `${end.node}/${end.port}`
    if (named.has(id)) return
    named.add(id)
    ports.push({ id, nodeId: end.node, label: end.port, at: point, side })
  }

  const slotOf = new Map(slots.map((s) => [`${s.line.id}\0${s.end}`, s]))
  for (const line of problem.lines) {
    const sa = slotOf.get(`${line.id}\0a`)
    const sb = slotOf.get(`${line.id}\0b`)
    const pa = sa && at.get(sa)
    const pb = sb && at.get(sb)
    if (!sa || !sb || !pa || !pb) continue
    const lead = (p: Point, s: Side): Point => ({
      x: p.x + outward[s].x * metrics.leadOut,
      y: p.y + outward[s].y * metrics.leadOut,
    })
    const la = lead(pa, sa.side)
    const lb = lead(pb, sb.side)
    const vertical = sa.side === 'top' || sa.side === 'bottom'
    const mid = vertical ? (la.y + lb.y) / 2 : (la.x + lb.x) / 2
    wires.set(
      line.id,
      simplify([
        pa,
        la,
        vertical ? { x: la.x, y: mid } : { x: mid, y: la.y },
        vertical ? { x: lb.x, y: mid } : { x: mid, y: lb.y },
        lb,
        pb,
      ]),
    )
    addPort(line.a, pa, sa.side)
    addPort(line.b, pb, sb.side)
  }

  // A line between two neighbours of one unit runs straight across, level with their centres.
  const pairs = new Map<string, Line[]>()
  for (const line of inside) {
    const key = [line.a.node ?? line.a.item, line.b.node ?? line.b.item].sort(compare).join('\0')
    pairs.set(key, [...(pairs.get(key) ?? []), line])
  }
  for (const group of pairs.values()) {
    for (const [k, line] of group.entries()) {
      const a = boxOf(line.a)
      const b = boxOf(line.b)
      if (!a || !b) continue
      const [from, to] = centre(a).x <= centre(b).x ? [a, b] : [b, a]
      const level = (centre(a).y + centre(b).y) / 2 + (k - (group.length - 1) / 2) * metrics.pitch
      const p = { x: from.x + from.width, y: level }
      const q = { x: to.x, y: level }
      const [first, last] = from === a ? [p, q] : [q, p]
      wires.set(line.id, [first, last])
      addPort(line.a, first, from === a ? 'right' : 'left')
      addPort(line.b, last, from === a ? 'left' : 'right')
    }
  }
  return { wires, ports, demands: [], violations: [] }
}

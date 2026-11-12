// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import type { Node } from '../models/types.js'
import { compare } from '../structure/keys.js'
import type { NodeId } from '../structure/types.js'
import { frameKey, splitSide } from './keys.js'
import type { Box, Point } from './metrics.js'
import { assertNever } from './must.js'
import { type Geometry, type Guest, type Problem, ROOT } from './problem.js'
import type { Scene, Side } from './scene.js'
import { shapeWires } from './shape.js'
import type { Turn } from './turns.js'

export interface Wiring {
  wires: Map<string, Point[]>
  ports: NonNullable<Scene['ports']>
  /** How each line turns, with the 45° straights the room left lets it take (`diagonalsOf`). */
  turns?: Map<string, Turn[]>
}

/** Where the edges that share the start of their names write it: the corner each edge starts at. */
function captionsOf(problem: Problem, geometry: Geometry): NonNullable<Scene['captions']> {
  const out: NonNullable<Scene['captions']> = []
  for (const [key, layout] of problem.portSides ?? []) {
    if (!layout.caption) continue
    const { box: id, side } = splitSide(key)
    const box = geometry.boxes.get(id)
    if (!box) continue
    // a member of a unit stands on the outline of the unit, which lies a pad outside its card
    const pad = problem.items.some(
      (i) => i.kind === 'unit' && i.members.some((m) => m.node.id === id),
    )
      ? problem.metrics.hullPad
      : 0
    const at: Record<Side, Point> = {
      top: { x: box.x, y: box.y - pad },
      bottom: { x: box.x, y: box.y + box.height + pad },
      left: { x: box.x - pad, y: box.y },
      right: { x: box.x + box.width + pad, y: box.y },
    }
    out.push({ nodeId: id, side, text: layout.caption.text, at: at[side] })
  }
  return out.sort((a, b) =>
    a.nodeId === b.nodeId ? compare(a.side, b.side) : compare(a.nodeId, b.nodeId),
  )
}

/** Puts the layers' results together as a scene, moved so that its top-left corner is the origin. */
export function assemble(
  problem: Problem,
  geometry: Geometry,
  wiring: Wiring,
  /** The members of each unit, left to right. */
  membersOf: ReadonlyMap<string, readonly NodeId[]>,
): Scene {
  const nodes: Scene['nodes'] = []
  const hulls: { members: string[]; kind?: string; box?: Box }[] = []
  for (const item of problem.items) {
    switch (item.kind) {
      case 'unit': {
        const members = membersOf.get(item.id) ?? []
        for (const id of members) {
          const member = item.members.find((m) => m.node.id === id)
          const box = geometry.boxes.get(id)
          if (member && box) nodes.push(...hostAndGuests(member, box))
        }
        const outline = geometry.boxes.get(item.id)
        hulls.push({
          members: [...members],
          ...(item.hullKind && { kind: item.hullKind }),
          ...(outline && { box: outline }),
        })
        break
      }
      case 'card':
      case 'bus':
      case 'cloud': {
        const box = geometry.boxes.get(item.id)
        if (box) nodes.push(...hostAndGuests(item, box))
        break
      }
      default:
        assertNever(item, 'item kind')
    }
  }
  const groups: Scene['groups'] = []
  for (const frame of problem.frames) {
    const box = geometry.boxes.get(frameKey(frame.id))
    if (frame.id === ROOT || !box) continue
    groups.push({ group: frame.group ?? { id: frame.id, label: frame.id }, box })
  }
  const shaped = shapeWires(problem, geometry, wiring.wires, wiring.turns)
  const wires: Scene['wires'] = problem.lines.flatMap((line) => {
    const wire = shaped.wires.get(line.id)
    return wire
      ? [{ link: line.link, ...wire, stroke: line.stroke, label: polylineMiddle(wire.points) }]
      : []
  })

  const seated = hulls.map((h) => seat(h, nodes, wires))

  const xs = [
    ...nodes.flatMap((n) => [n.box.x, n.box.x + n.box.width]),
    ...groups.flatMap((g) => [g.box.x, g.box.x + g.box.width]),
    ...wires.flatMap((w) => w.points.map((p) => p.x)),
  ]
  const ys = [
    ...nodes.flatMap((n) => [n.box.y, n.box.y + n.box.height]),
    ...groups.flatMap((g) => [g.box.y, g.box.y + g.box.height]),
    ...wires.flatMap((w) => w.points.map((p) => p.y)),
  ]
  const origin = xs.length === 0 ? 0 : Math.min(...xs)
  const originY = ys.length === 0 ? 0 : Math.min(...ys)
  const move = (p: Point): Point => ({ x: p.x - origin, y: p.y - originY })
  const captions = captionsOf(problem, geometry).map((c) => ({ ...c, at: move(c.at) }))
  const moveBox = (b: Box): Box => ({ ...b, x: b.x - origin, y: b.y - originY })
  return {
    nodes: nodes.map((n) => ({ ...n, box: moveBox(n.box) })),
    groups: groups.map((g) => ({ group: g.group, box: moveBox(g.box) })),
    ...(problem.inner.length > 0 && { inner: problem.inner }),
    wires: wires.map((w) => ({ ...w, points: w.points.map(move), label: move(w.label) })),
    ports: wiring.ports.map((p) => ({ ...p, at: move(p.at) })),
    ...(captions.length > 0 && { captions }),
    hulls: seated.map((h) => ({
      ...h,
      boxes: h.boxes.map(moveBox),
      seams: h.seams.map((y) => y - originY),
      ...(h.box && { box: moveBox(h.box) }),
    })),
    bounds: {
      x: 0,
      y: 0,
      width: xs.length === 0 ? 0 : Math.max(...xs) - origin,
      height: ys.length === 0 ? 0 : Math.max(...ys) - originY,
    },
  }
}

/** A node's box, and for a host the guests drawn inside it, at their places in the box. */
function hostAndGuests(
  host: { node: Node; guests?: Guest[]; heading?: number },
  box: Box,
): Scene['nodes'] {
  if (!host.guests?.length || host.heading === undefined) return [{ node: host.node, box }]
  return [
    { node: host.node, box, header: host.heading },
    ...host.guests.map((g) => ({
      node: g.node,
      box: { x: box.x + g.at.x, y: box.y + g.at.y, ...g.size },
    })),
  ]
}

/**
 * The middle of a polyline, where a caption sits: half its length from either end, as the line is
 * read, whatever its vertices (a diagonal or a turn adds vertices without moving the middle much).
 */
export function polylineMiddle(points: readonly Point[]): Point {
  const first = points[0] ?? { x: 0, y: 0 }
  const lengths = points.slice(1).map((b, k) => {
    const a = points[k] ?? b
    return Math.hypot(b.x - a.x, b.y - a.y)
  })
  let left = lengths.reduce((sum, l) => sum + l, 0) / 2
  for (const [k, l] of lengths.entries()) {
    const a = points[k] ?? first
    const b = points[k + 1] ?? a
    if (left <= l && l > 0) {
      const t = left / l
      return { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) }
    }
    left -= l
  }
  return points[points.length - 1] ?? first
}

/**
 * A hull with what its outline is drawn from: the boxes of its members left to right, and the
 * height at which the wire between each neighbouring pair crosses (the middle of the two cards
 * when no wire joins them).
 */
function seat(
  hull: { members: string[]; kind?: string; box?: Box },
  nodes: Scene['nodes'],
  wires: Scene['wires'],
): { members: string[]; kind?: string; box?: Box; boxes: Box[]; seams: number[] } {
  const found = new Map(nodes.map(({ node, box }) => [node.id, box]))
  const parts = hull.members
    .flatMap((id) => {
      const box = found.get(id)
      return box ? [{ id, box }] : []
    })
    .sort((a, b) => a.box.x + a.box.width / 2 - (b.box.x + b.box.width / 2))
  const seams = parts.flatMap((left, i) => {
    const right = parts[i + 1]
    if (!right) return []
    const wire = wires.find(({ link }) => {
      const ends = [link.from.node, link.to.node]
      return ends.includes(left.id) && ends.includes(right.id)
    })
    const first = wire?.points[0]
    const last = wire?.points[wire.points.length - 1]
    if (first && last) return [(first.y + last.y) / 2]
    return [(left.box.y + left.box.height / 2 + right.box.y + right.box.height / 2) / 2]
  })
  return { ...hull, members: parts.map((p) => p.id), boxes: parts.map((p) => p.box), seams }
}

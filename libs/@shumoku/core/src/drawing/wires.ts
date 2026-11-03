// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { compare, joinKey } from '../structure/keys.js'
import { pitchOf } from './kin.js'
import type { Box, Point } from './metrics.js'
import { centre, simplify } from './ports.js'
import type { End, Geometry, Line, Problem } from './problem.js'
import type { Scene, Side } from './scene.js'
import type { Entity, Tracks, Var } from './tracks.js'

/** The point on the edge of a box where a port stands, given its place along that edge. */
function portPoint(
  problem: Problem,
  geometry: Geometry,
  ent: Entity,
  along: number,
): Point | undefined {
  const box = geometry.boxes.get(ent.box)
  if (!box) return undefined
  // a member of a unit stands on the outline of the unit, which lies a pad outside its card
  const pad = problem.items.some(
    (i) => i.kind === 'unit' && i.members.some((m) => m.node.id === ent.box),
  )
    ? problem.metrics.hullPad
    : 0
  switch (ent.side) {
    case 'top':
      return { x: along, y: box.y - pad }
    case 'bottom':
      return { x: along, y: box.y + box.height + pad }
    case 'left':
      return { x: box.x - pad, y: along }
    case 'right':
      return { x: box.x + box.width + pad, y: along }
  }
}

/**
 * The lines as polylines: each from its port to its port through the coordinates of its chain,
 * which alternate between a place across and a place along, so that every vertex is the crossing
 * of the stretch before it and the stretch after it. The lines inside a unit run straight across
 * between neighbours.
 */
export function wiresOf(
  problem: Problem,
  geometry: Geometry,
  tracks: Tracks,
  valueAt: (v: Var) => number,
  dropped: ReadonlySet<string> = new Set(),
): { wires: Map<string, Point[]>; ports: NonNullable<Scene['ports']> } {
  const wires = new Map<string, Point[]>()
  const ports = new Map<string, NonNullable<Scene['ports']>[number]>()
  const addPort = (
    id: string,
    nodeId: string,
    label: string | undefined,
    at: Point,
    side: Side,
  ) => {
    const key = `${id}|${side}`
    if (ports.has(key)) return
    ports.set(key, { id, nodeId, ...(label && { label }), at, side })
  }
  for (const [lineId, chain] of tracks.chains) {
    const pts: Point[] = []
    let x = 0
    let y = 0
    for (const [k, v] of chain.entries()) {
      const val = valueAt(v)
      if (v.kind === 'port') {
        const ent = tracks.entities.get(v.id)
        if (!ent) continue
        const at = portPoint(problem, geometry, ent, val)
        if (!at) continue
        addPort(ent.sceneId, ent.nodeId, ent.label, at, ent.side)
        if (k === 0) {
          pts.push(at)
          x = at.x
          y = at.y
        } else {
          // the last port: reached along its axis, then the edge
          pts.push(ent.axis === 'x' ? { x: at.x, y } : { x, y: at.y }, at)
        }
        continue
      }
      const lane = tracks.lanes.get(v.key)
      if (!lane || dropped.has(v.key)) continue
      if (lane.axis === 'y') {
        y = val
        pts.push({ x, y })
      } else {
        x = val
        pts.push({ x, y })
      }
    }
    wires.set(lineId, simplify(pts))
  }
  insideWires(problem, geometry, wires, (end, at, side, line, which) => {
    const nodeId = end.node ?? end.item
    const id = end.port ? `${nodeId}/${end.port}` : `${nodeId}#${line.id}.${which}`
    addPort(id, nodeId, end.port, at, side)
  })
  return { wires, ports: [...ports.values()] }
}

/** A line between two neighbours of one unit runs straight across, level with their centres. */
function insideWires(
  problem: Problem,
  geometry: Geometry,
  wires: Map<string, Point[]>,
  addPort: (end: End, at: Point, side: Side, line: Line, which: 'a' | 'b') => void,
) {
  const boxOf = (end: End): Box | undefined =>
    geometry.boxes.get(end.node ?? end.item) ?? geometry.boxes.get(end.item)
  const pairs = new Map<string, Line[]>()
  for (const line of problem.lines) {
    if (line.role !== 'inside') continue
    const key = joinKey([line.a.node ?? line.a.item, line.b.node ?? line.b.item].sort(compare))
    pairs.set(key, [...(pairs.get(key) ?? []), line])
  }
  for (const group of pairs.values()) {
    // Neighbours stand a pitch apart, each pair by its own, and the row is centred.
    const offsets: number[] = []
    for (const [i, line] of group.entries()) {
      const before = group[i - 1]
      offsets.push(before ? (offsets[i - 1] ?? 0) + pitchOf(problem.metrics, before, line) : 0)
    }
    for (const [k, line] of group.entries()) {
      const a = boxOf(line.a)
      const b = boxOf(line.b)
      if (!a || !b) continue
      const [from, to] = centre(a).x <= centre(b).x ? [a, b] : [b, a]
      const level = (centre(a).y + centre(b).y) / 2 + (offsets[k] ?? 0) - (offsets.at(-1) ?? 0) / 2
      const p = { x: from.x + from.width, y: level }
      const q = { x: to.x, y: level }
      const [first, last] = from === a ? [p, q] : [q, p]
      wires.set(line.id, [first, last])
      addPort(line.a, first, from === a ? 'right' : 'left', line, 'a')
      addPort(line.b, last, from === a ? 'left' : 'right', line, 'b')
    }
  }
}

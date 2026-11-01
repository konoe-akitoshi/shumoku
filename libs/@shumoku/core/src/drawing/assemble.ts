// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import type { Box, Point } from './metrics.js'
import { frameKey, type Geometry, type Order, type Problem, ROOT, type Wiring } from './problem.js'
import type { Scene } from './scene.js'

/** Puts the layers' results together as a scene, moved so that its top-left corner is the origin. */
export function assemble(
  problem: Problem,
  geometry: Geometry,
  wiring: Wiring,
  order: Order,
): Scene {
  const nodes: Scene['nodes'] = []
  const hulls: NonNullable<Scene['hulls']> = []
  for (const item of problem.items) {
    if (item.kind === 'unit') {
      const members = order.members.get(item.id) ?? []
      for (const id of members) {
        const member = item.members?.find((m) => m.node.id === id)
        const box = geometry.boxes.get(id)
        if (member && box) nodes.push({ node: member.node, box })
      }
      const outline = geometry.boxes.get(item.id)
      hulls.push({
        members,
        ...(item.hullKind && { kind: item.hullKind }),
        ...(outline && { box: outline }),
      })
      continue
    }
    const box = geometry.boxes.get(item.id)
    if (item.node && box) nodes.push({ node: item.node, box })
  }
  const groups: Scene['groups'] = []
  for (const frame of problem.frames) {
    const box = geometry.boxes.get(frameKey(frame.id))
    if (frame.id === ROOT || !box) continue
    groups.push({ group: frame.group ?? { id: frame.id, label: frame.id }, box })
  }
  const wires: Scene['wires'] = problem.lines.flatMap((line) => {
    const points = wiring.wires.get(line.id)
    return points ? [{ link: line.link, points, stroke: line.stroke, width: line.width }] : []
  })

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
  const moveBox = (b: Box): Box => ({ ...b, x: b.x - origin, y: b.y - originY })
  return {
    nodes: nodes.map((n) => ({ node: n.node, box: moveBox(n.box) })),
    groups: groups.map((g) => ({ group: g.group, box: moveBox(g.box) })),
    wires: wires.map((w) => ({ ...w, points: w.points.map(move) })),
    ports: wiring.ports.map((p) => ({ ...p, at: move(p.at) })),
    hulls: hulls.map((h) => (h.box ? { ...h, box: moveBox(h.box) } : h)),
    bounds: {
      x: 0,
      y: 0,
      width: xs.length === 0 ? 0 : Math.max(...xs) - origin,
      height: ys.length === 0 ? 0 : Math.max(...ys) - originY,
    },
  }
}

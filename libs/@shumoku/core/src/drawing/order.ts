// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { compare } from '../structure/keys.js'
import { solveHorizontal } from './horizontal.js'
import type { Point } from './metrics.js'
import {
  type End,
  type FrameId,
  frameKey,
  type Geometry,
  type ItemId,
  type Order,
  type Problem,
  type YLayout,
} from './problem.js'
import { anchorsOf, treeOf } from './tree.js'

/** An element of a frame and the satellites that stand beside it, which move together. */
interface Cluster {
  anchor: string
  satellites: string[]
}

/** What can be rearranged in a frame, and what stays at its end. */
interface Row {
  movable: Cluster[]
  tail: string[]
}

type Rows = Map<FrameId, Row>
type Members = Map<ItemId, string[]>

const side = (p: Point, q: Point, r: Point) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x)
const cross = (a: Point, b: Point, c: Point, d: Point) =>
  side(a, b, c) * side(a, b, d) < 0 && side(c, d, a) * side(c, d, b) < 0

const flatten = (rows: Rows): Order['siblings'] =>
  new Map(
    [...rows].map(([frame, row]) => [
      frame,
      [...row.movable.flatMap((c) => [c.anchor, ...c.satellites]), ...row.tail],
    ]),
  )

/**
 * The left-to-right order of the siblings in each frame, and of the members of each unit, that
 * leaves the fewest crossings between the lines that place things. Crossings are counted on
 * straight lines between box centres, which is what the wiring will roughly follow. An order is
 * only ever replaced by one that crosses less, so the result never needs a limit chosen by hand:
 * the search stops when nothing improves.
 */
export function orderSiblings(problem: Problem, y: YLayout): Order {
  const tree = treeOf(problem)
  const anchors = anchorsOf(problem, tree)
  const free = new Set(problem.free)

  const rows: Rows = new Map()
  for (const frame of problem.frames) {
    const items = tree.itemsIn.get(frame.id) ?? []
    const keys = [
      ...items.filter((i) => !anchors.has(i.id) && !free.has(i.id)).map((i) => i.id),
      ...(tree.framesIn.get(frame.id) ?? []).map((f) => frameKey(f.id)),
    ].sort(compare)
    const movable = keys.map(
      (anchor): Cluster => ({
        anchor,
        satellites: [...anchors]
          .filter(([sat, a]) => a === anchor && tree.parentOf.get(sat) === frame.id)
          .map(([sat]) => sat)
          .sort(compare),
      }),
    )
    rows.set(frame.id, {
      movable,
      tail: items
        .filter((i) => free.has(i.id))
        .map((i) => i.id)
        .sort(compare),
    })
  }
  let members: Members = new Map(
    problem.items
      .filter((i) => i.kind === 'unit')
      .map((i) => [i.id, (i.members ?? []).map((m) => m.node.id).sort(compare)]),
  )

  const place = (r: Rows, m: Members) =>
    solveHorizontal(problem, y, { siblings: flatten(r), members: m })

  const lines = problem.lines.filter(
    (l) => (l.role === 'oriented' || l.role === 'attach') && l.a.item !== l.b.item,
  )
  const centre = (end: End, geo: Geometry): Point => {
    const box = geo.boxes.get(end.node ?? end.item) ?? geo.boxes.get(end.item)
    return box ? { x: box.x + box.width / 2, y: box.y + box.height / 2 } : { x: 0, y: 0 }
  }
  const segments = (geo: Geometry, shift?: ReadonlyMap<ItemId, number>) =>
    lines.map((l): [Point, Point] => {
      const a = centre(l.a, geo)
      const b = centre(l.b, geo)
      return [
        { x: a.x + (shift?.get(l.a.item) ?? 0), y: a.y },
        { x: b.x + (shift?.get(l.b.item) ?? 0), y: b.y },
      ]
    })
  const crossings = (segs: [Point, Point][]) => {
    let count = 0
    for (const [i, [a, b]] of segs.entries()) {
      for (const [c, d] of segs.slice(i + 1)) if (cross(a, b, c, d)) count++
    }
    return count
  }

  const itemsOf = (key: string): ItemId[] => {
    const frame = problem.frames.find((f) => frameKey(f.id) === key)
    return frame ? (tree.within.get(frame.id) ?? []).map((i) => i.id) : [key]
  }
  const clusterItems = (c: Cluster) => [c.anchor, ...c.satellites].flatMap(itemsOf)

  /** Clusters sorted by where the lines leaving them lead; ones with none stay where they are. */
  const byPull = (r: Rows, geo: Geometry): Rows =>
    new Map(
      [...r].map(([frame, row]) => {
        const keyed = row.movable.map((c) => {
          const own = new Set(clusterItems(c))
          const xs = lines.flatMap((l) => {
            const a = own.has(l.a.item)
            const b = own.has(l.b.item)
            if (a === b) return []
            return [centre(a ? l.b : l.a, geo).x]
          })
          const anchorBox = geo.boxes.get(c.anchor)
          const at = anchorBox ? anchorBox.x + anchorBox.width / 2 : 0
          return { c, at: xs.length > 0 ? xs.reduce((p, q) => p + q, 0) / xs.length : at }
        })
        keyed.sort((p, q) => p.at - q.at || compare(p.c.anchor, q.c.anchor))
        return [frame, { ...row, movable: keyed.map((k) => k.c) }]
      }),
    )

  const memberPull = (m: Members, geo: Geometry): Members =>
    new Map(
      [...m].map(([unit, ids]) => {
        const keyed = ids.map((id, index) => {
          const xs = lines.flatMap((l) => {
            const a = l.a.node === id && l.a.item === unit
            const b = l.b.node === id && l.b.item === unit
            if (a === b) return []
            return [centre(a ? l.b : l.a, geo).x]
          })
          return {
            id,
            index,
            at: xs.length > 0 ? xs.reduce((p, q) => p + q, 0) / xs.length : undefined,
          }
        })
        keyed.sort((p, q) =>
          p.at === undefined || q.at === undefined
            ? p.index - q.index
            : p.at - q.at || compare(p.id, q.id),
        )
        return [unit, keyed.map((k) => k.id)]
      }),
    )

  const same = (a: Rows, b: Rows, ma: Members, mb: Members) =>
    [...a].every(([f, row]) => {
      const other = b.get(f)
      return other?.movable.every((c, i) => c.anchor === row.movable[i]?.anchor)
    }) && [...ma].every(([u, ids]) => mb.get(u)?.every((id, i) => id === ids[i]))

  let geo = place(rows, members)
  let best = crossings(segments(geo))
  let current = rows
  const widest = Math.max(1, ...[...rows.values()].map((r) => r.movable.length))

  // Move each element towards the centre of what its lines lead to.
  for (let round = 0; round < widest; round++) {
    const next = byPull(current, geo)
    const nextMembers = memberPull(members, geo)
    if (same(current, next, members, nextMembers)) break
    const g = place(next, nextMembers)
    const c = crossings(segments(g))
    if (c >= best) break
    current = next
    members = nextMembers
    geo = g
    best = c
  }

  // Swap neighbours where that leaves fewer crossings among the lines that touch them.
  for (let pass = 0; pass < widest; pass++) {
    const swapped: Rows = new Map(current)
    let changed = false
    for (const [frame, row] of current) {
      const movable = [...row.movable]
      for (let i = 0; i + 1 < movable.length; i++) {
        const a = movable[i]
        const b = movable[i + 1]
        if (!a || !b) continue
        const ea = extentOf(clusterBoxes(a), geo)
        const eb = extentOf(clusterBoxes(b), geo)
        if (!ea || !eb) continue
        const gapBetween = Math.max(0, eb.left - ea.right)
        const shift = new Map<ItemId, number>()
        for (const id of clusterItems(b)) shift.set(id, ea.left - eb.left)
        for (const id of clusterItems(a)) shift.set(id, eb.right - eb.left + gapBetween)
        const touching = new Set(shift.keys())
        const before = crossingsTouching(segments(geo), lines, touching)
        const after = crossingsTouching(segments(geo, shift), lines, touching)
        if (after < before) {
          movable[i] = b
          movable[i + 1] = a
          changed = true
        }
      }
      swapped.set(frame, { ...row, movable })
    }
    if (!changed) break
    const g = place(swapped, members)
    const c = crossings(segments(g))
    if (c >= best) break
    current = swapped
    geo = g
    best = c
  }

  return { siblings: flatten(current), members }
}

const clusterBoxes = (c: Cluster) => [c.anchor, ...c.satellites]

function extentOf(keys: string[], geo: Geometry): { left: number; right: number } | undefined {
  const boxes = keys.flatMap((k) => geo.boxes.get(k) ?? [])
  if (boxes.length === 0) return undefined
  return {
    left: Math.min(...boxes.map((b) => b.x)),
    right: Math.max(...boxes.map((b) => b.x + b.width)),
  }
}

/** Crossings between the lines that touch a set of items and all lines, each pair once. */
function crossingsTouching(
  segs: [Point, Point][],
  lines: Problem['lines'],
  touching: ReadonlySet<ItemId>,
): number {
  const touches = lines.map((l) => touching.has(l.a.item) || touching.has(l.b.item))
  let count = 0
  for (const [i, [a, b]] of segs.entries()) {
    if (!touches[i]) continue
    for (const [j, [c, d]] of segs.entries()) {
      if (i === j || (touches[j] && j < i)) continue
      if (cross(a, b, c, d)) count++
    }
  }
  return count
}

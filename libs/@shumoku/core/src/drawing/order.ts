// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { compare } from '../structure/keys.js'
import type { Point } from './metrics.js'
import {
  type End,
  type FrameId,
  frameKey,
  type ItemId,
  type Order,
  type Problem,
  ROOT,
} from './problem.js'
import { ranksOf } from './ranks.js'
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
/** Where each item stands among all the items, counted left to right through the frames. */
type Index = Map<ItemId, number>
type Segment = [Point, Point]
type Sweep = 'down' | 'up'

const side = (p: Point, q: Point, r: Point) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x)
const cross = (a: Point, b: Point, c: Point, d: Point) =>
  side(a, b, c) * side(a, b, d) < 0 && side(c, d, a) * side(c, d, b) < 0

/** The lines that place things, other than those between two parts of one item. */
const placing = (problem: Problem) =>
  problem.lines.filter((l) => l.role === 'oriented' && l.a.item !== l.b.item)

const mean = (xs: readonly number[]) => xs.reduce((p, q) => p + q, 0) / xs.length

const countCrossings = (segs: Segment[]) => {
  let count = 0
  for (const [i, [a, b]] of segs.entries()) {
    for (const [c, d] of segs.slice(i + 1)) if (cross(a, b, c, d)) count++
  }
  return count
}

/** Crossings between the lines that touch a set of items and all lines, each pair once. */
function crossingsTouching(
  segs: Segment[],
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

const flatten = (rows: Rows): Order['siblings'] =>
  new Map(
    [...rows].map(([frame, row]) => [
      frame,
      [...row.movable.flatMap((c) => [c.anchor, ...c.satellites]), ...row.tail],
    ]),
  )

/**
 * The left-to-right order of the siblings in each frame, and of the members of each unit,
 * decided from ranks and positions in the order alone, never from a length. Every item stands at
 * a number, its place counted left to right through the frames, and a line is a segment between
 * the (place, rank) of its ends; two lines cross when their segments do. Each element is moved
 * towards the mean place of what its lines lead to (those above it when sweeping down, those
 * below when sweeping up, ties by id), and then neighbours are swapped where that leaves fewer
 * crossings among the lines that touch them. An order is replaced only by one that crosses no
 * more, and the search stops when it comes back to an order it has seen, so it needs no limit
 * chosen by hand. Of the orders met, the first that crosses least is the result.
 */
export function orderSiblings(problem: Problem): Order {
  const tree = treeOf(problem)
  const anchors = anchorsOf(problem, tree)
  const free = new Set(problem.free)
  const rank = ranksOf(problem)
  const lines = placing(problem)
  const rankSize = new Map<number, number>()
  for (const level of rank.values()) rankSize.set(level, (rankSize.get(level) ?? 0) + 1)
  const frameOfKey = new Map(problem.frames.map((f) => [frameKey(f.id), f.id]))

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
  const members: Members = new Map(
    problem.items
      .filter((i) => i.kind === 'unit')
      .map((i) => [i.id, (i.members ?? []).map((m) => m.node.id).sort(compare)]),
  )

  const itemsOf = (key: string): ItemId[] => {
    const frame = frameOfKey.get(key)
    return frame === undefined ? [key] : (tree.within.get(frame) ?? []).map((i) => i.id)
  }
  const clusterItems = (c: Cluster) => [c.anchor, ...c.satellites].flatMap(itemsOf)

  /**
   * Every item's place along its rank, counting through the frames in the order given: its
   * position among the items of its rank, as a share of their number, so that ranks of different
   * widths line up and a line between two ranks is judged by where its ends stand in them.
   */
  const indexOf = (r: Rows): Index => {
    const counted = new Map<number, number>()
    const placed: [ItemId, number][] = []
    const visit = (frame: FrameId) => {
      const row = r.get(frame)
      if (!row) return
      const put = (id: ItemId) => {
        const level = rank.get(id) ?? 0
        const n = counted.get(level) ?? 0
        counted.set(level, n + 1)
        placed.push([id, n])
      }
      for (const c of row.movable) {
        for (const key of [c.anchor, ...c.satellites]) {
          const inner = frameOfKey.get(key)
          if (inner === undefined) put(key)
          else visit(inner)
        }
      }
      for (const id of row.tail) put(id)
    }
    visit(ROOT)
    return new Map(placed.map(([id, n]) => [id, (n + 0.5) / (counted.get(rank.get(id) ?? 0) ?? 1)]))
  }

  /** Where a line ends: its item's place, and for a member of a unit a step within that place. */
  const placeOf = (end: End, index: Index, m: Members): number => {
    const at = index.get(end.item) ?? 0
    const ids = m.get(end.item)
    const k = end.node === undefined ? -1 : (ids?.indexOf(end.node) ?? -1)
    if (!ids || k < 0) return at
    const share = 1 / (rankSize.get(rank.get(end.item) ?? 0) ?? 1)
    return at + ((k + 0.5) / ids.length - 0.5) * share
  }
  const pointOf = (end: End, index: Index, m: Members): Point => ({
    x: placeOf(end, index, m),
    y: rank.get(end.item) ?? 0,
  })
  const segments = (index: Index, m: Members) =>
    lines.map((l): Segment => [pointOf(l.a, index, m), pointOf(l.b, index, m)])

  /**
   * The places of what an end's lines lead to: those on the side of the flow the sweep comes
   * from (level ones with either), or all of them where there are none on that side.
   */
  const leading = (
    ends: { mine: End; theirs: End }[],
    index: Index,
    m: Members,
    sweep: Sweep,
  ): number[] => {
    const all = ends.map((e) => ({
      x: placeOf(e.theirs, index, m),
      d: (rank.get(e.theirs.item) ?? 0) - (rank.get(e.mine.item) ?? 0),
    }))
    const near = all.filter((e) => (sweep === 'down' ? e.d <= 0 : e.d >= 0))
    return (near.length > 0 ? near : all).map((e) => e.x)
  }

  /**
   * Clusters of one frame sorted by where the lines leaving them lead; ones with none stay where
   * they are.
   */
  const byPull = (r: Rows, only: FrameId, index: Index, m: Members, sweep: Sweep): Rows =>
    new Map(
      [...r].map(([frame, row]) => {
        if (frame !== only) return [frame, row]
        const keyed = row.movable.map((c) => {
          const own = new Set(clusterItems(c))
          const ends = lines.flatMap((l) => {
            const a = own.has(l.a.item)
            const b = own.has(l.b.item)
            if (a === b) return []
            return [a ? { mine: l.a, theirs: l.b } : { mine: l.b, theirs: l.a }]
          })
          const xs = leading(ends, index, m, sweep)
          const here = [...own].map((id) => index.get(id) ?? 0)
          return { c, at: mean(xs.length > 0 ? xs : here) }
        })
        keyed.sort((p, q) => p.at - q.at || compare(p.c.anchor, q.c.anchor))
        return [frame, { ...row, movable: keyed.map((k) => k.c) }]
      }),
    )

  const byMemberPull = (
    m: Members,
    only: ReadonlySet<ItemId>,
    index: Index,
    sweep: Sweep,
  ): Members =>
    new Map(
      [...m].map(([unit, ids]) => {
        if (!only.has(unit)) return [unit, ids]
        const keyed = ids.map((id, position) => {
          const ends = lines.flatMap((l) => {
            const a = l.a.node === id && l.a.item === unit
            const b = l.b.node === id && l.b.item === unit
            if (a === b) return []
            return [a ? { mine: l.a, theirs: l.b } : { mine: l.b, theirs: l.a }]
          })
          const xs = leading(ends, index, m, sweep)
          return { id, position, at: xs.length > 0 ? mean(xs) : undefined }
        })
        keyed.sort((p, q) =>
          p.at === undefined || q.at === undefined
            ? p.position - q.position
            : p.at - q.at || compare(p.id, q.id),
        )
        return [unit, keyed.map((k) => k.id)]
      }),
    )

  const nameOf = (r: Rows, m: Members) => JSON.stringify([[...flatten(r)], [...m]])

  /**
   * The frames in the order a sweep takes them: down, those whose contents start nearest the top
   * first; up, those that reach furthest down. Each is settled on the places the ones before it
   * left, so that what is settled once is not undone by what is settled with it.
   */
  const reach = (frame: FrameId) => {
    const levels = (tree.within.get(frame) ?? []).map((i) => rank.get(i.id) ?? 0)
    return { top: Math.min(...levels), bottom: Math.max(...levels) }
  }
  const sweepOrder = (sweep: Sweep) =>
    problem.frames
      .map((f) => f.id)
      .sort((p, q) =>
        sweep === 'down'
          ? reach(p).top - reach(q).top || compare(p, q)
          : reach(q).bottom - reach(p).bottom || compare(p, q),
      )

  const sweepOnce = (r: Rows, m: Members, sweep: Sweep) => {
    let rowsNow = r
    let membersNow = m
    let indexNow = indexOf(rowsNow)
    for (const frame of sweepOrder(sweep)) {
      const units = new Set((tree.itemsIn.get(frame) ?? []).map((i) => i.id))
      rowsNow = byPull(rowsNow, frame, indexNow, membersNow, sweep)
      membersNow = byMemberPull(membersNow, units, indexNow, sweep)
      indexNow = indexOf(rowsNow)
    }
    return { rows: rowsNow, members: membersNow, index: indexNow }
  }

  // Sweep down and up, moving each element towards the mean place of what its lines lead to.
  let current = rows
  let currentMembers = members
  let index = indexOf(current)
  let best = countCrossings(segments(index, currentMembers))
  let bestRows = current
  let bestMembers = currentMembers
  // Each sweep starts from where the last left off, better or not: a move that crosses more may
  // be what the next one needs. The order of sweeps repeats once an order comes back with the
  // sweep that follows it, which is the end, whatever the size.
  const seen = new Set<string>()
  for (let sweep: Sweep = 'down'; ; sweep = sweep === 'down' ? 'up' : 'down') {
    const turn = `${sweep} ${nameOf(current, currentMembers)}`
    if (seen.has(turn)) break
    seen.add(turn)
    const next = sweepOnce(current, currentMembers, sweep)
    current = next.rows
    currentMembers = next.members
    index = next.index
    const c = countCrossings(segments(index, currentMembers))
    if (c < best) {
      best = c
      bestRows = current
      bestMembers = currentMembers
    }
  }
  current = bestRows
  currentMembers = bestMembers
  index = indexOf(current)

  // Move each element to the place in its frame where the lines that touch it cross least, if
  // that is fewer than where it stands; repeated until nothing moves. A pass that, counted over
  // all lines, would leave more crossings than it found is not kept.
  let settled = countCrossings(segments(index, currentMembers))
  for (let changed = true; changed; ) {
    changed = false
    const start = current
    const startIndex = index
    for (const frame of problem.frames) {
      for (const { anchor } of current.get(frame.id)?.movable ?? []) {
        const row = current.get(frame.id)
        if (!row) continue
        const at = row.movable.findIndex((c) => c.anchor === anchor)
        const moving = row.movable[at]
        if (!moving) continue
        const touching = new Set(clusterItems(moving))
        const others = row.movable.filter((_, i) => i !== at)
        let bestAt = at
        let bestCount = crossingsTouching(segments(index, currentMembers), lines, touching)
        let bestTrial: Rows | undefined
        let bestIndex = index
        for (let p = 0; p <= others.length; p++) {
          if (p === at) continue
          const trial: Rows = new Map(current).set(frame.id, {
            ...row,
            movable: [...others.slice(0, p), moving, ...others.slice(p)],
          })
          const trialIndex = indexOf(trial)
          const count = crossingsTouching(segments(trialIndex, currentMembers), lines, touching)
          if (count < bestCount) {
            bestCount = count
            bestAt = p
            bestTrial = trial
            bestIndex = trialIndex
          }
        }
        if (bestTrial && bestAt !== at) {
          current = bestTrial
          index = bestIndex
          changed = true
        }
      }
    }
    if (!changed) break
    const total = countCrossings(segments(index, currentMembers))
    if (total >= settled) {
      current = start
      index = startIndex
      break
    }
    settled = total
  }

  return { siblings: flatten(current), members: currentMembers }
}

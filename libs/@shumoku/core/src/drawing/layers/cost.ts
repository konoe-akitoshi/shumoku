// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { boxKey, type FrameId } from '../problem.js'
import type { Costs, Ctx, Flat, State } from './types.js'

/**
 * The weighted count of pairs that stand one way in `p` and the other way in `q`: the crossings
 * between two ranks, by one pass with a Fenwick tree.
 */
export const inversions = (input: { p: number; q: number; w: number }[]): number => {
  const sorted = [...input].sort((x, y) => x.p - y.p || x.q - y.q)
  const dense = new Map(
    [...new Set(sorted.map((e) => e.q))].sort((x, y) => x - y).map((q, i) => [q, i]),
  )
  const pairs = sorted.map((e) => ({ ...e, q: dense.get(e.q) ?? 0 }))
  const tree = new Float64Array(dense.size + 2)
  let seen = 0
  let count = 0
  const add = (i: number, w: number) => {
    for (let x = i + 1; x < tree.length; x += x & -x) tree[x] = (tree[x] ?? 0) + w
  }
  const upTo = (i: number) => {
    let sum = 0
    for (let x = i + 1; x > 0; x -= x & -x) sum += tree[x] ?? 0
    return sum
  }
  for (let i = 0; i < pairs.length; ) {
    let j = i
    while (j < pairs.length && pairs[j]?.p === pairs[i]?.p) j++
    for (let k = i; k < j; k++) {
      const e = pairs[k]
      if (e) count += e.w * (seen - upTo(e.q))
    }
    for (let k = i; k < j; k++) {
      const e = pairs[k]
      if (e) {
        add(e.q, e.w)
        seen += e.w
      }
    }
    i = j
  }
  return count
}

/** The walls first, then the crossings: a cost is better when it is less in that order. */
export const total = (c: Costs): [number, number] => [
  c.wall.reduce((s, x) => s + x, 0),
  c.gap.reduce((s, x) => s + x, 0) + c.level.reduce((s, x) => s + x, 0),
]

/** The ranks an element or a frame reaches. */
export const spanOfKey = (
  cx: Pick<Ctx, 'dummies' | 'ranks' | 'rankOf'>,
  k: string,
): readonly [number, number] => {
  const d = cx.dummies.get(k)
  if (d) return [d.rank, d.rank]
  return cx.ranks.span.get(k) ?? [cx.rankOf(k), cx.rankOf(k)]
}

/** The children of each frame, in the order the search started from. */
const childrenOf = (s: State): string[][] =>
  [...s.rows.values()].map((row) => [
    ...row.movable.flatMap((c) => [c.anchor, ...c.satellites]),
    ...row.tail,
  ])

/** The siblings that must stand beside each other though they share no rank. */
const apartKidsOf = (
  cx: Pick<Ctx, 'dummies' | 'ranks' | 'rankOf'>,
  initial: State,
): Map<string, string[]> => {
  const apart = new Map<string, string[]>()
  for (const all of childrenOf(initial)) {
    const kids = all.filter((k) => !cx.dummies.has(k))
    for (const a of kids) {
      for (const b of kids) {
        if (a === b) continue
        const [sa, sb] = [spanOfKey(cx, a), spanOfKey(cx, b)]
        if ((sa[1] < sb[0] || sb[1] < sa[0]) && !cx.ranks.ordered(a, b))
          apart.set(a, [...(apart.get(a) ?? []), b])
      }
    }
  }
  return apart
}

/**
 * Judges an order. Crossings and walls are read off the rows; lengths come last: where each
 * line's ends would stand if the contents were packed to the left by the room their ports take
 * (a box is as many slots wide as it has line ends, and slots stand a slot apart: counted from
 * the relations, so that a font which measures a little differently decides nothing here), in
 * the order of the rows (a frame is one stretch across all the ranks it holds, siblings that
 * share a rank or are not related by the flow stand side by side, and siblings the flow stacks
 * block nothing of each other). This is an estimate from the contents, not the coordinates stage
 * 7 solves, which differ by what the lines pull.
 */
export interface Judge {
  /** The siblings that must stand beside each other though they share no rank. */
  apartKids: ReadonlyMap<string, readonly string[]>
  gapCost(g: number, f: Flat): number
  levelCost(r: number, f: Flat): number
  wallCost(g: number, f: Flat): number
  costs(f: Flat): Costs
  /** The walls first, then the crossings, then the lengths: better when less in that order. */
  better(a: [number, number], sa: State, b: [number, number], sb: State): boolean
}

/** What judging reads: the problem as looked up, and every segment, level line and degree. */
export type JudgeIn = Pick<
  Ctx,
  | 'problem'
  | 'ranks'
  | 'items'
  | 'parentFrame'
  | 'frameOfKey'
  | 'ownerOf'
  | 'dummies'
  | 'reaches'
  | 'rankOf'
  | 'segs'
  | 'gapSegs'
  | 'levelsAt'
  | 'degUp'
  | 'degDown'
>

export function judgeOf(cx: JudgeIn, initial: State): Judge {
  const { problem, ranks, items, parentFrame, ownerOf, dummies } = cx
  const apartKids = apartKidsOf(cx, initial)

  const gapCost = (g: number, f: Flat): number => {
    const list = cx.gapSegs[g] ?? []
    const place = (key: string, port: string) =>
      (port ? f.end.get(port) : undefined) ?? (f.pos.get(key) ?? 0) + 0.5
    return inversions(list.map((s) => ({ p: place(s.a, s.pa), q: place(s.b, s.pb), w: s.w })))
  }
  const levelCost = (r: number, f: Flat): number => {
    let cost = 0
    const row = f.seq[r] ?? []
    for (const l of cx.levelsAt[r] ?? []) {
      const [p, q] = [f.pos.get(l.a) ?? 0, f.pos.get(l.b) ?? 0].sort((x, y) => x - y)
      let up = 0
      let down = 0
      for (const e of row.slice((p ?? 0) + 1, q)) {
        up += cx.degUp.get(e) ?? 0
        down += cx.degDown.get(e) ?? 0
      }
      cost += l.w * Math.min(up, down)
    }
    return cost
  }
  // A segment that runs from the left of a frame's stretch to its right, in the gap between two
  // ranks the frame holds both of, must go through the frame or round it. Lines keep to the
  // frames of their own ends, so a segment of a line that does not belong to the frame is a wall
  // it has to pass: counted before the crossings.
  const frameOfElement = (k: string): FrameId | undefined => {
    const d = dummies.get(k)
    if (d) return d.frame
    const owner = ownerOf.get(k)
    return owner === undefined ? undefined : items.get(owner)?.frame
  }
  const walled: FrameId[][] = Array.from({ length: ranks.max + 1 }, (_, g) =>
    problem.frames
      .filter((f) => f.id !== '' && cx.reaches(f.id, g) && cx.reaches(f.id, g + 1))
      .map((f) => f.id),
  )
  const stretches = (row: readonly string[], frames: ReadonlySet<FrameId>) => {
    const out = new Map<FrameId, [number, number]>()
    for (const [i, k] of row.entries()) {
      for (let x = frameOfElement(k); x !== undefined; x = parentFrame.get(x)) {
        if (!frames.has(x)) continue
        const known = out.get(x)
        if (known) known[1] = i
        else out.set(x, [i, i])
      }
    }
    return out
  }
  const wallCost = (g: number, f: Flat): number => {
    const frames = walled[g] ?? []
    const list = cx.gapSegs[g] ?? []
    if (frames.length === 0 || list.length === 0) return 0
    const set = new Set(frames)
    const top = stretches(f.seq[g] ?? [], set)
    const bottom = stretches(f.seq[g + 1] ?? [], set)
    let count = 0
    for (const seg of list) {
      const [p, q] = [f.pos.get(seg.a) ?? 0, f.pos.get(seg.b) ?? 0]
      const crossed = frames.some((G) => {
        if (seg.allowed.has(G)) return false
        const [t, b] = [top.get(G), bottom.get(G)]
        return (
          t !== undefined && b !== undefined && ((p < t[0] && q > b[1]) || (p > t[1] && q < b[0]))
        )
      })
      if (crossed) count += seg.w
    }
    return count
  }
  const costs = (f: Flat): Costs => ({
    wall: Array.from({ length: ranks.max }, (_, g) => wallCost(g, f)),
    gap: Array.from({ length: ranks.max }, (_, g) => gapCost(g, f)),
    level: Array.from({ length: ranks.max + 1 }, (_, r) => levelCost(r, f)),
  })

  const ends = new Map<string, number>()
  for (const line of problem.lines) {
    if (line.role === 'inside') continue
    for (const end of [line.a, line.b]) ends.set(boxKey(end), (ends.get(boxKey(end)) ?? 0) + 1)
  }
  const widthOfKey = (k: string): number => (dummies.has(k) ? 0 : Math.max(1, ends.get(k) ?? 0))
  const lengths = new WeakMap<State, number>()
  const lengthOf = (s: State): number => {
    const known = lengths.get(s)
    if (known !== undefined) return known
    const at = new Map<string, number>()
    const gap = 1
    /** Lays out the children of a frame from `base`; returns the right edge. */
    const layOut = (f: FrameId, base: number): number => {
      const row = s.rows.get(f)
      if (!row) return base
      const front = new Map<number, number>()
      const right = new Map<string, number>()
      let edge = base
      const edgeAt = (r: number) => front.get(r) ?? base
      for (const k of [...row.movable.flatMap((c) => [c.anchor, ...c.satellites]), ...row.tail]) {
        const [lo, hi] = spanOfKey(cx, k)
        let left = base
        for (let r = lo; r <= hi; r++) left = Math.max(left, edgeAt(r))
        for (const b of apartKids.get(k) ?? []) left = Math.max(left, right.get(b) ?? base)
        const inner = cx.frameOfKey.get(k)
        let end: number
        if (inner !== undefined) end = layOut(inner, left)
        else if (dummies.has(k)) {
          at.set(k, left)
          end = left
        } else {
          const item = items.get(k)
          if (!item) continue
          let x = left
          if (item.kind === 'unit') {
            for (const m of s.members.get(k) ?? []) {
              const w = widthOfKey(m)
              at.set(m, x + w / 2)
              x += w + gap
            }
            end = x - gap
          } else {
            const w = widthOfKey(k)
            at.set(k, left + w / 2)
            end = left + w
          }
        }
        right.set(k, end + gap)
        for (let r = lo; r <= hi; r++) front.set(r, dummies.has(k) ? left : end + gap)
        edge = Math.max(edge, end)
      }
      return edge
    }
    layOut('', 0)
    let sum = 0
    for (const seg of cx.segs.values())
      sum += Math.abs((at.get(seg.a) ?? 0) - (at.get(seg.b) ?? 0)) * seg.w
    lengths.set(s, sum)
    return sum
  }
  const better = (a: [number, number], sa: State, b: [number, number], sb: State) =>
    a[0] < b[0] ||
    (a[0] === b[0] && (a[1] < b[1] || (a[1] === b[1] && lengthOf(sa) < lengthOf(sb))))

  return { apartKids, gapCost, levelCost, wallCost, costs, better }
}

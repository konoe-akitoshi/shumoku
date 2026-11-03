// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { compare } from '../structure/keys.js'
import type { NodeId } from '../structure/types.js'
import { boxKey, type FrameId, frameKey, type ItemId, type Line, type Problem } from './problem.js'
import type { Hints, Ranks } from './ranks.js'
import { allowedFrames } from './routes.js'
import { anchorsOf, treeOf } from './tree.js'

/**
 * One place in a rank's row: a box (a card, bus or cloud, or one member of a unit) or the
 * dummy a line that crosses ranks leaves in each rank it passes. Twins share their dummies.
 */
export type Element =
  | { kind: 'box'; key: string; item: ItemId }
  | { kind: 'dummy'; key: string; family: string; lines: string[]; frame: FrameId; rank: number }

export interface Layers {
  ranks: Ranks
  /** Rank by rank, the elements left to right. A frame's elements lie in one stretch of each. */
  sequences: readonly (readonly Element[])[]
  /** Each frame's children, left to right: item ids, `frameKey`s and dummy keys. Satellites follow their anchor, free items come last. */
  siblings: ReadonlyMap<FrameId, readonly string[]>
  /** The members of each unit, left to right. */
  members: ReadonlyMap<ItemId, readonly NodeId[]>
  /** Where each element stands in its rank's row. */
  position: ReadonlyMap<string, number>
  /** The dummies by key. */
  dummies: ReadonlyMap<string, Extract<Element, { kind: 'dummy' }>>
  /** The pairs of lines that must cross between two neighbouring ranks, and the cost of passing level lines round what lies between. */
  crossings: number
  /** The crossings by gap (g between ranks g and g+1), and the cost of level lines by rank. */
  byGap: { gap: readonly number[]; level: readonly number[] }
}

interface Cluster {
  anchor: string
  satellites: string[]
}
interface Row {
  movable: Cluster[]
  tail: string[]
}
interface State {
  rows: Map<FrameId, Row>
  members: Map<ItemId, NodeId[]>
}
interface Segment {
  gap: number
  a: string
  b: string
  w: number
  /** The frames the line may cross without cost. */
  allowed: ReadonlySet<FrameId>
}
interface Flat {
  seq: string[][]
  pos: Map<string, number>
}

const median = (xs: readonly number[]): number => {
  const s = [...xs].sort((p, q) => p - q)
  const m = s.length >> 1
  return s.length % 2 === 1 ? (s[m] ?? 0) : ((s[m - 1] ?? 0) + (s[m] ?? 0)) / 2
}

/**
 * The left-to-right order of every rank's row, decided from ranks and places alone, never from a
 * length. One order of each frame's children serves every rank, so a frame is one stretch of each
 * row it reaches and two frames stand the same way round in all of them. The order is swept down
 * and up the ranks, each child moved towards the median place of what its lines lead to, and
 * then neighbours are swapped where that leaves fewer crossings; the sweeps stop when an order
 * comes back with the sweep that follows it, whatever the size.
 */
export function layersOf(
  problem: Problem,
  ranks: Ranks,
  hints: Pick<Hints, 'order' | 'members'> = {},
): Layers {
  const tree = treeOf(problem)
  const anchors = anchorsOf(problem, tree)
  const free = new Set(problem.free)
  const rankOf = (id: string) => ranks.rank.get(id) ?? 0
  const items = new Map(problem.items.map((i) => [i.id, i]))
  const frameOfKey = new Map(problem.frames.map((f) => [frameKey(f.id), f.id]))
  const parentFrame = new Map(problem.frames.map((f) => [f.id, f.parent]))
  const ownerOf = new Map<string, ItemId>()
  for (const item of problem.items) {
    ownerOf.set(item.id, item.id)
    for (const m of item.members ?? []) ownerOf.set(m.node.id, item.id)
  }

  // ---- what the lines say of the rows: the chain of elements each stands in, rank by rank
  const dummies = new Map<string, Extract<Element, { kind: 'dummy' }>>()
  const chain = (f: FrameId): FrameId[] => {
    const out: FrameId[] = []
    for (let x: FrameId | undefined = f; x !== undefined; x = parentFrame.get(x)) out.push(x)
    return out
  }
  const reaches = (f: FrameId, r: number) => {
    const s = ranks.span.get(frameKey(f))
    return s !== undefined && s[0] <= r && r <= s[1]
  }
  const dummyFrame = (lo: Line['a'], hi: Line['a'], r: number): FrameId => {
    const up = chain(items.get(lo.item)?.frame ?? '').filter((f) => reaches(f, r))
    const down = chain(items.get(hi.item)?.frame ?? '').filter((f) => reaches(f, r))
    const [u, d] = [up[0], down[0]]
    if (u === undefined) return d ?? ''
    if (d === undefined) return u
    return chain(d).length > chain(u).length ? d : u
  }
  const segs = new Map<string, Segment>()
  const levels: { r: number; a: string; b: string; w: number }[] = []
  const adj = new Map<string, { up: string[]; down: string[]; level: string[] }>()
  const adjOf = (k: string) => {
    let e = adj.get(k)
    if (!e) {
      e = { up: [], down: [], level: [] }
      adj.set(k, e)
    }
    return e
  }
  for (const line of problem.lines) {
    if (line.role === 'inside' || line.a.item === line.b.item) continue
    const ra = rankOf(line.a.item)
    const rb = rankOf(line.b.item)
    if (ra === rb) {
      levels.push({ r: ra, a: boxKey(line.a), b: boxKey(line.b), w: 1 })
      adjOf(boxKey(line.a)).level.push(boxKey(line.b))
      adjOf(boxKey(line.b)).level.push(boxKey(line.a))
      continue
    }
    const [lo, hi] = ra < rb ? [line.a, line.b] : [line.b, line.a]
    const [rlo, rhi] = ra < rb ? [ra, rb] : [rb, ra]
    const allowed = allowedFrames(problem, line)
    let before = boxKey(lo)
    for (let r = rlo + 1; r <= rhi; r++) {
      let here = boxKey(hi)
      if (r < rhi) {
        here = `dummy:${line.family}@${r}`
        const known = dummies.get(here)
        if (known) known.lines.push(line.id)
        else
          dummies.set(here, {
            kind: 'dummy',
            key: here,
            family: line.family,
            lines: [line.id],
            frame: dummyFrame(lo, hi, r),
            rank: r,
          })
      }
      const key = `${r - 1}\0${before}\0${here}`
      const seg = segs.get(key) ?? { gap: r - 1, a: before, b: here, w: 0, allowed }
      seg.w++
      segs.set(key, seg)
      adjOf(before).down.push(here)
      adjOf(here).up.push(before)
      before = here
    }
  }
  const gapSegs: Segment[][] = Array.from({ length: ranks.max + 1 }, () => [])
  const degUp = new Map<string, number>()
  const degDown = new Map<string, number>()
  for (const seg of [...segs.values()].sort(
    (p, q) => p.gap - q.gap || compare(p.a, q.a) || compare(p.b, q.b),
  )) {
    gapSegs[seg.gap]?.push(seg)
    degDown.set(seg.a, (degDown.get(seg.a) ?? 0) + seg.w)
    degUp.set(seg.b, (degUp.get(seg.b) ?? 0) + seg.w)
  }
  const levelsAt: (typeof levels)[] = Array.from({ length: ranks.max + 1 }, () => [])
  for (const l of levels) levelsAt[l.r]?.push(l)

  // ---- the order to start from: the flow, followed in id order
  const next = new Map<string, Set<string>>()
  const link = (a: string, b: string) => {
    next.set(a, (next.get(a) ?? new Set()).add(b))
    next.set(b, (next.get(b) ?? new Set()).add(a))
  }
  const flowDown = new Map<string, Set<string>>()
  for (const { upper, lower } of problem.above) {
    flowDown.set(upper, (flowDown.get(upper) ?? new Set()).add(lower))
    link(upper, lower)
  }
  for (const { a, b } of problem.level) link(a, b)
  for (const s of problem.satellites) link(s.item, s.partner)
  const visit = new Map<string, number>()
  const walk = (id: string) => {
    if (visit.has(id)) return
    visit.set(id, visit.size)
    const out = flowDown.get(id)
    for (const n of [...(out ?? [])].sort(compare)) walk(n)
    for (const n of [...(next.get(id) ?? [])].sort(compare)) walk(n)
  }
  const ids = problem.items.map((i) => i.id).sort(compare)
  for (const id of ids.filter((i) => rankOf(i) === 0)) walk(id)
  for (const id of ids) walk(id)
  const firstVisit = (key: string): number => {
    const f = frameOfKey.get(key)
    if (f !== undefined)
      return Math.min(
        Number.POSITIVE_INFINITY,
        ...(tree.within.get(f) ?? []).map((i) => visit.get(i.id) ?? 0),
      )
    const d = dummies.get(key)
    if (d) {
      const l = problem.lines.find((x) => x.id === d.lines[0])
      return l ? ((visit.get(l.a.item) ?? 0) + (visit.get(l.b.item) ?? 0)) / 2 : 0
    }
    return visit.get(key) ?? 0
  }

  const rows: Map<FrameId, Row> = new Map()
  for (const frame of problem.frames) {
    const here = tree.itemsIn.get(frame.id) ?? []
    const keys = [
      ...here.filter((i) => !anchors.has(i.id) && !free.has(i.id)).map((i) => i.id),
      ...(tree.framesIn.get(frame.id) ?? []).map((f) => frameKey(f.id)),
      ...[...dummies.values()].filter((d) => d.frame === frame.id).map((d) => d.key),
    ].sort((p, q) => firstVisit(p) - firstVisit(q) || compare(p, q))
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
      tail: here
        .filter((i) => free.has(i.id))
        .map((i) => i.id)
        .sort(compare),
    })
  }
  const members0 = new Map<ItemId, NodeId[]>(
    problem.items
      .filter((i) => i.kind === 'unit')
      .map((i) => [
        i.id,
        [...(hints.members?.get(i.id) ?? (i.members ?? []).map((m) => m.node.id).sort(compare))],
      ]),
  )

  // ---- the rows, from an order
  const flatten = (s: State): Flat => {
    const seq: string[][] = Array.from({ length: ranks.max + 1 }, () => [])
    const emit = (key: string) => {
      const inner = frameOfKey.get(key)
      if (inner !== undefined) return visitFrame(inner)
      const d = dummies.get(key)
      if (d) return void seq[d.rank]?.push(key)
      const item = items.get(key)
      if (!item) return
      if (item.kind === 'unit') for (const m of s.members.get(key) ?? []) seq[rankOf(key)]?.push(m)
      else seq[rankOf(key)]?.push(key)
    }
    const visitFrame = (f: FrameId) => {
      const row = s.rows.get(f)
      if (!row) return
      for (const c of row.movable) for (const k of [c.anchor, ...c.satellites]) emit(k)
      for (const k of row.tail) emit(k)
    }
    visitFrame('')
    const pos = new Map<string, number>()
    for (const row of seq) for (const [i, k] of row.entries()) pos.set(k, i)
    return { seq, pos }
  }

  // ---- what an order costs
  const inversions = (pairs: { p: number; q: number; w: number }[], width: number): number => {
    pairs.sort((x, y) => x.p - y.p || x.q - y.q)
    const tree_ = new Float64Array(width + 2)
    let total = 0
    let count = 0
    const add = (i: number, w: number) => {
      for (let x = i + 1; x < tree_.length; x += x & -x) tree_[x] = (tree_[x] ?? 0) + w
    }
    const upTo = (i: number) => {
      let sum = 0
      for (let x = i + 1; x > 0; x -= x & -x) sum += tree_[x] ?? 0
      return sum
    }
    for (let i = 0; i < pairs.length; ) {
      let j = i
      while (j < pairs.length && pairs[j]?.p === pairs[i]?.p) j++
      for (let k = i; k < j; k++) {
        const e = pairs[k]
        if (e) count += e.w * (total - upTo(e.q))
      }
      for (let k = i; k < j; k++) {
        const e = pairs[k]
        if (e) {
          add(e.q, e.w)
          total += e.w
        }
      }
      i = j
    }
    return count
  }
  const gapCost = (g: number, f: Flat): number => {
    const list = gapSegs[g] ?? []
    const width = f.seq[g + 1]?.length ?? 0
    return inversions(
      list.map((s) => ({ p: f.pos.get(s.a) ?? 0, q: f.pos.get(s.b) ?? 0, w: s.w })),
      width,
    )
  }
  const levelCost = (r: number, f: Flat): number => {
    let cost = 0
    const row = f.seq[r] ?? []
    for (const l of levelsAt[r] ?? []) {
      const [p, q] = [f.pos.get(l.a) ?? 0, f.pos.get(l.b) ?? 0].sort((x, y) => x - y)
      let up = 0
      let down = 0
      for (const e of row.slice((p ?? 0) + 1, q)) {
        up += degUp.get(e) ?? 0
        down += degDown.get(e) ?? 0
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
      .filter((f) => f.id !== '' && reaches(f.id, g) && reaches(f.id, g + 1))
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
    const list = gapSegs[g] ?? []
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
  const costs = (f: Flat) => ({
    wall: Array.from({ length: ranks.max }, (_, g) => wallCost(g, f)),
    gap: Array.from({ length: ranks.max }, (_, g) => gapCost(g, f)),
    level: Array.from({ length: ranks.max + 1 }, (_, r) => levelCost(r, f)),
  })
  type Costs = ReturnType<typeof costs>
  /** The walls first, then the crossings: a cost is better when it is less in that order. */
  const total = (c: Costs): [number, number] => [
    c.wall.reduce((s, x) => s + x, 0),
    c.gap.reduce((s, x) => s + x, 0) + c.level.reduce((s, x) => s + x, 0),
  ]
  // Lengths come last: the places the contents would stand at if each rank's row were stacked
  // from the left, a frame's stretch as wide as the widest row it holds, so that what the
  // crossings cannot tell apart is put by how far apart the lines' ends would be.
  const widthOfKey = (k: string): number => {
    if (dummies.has(k)) return 0
    const owner = ownerOf.get(k)
    const item = owner === undefined ? undefined : items.get(owner)
    if (!item) return 0
    if (owner === k) return item.size.width
    return (item.members ?? []).find((m) => m.node.id === k)?.size.width ?? 0
  }
  const lengthOf = (s: State): number => {
    const cursor = new Array<number>(ranks.max + 1).fill(0)
    const at = new Map<string, number>()
    const emit = (key: string) => {
      const inner = frameOfKey.get(key)
      if (inner !== undefined) return visitFrame(inner)
      const d = dummies.get(key)
      if (d) return void at.set(key, cursor[d.rank] ?? 0)
      const item = items.get(key)
      if (!item) return
      const r = rankOf(key)
      for (const k of item.kind === 'unit' ? (s.members.get(key) ?? []) : [key]) {
        const w = widthOfKey(k)
        at.set(k, (cursor[r] ?? 0) + w / 2)
        cursor[r] = (cursor[r] ?? 0) + w + problem.metrics.gap
      }
    }
    const visitFrame = (f: FrameId) => {
      const row = s.rows.get(f)
      const span = ranks.span.get(frameKey(f)) ?? [0, ranks.max]
      const rs = range(span[0], span[1])
      const start = Math.max(0, ...rs.map((r) => cursor[r] ?? 0))
      for (const r of rs) cursor[r] = start
      if (row) {
        for (const c of row.movable) for (const k of [c.anchor, ...c.satellites]) emit(k)
        for (const k of row.tail) emit(k)
      }
      const end = Math.max(0, ...rs.map((r) => cursor[r] ?? 0))
      for (const r of rs) cursor[r] = end
    }
    visitFrame('')
    let total = 0
    for (const seg of segs.values())
      total += Math.abs((at.get(seg.a) ?? 0) - (at.get(seg.b) ?? 0)) * seg.w
    return total
  }
  /** The walls first, then the crossings, then the lengths: better when less in that order. */
  const better = (a: [number, number], sa: State, b: [number, number], sb: State) =>
    a[0] < b[0] ||
    (a[0] === b[0] && (a[1] < b[1] || (a[1] === b[1] && lengthOf(sa) < lengthOf(sb))))

  // ---- one sweep
  const elementsAt = (s: State, key: string, r: number): string[] => {
    const inner = frameOfKey.get(key)
    if (inner !== undefined) {
      const row = s.rows.get(inner)
      if (!row) return []
      return [...row.movable.flatMap((c) => [c.anchor, ...c.satellites]), ...row.tail].flatMap(
        (k) => elementsAt(s, k, r),
      )
    }
    const d = dummies.get(key)
    if (d) return d.rank === r ? [key] : []
    const item = items.get(key)
    if (!item || rankOf(key) !== r) return []
    return item.kind === 'unit' ? (s.members.get(key) ?? []) : [key]
  }
  const sweepOnce = (start: State, dir: 'down' | 'up'): State => {
    let s = start
    let f = flatten(s)
    const place = (k: string) => {
      const r = rankOf(ownerOf.get(k) ?? k)
      const rr = dummies.get(k)?.rank ?? r
      return ((f.pos.get(k) ?? 0) + 0.5) / Math.max(1, f.seq[rr]?.length ?? 1)
    }
    const around = (k: string): number[] => {
      const a = adj.get(k)
      if (!a) return []
      return [...(dir === 'down' ? a.up : a.down), ...a.level].map(place)
    }
    const order = dir === 'down' ? range(1, ranks.max) : range(0, ranks.max - 1).reverse()
    for (const r of order) {
      const members = new Map(s.members)
      for (const [unit, list] of s.members) {
        const item = items.get(unit)
        if (!item || rankOf(unit) !== r || hints.members?.has(unit)) continue
        const keyed = list.map((m, i) => {
          const xs = around(m)
          return { m, i, at: xs.length > 0 ? median(xs) : undefined }
        })
        keyed.sort((p, q) =>
          p.at === undefined || q.at === undefined ? p.i - q.i : p.at - q.at || compare(p.m, q.m),
        )
        members.set(
          unit,
          keyed.map((k) => k.m),
        )
      }
      const rowsNow = new Map(s.rows)
      for (const frame of problem.frames) {
        const row = rowsNow.get(frame.id)
        if (!row) continue
        const present: { c: Cluster; at: number; slot: number }[] = []
        for (const [slot, c] of row.movable.entries()) {
          const els = [c.anchor, ...c.satellites].flatMap((k) =>
            elementsAt({ rows: s.rows, members }, k, r),
          )
          if (els.length === 0) continue
          const xs = els.flatMap(around)
          const own = els.map(place)
          present.push({ c, slot, at: median(xs.length > 0 ? xs : own) })
        }
        const sorted = [...present].sort((p, q) => p.at - q.at || p.slot - q.slot)
        const movable = [...row.movable]
        for (const [i, p] of present.entries()) {
          const put = sorted[i]
          if (put) movable[p.slot] = put.c
        }
        rowsNow.set(frame.id, { ...row, movable: pinned(frame.id, movable) })
      }
      s = { rows: rowsNow, members }
      f = flatten(s)
    }
    return s
  }
  const pinned = (frame: FrameId, movable: Cluster[]): Cluster[] => {
    const hint = hints.order?.get(frame)
    if (!hint) return movable
    const slots = movable.flatMap((c, i) => (hint.includes(c.anchor) ? [i] : []))
    const named = movable
      .filter((c) => hint.includes(c.anchor))
      .sort((p, q) => hint.indexOf(p.anchor) - hint.indexOf(q.anchor))
    const out = [...movable]
    for (const [i, slot] of slots.entries()) {
      const c = named[i]
      if (c) out[slot] = c
    }
    return out
  }
  const name = (s: State) =>
    JSON.stringify([
      [...s.rows].map(([f, r]) => [f, r.movable.map((c) => [c.anchor, c.satellites]), r.tail]),
      [...s.members],
    ])

  let current: State = {
    rows: new Map([...rows].map(([f, r]) => [f, { ...r, movable: pinned(f, r.movable) }])),
    members: members0,
  }
  let best = current
  let bestCost = total(costs(flatten(current)))
  const seen = new Set<string>()
  for (let dir: 'down' | 'up' = 'down'; ; dir = dir === 'down' ? 'up' : 'down') {
    const turn = `${dir} ${name(current)}`
    if (seen.has(turn)) break
    seen.add(turn)
    current = sweepOnce(current, dir)
    const c = total(costs(flatten(current)))
    if (better(c, current, bestCost, best)) {
      bestCost = c
      best = current
    }
  }
  current = best

  // ---- neighbours swapped where that leaves fewer crossings
  let flat = flatten(current)
  let cost = costs(flat)
  const hinted = (frame: FrameId, a: string, b: string) => {
    const h = hints.order?.get(frame)
    return h?.includes(a) === true && h.includes(b)
  }
  for (let changed = true; changed; ) {
    changed = false
    for (const frame of problem.frames) {
      const row = current.rows.get(frame.id)
      if (!row) continue
      for (let k = 0; k + 1 < row.movable.length; k++) {
        const now = current.rows.get(frame.id)
        const [c1, c2] = [now?.movable[k], now?.movable[k + 1]]
        if (!now || !c1 || !c2 || hinted(frame.id, c1.anchor, c2.anchor)) continue
        const swapped = [...now.movable]
        swapped[k] = c2
        swapped[k + 1] = c1
        const trial: State = {
          rows: new Map(current.rows).set(frame.id, { ...now, movable: swapped }),
          members: current.members,
        }
        const tf = flatten(trial)
        const touched = new Set(
          [c1, c2].flatMap((c) => [c.anchor, ...c.satellites]).flatMap((key) => spanOf(key)),
        )
        const tc: Costs = {
          wall: cost.wall.map((v, g) =>
            touched.has(g) || touched.has(g + 1) ? wallCost(g, tf) : v,
          ),
          gap: cost.gap.map((v, g) => (touched.has(g) || touched.has(g + 1) ? gapCost(g, tf) : v)),
          level: cost.level.map((v, r) => (touched.has(r) ? levelCost(r, tf) : v)),
        }
        if (better(total(tc), trial, total(cost), current)) {
          current = trial
          flat = tf
          cost = tc
          changed = true
        }
      }
    }
  }
  function spanOf(key: string): number[] {
    const d = dummies.get(key)
    const s = d ? [d.rank, d.rank] : ranks.span.get(key)
    return s ? range(s[0], s[1]) : []
  }

  const dummyList = [...dummies.values()].sort((p, q) => compare(p.key, q.key))
  for (const d of dummyList) d.lines.sort(compare)
  const elementOf = (k: string): Element => {
    const d = dummies.get(k)
    return d ?? { kind: 'box', key: k, item: ownerOf.get(k) ?? k }
  }
  return {
    ranks,
    sequences: flat.seq.map((row) => row.map(elementOf)),
    siblings: new Map(
      [...current.rows].map(([f, r]) => [
        f,
        [...r.movable.flatMap((c) => [c.anchor, ...c.satellites]), ...r.tail],
      ]),
    ),
    members: current.members,
    position: flat.pos,
    dummies,
    crossings: total(cost)[1],
    byGap: { gap: cost.gap, level: cost.level },
  }
}

function range(lo: number, hi: number): number[] {
  const out: number[] = []
  for (let i = lo; i <= hi; i++) out.push(i)
  return out
}

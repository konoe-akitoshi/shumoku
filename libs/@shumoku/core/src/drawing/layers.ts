// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { compare } from '../structure/keys.js'
import type { NodeId } from '../structure/types.js'
import { portId } from './ports.js'
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
  /** The ports on the top and bottom of each box (`box side`), left to right. */
  ports: ReadonlyMap<string, readonly string[]>
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
  /** The ports (by `ports` key) the segment starts and ends at; none where it meets a dummy. */
  pa: string
  pb: string
}
interface Looked {
  get(key: string): number | undefined
}
/** The rows with the places in them; a trial's are the base's with what it changed laid over. */
interface Flat {
  seq: string[][]
  pos: Looked
  /** Where each port stands: its box's place and a part of it. */
  end: Looked
}
interface Whole extends Flat {
  pos: Map<string, number>
  end: Map<string, number>
  /** The ports of each side of a box, in order along it. */
  ports: Map<string, string[]>
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
  options: { verify?: boolean } = {},
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
  /** Each port on a top or bottom side: its box and side, and the places its lines lead to. */
  const portInfo = new Map<string, { box: string; side: 'top' | 'bottom'; partners: string[] }>()
  const portOf = (end: Line['a'], which: 'a' | 'b', line: Line, side: 'top' | 'bottom'): string => {
    const id = `${portId(end.node ?? end.item, end.port, line.id, which)}|${side}`
    if (!portInfo.has(id)) portInfo.set(id, { box: boxKey(end), side, partners: [] })
    return id
  }
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
    const loPort = portOf(lo, lo === line.a ? 'a' : 'b', line, 'bottom')
    const hiPort = portOf(hi, hi === line.a ? 'a' : 'b', line, 'top')
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
      const pa = r === rlo + 1 ? loPort : ''
      const pb = r === rhi ? hiPort : ''
      const key = [r - 1, before, here, pa, pb].join('|')
      const seg = segs.get(key) ?? { gap: r - 1, a: before, b: here, w: 0, allowed, pa, pb }
      if (pa) portInfo.get(pa)?.partners.push(here)
      if (pb) portInfo.get(pb)?.partners.push(before)
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
  // the roots stand in the order the reader named the boundary, then the rest of rank 0 by id
  for (const id of problem.boundary.filter((i) => items.has(i))) walk(id)
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

  interface PortGroup {
    key: string
    box: string
    side: 'top' | 'bottom'
    ids: string[]
    partners: string[][]
  }
  const portGroups: PortGroup[] = []
  {
    const byBox = new Map<string, string[]>()
    const sides = new Map<string, 'top' | 'bottom'>()
    for (const [id, info] of [...portInfo].sort((p, q) => compare(p[0], q[0]))) {
      const key = `${info.box}\0${info.side}`
      byBox.set(key, [...(byBox.get(key) ?? []), id])
      sides.set(key, info.side)
    }
    for (const [key, ids] of byBox)
      portGroups.push({
        key,
        box: key.slice(0, key.indexOf('\0')),
        side: sides.get(key) ?? 'top',
        ids,
        partners: ids.map((id) => portInfo.get(id)?.partners ?? []),
      })
  }

  const groupsAt: PortGroup[][] = Array.from({ length: ranks.max + 1 }, () => [])
  for (const g of portGroups) groupsAt[rankOf(ownerOf.get(g.box) ?? g.box)]?.push(g)

  // ---- the rows, from an order
  const flatten = (s: State): Whole => {
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
    // the ports of a side stand in the order of the places their lines lead to
    const ports = new Map<string, string[]>()
    const end = new Map<string, number>()
    for (const g of portGroups) {
      const sorted = portsOf(g, (k) => pos.get(k))
      ports.set(g.key, sorted)
      for (const [id, at] of endsOf(g, sorted, (k) => pos.get(k))) end.set(id, at)
    }
    return { seq, pos, end, ports }
  }
  const portsOf = (g: PortGroup, at: (k: string) => number | undefined): string[] => {
    if (g.ids.length < 2) return g.ids
    const where = g.partners.map((ps) => {
      if (ps.length === 1) return at(ps[0] ?? '') ?? 0
      return median(ps.map((k) => at(k) ?? 0))
    })
    return g.ids
      .map((id, i) => ({ id, at: where[i] ?? 0, i }))
      .sort((p, q) => p.at - q.at || p.i - q.i)
      .map((e) => e.id)
  }
  const endsOf = (
    g: PortGroup,
    sorted: readonly string[],
    at: (k: string) => number | undefined,
  ): [string, number][] =>
    sorted.map((id, k): [string, number] => [id, (at(g.box) ?? 0) + (k + 0.5) / sorted.length])

  // ---- what an order costs
  const inversions = (pairs: { p: number; q: number; w: number }[]): number => {
    pairs.sort((x, y) => x.p - y.p || x.q - y.q)
    const dense = new Map(
      [...new Set(pairs.map((e) => e.q))].sort((x, y) => x - y).map((q, i) => [q, i]),
    )
    pairs = pairs.map((e) => ({ ...e, q: dense.get(e.q) ?? 0 }))
    const tree_ = new Float64Array(dense.size + 2)
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
    const place = (key: string, port: string) =>
      (port ? f.end.get(port) : undefined) ?? (f.pos.get(key) ?? 0) + 0.5
    return inversions(list.map((s) => ({ p: place(s.a, s.pa), q: place(s.b, s.pb), w: s.w })))
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
  // Lengths come last: where each line's ends would stand if the contents were packed to the
  // left by the room their ports take (a box is as many slots wide as it has line ends, and
  // slots stand a slot apart: counted from the relations, so that a font which measures a little
  // differently decides nothing here), in the order of the rows (a frame is one stretch across all the ranks it
  // holds, siblings that share a rank or are not related by the flow stand side by side, and
  // siblings the flow stacks block nothing of each other). This is an estimate from the contents,
  // not the coordinates stage 7 solves, which differ by what the lines pull.
  const ends = new Map<string, number>()
  for (const line of problem.lines) {
    if (line.role === 'inside') continue
    for (const end of [line.a, line.b]) ends.set(boxKey(end), (ends.get(boxKey(end)) ?? 0) + 1)
  }
  const widthOfKey = (k: string): number => (dummies.has(k) ? 0 : Math.max(1, ends.get(k) ?? 0))
  const spanOfKey = (k: string): readonly [number, number] => {
    const d = dummies.get(k)
    if (d) return [d.rank, d.rank]
    return ranks.span.get(k) ?? [rankOf(k), rankOf(k)]
  }
  // the siblings that must stand beside each other though they share no rank
  const apartKids = new Map<string, string[]>()
  for (const [f, row] of rows) {
    void f
    const kids = [...row.movable.flatMap((c) => [c.anchor, ...c.satellites]), ...row.tail].filter(
      (k) => !dummies.has(k),
    )
    for (const a of kids) {
      for (const b of kids) {
        if (a === b) continue
        const [sa, sb] = [spanOfKey(a), spanOfKey(b)]
        if ((sa[1] < sb[0] || sb[1] < sa[0]) && !ranks.ordered(a, b))
          apartKids.set(a, [...(apartKids.get(a) ?? []), b])
      }
    }
  }
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
        const [lo, hi] = spanOfKey(k)
        let left = base
        for (let r = lo; r <= hi; r++) left = Math.max(left, edgeAt(r))
        for (const b of apartKids.get(k) ?? []) left = Math.max(left, right.get(b) ?? base)
        const inner = frameOfKey.get(k)
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
    let total = 0
    for (const seg of segs.values())
      total += Math.abs((at.get(seg.a) ?? 0) - (at.get(seg.b) ?? 0)) * seg.w
    lengths.set(s, total)
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

  const initial: State = {
    rows: new Map([...rows].map(([f, r]) => [f, { ...r, movable: pinned(f, r.movable) }])),
    members: members0,
  }
  /** The sweeps from an order, then sifting from the best of them. */
  const search = (start: State): State => {
    let current = start
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

    // ---- sifting: each child of a frame tried at every place among its siblings, with what its
    // lines lead to set again: the dummies of the frame on them, and the boxes of the frame at
    // their far ends, each by the median of the places on both sides, the nearest first
    let flat: Whole = flatten(current)
    let cost = costs(flat)
    const hintedKey = (frame: FrameId, a: string) => hints.order?.get(frame)?.includes(a) === true
    for (let changed = true; changed; ) {
      changed = false
      for (const frame of problem.frames) {
        const n = current.rows.get(frame.id)?.movable.length ?? 0
        for (let k = 0; k < n; k++) {
          const row = current.rows.get(frame.id)
          const c = row?.movable[k]
          if (!row || !c || hintedKey(frame.id, c.anchor)) continue
          const mine = [c.anchor, ...c.satellites]
          const trail = trailOf(mine).filter(
            (key) => ownerFrame(key) === frame.id && !hintedKey(frame.id, key),
          )
          const rest = row.movable.filter((x) => x !== c)
          let best: { state: State; cost: Costs } = { state: current, cost }
          // only the siblings it shares a rank with, or must stand beside, tell one place from
          // another: it is tried just after each of them, and first of all
          const places = new Set<number>([0, k])
          for (const [i, o] of rest.entries()) {
            const theirs = [o.anchor, ...o.satellites]
            const meets = mine.some((m) =>
              theirs.some((t) => {
                const [sm, st] = [spanOfKey(m), spanOfKey(t)]
                return (sm[0] <= st[1] && st[0] <= sm[1]) || (apartKids.get(m) ?? []).includes(t)
              }),
            )
            if (meets) places.add(i + 1)
          }
          for (const at of [...places].sort((x, y) => x - y)) {
            const moved = [...rest.slice(0, at), c, ...rest.slice(at)]
            const { trial, tf, same } = settle(current, flat, frame.id, row, moved, mine, trail)
            // only the gaps beside a row that changed are counted again
            const tc: Costs = {
              wall: cost.wall.map((v, g) => (same(g) && same(g + 1) ? v : wallCost(g, tf))),
              gap: cost.gap.map((v, g) => (same(g) && same(g + 1) ? v : gapCost(g, tf))),
              level: cost.level.map((v, r) => (same(r) ? v : levelCost(r, tf))),
            }
            if (options.verify) agree(tc, costs(flatten(trial)))
            if (better(total(tc), trial, total(best.cost), best.state))
              best = { state: trial, cost: tc }
          }
          if (best.state !== current) {
            current = best.state
            flat = flatten(current)
            stretchCache.clear()
            cost = best.cost
            changed = true
          }
        }
      }
    }
    return current
  }
  const agree = (fast: Costs, slow: Costs) => {
    if (JSON.stringify(fast) !== JSON.stringify(slow))
      throw new Error(`incremental costs differ: ${JSON.stringify(fast)} ${JSON.stringify(slow)}`)
  }
  const ownerFrame = (key: string): FrameId | undefined =>
    dummies.get(key)?.frame ?? items.get(key)?.frame
  /**
   * The lines that end in the given children, each from its end outwards, nearer ranks first:
   * the keys of the dummies on them and of the box at the far end.
   */
  const trails = new Map<string, string[]>()
  const trailOf = (mine: readonly string[]): string[] => {
    const id = mine.join('\0')
    const known = trails.get(id)
    if (known) return known
    const inside = new Set(
      mine.flatMap((key) => {
        const f = frameOfKey.get(key)
        return f === undefined ? [key] : (tree.within.get(f) ?? []).map((i) => i.id)
      }),
    )
    const found: { key: string; dist: number; line: string }[] = []
    for (const line of problem.lines) {
      if (line.role === 'inside' || line.a.item === line.b.item) continue
      const [ina, inb] = [inside.has(line.a.item), inside.has(line.b.item)]
      if (ina === inb) continue
      const [mineEnd, other] = ina ? [line.a, line.b] : [line.b, line.a]
      const [from, to] = [rankOf(mineEnd.item), rankOf(other.item)]
      const step = to > from ? 1 : -1
      for (let r = from + step; r !== to && to !== from; r += step)
        found.push({ key: `dummy:${line.family}@${r}`, dist: Math.abs(r - from), line: line.id })
      found.push({ key: other.item, dist: Math.abs(to - from), line: line.id })
    }
    found.sort((p, q) => p.dist - q.dist || compare(p.line, q.line) || compare(p.key, q.key))
    const out = [...new Set(found.map((f) => f.key))].filter(
      (key) => dummies.has(key) || items.has(key),
    )
    trails.set(id, out)
    return out
  }
  /** The nodes an element stands in, innermost first, each with the frame it is a child of. */
  const chains = new Map<string, { node: string; parent: FrameId }[]>()
  const chainOfElement = (k: string) => {
    const known = chains.get(k)
    if (known) return known
    const d = dummies.get(k)
    const owner = d ? k : (ownerOf.get(k) ?? k)
    const out = [{ node: owner, parent: d ? d.frame : (items.get(owner)?.frame ?? '') }]
    for (let f = out[0]?.parent; f !== undefined && f !== ''; f = parentFrame.get(f))
      out.push({ node: frameKey(f), parent: parentFrame.get(f) ?? '' })
    chains.set(k, out)
    return out
  }
  /** The children of a frame in each row of the order in hand, by frame and rank. */
  const stretchCache = new Map<string, { node: string; lo: number; hi: number }[]>()
  const kids = new Map<FrameId, Map<string, string | null>>()
  /** The child of a frame an element stands in, if it stands in the frame. */
  const nodeIn = (frame: FrameId, k: string): string | undefined => {
    let m = kids.get(frame)
    if (!m) {
      m = new Map()
      kids.set(frame, m)
    }
    let node = m.get(k)
    if (node === undefined) {
      node = chainOfElement(k).find((c) => c.parent === frame)?.node ?? null
      m.set(k, node)
    }
    return node ?? undefined
  }
  /**
   * The rows after a child is put at a place of its frame, and what its lines lead to set
   * again: each is taken from its place in its own rank's row and put among the frame's
   * children by the median of where what lies before and after it stands. Only the rows that
   * change are copied; `same(r)` tells of the rows that did not.
   */
  const settle = (
    from: State,
    base: Flat,
    frame: FrameId,
    row: Row,
    moved: Cluster[],
    mine: readonly string[],
    trail: readonly string[],
  ): { trial: State; tf: Flat; same: (r: number) => boolean } => {
    const fresh = new Map<number, string[]>()
    const over = new Map<string, number>()
    const rowAt = (r: number) => fresh.get(r) ?? base.seq[r] ?? []
    const posAt = (k: string) => over.get(k) ?? base.pos.get(k)
    const edit = (r: number): string[] => {
      let x = fresh.get(r)
      if (!x) {
        x = [...(base.seq[r] ?? [])]
        fresh.set(r, x)
      }
      return x
    }
    const reindex = (r: number, lo: number, hi: number) => {
      const x = fresh.get(r) ?? []
      for (let i = lo; i <= hi; i++) over.set(x[i] ?? '', i)
    }
    /** The frame's children in a row, left to right, each with the stretch it fills. */
    const stretchesOf = (r: number) => {
      const cached = fresh.has(r) ? undefined : stretchCache.get(`${frame}|${r}`)
      if (cached) return cached
      const x = rowAt(r)
      const out: { node: string; lo: number; hi: number }[] = []
      let started = false
      for (const [i, k] of x.entries()) {
        const node = nodeIn(frame, k)
        if (node === undefined) {
          if (started) break
          continue
        }
        started = true
        const last = out[out.length - 1]
        if (last && last.node === node) last.hi = i
        else out.push({ node, lo: i, hi: i })
      }
      if (!fresh.has(r)) stretchCache.set(`${frame}|${r}`, out)
      return out
    }
    const nodesAt = (list: Cluster[]) => {
      const order = new Map<string, number>()
      const cluster = new Map<string, number>()
      let i = 0
      for (const [j, c] of list.entries())
        for (const n of [c.anchor, ...c.satellites]) {
          order.set(n, i++)
          cluster.set(n, j)
        }
      return { order, cluster }
    }
    let movable = moved
    // the child at its place: the frame's stretch of each row it fills, in the order of the children
    {
      const { order } = nodesAt(movable)
      for (const r of new Set(mine.flatMap((key) => spanOf(key)))) {
        const groups = stretchesOf(r)
        const sorted = [...groups].sort(
          (p, q) => (order.get(p.node) ?? 1e9) - (order.get(q.node) ?? 1e9),
        )
        if (sorted.every((g, i) => g === groups[i])) continue
        const x = edit(r)
        const old = [...x]
        const lo = groups[0]?.lo ?? 0
        const hi = groups[groups.length - 1]?.hi ?? 0
        x.splice(lo, hi - lo + 1, ...sorted.flatMap((g) => old.slice(g.lo, g.hi + 1)))
        reindex(r, lo, hi)
      }
    }
    const placeAt = (k: string) => {
      const rr = dummies.get(k)?.rank ?? rankOf(ownerOf.get(k) ?? k)
      return ((posAt(k) ?? 0) + 0.5) / Math.max(1, rowAt(rr).length)
    }
    let nodes = nodesAt(movable)
    for (const key of trail) {
      const rank = dummies.get(key)?.rank ?? rankOf(key)
      const { cluster } = nodes
      const at = cluster.get(key)
      if (at === undefined || movable[at]?.anchor !== key) continue
      const x = rowAt(rank)
      // the stretch of the child with its satellites, and of each other child
      const span = new Map<number, [number, number]>()
      for (const g of stretchesOf(rank)) {
        const j = cluster.get(g.node)
        if (j === undefined) continue
        const known = span.get(j)
        if (known) span.set(j, [Math.min(known[0], g.lo), Math.max(known[1], g.hi)])
        else span.set(j, [g.lo, g.hi])
      }
      const own = span.get(at)
      if (!own) continue
      const near = x
        .slice(own[0], own[1] + 1)
        .flatMap((k) => [
          ...(adj.get(k)?.up ?? []),
          ...(adj.get(k)?.down ?? []),
          ...(adj.get(k)?.level ?? []),
        ])
        .map(placeAt)
      if (near.length === 0) continue
      const want = median(near)
      // the first child to the right of the wanted place, else after the last
      let before = -1
      let beforeFrom = 0
      let last = -1
      let lastTo = 0
      for (const j of [...span.keys()].sort((p, q) => p - q)) {
        const s = span.get(j)
        if (j === at || !s) continue
        last = j
        lastTo = s[1]
        if (before < 0 && ((s[0] + s[1]) / 2 + 0.5) / x.length > want) {
          before = j
          beforeFrom = s[0]
        }
      }
      if (last < 0) continue
      const [slot, p] = before >= 0 ? [before, beforeFrom] : [last + 1, lastTo + 1]
      const len = own[1] - own[0] + 1
      const to = p > own[0] ? p - len : p
      if (to === own[0]) continue
      const y = edit(rank)
      const block = y.splice(own[0], len)
      y.splice(to, 0, ...block)
      reindex(rank, Math.min(own[0], to), Math.max(own[0], to) + len - 1)
      const others = movable.filter((_, j) => j !== at)
      const cut = slot > at ? slot - 1 : slot
      const cl = movable[at]
      if (cl) movable = [...others.slice(0, cut), cl, ...others.slice(cut)]
      nodes = nodesAt(movable)
    }
    // the rows that came out as they were are not changed rows
    for (const [r, x] of fresh) {
      const was = base.seq[r] ?? []
      if (x.length === was.length && x.every((k, i) => k === was[i])) fresh.delete(r)
    }
    // the ports beside a changed row stand again
    const ends = new Map<string, number>()
    const stood = new Set<PortGroup>()
    for (const r of fresh.keys()) {
      for (const g of groupsAt[r] ?? []) stood.add(g)
      for (const g of groupsAt[r - 1] ?? []) if (g.side === 'bottom') stood.add(g)
      for (const g of groupsAt[r + 1] ?? []) if (g.side === 'top') stood.add(g)
    }
    for (const g of stood)
      for (const [id, at] of endsOf(g, portsOf(g, posAt), posAt)) ends.set(id, at)
    return {
      trial: { rows: new Map(from.rows).set(frame, { ...row, movable }), members: from.members },
      tf: {
        seq: base.seq.map((x, r) => fresh.get(r) ?? x),
        pos: { get: posAt },
        end: { get: (k) => ends.get(k) ?? base.end.get(k) },
      },
      same: (r) => !fresh.has(r),
    }
  }
  const current = search(initial)
  const flat = flatten(current)
  const cost = costs(flat)
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
    ports: flat.ports,
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

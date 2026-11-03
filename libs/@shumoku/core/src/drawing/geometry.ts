// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { splitKey } from '../structure/keys.js'
import { type AxisInput, solveAxis } from './axis.js'
import { type Corridors, columnKey } from './corridors.js'
import { cornerOf, flowRoom, haloOf, jogLeastOf, keepOff, pitchOf, snapOf, whiteOf } from './kin.js'
import { lanesOf } from './lane-order.js'
import type { Layers } from './layers.js'
import { ledgerOf } from './ledger.js'
import type { Box, Point } from './metrics.js'
import {
  type FrameId,
  frameKey,
  type Geometry,
  type Item,
  linesById,
  type Problem,
  ROOT,
} from './problem.js'
import type { Ranks } from './ranks.js'
import type { Routes } from './routes.js'
import type { Scene } from './scene.js'
import { type Lane, type Tracks, type Var, varKey } from './tracks.js'
import { treeOf } from './tree.js'
import { wiresOf } from './wires.js'

export interface Placed {
  geometry: Geometry
  wires: Map<string, Point[]>
  ports: NonNullable<Scene['ports']>
  /** What the solution does not keep: separations short of their distance, values out of their room. */
  unmet: { separations: number; bounds: number }
  /** What the orders of the runs along the rows cost in crossings. */
  laneCrossings: number
  /** By gap, what each stage counts as crossings (a check: the stages should agree). */
  table: { gap: number; layers: number; lanesLeast: number; lanes: number; drawn: number }[]
  /** Each drawn crossing: the horizontal and the vertical line, the band, and where. */
  crossingList: {
    h: string
    v: string
    gap: number
    x: number
    y: number
    vFrom: number
    vTo: number
  }[]
}

/** A place on an axis: a variable and a fixed offset from it. */
interface Ref {
  v: number
  off: number
}
interface Sep {
  i: number
  j: number
  d: number
}

/** `later` at least `gap` after `earlier`. */
const after = (earlier: Ref, later: Ref, gap: number): Sep => ({
  i: earlier.v,
  j: later.v,
  d: gap + earlier.off - later.off,
})
/** Two places that are one. */
const same = (a: Ref, b: Ref): Sep => ({ i: a.v, j: b.v, d: a.off - b.off })

interface Sys {
  n: number
  names: string[]
  sep: Sep[]
  equal: Sep[]
  pair: AxisInput['pair']
}
const newSys = (): Sys => ({ n: 0, names: [], sep: [], equal: [], pair: [] })

/**
 * Where everything stands. The heights are solved first and the widths after, each axis as one
 * system of separations and equalities fixed by the orders of the stages before, so a length
 * never changes an order. Only the stretches that were left a hair short of a straight line are
 * looked at once the widths are solved (the band a jog is too small to be drawn in).
 */
export function placeAll(
  problem: Problem,
  ranks: Ranks,
  layers: Layers,
  corridors: Corridors,
  _routes: Routes,
  tracks: Tracks,
): Placed {
  const { metrics } = problem
  const byLine = linesById(problem)
  const tree = treeOf(problem)
  const { nodes } = corridors
  const frames = new Map(problem.frames.map((f) => [f.id, f]))
  const frameOfKey = new Map(problem.frames.map((f) => [frameKey(f.id), f.id]))
  const isFrame = (k: string) => frameOfKey.has(k)
  const tolerance = snapOf(metrics)

  // ---- the boxes: items, and the members of units at their place inside the outline
  interface BoxInfo {
    item: Item
    ox: number
    oy: number
    w: number
    h: number
  }
  const boxes = new Map<string, BoxInfo>()
  for (const item of problem.items) {
    boxes.set(item.id, { item, ox: 0, oy: 0, w: item.size.width, h: item.size.height })
    if (item.kind !== 'unit') continue
    const sizes = new Map((item.members ?? []).map((m) => [m.node.id, m.size]))
    const tallest = Math.max(0, ...[...sizes.values()].map((s) => s.height))
    let at = metrics.hullPad
    for (const id of layers.members.get(item.id) ?? []) {
      const size = sizes.get(id)
      if (!size) continue
      boxes.set(id, {
        item,
        ox: at,
        oy: metrics.hullPad + (tallest - size.height) / 2,
        w: size.width,
        h: size.height,
      })
      at += size.width + metrics.memberGap
    }
  }
  const ported = (itemId: string, side: 'top' | 'bottom' | 'left' | 'right') => {
    const item = boxes.get(itemId)?.item
    const keys = item?.kind === 'unit' ? (layers.members.get(itemId) ?? []) : [itemId]
    return keys.some((k) => (tracks.ports.get(`${k}\0${side}`)?.length ?? 0) > 0)
  }

  // ---- the coordinates that are one: a run carried on through several nodes, level ports
  const parent = new Map<string, string>()
  const find = (k: string): string => {
    const p = parent.get(k) ?? k
    if (p === k) return k
    const r = find(p)
    parent.set(k, r)
    return r
  }
  for (const [a, b] of tracks.joined) {
    const [ra, rb] = [find(a), find(b)]
    if (ra !== rb) parent.set(ra, rb)
  }

  /** One axis: the unknowns of items, frames, lanes and ports, and the places they make. */
  const axisOf = (axis: 'x' | 'y') => {
    const sys = newSys()
    const lo = new Map<string, number>()
    const hi = new Map<string, number>()
    const coord = new Map<string, number>()
    const alloc = (name: string) => {
      sys.names[sys.n] = name
      return sys.n++
    }
    for (const item of problem.items) lo.set(item.id, alloc(`${axis} lo ${item.id}`))
    for (const f of problem.frames) {
      if (f.id === ROOT) continue
      lo.set(frameKey(f.id), alloc(`${axis} lo frame ${f.id}`))
      hi.set(frameKey(f.id), alloc(`${axis} hi frame ${f.id}`))
    }
    const lowRef = (key: string): Ref => {
      const f = frameOfKey.get(key)
      if (f !== undefined) return { v: lo.get(key) ?? 0, off: 0 }
      const b = boxes.get(key)
      return {
        v: lo.get(b?.item.id ?? key) ?? 0,
        off: axis === 'x' ? (b?.ox ?? 0) : (b?.oy ?? 0),
      }
    }
    const sizeOf = (key: string) => {
      const b = boxes.get(key)
      return axis === 'x' ? (b?.w ?? 0) : (b?.h ?? 0)
    }
    const highRef = (key: string): Ref => {
      if (frameOfKey.has(key)) return { v: hi.get(key) ?? 0, off: 0 }
      const l = lowRef(key)
      return { v: l.v, off: l.off + sizeOf(key) }
    }
    const midRef = (key: string): Ref => {
      const l = lowRef(key)
      return { v: l.v, off: l.off + sizeOf(key) / 2 }
    }
    /** The unknown of a coordinate in a line's chain, shared by those that are one. */
    const at = (v: Var): Ref => {
      const root = find(varKey(v))
      let c = coord.get(root)
      if (c === undefined) {
        c = alloc(`${axis} ${varKey(v)}`)
        coord.set(root, c)
      }
      return { v: c, off: 0 }
    }
    const inset = (f: FrameId) => {
      const i = frames.get(f)?.insets
      return axis === 'x'
        ? { lo: i?.left ?? 0, hi: i?.right ?? 0 }
        : { lo: i?.top ?? 0, hi: i?.bottom ?? 0 }
    }
    // frames hold what is in them
    for (const f of problem.frames) {
      if (f.id === ROOT) continue
      const key = frameKey(f.id)
      sys.sep.push(
        after(
          lowRef(key),
          highRef(key),
          f.insets[axis === 'x' ? 'left' : 'top'] + f.insets[axis === 'x' ? 'right' : 'bottom'],
        ),
      )
      if (f.parent === undefined || f.parent === ROOT) continue
      const up = frameKey(f.parent)
      sys.sep.push(after(lowRef(up), lowRef(key), inset(f.id).lo))
      sys.sep.push(after(highRef(key), highRef(up), inset(f.id).hi))
    }
    for (const item of problem.items) {
      if (item.frame === ROOT) continue
      const f = frameKey(item.frame)
      sys.sep.push(after(lowRef(f), lowRef(item.id), inset(item.frame).lo))
      sys.sep.push(after(highRef(item.id), highRef(f), inset(item.frame).hi))
    }
    return { sys, lowRef, highRef, midRef, at, sizeOf, alloc }
  }

  const Y = axisOf('y')
  const X = axisOf('x')
  // every coordinate has its unknown before any constraint is laid
  for (const lane of tracks.lanes.values()) {
    if (lane.used) (lane.axis === 'x' ? X : Y).at({ kind: 'lane', key: lane.key })
  }
  for (const ent of tracks.entities.values())
    (ent.axis === 'x' ? X : Y).at({ kind: 'port', id: ent.id })
  const ys = Y.sys
  const xs = X.sys
  const room = flowRoom(metrics)
  const kidsOf = (f: FrameId): string[] =>
    (layers.siblings.get(f) ?? []).filter((k) => !layers.dummies.has(k))
  const haloLane = (key: string) => {
    const l = tracks.lanes.get(key)
    const line = l ? byLine.get(l.line) : undefined
    return line ? haloOf(line) : 0
  }
  const lineOfLane = (key: string) => byLine.get(tracks.lanes.get(key)?.line ?? '')
  const R = (line: string) => {
    const l = byLine.get(line)
    return l ? cornerOf(metrics, l) : 0
  }

  // the ports on the edges: in the order the tracks gave, a slot apart, a half slot from the corners
  const portChain = (A: ReturnType<typeof axisOf>, sys: Sys, along: 'x' | 'y') => {
    for (const [k, list] of tracks.ports) {
      const [box, side] = splitKey(k)
      if (box === undefined || list.length === 0) continue
      const horizontal = side === 'top' || side === 'bottom'
      if (horizontal !== (along === 'x')) continue
      const slot = problem.slots.get(box) ?? 0
      const lo = A.lowRef(box)
      const hi = A.highRef(box)
      const first = list[0]
      const last = list[list.length - 1]
      if (first === undefined || last === undefined) continue
      sys.sep.push(after(lo, A.at({ kind: 'port', id: first }), slot / 2))
      for (const [i, id] of list.entries()) {
        const next = list[i + 1]
        if (next !== undefined)
          sys.sep.push(after(A.at({ kind: 'port', id }), A.at({ kind: 'port', id: next }), slot))
      }
      sys.sep.push(after(A.at({ kind: 'port', id: last }), hi, slot / 2))
    }
  }

  const solveCompact = (
    sys: Sys,
    spans: { lo: number; hi: number }[],
    extra: AxisInput['pair'],
    more: { sep?: Sep[]; equal?: Sep[] } = {},
  ): Float64Array => {
    const sep = [...sys.sep, ...(more.sep ?? [])]
    const equal = [...sys.equal, ...(more.equal ?? [])]
    const compact = solveAxis({
      n: sys.n,
      sep,
      equal,
      pull: [],
      pair: spans.map((s) => ({ i: s.lo, j: s.hi, w: 1, d: 0 })),
      tolerance,
    })
    const caps = spans.map((s) => ({
      i: s.hi,
      j: s.lo,
      d: (compact[s.lo] ?? 0) - (compact[s.hi] ?? 0),
    }))
    return solveAxis({
      n: sys.n,
      sep: [...sep, ...caps],
      equal,
      pull: [],
      pair: extra,
      tolerance,
      start: compact,
    })
  }
  const frameSpans = (A: ReturnType<typeof axisOf>) =>
    problem.frames
      .filter((f) => f.id !== ROOT)
      .map((f) => ({
        lo: A.lowRef(frameKey(f.id)).v,
        hi: A.highRef(frameKey(f.id)).v,
      }))

  // =========================================================== 7a widths
  // a vertical run that turns at one of its ends needs room for the corner to its neighbours
  const turns = (l: Lane): boolean => {
    if (l.win === 'left' || l.win === 'right' || l.wout === 'left' || l.wout === 'right')
      return true
    const chain = tracks.chains.get(l.line) ?? []
    const me = chain.findIndex((v) => v.kind === 'lane' && v.key === l.key)
    return [chain[me - 1], chain[me + 1]].some((v) =>
      v?.kind === 'port'
        ? tracks.entities.get(v.id)?.axis === 'y'
        : v !== undefined && tracks.lanes.get(v.key)?.essential === true,
    )
  }
  const cornerRoom = (key: string): number => {
    const l = tracks.lanes.get(key)
    return l && turns(l) ? R(l.line) : 0
  }
  for (const [id, node] of nodes.entries()) {
    if (node.kind !== 'column') continue
    const near = corridors.around.get(id) ?? {}
    const runs = tracks.columns.get(id) ?? []
    const leftEdge = near.left === undefined ? undefined : X.highRef(near.left)
    const rightEdge = near.right === undefined ? undefined : X.lowRef(near.right)
    const offLeft =
      near.left === undefined
        ? 0
        : isFrame(near.left)
          ? whiteOf(metrics)
          : keepOff(metrics, ported(near.left, 'right'))
    const offRight =
      near.right === undefined
        ? 0
        : isFrame(near.right)
          ? whiteOf(metrics)
          : keepOff(metrics, ported(near.right, 'left'))
    const gap =
      (near.left !== undefined && isFrame(near.left)) ||
      (near.right !== undefined && isFrame(near.right))
        ? metrics.groupGap
        : metrics.gap
    if (leftEdge && rightEdge) xs.sep.push(after(leftEdge, rightEdge, gap))
    const frameKeyHere = node.frame === ROOT ? undefined : frameKey(node.frame)
    const firstKey = runs[0]
    const lastKey = runs[runs.length - 1]
    if (firstKey !== undefined && lastKey !== undefined) {
      const first = X.at({ kind: 'lane', key: firstKey })
      const last = X.at({ kind: 'lane', key: lastKey })
      const hFirst = haloLane(firstKey) + cornerRoom(firstKey)
      const hLast = haloLane(lastKey) + cornerRoom(lastKey)
      if (leftEdge) xs.sep.push(after(leftEdge, first, offLeft + hFirst))
      else if (frameKeyHere)
        xs.sep.push(after(X.lowRef(frameKeyHere), first, whiteOf(metrics) + hFirst))
      if (rightEdge) xs.sep.push(after(last, rightEdge, hLast + offRight))
      else if (frameKeyHere)
        xs.sep.push(after(last, X.highRef(frameKeyHere), hLast + whiteOf(metrics)))
      for (const [i, key] of runs.entries()) {
        const next = runs[i + 1]
        if (next === undefined) continue
        const [a, b] = [lineOfLane(key), lineOfLane(next)]
        if (a && b)
          xs.sep.push(
            after(
              X.at({ kind: 'lane', key }),
              X.at({ kind: 'lane', key: next }),
              pitchOf(metrics, a, b) + cornerRoom(key) + cornerRoom(next),
            ),
          )
      }
    }
  }
  // siblings with nothing to do with each other stand apart; those that share ranks are held
  // apart by the columns between them
  for (const f of problem.frames) {
    const kids = kidsOf(f.id)
    for (const [i, a] of kids.entries()) {
      for (const b of kids.slice(i + 1)) {
        const [sa, sb] = [ranks.span.get(a), ranks.span.get(b)]
        if (!sa || !sb || (sa[1] >= sb[0] && sb[1] >= sa[0]) || ranks.ordered(a, b)) continue
        xs.sep.push(
          after(
            X.highRef(a),
            X.lowRef(b),
            isFrame(a) || isFrame(b) ? metrics.groupGap : metrics.gap,
          ),
        )
      }
    }
  }
  portChain(X, xs, 'x')

  // the steps of a line from one x to the next (a run along a row, between its two ends)
  const steps: { a: Var; b: Var; line: string }[] = []
  for (const [line, chain] of tracks.chains) {
    const across = chain.filter(
      (v) =>
        (v.kind === 'port' ? tracks.entities.get(v.id)?.axis : tracks.lanes.get(v.key)?.axis) ===
        'x',
    )
    for (const [k, a] of across.entries()) {
      const b = across[k + 1]
      if (b) steps.push({ a, b, line })
    }
  }

  // The widths of the frames are settled before any line is made straight: what a frame holds
  // and the lines that must pass in it decide its width, and a line is not worth a wider frame.
  // So the frames are made as narrow as they can be with no alignment, and those widths are held
  // as caps while the alignments are chosen.
  const spansX = frameSpans(X)
  const unaligned0 = solveAxis({
    n: xs.n,
    sep: xs.sep,
    equal: xs.equal,
    pull: [],
    pair: spansX.map((sp) => ({ i: sp.lo, j: sp.hi, w: 1, d: 0 })),
    tolerance,
  })
  const widthCaps: Sep[] = spansX.map((sp) => ({
    i: sp.hi,
    j: sp.lo,
    d: (unaligned0[sp.lo] ?? 0) - (unaligned0[sp.hi] ?? 0),
  }))

  /** The equalities held so far with the separations and the widths: whether one more fits, with no ring that must grow. */
  const held = ledgerOf(xs.n, [...xs.sep, ...widthCaps], xs.equal)

  // alignment, after Brandes and Koepf: down the gaps, each box (or run) takes the line at the
  // median of its top edge to stand straight with, if that keeps the lines from crossing and
  // forms no ring; a box gives one line down and takes one up
  interface Elem {
    /** The box (the unit, for its members) or the run. */
    key: string
    rank: number
    pos: number
  }
  const elemOf = (v: Var): Elem | undefined => {
    if (v.kind === 'port') {
      const ent = tracks.entities.get(v.id)
      const info = ent ? corridors.boxes.get(ent.box) : undefined
      if (!ent || !info) return undefined
      return { key: info.item, rank: info.rank, pos: (corridors.slotOf.get(ent.box) ?? 0) * 1000 }
    }
    const lane = tracks.lanes.get(v.key)
    const node = lane ? nodes[lane.node] : undefined
    if (!lane || node?.kind !== 'column') return undefined
    const at = (tracks.columns.get(lane.node) ?? []).indexOf(v.key)
    return {
      key: v.key,
      rank: node.rank,
      pos: (corridors.slotOf.get(columnKey(lane.node)) ?? 0) * 1000 + 1 + at,
    }
  }
  const sideOf = (v: Var) => (v.kind === 'port' ? tracks.entities.get(v.id)?.side : undefined)
  interface Link {
    upper: Var
    lower: Var
    up: Elem
    low: Elem
  }
  const linksOf = new Map<string, Link[]>() // the lower element's key
  for (const st of steps) {
    const [ea, eb] = [elemOf(st.a), elemOf(st.b)]
    if (!ea || !eb || Math.abs(ea.rank - eb.rank) !== 1) continue
    const [upper, lower, up, low] = ea.rank < eb.rank ? [st.a, st.b, ea, eb] : [st.b, st.a, eb, ea]
    if (sideOf(upper) !== undefined && sideOf(upper) !== 'bottom') continue
    if (sideOf(lower) !== undefined && sideOf(lower) !== 'top') continue
    linksOf.set(low.key, [...(linksOf.get(low.key) ?? []), { upper, lower, up, low }])
  }
  const lowerElems = new Map<number, { elem: Elem; vars: Var[] }[]>() // by the rank of the gap's top
  const seenLow = new Set<string>()
  for (const links of linksOf.values()) {
    for (const l of links) {
      if (seenLow.has(l.low.key)) continue
      seenLow.add(l.low.key)
      let vars: Var[]
      if (l.lower.kind === 'port') {
        const members = layers.members.get(l.low.key) ?? [
          corridors.boxes.get(l.low.key)?.item ?? '',
        ]
        const keys = layers.members.has(l.low.key) ? members : [l.low.key]
        vars = keys.flatMap((k) =>
          (tracks.ports.get(`${k}\0top`) ?? []).map((id): Var => ({ kind: 'port', id })),
        )
      } else vars = [l.lower]
      const list = lowerElems.get(l.low.rank - 1) ?? []
      list.push({ elem: l.low, vars })
      lowerElems.set(l.low.rank - 1, list)
    }
  }
  const straight: Sep[] = []
  const usedDown = new Set<string>()
  const usedUp = new Set<string>()
  for (let g = 0; g < layers.ranks.max; g++) {
    const row = (lowerElems.get(g) ?? []).sort((p, q) => p.elem.pos - q.elem.pos)
    let last = -1
    for (const { elem, vars } of row) {
      if (usedUp.has(elem.key) || vars.length === 0) continue
      const medians = [
        ...new Set([Math.floor((vars.length - 1) / 2), Math.ceil((vars.length - 1) / 2)]),
      ]
      let done = false
      for (const m of medians) {
        const v = vars[m]
        if (!v || done) continue
        const link = (linksOf.get(elem.key) ?? []).find(
          (l) => varKey(l.lower) === varKey(v) && l.up.pos > last && !usedDown.has(l.up.key),
        )
        if (!link) continue
        const eq = same(X.at(link.upper), X.at(link.lower))
        if (eq.i !== eq.j && !held.admits(eq)) continue
        if (eq.i !== eq.j) {
          held.add(eq)
          straight.push(eq)
        }
        usedDown.add(link.up.key)
        usedUp.add(elem.key)
        last = link.up.pos
        done = true
      }
    }
  }
  const aligned = new Set(straight.map((e) => `${e.i}|${e.j}`))
  const unaligned = steps.filter((s) => {
    const [a, b] = [X.at(s.a), X.at(s.b)]
    return a.v !== b.v && !aligned.has(`${a.v}|${b.v}`) && !aligned.has(`${b.v}|${a.v}`)
  })
  // what remains is the length of the runs along the rows
  const pull: AxisInput['pair'] = [...xs.pair]
  for (const s of unaligned) pull.push({ i: X.at(s.a).v, j: X.at(s.b).v, w: 1, d: 0 })
  const solveX = (more: { sep?: Sep[]; equal?: Sep[] } = {}) =>
    solveCompact(xs, frameSpans(X), pull, { ...more, equal: [...straight, ...(more.equal ?? [])] })
  let xv = solveX()

  // the forbidden band: a step too small to be drawn as a jog is made straight where the
  // neighbours allow it, else as large as a jog may be; no order changes
  const small: { sep: Sep; wide: Sep }[] = []
  for (const s of unaligned) {
    const [a, b] = [X.at(s.a), X.at(s.b)]
    const delta = (xv[b.v] ?? 0) - (xv[a.v] ?? 0)
    const least = jogLeastOf(R(s.line))
    if (Math.abs(delta) < tolerance || Math.abs(delta) >= least) continue
    small.push({
      sep: same(a, b),
      wide: delta > 0 ? { i: a.v, j: b.v, d: least } : { i: b.v, j: a.v, d: least },
    })
  }
  if (small.length > 0) {
    const level: Sep[] = []
    for (const c of small) {
      if (!held.admits(c.sep)) continue
      held.add(c.sep)
      level.push(c.sep)
    }
    const got = new Set(level)
    xv = solveX({
      equal: level,
      sep: small.filter((c) => !got.has(c.sep)).map((c) => c.wide),
    })
  }

  // =========================================================== 7b the runs along the rows
  const xAt = (r: Ref) => (xv[r.v] ?? 0) + r.off
  const lanes = lanesOf(problem, corridors, tracks, (v) => xv[X.at(v).v] ?? 0, tolerance)

  // =========================================================== 7c heights
  for (const { upper, lower } of problem.above)
    ys.sep.push(after(Y.highRef(upper), Y.lowRef(lower), room))
  // siblings the flows put one upstream of the other, a frame among them, stay one above the other
  for (const f of problem.frames) {
    const kids = kidsOf(f.id)
    for (const [i, u] of kids.entries()) {
      for (const l of kids.slice(i + 1)) {
        if (!ranks.ordered(u, l) || !(isFrame(u) || isFrame(l))) continue
        const [su, sl] = [ranks.span.get(u), ranks.span.get(l)]
        if (!su || !sl) continue
        const [up, down] = su[1] < sl[0] ? [u, l] : [l, u]
        ys.sep.push(after(Y.highRef(up), Y.lowRef(down), metrics.groupGap))
      }
    }
  }
  for (const { a, b } of problem.level) ys.equal.push(same(Y.midRef(a), Y.midRef(b)))
  for (const s of problem.satellites) ys.equal.push(same(Y.midRef(s.item), Y.midRef(s.partner)))
  // an item without a place in the flow stands level with the first item of its rank in its frame
  const free = new Set(problem.free)
  for (const id of problem.free) {
    const own = problem.items.find((i) => i.id === id)
    if (!own) continue
    const inside = new Set((tree.within.get(own.frame) ?? []).map((i) => i.id))
    const row = layers.sequences[ranks.rank.get(id) ?? 0] ?? []
    const first = row.find((e) => e.kind === 'box' && inside.has(e.item) && !free.has(e.item))
    if (first?.kind === 'box') ys.equal.push(same(Y.midRef(id), Y.midRef(first.item)))
  }

  // Every rank is a band: its boxes lie between the band's top and bottom, and the band of the
  // next rank begins below. The runs along a row lie in the band of its gap, so that a vertical
  // leg only passes the bands of the two gaps it joins, and a row with nothing over or under a
  // run cannot let it fall anywhere.
  const bandTop: Ref[] = []
  const bandBottom: Ref[] = []
  for (let r = 0; r <= ranks.max; r++) {
    bandTop.push({ v: Y.alloc(`y band top ${r}`), off: 0 })
    bandBottom.push({ v: Y.alloc(`y band bottom ${r}`), off: 0 })
  }
  for (const item of problem.items) {
    const r = ranks.rank.get(item.id) ?? 0
    const [t, b] = [bandTop[r], bandBottom[r]]
    if (!t || !b) continue
    ys.sep.push(after(t, Y.lowRef(item.id), 0))
    ys.sep.push(after(Y.highRef(item.id), b, 0))
  }
  for (let r = 0; r < ranks.max; r++) {
    const [b, t] = [bandBottom[r], bandTop[r + 1]]
    if (b && t) ys.sep.push(after(b, t, 0))
  }

  // the runs along the rows lie between what is over them and what is under
  for (const [id, cell] of nodes.entries()) {
    if (cell.kind !== 'cell') continue
    for (const key of lanes.order.get(id) ?? []) {
      const iv = lanes.interval.get(key)
      if (!iv) continue
      const h = haloLane(key)
      const y = Y.at({ kind: 'lane', key })
      const above = bandBottom[cell.gap]
      const below = bandTop[cell.gap + 1]
      if (above) ys.sep.push(after(above, y, keepOff(metrics, false) + h))
      if (below) ys.sep.push(after(y, below, h + keepOff(metrics, false)))
      const touches = (b: { key: string }) => {
        const [x0, x1] = [xAt(X.lowRef(b.key)), xAt(X.highRef(b.key))]
        return x0 < iv[1] + tolerance && iv[0] - tolerance < x1
      }
      for (const b of cell.over) {
        if (!touches(b)) continue
        if (b.frame) ys.sep.push(after(Y.highRef(b.key), y, whiteOf(metrics) + h))
        else ys.sep.push(after(Y.highRef(b.key), y, keepOff(metrics, ported(b.key, 'bottom')) + h))
      }
      for (const b of cell.under) {
        if (!touches(b)) continue
        if (b.frame) ys.sep.push(after(y, Y.lowRef(b.key), h + whiteOf(metrics)))
        else ys.sep.push(after(y, Y.lowRef(b.key), h + keepOff(metrics, ported(b.key, 'top'))))
      }
      if (cell.frame !== ROOT) {
        const fk = frameKey(cell.frame)
        const top = frames.get(cell.frame)?.insets.top ?? 0
        if (cell.topMargin) ys.sep.push(after(Y.lowRef(fk), y, top + h))
        if (cell.bottomMargin) ys.sep.push(after(y, Y.highRef(fk), h + whiteOf(metrics)))
      }
    }
  }
  for (const { a, b, d } of lanes.apart)
    ys.sep.push(after(Y.at({ kind: 'lane', key: a }), Y.at({ kind: 'lane', key: b }), d))
  portChain(Y, ys, 'y')

  const spread = problem.above.map(({ upper, lower }) => ({
    ...after(Y.highRef(upper), Y.lowRef(lower), room),
    w: 1,
  }))
  const yv = solveCompact(ys, frameSpans(Y), spread)

  // =========================================================== the result
  const geom = new Map<string, Box>()
  for (const item of problem.items) {
    const left = xv[X.lowRef(item.id).v] ?? 0
    const top = yv[Y.lowRef(item.id).v] ?? 0
    geom.set(item.id, { x: left, y: top, ...item.size })
  }
  for (const [key, b] of boxes) {
    if (key === b.item.id) continue
    const unit = geom.get(b.item.id)
    if (unit) geom.set(key, { x: unit.x + b.ox, y: unit.y + b.oy, width: b.w, height: b.h })
  }
  for (const f of problem.frames) {
    if (f.id === ROOT) continue
    const key = frameKey(f.id)
    const l = xv[X.lowRef(key).v] ?? 0
    const r = xv[X.highRef(key).v] ?? 0
    const t = yv[Y.lowRef(key).v] ?? 0
    const b = yv[Y.highRef(key).v] ?? 0
    geom.set(key, { x: l, y: t, width: r - l, height: b - t })
  }
  const geometry: Geometry = { boxes: geom }
  const value = (v: Var): number => {
    const lane = v.kind === 'lane' ? tracks.lanes.get(v.key) : undefined
    const axis = v.kind === 'port' ? tracks.entities.get(v.id)?.axis : lane?.axis
    return axis === 'x' ? (xv[X.at(v).v] ?? 0) : (yv[Y.at(v).v] ?? 0)
  }
  const { wires, ports } = wiresOf(problem, geometry, tracks, value, lanes.dropped)

  const short = (sys: Sys, v: Float64Array) =>
    sys.sep.filter(({ i, j, d }) => (v[j] ?? 0) - (v[i] ?? 0) < d - tolerance).length
  // the crossings that are drawn, told by the band they fall in
  const bands = bandTop.map((t, r) => ({
    top: yv[t.v] ?? 0,
    bottom: yv[bandBottom[r]?.v ?? 0] ?? 0,
  }))
  const gapAt = (y: number): number => {
    for (const [r, b] of bands.entries()) {
      if (y < b.top) return r - 1
      if (y <= b.bottom) return -2 - r
    }
    return ranks.max
  }
  interface Seg {
    line: string
    x0: number
    y0: number
    x1: number
    y1: number
  }
  const hs: Seg[] = []
  const vs: Seg[] = []
  for (const [line, pts] of wires) {
    for (const [k, a] of pts.entries()) {
      const b = pts[k + 1]
      if (!b) continue
      const seg = { line, x0: a.x, y0: a.y, x1: b.x, y1: b.y }
      if (Math.abs(a.y - b.y) < 1e-6 && Math.abs(a.x - b.x) >= 1e-6) hs.push(seg)
      else if (Math.abs(a.x - b.x) < 1e-6 && Math.abs(a.y - b.y) >= 1e-6) vs.push(seg)
    }
  }
  const drawn = new Map<number, number>()
  const crossingList: Placed['crossingList'] = []
  for (const h of hs) {
    for (const v of vs) {
      if (h.line === v.line) continue
      const [lo, hi] = [Math.min(h.x0, h.x1), Math.max(h.x0, h.x1)]
      const [top, bottom] = [Math.min(v.y0, v.y1), Math.max(v.y0, v.y1)]
      if (v.x0 > lo && v.x0 < hi && h.y0 > top && h.y0 < bottom) {
        const g = gapAt(h.y0)
        drawn.set(g, (drawn.get(g) ?? 0) + 1)
        crossingList.push({
          h: h.line,
          v: v.line,
          gap: g,
          x: v.x0,
          y: h.y0,
          vFrom: Math.min(v.y0, v.y1),
          vTo: Math.max(v.y0, v.y1),
        })
      }
    }
  }
  const table: Placed['table'] = []
  for (let g = -1; g <= ranks.max; g++) {
    const l = lanes.byGap.get(g)
    table.push({
      gap: g,
      layers: (layers.byGap.gap[g] ?? 0) + (layers.byGap.level[g] ?? 0),
      lanesLeast: l?.least ?? 0,
      lanes: l?.chosen ?? 0,
      drawn: drawn.get(g) ?? 0,
    })
  }
  for (const [g, n] of drawn)
    if (g <= -2) table.push({ gap: g, layers: 0, lanesLeast: 0, lanes: 0, drawn: n })
  return {
    geometry,
    wires,
    ports,
    table,
    crossingList,
    unmet: { separations: short(ys, yv) + short(xs, xv), bounds: 0 },
    laneCrossings: lanes.crossings,
  }
}

// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { splitKey } from '../structure/keys.js'
import { type AxisInput, CycleError, solveAxis } from './axis.js'
import type { Corridors } from './corridors.js'
import { cornerOf, flowRoom, haloOf, jogLeastOf, keepOff, pitchOf, snapOf, whiteOf } from './kin.js'
import type { Layers } from './layers.js'
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
import { type Tracks, type Var, varKey } from './tracks.js'
import { treeOf } from './tree.js'
import { wiresOf } from './wires.js'

export interface Placed {
  geometry: Geometry
  wires: Map<string, Point[]>
  ports: NonNullable<Scene['ports']>
  /** What the solution does not keep: separations short of their distance, values out of their room. */
  unmet: { separations: number; bounds: number }
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
  /** Separations that are given up when the rest cannot hold them. */
  soft: Sep[]
  equal: Sep[]
  pair: AxisInput['pair']
}
const newSys = (): Sys => ({ n: 0, names: [], sep: [], soft: [], equal: [], pair: [] })

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
    return { sys, lowRef, highRef, midRef, at, sizeOf }
  }

  // =========================================================== heights
  const Y = axisOf('y')
  const X = axisOf('x')
  // every coordinate has its unknown before any constraint is laid
  for (const lane of tracks.lanes.values()) {
    if (lane.used) (lane.axis === 'x' ? X : Y).at({ kind: 'lane', key: lane.key })
  }
  for (const ent of tracks.entities.values())
    (ent.axis === 'x' ? X : Y).at({ kind: 'port', id: ent.id })
  const ys = Y.sys
  const room = flowRoom(metrics)
  for (const { upper, lower } of problem.above)
    ys.sep.push(after(Y.highRef(upper), Y.lowRef(lower), room))
  // siblings the flows put one upstream of the other, a frame among them, stay one above the other
  const kidsOf = (f: FrameId): string[] =>
    (layers.siblings.get(f) ?? []).filter((k) => !layers.dummies.has(k))
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

  // the stretches between ranks
  const haloLane = (key: string) => {
    const l = tracks.lanes.get(key)
    const line = l ? byLine.get(l.line) : undefined
    return line ? haloOf(line) : 0
  }
  for (const [id, cell] of nodes.entries()) {
    if (cell.kind !== 'cell') continue
    const order = tracks.cells.get(id) ?? []
    for (const key of order) {
      const span = tracks.spans.get(key)
      const lane = tracks.lanes.get(key)
      if (!span || !lane) continue
      const h = haloLane(key)
      const y = Y.at({ kind: 'lane', key })
      const touches = (side: 'top' | 'bottom', from: number, to: number) => {
        const r = tracks.reach(cell.gap, side, from, to)
        return r !== undefined && r[0] <= span[1] && span[0] <= r[1]
      }
      for (const b of cell.over) {
        if (!touches('top', b.from, b.to)) continue
        if (b.frame) ys.sep.push(after(Y.highRef(b.key), y, whiteOf(metrics) + h))
        else ys.sep.push(after(Y.highRef(b.key), y, keepOff(metrics, ported(b.key, 'bottom')) + h))
      }
      for (const b of cell.under) {
        if (!touches('bottom', b.from, b.to)) continue
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
    for (const [i, a] of order.entries()) {
      for (const b of order.slice(i + 1)) {
        const [la, lb] = [tracks.lanes.get(a), tracks.lanes.get(b)]
        const [sa, sb] = [tracks.spans.get(a), tracks.spans.get(b)]
        if (!la || !lb || !sa || !sb || la.run === lb.run) continue
        if (sa[0] > sb[1] || sb[0] > sa[1]) continue
        const [pa, pb] = [byLine.get(la.line), byLine.get(lb.line)]
        if (!pa || !pb) continue
        ys.sep.push(
          after(
            Y.at({ kind: 'lane', key: a }),
            Y.at({ kind: 'lane', key: b }),
            pitchOf(metrics, pa, pb),
          ),
        )
      }
    }
  }

  // the ports on left and right edges
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
        // a port is drawn towards the middle of its edge
        sys.pair.push({
          i: lo.v,
          j: A.at({ kind: 'port', id }).v,
          w: 1,
          d: lo.off + A.sizeOf(box) / 2,
        })
      }
      sys.sep.push(after(A.at({ kind: 'port', id: last }), hi, slot / 2))
    }
  }
  portChain(Y, ys, 'y')

  const spread = problem.above.map(({ upper, lower }) => ({
    ...after(Y.highRef(upper), Y.lowRef(lower), room),
    w: 1,
  }))
  const solveCompact = (
    sys: Sys,
    spans: { lo: number; hi: number }[],
    extra: AxisInput['pair'],
    more: { sep?: Sep[]; equal?: Sep[] } = {},
  ): Float64Array => {
    const hard = [...sys.sep, ...(more.sep ?? [])]
    const equal = [...sys.equal, ...(more.equal ?? [])]
    // the orders the neighbours of a gap give are given up where the sizes of what lies between
    // make them impossible, and the line is then drawn leaning
    const soft = new Set(sys.soft)
    let sep: Sep[] = []
    let compact: Float64Array
    for (;;) {
      sep = [...hard, ...soft]
      try {
        compact = solveAxis({
          n: sys.n,
          sep,
          equal,
          pull: [],
          pair: spans.map((s) => ({ i: s.lo, j: s.hi, w: 1, d: 0 })),
          tolerance,
        })
        break
      } catch (e) {
        if (!(e instanceof CycleError)) throw e
        const drop = e.seps.flatMap((k) => {
          const s = sep[k]
          return s && soft.has(s) ? [s] : []
        })
        if (drop.length === 0) {
          if (process.env['SERIAL_DEBUG'])
            console.error(
              e.seps
                .map((k) => {
                  const s = sep[k]
                  return s ? `${sys.names[s.i]} -> ${sys.names[s.j]} (${Math.round(s.d)})` : '?'
                })
                .join(String.fromCharCode(10)),
            )
          throw e
        }
        for (const s of drop) soft.delete(s)
      }
    }
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
  const yv = solveCompact(ys, frameSpans(Y), [...spread, ...ys.pair])

  // =========================================================== widths
  const xs = X.sys
  // the columns: lines run between what stands on either side of them
  const lineOfLane = (key: string) => byLine.get(tracks.lanes.get(key)?.line ?? '')
  for (const [id, node] of nodes.entries()) {
    if (node.kind !== 'column') continue
    const near = corridors.around.get(id) ?? {}
    const lanes = tracks.columns.get(id) ?? []
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
    const firstKey = lanes[0]
    const lastKey = lanes[lanes.length - 1]
    if (firstKey !== undefined && lastKey !== undefined) {
      const first = X.at({ kind: 'lane', key: firstKey })
      const last = X.at({ kind: 'lane', key: lastKey })
      const hFirst = haloLane(firstKey)
      const hLast = haloLane(lastKey)
      if (leftEdge) xs.sep.push(after(leftEdge, first, offLeft + hFirst))
      else if (frameKeyHere)
        xs.sep.push(after(X.lowRef(frameKeyHere), first, whiteOf(metrics) + hFirst))
      if (rightEdge) xs.sep.push(after(last, rightEdge, hLast + offRight))
      else if (frameKeyHere)
        xs.sep.push(after(last, X.highRef(frameKeyHere), hLast + whiteOf(metrics)))
      for (const [i, key] of lanes.entries()) {
        const next = lanes[i + 1]
        if (next === undefined) continue
        const [a, b] = [lineOfLane(key), lineOfLane(next)]
        if (a && b)
          xs.sep.push(
            after(
              X.at({ kind: 'lane', key }),
              X.at({ kind: 'lane', key: next }),
              pitchOf(metrics, a, b),
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
  // lines of neighbouring ranks interleave in the order the tracks gave
  const refLines = (ref: string): string[] => {
    if (ref.startsWith('p:'))
      return (tracks.entities.get(ref.slice(2))?.ends ?? []).map((e) => e.line)
    const l = tracks.lanes.get(ref.slice(2))
    return l ? [l.line] : []
  }
  const asVar = (ref: string): Var =>
    ref.startsWith('p:') ? { kind: 'port', id: ref.slice(2) } : { kind: 'lane', key: ref.slice(2) }
  const realAt = new Map<string, { gap: number; i: number; slot: number; side: 'top' | 'bottom' }>()
  for (const [g, row] of tracks.merged.entries()) {
    const real = row.flatMap((e) => (e.ref ? [e] : []))
    for (const [i, e] of real.entries()) {
      realAt.set(`${e.ref}|${g - 1}`, { gap: g - 1, i, slot: e.slot, side: e.side })
      const next = real[i + 1]
      if (!e.ref || !next?.ref || next.side === e.side) continue
      const [a, b] = [X.at(asVar(e.ref)), X.at(asVar(next.ref))]
      if (a.v === b.v) continue
      const [la, lb] = [refLines(e.ref), refLines(next.ref)]
      const share = la.some((l) => lb.includes(l))
      const [pa, pb] = [byLine.get(la[0] ?? ''), byLine.get(lb[0] ?? '')]
      xs.soft.push(after(a, b, share || !pa || !pb ? 0 : pitchOf(metrics, pa, pb)))
    }
  }
  // the steps of a line from one rank's coordinate to the next: held straight where they are
  // neighbours in the merged order, pulled together where they are not
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
  /** The equalities of `candidates` that the separations and the equalities already laid allow, tried in order. */
  const feasible = (base: readonly Sep[], candidates: Sep[]): Sep[] => {
    const accepted: Sep[] = []
    const works = (extra: Sep[]) => {
      try {
        solveAxis({
          n: xs.n,
          sep: xs.sep,
          equal: [...xs.equal, ...base, ...accepted, ...extra],
          pull: [],
          pair: [],
          tolerance,
        })
        return true
      } catch (e) {
        if (e instanceof CycleError) return false
        throw e
      }
    }
    const go = (list: Sep[]) => {
      if (list.length === 0) return
      if (works(list)) {
        accepted.push(...list)
        return
      }
      if (list.length === 1) return
      const mid = list.length >> 1
      go(list.slice(0, mid))
      go(list.slice(mid))
    }
    go(candidates)
    return accepted
  }
  const used = new Set<string>()
  const wanted: { step: (typeof steps)[number]; sep: Sep }[] = []
  for (const s of steps) {
    const [ka, kb] = [varKey(s.a), varKey(s.b)]
    const gapOf = tracks
      .places(s.a)
      .find((p) => tracks.places(s.b).some((q) => q.gap === p.gap && q.side !== p.side))
    const [ia, ib] = gapOf
      ? [realAt.get(`${ka}|${gapOf.gap}`), realAt.get(`${kb}|${gapOf.gap}`)]
      : [undefined, undefined]
    if (
      ia &&
      ib &&
      Math.abs(ia.i - ib.i) === 1 &&
      (ia.side === 'top'
        ? tracks.free(ia.gap, ia.slot, ib.slot)
        : tracks.free(ia.gap, ib.slot, ia.slot)) &&
      !used.has(ka) &&
      !used.has(kb) &&
      X.at(s.a).v !== X.at(s.b).v
    ) {
      used.add(ka)
      used.add(kb)
      wanted.push({ step: s, sep: same(X.at(s.a), X.at(s.b)) })
    }
  }
  const straight = feasible(
    [],
    wanted.map((w) => w.sep),
  )
  const kept = new Set(straight)
  const unaligned = steps.filter((s) => !wanted.some((w) => w.step === s && kept.has(w.sep)))
  const pull: AxisInput['pair'] = [...xs.pair]
  // a line draws its two boxes towards one column, each at the place its line leaves it
  for (const line of problem.lines) {
    if (line.role === 'inside' || line.a.item === line.b.item) continue
    const [ba, bb] = [boxes.get(line.a.node ?? line.a.item), boxes.get(line.b.node ?? line.b.item)]
    if (!ba || !bb) continue
    const [la, lb] = [X.lowRef(line.a.node ?? line.a.item), X.lowRef(line.b.node ?? line.b.item)]
    if (la.v === lb.v) continue
    pull.push({ i: la.v, j: lb.v, w: 1, d: la.off + ba.w / 2 - lb.off - bb.w / 2 })
  }
  for (const s of unaligned) {
    const [a, b] = [X.at(s.a), X.at(s.b)]
    if (a.v !== b.v) pull.push({ i: a.v, j: b.v, w: 1, d: 0 })
  }
  const solveX = (more: { sep?: Sep[]; equal?: Sep[] } = {}) =>
    solveCompact(xs, frameSpans(X), pull, { ...more, equal: [...straight, ...(more.equal ?? [])] })
  let xv = solveX()

  // the forbidden band: a step too small to be drawn as a jog is made straight where the
  // neighbours allow it, else as large as a jog may be; no order changes
  const R = (line: string) => {
    const l = byLine.get(line)
    return l ? cornerOf(metrics, l) : 0
  }
  const small: { sep: Sep; wide: Sep }[] = []
  for (const s of unaligned) {
    const [a, b] = [X.at(s.a), X.at(s.b)]
    if (a.v === b.v) continue
    const delta = (xv[b.v] ?? 0) - (xv[a.v] ?? 0)
    const least = jogLeastOf(R(s.line))
    if (Math.abs(delta) < tolerance || Math.abs(delta) >= least) continue
    small.push({
      sep: same(a, b),
      wide: delta > 0 ? { i: a.v, j: b.v, d: least } : { i: b.v, j: a.v, d: least },
    })
  }
  if (process.env['SERIAL_DEBUG'])
    console.error('band candidates', small.length, 'straight', straight.length, 'of', wanted.length)
  if (small.length > 0) {
    const level = feasible(
      straight,
      small.map((c) => c.sep),
    )
    const got = new Set(level)
    xv = solveX({
      equal: level,
      sep: small.filter((c) => !got.has(c.sep)).map((c) => c.wide),
    })
  }

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
  const { wires, ports } = wiresOf(problem, geometry, tracks, value)

  const short = (sys: Sys, v: Float64Array) =>
    sys.sep.filter(({ i, j, d }) => (v[j] ?? 0) - (v[i] ?? 0) < d - tolerance).length
  return {
    geometry,
    wires,
    ports,
    unmet: { separations: short(ys, yv) + short(xs, xv), bounds: 0 },
  }
}

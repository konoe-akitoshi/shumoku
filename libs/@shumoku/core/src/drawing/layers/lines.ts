// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { compare } from '../../structure/keys.js'
import type { Building } from '../building.js'
import { type DummyKey, dummyKey, type PortKey, portKey } from '../keys.js'
import { portId } from '../ports.js'
import { boxKey, type FrameId, type Line } from '../problem.js'
import { allowedFrames } from '../routes.js'
import type { Basis, Dummy, Level, Neighbours, PortInfo, Segment, Wires } from './types.js'

/**
 * What the lines say of the rows: each line that crosses ranks is cut into one segment per gap,
 * with a dummy in each rank between its ends, and the neighbours every place has above, below and
 * beside it.
 */
export function linesOf(basis: Basis): Wires {
  const { problem, ranks, items, parentFrame, rankOf } = basis
  const dummies = new Map<DummyKey, Building<Dummy>>()
  const chain = (f: FrameId): FrameId[] => {
    const out: FrameId[] = []
    for (let x: FrameId | undefined = f; x !== undefined; x = parentFrame.get(x)) out.push(x)
    return out
  }
  const dummyFrame = (lo: Line['a'], hi: Line['a'], r: number): FrameId => {
    const up = chain(items.get(lo.item)?.frame ?? '').filter((f) => basis.reaches(f, r))
    const down = chain(items.get(hi.item)?.frame ?? '').filter((f) => basis.reaches(f, r))
    const [u, d] = [up[0], down[0]]
    if (u === undefined) return d ?? ''
    if (d === undefined) return u
    return chain(d).length > chain(u).length ? d : u
  }
  const segs = new Map<string, Building<Segment>>()
  const portInfo = new Map<PortKey, Building<PortInfo>>()
  const portOf = (
    end: Line['a'],
    which: 'a' | 'b',
    line: Line,
    side: 'top' | 'bottom',
  ): PortKey => {
    const id = portKey(portId(end.node ?? end.item, end.port, line.id, which), side)
    if (!portInfo.has(id)) portInfo.set(id, { box: boxKey(end), side, partners: [] })
    return id
  }
  const levels: Level[] = []
  const adj = new Map<string, Building<Neighbours>>()
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
        const key = dummyKey(line.family, r)
        here = key
        const known = dummies.get(key)
        if (known) known.lines.push(line.id)
        else
          dummies.set(key, {
            kind: 'dummy',
            key,
            family: line.family,
            lines: [line.id],
            frame: dummyFrame(lo, hi, r),
            rank: r,
          })
      }
      const pa = r === rlo + 1 ? loPort : ''
      const pb = r === rhi ? hiPort : ''
      const segKey = [r - 1, before, here, pa, pb].join('|')
      const seg = segs.get(segKey) ?? { gap: r - 1, a: before, b: here, w: 0, allowed, pa, pb }
      if (pa) portInfo.get(pa)?.partners.push(here)
      if (pb) portInfo.get(pb)?.partners.push(before)
      seg.w++
      segs.set(segKey, seg)
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
  const levelsAt: Level[][] = Array.from({ length: ranks.max + 1 }, () => [])
  for (const l of levels) levelsAt[l.r]?.push(l)
  return { dummies, segs, portInfo, adj, gapSegs, degUp, degDown, levelsAt }
}

// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { type AxisInput, solveAxis } from '../axis.js'
import { jogLeastOf, pitchOf } from '../kin.js'
import { ledgerOf } from '../ledger.js'
import type { Var } from '../tracks.js'
import { type AlignPlan, alignDown } from './align.js'
import { balanceOf, portMiddlesOf } from './balance.js'
import type { Plan } from './plan.js'
import {
  type Axis,
  after,
  frameSpans,
  type Sep,
  type Sys,
  same,
  solveCompact,
  systemOf,
} from './system.js'
import { layWidths, stepsOf, type WidthsPlan } from './widths.js'

/** What the widths read of the plan. */
export type XPlan = WidthsPlan & AlignPlan & Pick<Plan, 'tolerance' | 'corner' | 'problem'>

/**
 * The widths: the separations of columns, siblings and ports; the frames made as narrow as they
 * can be and held there; the lines made straight where the ledger allows (Brandes and Koepf);
 * what remains pulled short, and the room that is left shared out evenly. Returns the value of every unknown of the axis, and the system that
 * was solved.
 */
export function placeX(plan: XPlan, xAxis: Axis): { xValues: Float64Array; sys: Sys } {
  const { tolerance } = plan
  const xSys = systemOf(xAxis, layWidths(plan, xAxis))
  const steps = stepsOf(plan)

  // The widths of the frames are settled before any line is made straight: what a frame holds
  // and the lines that must pass in it decide its width, and a line is not worth a wider frame.
  // So the frames are made as narrow as they can be with no alignment, and those widths are held
  // as caps while the alignments are chosen.
  const spansX = frameSpans(plan, xAxis)
  const unaligned0 = solveAxis({
    n: xSys.n,
    sep: xSys.sep,
    equal: xSys.equal,
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
  const held = ledgerOf(xSys.n, [...xSys.sep, ...widthCaps], xSys.equal)
  const straight = alignDown(plan, xAxis, steps, held)

  const aligned = new Set(straight.map((e) => `${e.i}|${e.j}`))
  const unaligned = steps.filter((s) => {
    const [a, b] = [xAxis.at(s.a), xAxis.at(s.b)]
    return a.v !== b.v && !aligned.has(`${a.v}|${b.v}`) && !aligned.has(`${b.v}|${a.v}`)
  })
  // what remains is the length of the runs along the rows
  const pull: AxisInput['pair'] = [...xSys.pair]
  for (const s of unaligned) pull.push({ i: xAxis.at(s.a).v, j: xAxis.at(s.b).v, w: 1, d: 0 })
  // and, weakly, the middle of every box over the middles of the boxes below it
  pull.push(...balanceOf(plan, xAxis).pair)
  // and more weakly still, each port about the middle of its edge
  pull.push(...portMiddlesOf(plan, xAxis).pair)
  const solveX = (more: { sep?: Sep[]; equal?: Sep[] } = {}) =>
    solveCompact(
      plan,
      xSys,
      frameSpans(plan, xAxis),
      pull,
      { ...more, equal: [...straight, ...(more.equal ?? [])] },
      'middle',
    )
  const xValues = solveX()

  // the forbidden band: a step too small to be drawn as a jog is made straight where the
  // neighbours allow it, else as large as a jog may be, to the side it leans where there is room
  // there and to the other side where there is not, and left as it is where neither has room;
  // no order changes
  const small: { sep: Sep; wide: Sep; back: Sep }[] = []
  for (const s of unaligned) {
    const [a, b] = [xAxis.at(s.a), xAxis.at(s.b)]
    const delta = (xValues[b.v] ?? 0) - (xValues[a.v] ?? 0)
    const least = jogLeastOf(plan.corner(s.line))
    if (Math.abs(delta) < tolerance || Math.abs(delta) >= least) continue
    const right = { i: a.v, j: b.v, d: least }
    const left = { i: b.v, j: a.v, d: least }
    small.push({
      sep: same(a, b),
      wide: delta > 0 ? right : left,
      back: delta > 0 ? left : right,
    })
  }
  const apart = legsApart(plan, xAxis, xValues, held)
  if (small.length === 0 && apart.length === 0) return { xValues, sys: xSys }
  const level: Sep[] = []
  for (const c of small) {
    if (!held.admits(c.sep)) continue
    held.add(c.sep)
    level.push(c.sep)
  }
  const got = new Set(level)
  const wide: Sep[] = []
  for (const c of small) {
    if (got.has(c.sep)) continue
    // a step no side has room for is held by the rest of the drawing between the least and
    // nothing (the ports of a wider line leave no more); it stays as it is, since asking the
    // least of it anyway would ask more than the frames and columns around it can give
    const side = held.fits(c.wide) ? c.wide : held.fits(c.back) ? c.back : undefined
    if (!side) continue
    held.hold(side)
    wide.push(side)
  }
  return {
    xValues: solveX({ equal: level, sep: [...wide, ...apart] }),
    sys: xSys,
  }
}

/**
 * Two lines turning in one gap between rows each run down a leg there: one from a port on the
 * box above to where it turns, the other from where it turns to a port on the box below. Where
 * the two legs stand at one x they can run on each other for the stretch their heights share,
 * and nothing in the widths keeps them apart, since the ports are on different boxes. So where
 * the solve put such a pair of legs nearer than the pitch of their lines, the leg from above is
 * kept a pitch to the side the other line comes from (its run passes over the leg, crossing it
 * once, as the two would cross anyway), where the rest of the drawing has room for it.
 */
function legsApart(
  plan: XPlan,
  xAxis: Axis,
  xValues: Float64Array,
  held: ReturnType<typeof ledgerOf>,
): Sep[] {
  const { tracks } = plan
  type Leg = { line: string; port: Var; other: Var }
  const fromAbove = new Map<number, Leg[]>()
  const toBelow = new Map<number, Leg[]>()
  const push = (m: Map<number, Leg[]>, node: number, leg: Leg) =>
    m.set(node, [...(m.get(node) ?? []), leg])
  for (const [line, chain] of tracks.chains) {
    for (const [i, v] of chain.entries()) {
      if (v.kind !== 'lane') continue
      const lane = tracks.lanes.get(v.key)
      if (lane?.axis !== 'y') continue
      const [before, after_] = [chain[i - 1], chain[i + 1]]
      if (before?.kind === 'port' && tracks.entities.get(before.id)?.side === 'bottom' && after_)
        push(fromAbove, lane.node, { line, port: before, other: after_ })
      if (after_?.kind === 'port' && tracks.entities.get(after_.id)?.side === 'top' && before)
        push(toBelow, lane.node, { line, port: after_, other: before })
    }
  }
  const x = (v: Var) => {
    const r = xAxis.at(v)
    return (xValues[r.v] ?? 0) + r.off
  }
  const out: Sep[] = []
  for (const [node, ups] of fromAbove) {
    for (const down of toBelow.get(node) ?? []) {
      for (const up of ups) {
        if (up.line === down.line) continue
        const [pl, ql] = [plan.byLine.get(up.line), plan.byLine.get(down.line)]
        const pitch = pl && ql ? pitchOf(plan.metrics, pl, ql) : plan.metrics.gapApart
        if (Math.abs(x(up.port) - x(down.port)) >= pitch - plan.tolerance) continue
        const [u, d] = [xAxis.at(up.port), xAxis.at(down.port)]
        // the lower line comes from the left: the leg from above stands to its left
        const fromLeft = x(down.other) < x(down.port)
        const near = fromLeft ? after(u, d, pitch) : after(d, u, pitch)
        const far = fromLeft ? after(d, u, pitch) : after(u, d, pitch)
        const side = held.fits(near) ? near : held.fits(far) ? far : undefined
        if (!side) continue
        held.hold(side)
        out.push(side)
      }
    }
  }
  return out
}

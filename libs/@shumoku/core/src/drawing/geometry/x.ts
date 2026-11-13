// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { type AxisInput, solveAxis } from '../axis.js'
import { jogLeastOf } from '../kin.js'
import { ledgerOf } from '../ledger.js'
import { type AlignPlan, alignDown } from './align.js'
import { balanceOf } from './balance.js'
import type { Plan } from './plan.js'
import {
  type Axis,
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
  if (small.length === 0) return { xValues, sys: xSys }
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
    xValues: solveX({ equal: level, sep: wide }),
    sys: xSys,
  }
}

// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { frameKey, type LaneKey } from '../keys.js'
import { keepOff, pitchOf, whiteOf } from '../kin.js'
import { ROOT } from '../problem.js'
import type { Lane, Var } from '../tracks.js'
import type { Plan } from './plan.js'
import { type Axis, after, portChain } from './system.js'

/** A line's step from one x to the next (a run along a row, between its two ends). */
export interface Step {
  readonly a: Var
  readonly b: Var
  readonly line: string
}

/** A vertical run that turns at one of its ends needs room for the corner to its neighbours. */
const turns = (plan: Pick<Plan, 'tracks'>, l: Lane): boolean => {
  const { tracks } = plan
  if (l.win === 'left' || l.win === 'right' || l.wout === 'left' || l.wout === 'right') return true
  const chain = tracks.chains.get(l.line) ?? []
  const me = chain.findIndex((v) => v.kind === 'lane' && v.key === l.key)
  return [chain[me - 1], chain[me + 1]].some((v) =>
    v?.kind === 'port'
      ? tracks.entities.get(v.id)?.axis === 'y'
      : v !== undefined && tracks.lanes.get(v.key)?.essential === true,
  )
}
const cornerRoom = (plan: Pick<Plan, 'tracks' | 'corner'>, key: LaneKey): number => {
  const l = plan.tracks.lanes.get(key)
  return l && turns(plan, l) ? plan.corner(l.line) : 0
}

/** The room each column of runs needs between the boxes and frames beside it. */
function columnWidths(
  plan: Pick<
    Plan,
    'metrics' | 'corridors' | 'tracks' | 'isFrame' | 'ported' | 'haloLane' | 'lineOfLane' | 'corner'
  >,
  xAxis: Axis,
) {
  const { metrics, corridors, tracks } = plan
  const xSys = xAxis.sys
  for (const [id, node] of corridors.nodes.entries()) {
    if (node.kind !== 'column') continue
    const near = corridors.around.get(id) ?? {}
    const runs = tracks.columns.get(id) ?? []
    const leftEdge = near.left === undefined ? undefined : xAxis.highRef(near.left)
    const rightEdge = near.right === undefined ? undefined : xAxis.lowRef(near.right)
    const offLeft =
      near.left === undefined
        ? 0
        : plan.isFrame(near.left)
          ? whiteOf(metrics)
          : keepOff(metrics, plan.ported(near.left, 'right'))
    const offRight =
      near.right === undefined
        ? 0
        : plan.isFrame(near.right)
          ? whiteOf(metrics)
          : keepOff(metrics, plan.ported(near.right, 'left'))
    const gap =
      (near.left !== undefined && plan.isFrame(near.left)) ||
      (near.right !== undefined && plan.isFrame(near.right))
        ? metrics.groupGap
        : metrics.gap
    if (leftEdge && rightEdge) xSys.sep.push(after(leftEdge, rightEdge, gap))
    const frameKeyHere = node.frame === ROOT ? undefined : frameKey(node.frame)
    const firstKey = runs[0]
    const lastKey = runs[runs.length - 1]
    if (firstKey !== undefined && lastKey !== undefined) {
      const first = xAxis.at({ kind: 'lane', key: firstKey })
      const last = xAxis.at({ kind: 'lane', key: lastKey })
      const hFirst = plan.haloLane(firstKey) + cornerRoom(plan, firstKey)
      const hLast = plan.haloLane(lastKey) + cornerRoom(plan, lastKey)
      if (leftEdge) xSys.sep.push(after(leftEdge, first, offLeft + hFirst))
      else if (frameKeyHere)
        xSys.sep.push(after(xAxis.lowRef(frameKeyHere), first, whiteOf(metrics) + hFirst))
      if (rightEdge) xSys.sep.push(after(last, rightEdge, hLast + offRight))
      else if (frameKeyHere)
        xSys.sep.push(after(last, xAxis.highRef(frameKeyHere), hLast + whiteOf(metrics)))
      for (const [i, key] of runs.entries()) {
        const next = runs[i + 1]
        if (next === undefined) continue
        const [a, b] = [plan.lineOfLane(key), plan.lineOfLane(next)]
        if (a && b)
          xSys.sep.push(
            after(
              xAxis.at({ kind: 'lane', key }),
              xAxis.at({ kind: 'lane', key: next }),
              pitchOf(metrics, a, b) + cornerRoom(plan, key) + cornerRoom(plan, next),
            ),
          )
      }
    }
  }
}

/**
 * Siblings with nothing to do with each other stand apart; those that share ranks are held
 * apart by the columns between them.
 */
function siblingsApart(
  plan: Pick<Plan, 'metrics' | 'ranks' | 'problem' | 'kidsOf' | 'isFrame'>,
  xAxis: Axis,
) {
  const { metrics, ranks } = plan
  for (const f of plan.problem.frames) {
    const kids = plan.kidsOf(f.id)
    for (const [i, a] of kids.entries()) {
      for (const b of kids.slice(i + 1)) {
        const [sa, sb] = [ranks.span.get(a), ranks.span.get(b)]
        if (!sa || !sb || (sa[1] >= sb[0] && sb[1] >= sa[0]) || ranks.ordered(a, b)) continue
        xAxis.sys.sep.push(
          after(
            xAxis.highRef(a),
            xAxis.lowRef(b),
            plan.isFrame(a) || plan.isFrame(b) ? metrics.groupGap : metrics.gap,
          ),
        )
      }
    }
  }
}

/** What laying the widths reads of the plan. */
export type WidthsPlan = Parameters<typeof columnWidths>[0] &
  Parameters<typeof siblingsApart>[0] &
  Parameters<typeof portChain>[0]

/**
 * The separations the widths are made of: columns, siblings, and the ports along the tops.
 * They are added to `xAxis.sys`.
 */
export function layWidths(plan: WidthsPlan, xAxis: Axis): void {
  columnWidths(plan, xAxis)
  siblingsApart(plan, xAxis)
  portChain(plan, xAxis, 'x')
}

/** The steps of each line from one x to the next. */
export function stepsOf(plan: Pick<Plan, 'tracks'>): Step[] {
  const { tracks } = plan
  const steps: Step[] = []
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
  return steps
}

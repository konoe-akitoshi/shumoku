// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { keepOff, pitchOf, whiteOf } from '../kin.js'
import { frameKey, ROOT } from '../problem.js'
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
const turns = (pl: Pick<Plan, 'tracks'>, l: Lane): boolean => {
  const { tracks } = pl
  if (l.win === 'left' || l.win === 'right' || l.wout === 'left' || l.wout === 'right') return true
  const chain = tracks.chains.get(l.line) ?? []
  const me = chain.findIndex((v) => v.kind === 'lane' && v.key === l.key)
  return [chain[me - 1], chain[me + 1]].some((v) =>
    v?.kind === 'port'
      ? tracks.entities.get(v.id)?.axis === 'y'
      : v !== undefined && tracks.lanes.get(v.key)?.essential === true,
  )
}
const cornerRoom = (pl: Pick<Plan, 'tracks' | 'corner'>, key: string): number => {
  const l = pl.tracks.lanes.get(key)
  return l && turns(pl, l) ? pl.corner(l.line) : 0
}

/** The room each column of runs needs between the boxes and frames beside it. */
function columnWidths(
  pl: Pick<
    Plan,
    'metrics' | 'corridors' | 'tracks' | 'isFrame' | 'ported' | 'haloLane' | 'lineOfLane' | 'corner'
  >,
  X: Axis,
) {
  const { metrics, corridors, tracks } = pl
  const xs = X.sys
  for (const [id, node] of corridors.nodes.entries()) {
    if (node.kind !== 'column') continue
    const near = corridors.around.get(id) ?? {}
    const runs = tracks.columns.get(id) ?? []
    const leftEdge = near.left === undefined ? undefined : X.highRef(near.left)
    const rightEdge = near.right === undefined ? undefined : X.lowRef(near.right)
    const offLeft =
      near.left === undefined
        ? 0
        : pl.isFrame(near.left)
          ? whiteOf(metrics)
          : keepOff(metrics, pl.ported(near.left, 'right'))
    const offRight =
      near.right === undefined
        ? 0
        : pl.isFrame(near.right)
          ? whiteOf(metrics)
          : keepOff(metrics, pl.ported(near.right, 'left'))
    const gap =
      (near.left !== undefined && pl.isFrame(near.left)) ||
      (near.right !== undefined && pl.isFrame(near.right))
        ? metrics.groupGap
        : metrics.gap
    if (leftEdge && rightEdge) xs.sep.push(after(leftEdge, rightEdge, gap))
    const frameKeyHere = node.frame === ROOT ? undefined : frameKey(node.frame)
    const firstKey = runs[0]
    const lastKey = runs[runs.length - 1]
    if (firstKey !== undefined && lastKey !== undefined) {
      const first = X.at({ kind: 'lane', key: firstKey })
      const last = X.at({ kind: 'lane', key: lastKey })
      const hFirst = pl.haloLane(firstKey) + cornerRoom(pl, firstKey)
      const hLast = pl.haloLane(lastKey) + cornerRoom(pl, lastKey)
      if (leftEdge) xs.sep.push(after(leftEdge, first, offLeft + hFirst))
      else if (frameKeyHere)
        xs.sep.push(after(X.lowRef(frameKeyHere), first, whiteOf(metrics) + hFirst))
      if (rightEdge) xs.sep.push(after(last, rightEdge, hLast + offRight))
      else if (frameKeyHere)
        xs.sep.push(after(last, X.highRef(frameKeyHere), hLast + whiteOf(metrics)))
      for (const [i, key] of runs.entries()) {
        const next = runs[i + 1]
        if (next === undefined) continue
        const [a, b] = [pl.lineOfLane(key), pl.lineOfLane(next)]
        if (a && b)
          xs.sep.push(
            after(
              X.at({ kind: 'lane', key }),
              X.at({ kind: 'lane', key: next }),
              pitchOf(metrics, a, b) + cornerRoom(pl, key) + cornerRoom(pl, next),
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
  pl: Pick<Plan, 'metrics' | 'ranks' | 'problem' | 'kidsOf' | 'isFrame'>,
  X: Axis,
) {
  const { metrics, ranks } = pl
  for (const f of pl.problem.frames) {
    const kids = pl.kidsOf(f.id)
    for (const [i, a] of kids.entries()) {
      for (const b of kids.slice(i + 1)) {
        const [sa, sb] = [ranks.span.get(a), ranks.span.get(b)]
        if (!sa || !sb || (sa[1] >= sb[0] && sb[1] >= sa[0]) || ranks.ordered(a, b)) continue
        X.sys.sep.push(
          after(
            X.highRef(a),
            X.lowRef(b),
            pl.isFrame(a) || pl.isFrame(b) ? metrics.groupGap : metrics.gap,
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
 * They are added to `X.sys`.
 */
export function layWidths(pl: WidthsPlan, X: Axis): void {
  columnWidths(pl, X)
  siblingsApart(pl, X)
  portChain(pl, X, 'x')
}

/** The steps of each line from one x to the next. */
export function stepsOf(pl: Pick<Plan, 'tracks'>): Step[] {
  const { tracks } = pl
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

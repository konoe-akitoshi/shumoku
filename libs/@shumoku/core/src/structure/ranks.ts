// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import type * as input from '../input/model.js'
import { compare, setKey } from './keys.js'
import type {
  AnalysisGraph,
  Branch,
  PlaneStage,
  RankedBranch,
  Shapes,
  VertexRef,
} from './stage-types.js'
import type { Destination, GroupId } from './types.js'
import { groupParents } from './units.js'

/**
 * Stage 10. Each branch gets an order and what it holds whole.
 *
 * The order is the Strahler number of the branch counted away from the trunk: a branch with
 * nothing beyond it is 1; a branch whose onward branches have a largest order m is m, or m + 1
 * when two or more of them have m. Twins that hang off one fork count as one onward branch,
 * since they are one fan. The order depends only on the branch and what lies beyond it.
 *
 * The branch holds the outermost groups whose vertices (in the default plane) are all inside
 * it, and the segments and routing domains inside it that no such group holds.
 */
export function rankBranches(
  network: input.Network,
  analysis: Pick<AnalysisGraph, 'vertices'>,
  plane: Pick<PlaneStage, 'vertices' | 'twins'> | undefined,
  shapes: Pick<Shapes, 'shapes'>,
  branches: readonly Branch[],
): RankedBranch[] {
  if (!plane) return []
  const parents = groupParents(network)
  const segmentGroup = new Map(
    analysis.vertices.filter((v) => v.kind === 'segment').map((v) => [v.id, v.group]),
  )
  const inPlane = new Set(plane.vertices)
  const twinOf = new Map<VertexRef, string>()
  for (const t of plane.twins) {
    if (!t.adjacent) for (const m of t.members) twinOf.set(m, setKey(t.members))
  }
  const inside = shapes.shapes
    .map((s) => ({ group: s.group, vertices: s.vertices.filter((v) => inPlane.has(v)) }))
    .filter((s) => s.vertices.length > 0)

  const holdsOf = (reached: ReadonlySet<VertexRef>): Destination[] => {
    const whole = new Set(
      inside.filter((s) => s.vertices.every((v) => reached.has(v))).map((s) => s.group),
    )
    const outermost = [...whole].filter((g) => {
      const parent = parents.get(g)
      return parent === undefined || !whole.has(parent)
    })
    const insideWhole = (g: GroupId | undefined) => {
      for (let p = g; p !== undefined; p = parents.get(p)) if (whole.has(p)) return true
      return false
    }
    const loose: Destination[] = []
    for (const v of reached) {
      if (v.startsWith('segment:')) {
        const id = v.slice('segment:'.length)
        if (!insideWhole(segmentGroup.get(id))) loose.push({ segment: id })
      } else if (v.startsWith('routingDomain:')) {
        loose.push({ routingDomain: v.slice('routingDomain:'.length) })
      }
    }
    return [
      ...outermost.sort(compare).map((group) => ({ group })),
      ...loose.sort((a, b) => compare(destinationKey(a), destinationKey(b))),
    ]
  }

  const rank = (b: Branch): { ranked: RankedBranch; reached: Set<VertexRef> } => {
    const children = b.branches.map(rank)
    const reached = new Set<VertexRef>(b.via)
    for (const c of children) for (const v of c.reached) reached.add(v)

    // Twins hanging off one fork are one fan: they make one stream, not several.
    const streams = new Map<string, number>()
    for (const [i, c] of children.entries()) {
      const [only] = c.ranked.via
      const twins = c.ranked.via.length === 1 && only !== undefined ? twinOf.get(only) : undefined
      const stream = twins === undefined ? `own\0${i}` : `twins\0${c.ranked.at}\0${twins}`
      streams.set(stream, Math.max(streams.get(stream) ?? 0, c.ranked.order))
    }
    const orders = [...streams.values()]
    const largest = Math.max(0, ...orders)
    const order =
      orders.length === 0
        ? 1
        : orders.filter((o) => o === largest).length >= 2
          ? largest + 1
          : largest

    return {
      ranked: {
        at: b.at,
        via: b.via,
        order,
        holds: holdsOf(reached),
        branches: children.map((c) => c.ranked),
      },
      reached,
    }
  }
  return branches.map((b) => rank(b).ranked)
}

const destinationKey = (d: Destination): string =>
  'group' in d ? `g\0${d.group}` : 'segment' in d ? `s\0${d.segment}` : `r\0${d.routingDomain}`

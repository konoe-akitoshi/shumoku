// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { type PortKey, type SideKey, sideKey, splitSide } from './keys.js'
import type { PortSide, PortSideLayout } from './metrics.js'
import { must } from './must.js'
import { extentOf, widen } from './ports.js'
import type { Problem } from './problem.js'
import { portalsOf, sealedOf } from './sides.js'
import type { Tracks } from './tracks.js'

const SIDES: readonly PortSide[] = ['top', 'bottom', 'left', 'right']

/** The size of a box before it is widened: its item, or the member of a unit. */
function bodyOf(problem: Problem, box: string): { width: number; height: number } {
  for (const item of problem.items) {
    if (item.id === box) return item.size
    if (item.kind !== 'unit') continue
    const member = item.members.find((m) => m.node.id === box)
    if (member) return member.size
  }
  return { width: 0, height: 0 }
}

/**
 * How long each box's edges must be to hold the ports on them clear of one another and of the
 * corners, as the metrics ask for the names written beside them: the problem with every box made
 * large enough, units refitted, and with the layout of each edge (`Problem.portSides`) kept for
 * the stages after. The ports are known from the tracks, so a short edge is met by lengthening
 * the side and not by bending a line.
 */
export function needsOf(problem: Problem, tracks: Tracks): Problem {
  const widths = new Map<string, number>()
  const heights = new Map<string, number>()
  const ported = new Map<string, Map<PortSide, readonly PortKey[]>>()
  const sealed = sealedOf(problem)
  const portals = portalsOf(problem)
  for (const [key, list] of tracks.ports) {
    if (list.length === 0) continue
    const { box, side } = splitSide(key)
    // a leaf group's edges carry no names and are not lengthened: its size is settled
    if (sealed.has(box)) continue
    // a portal is a point; its width is the pitch of the lines beside it, not a margin
    if (portals.has(box)) continue
    ported.set(box, (ported.get(box) ?? new Map()).set(side, list))
  }
  const layouts = new Map<SideKey, PortSideLayout>()
  for (const [box, sides] of [...ported].sort(([p], [q]) => (p < q ? -1 : p > q ? 1 : 0))) {
    const body = bodyOf(problem, box)
    const named = (side: PortSide) =>
      (sides.get(side) ?? []).map((id) => {
        const name = tracks.entities.get(id)?.label
        return name === undefined ? {} : { name }
      })
    const laid = problem.metrics.portSides({
      bodyWidth: body.width,
      bodyHeight: body.height,
      sides: {
        top: named('top'),
        bottom: named('bottom'),
        left: named('left'),
        right: named('right'),
      },
    })
    const slot = must(problem.slots, box, 'slot of box')
    for (const side of SIDES) {
      const list = sides.get(side)
      if (!list) continue
      const layout = laid[side]
      layouts.set(sideKey(box, side), layout)
      const extent = extentOf(layout, slot, list.length)
      const into = side === 'top' || side === 'bottom' ? widths : heights
      into.set(box, Math.max(into.get(box) ?? 0, extent))
    }
  }
  return { ...widen(problem, widths, heights), portSides: layouts }
}

// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * How the names of a box's ports are shown, and the room each edge needs for them. The layout
 * hands over the ports of a box edge by edge, in the order they stand along it; this answers with
 * the text of every chip and the distance each neighbouring pair must keep. A pure function of
 * the names and the kit: the same input gives the same answer.
 *
 * Along a top or bottom edge the chips are laid side by side, so two neighbours keep half of each
 * chip's width between their centres. Along a left or right edge the chips run outward, so only
 * their height counts, and a long name widens nothing along the edge.
 */

import type { DrawingPortBox, DrawingPortLabelSpec, DrawingPortSideLayout } from '@shumoku/core'
import { type Kit, portLabelSize } from './measure.js'
import { displayPortNames } from './port-name.js'

type Side = 'top' | 'bottom' | 'left' | 'right'
const SIDES: readonly Side[] = ['top', 'bottom', 'left', 'right']

export function portSides(box: DrawingPortBox, kit: Kit): Record<Side, DrawingPortSideLayout> {
  const names = SIDES.flatMap((side) => box.sides[side].flatMap((p) => p.name ?? []))
  const shown = displayPortNames(names)
  const layout = (side: Side): DrawingPortSideLayout => {
    const horizontal = side === 'top' || side === 'bottom'
    const { port } = kit.tokens
    const labels: DrawingPortLabelSpec[] = box.sides[side].map((p) => {
      const text = p.name === undefined ? '' : (shown.get(p.name) ?? p.name)
      const size = portLabelSize(text, kit)
      return {
        text: size ? text.trim() : '',
        width: size?.width ?? 0,
        height: size?.height ?? 0,
        row: 0,
      }
    })
    const gaps = labels.slice(1).map((next, i) => {
      const prev = labels[i]
      const width = prev && next ? prev.width / 2 + next.width / 2 + port.labelGap : 0
      const lateral =
        prev && (prev.width > 0 || next.width > 0) ? port.labelHeight + port.labelGap : 0
      return { from: i, to: i + 1, min: Math.max(port.minSlot, horizontal ? width : lateral) }
    })
    const first = labels[0]
    const last = labels[labels.length - 1]
    const reach = (spec: DrawingPortLabelSpec | undefined) =>
      Math.max(
        port.minSlot / 2,
        horizontal ? (spec?.width ?? 0) / 2 - port.labelOverhang : (spec?.height ?? 0) / 2,
      )
    const widest = Math.max(0, ...labels.map((l) => l.width))
    return {
      labels,
      gaps,
      leadMargin: reach(first),
      trailMargin: reach(last),
      depth: port.labelOffset + (horizontal ? port.labelHeight : widest + port.labelGap),
    }
  }
  return {
    top: layout('top'),
    bottom: layout('bottom'),
    left: layout('left'),
    right: layout('right'),
  }
}

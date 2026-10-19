// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * Node sizing rules.
 *
 * Pure functions that compute node body size and full footprint
 * from the node's content and ports. The rule layer **consumes**
 * per-side port lists — it does not decide which side each port
 * lives on (that's an auto-placement concern).
 *
 * Text widths come through the injected `TextMeasurer` so the
 * rule layer's answer matches what the renderer will actually
 * draw (when canvas measurements are available).
 */

import { resolveIcon } from '../../icons/index.js'
import {
  DIAGRAM_CARD,
  nodeBadgeWidth,
  nodeContentMetrics,
  nodeContentScale,
  nodePresentation,
} from '../../models/diagram-presentation.js'
import type { DiagramAnnotation, NodeShape, NodeSpec } from '../../models/types.js'
import type { PortsBySide, Size, TextMeasurer } from './types.js'

/** Floor width for the body box so very short labels don't collapse. */
const MIN_NODE_WIDTH = 80
/** Floor height for the body box. */
const MIN_NODE_HEIGHT = 60
/** Minimum centre-to-centre spacing between adjacent ports on one side. */
const MIN_PORT_SLOT = 40
/** Air between two adjacent port-label boxes. */
const PORT_LABEL_GAP = 12

interface NodeLike {
  label?: string | string[]
  annotations?: DiagramAnnotation[]
  spec?: NodeSpec
  shape?: NodeShape
}

/**
 * Body size — the rectangle holding the icon + label, with no
 * port-lane allowance. Pure on the node's content.
 */
export function nodeBodySize(node: NodeLike, text: TextMeasurer): Size {
  const presentation = nodePresentation(node)
  const hasIcon = !!resolveIcon(node.spec)
  const metrics = nodeContentMetrics(presentation, hasIcon)
  const iconLane = hasIcon ? DIAGRAM_CARD.iconSize + DIAGRAM_CARD.iconGap : 0
  const headerWidth =
    Math.max(
      ...presentation.labels.map(
        (line, i) =>
          text.measure(line.replace(/<[^>]*>/g, ''), 'body') +
          (i === 0 && presentation.badge ? nodeBadgeWidth(presentation.badge) + 8 : 0),
      ),
      text.measure(presentation.subtitle, 'subgraph'),
    ) + iconLane
  const keyWidth = Math.max(0, ...presentation.rows.map((r) => text.measure(r.label, 'subgraph')))
  const valueWidth = Math.max(0, ...presentation.rows.map((r) => text.measure(r.value, 'subgraph')))
  const footerWidth = Math.max(
    keyWidth + (keyWidth ? 12 : 0) + valueWidth,
    presentation.hidden ? text.measure(`+${presentation.hidden} more`, 'subgraph') : 0,
  )
  const scale = nodeContentScale(node.shape)
  const width =
    Math.max(MIN_NODE_WIDTH, Math.max(headerWidth, footerWidth) + DIAGRAM_CARD.padding * 2) /
    scale.x
  const height = Math.max(MIN_NODE_HEIGHT, metrics.height + DIAGRAM_CARD.padding * 2) / scale.y
  return node.shape === 'circle'
    ? { width: Math.max(width, height), height: Math.max(width, height) }
    : { width, height }
}

/**
 * Slot width per port: the centre-to-centre spacing the layout
 * will use along the side carrying these ports. Caller supplies
 * the widest *measured* port label in the relevant side; the
 * function adds `PORT_LABEL_GAP` and floors at `MIN_PORT_SLOT`.
 */
function portSlotWidth(maxLabelPx: number): number {
  return Math.max(MIN_PORT_SLOT, maxLabelPx + PORT_LABEL_GAP)
}

/**
 * Footprint = body size enlarged so each side that carries
 * ports has enough room for those ports' slots. Width grows
 * with `max(top, bottom)` port count; height with
 * `max(left, right)`. Sides without ports don't inflate the
 * corresponding axis.
 *
 * The widest port label is measured *per side* via the
 * `TextMeasurer`; callers don't pre-measure anything. The slot
 * width for each side uses the side's own widest port label,
 * so a node with `Gi1/0/24-trunk` on bottom and `1` on top
 * gets a narrow top lane and a wide bottom lane.
 */
export function nodeFootprint(node: NodeLike, portsBySide: PortsBySide, text: TextMeasurer): Size {
  const body = nodeBodySize(node, text)

  const widest = (ports: { label?: string }[]): number =>
    ports.reduce((max, p) => Math.max(max, p.label ? text.measure(p.label, 'port') : 0), 0)

  const topMax = widest(portsBySide.top)
  const bottomMax = widest(portsBySide.bottom)
  const leftMax = widest(portsBySide.left)
  const rightMax = widest(portsBySide.right)

  // Per-side slot widths. The side reserves enough length to
  // hold its own ports at (i+1)/(N+1) ratios with `slot`
  // centre-to-centre spacing.
  const horizPorts = Math.max(portsBySide.top.length, portsBySide.bottom.length)
  const vertPorts = Math.max(portsBySide.left.length, portsBySide.right.length)
  const horizSlot = portSlotWidth(Math.max(topMax, bottomMax))
  const vertSlot = portSlotWidth(Math.max(leftMax, rightMax))
  const horizPortReq = horizPorts > 0 ? (horizPorts + 1) * horizSlot : 0
  const vertPortReq = vertPorts > 0 ? (vertPorts + 1) * vertSlot : 0

  return {
    width: Math.max(body.width, horizPortReq),
    height: Math.max(body.height, vertPortReq),
  }
}

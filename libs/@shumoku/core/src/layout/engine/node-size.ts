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

import {
  DEFAULT_ICON_SIZE,
  ICON_LABEL_GAP,
  LABEL_LINE_HEIGHT,
  NODE_HORIZONTAL_PADDING,
  NODE_VERTICAL_PADDING,
} from '../../constants.js'
import { getDeviceIcon } from '../../icons/index.js'
import type { NodeSpec } from '../../models/types.js'
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
  spec?: NodeSpec
}

/**
 * Body size — the rectangle holding the icon + label, with no
 * port-lane allowance. Pure on the node's content.
 */
export function nodeBodySize(node: NodeLike, text: TextMeasurer): Size {
  const labelLines = Array.isArray(node.label) ? node.label : node.label ? [node.label] : []
  const specType = node.spec?.kind !== 'service' ? node.spec?.type : undefined
  const hasIcon = !!(specType && getDeviceIcon(specType))

  const iconH = hasIcon ? DEFAULT_ICON_SIZE : 0
  const iconW = hasIcon ? DEFAULT_ICON_SIZE : 0
  const gapH = iconH > 0 ? ICON_LABEL_GAP : 0
  const contentH = iconH + gapH + labelLines.length * LABEL_LINE_HEIGHT

  // Real measurement — engine measures every line and takes
  // the max. The TextMeasurer falls back to an em-based
  // estimate when no canvas is available (SSR / CLI).
  const labelW = labelLines.reduce((max, line) => Math.max(max, text.measure(line, 'body')), 0)
  const contentW = Math.max(iconW, labelW)

  return {
    width: Math.max(MIN_NODE_WIDTH, contentW + NODE_HORIZONTAL_PADDING * 2),
    height: Math.max(MIN_NODE_HEIGHT, contentH + NODE_VERTICAL_PADDING),
  }
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

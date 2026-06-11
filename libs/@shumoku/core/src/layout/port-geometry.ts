// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * Port and port-label geometry — the single source of truth.
 *
 * A node OWNS its ports, a port OWNS its label. For that ownership to
 * mean anything geometrically, every consumer (renderer, invariant
 * checker, routed-geometry score, container bounds) must agree on the
 * boxes those elements occupy. This module is that agreement; the
 * renderer's drawing code mirrors these formulas.
 *
 * Label width uses a conservative character estimate (no font
 * measurement — layout must stay deterministic across environments).
 * The renderer's actual text is guaranteed to fit inside the estimate.
 */

import type { Bounds } from '../models/types.js'
import type { ResolvedPort } from './resolved-types.js'

/** Port label font size used by the renderer (px). */
export const PORT_LABEL_FONT = 9
/** Conservative per-character width at PORT_LABEL_FONT, monospace. */
export const PORT_LABEL_CHAR_W = 5.6
/** Label box height (one line incl. padding). */
export const PORT_LABEL_H = 12
/** Distance from the port center to where the label box starts. */
export const PORT_LABEL_BOX_OFFSET = 10

/** Estimated label box length along the reading direction. */
export function portLabelLength(label: string): number {
  return label.length * PORT_LABEL_CHAR_W + 4
}

/** Axis-aligned box of the port marker itself. */
export function portBox(port: ResolvedPort): Bounds {
  return {
    x: port.absolutePosition.x - port.size.width / 2,
    y: port.absolutePosition.y - port.size.height / 2,
    width: port.size.width,
    height: port.size.height,
  }
}

/**
 * Axis-aligned box of the port's label, or undefined when the port has
 * no label. Mirrors the renderer:
 *   - vertical (composite top/bottom): the label runs along the wire,
 *     away from the node face, in a 12px-wide strip.
 *   - horizontal: classic placement per side (above / below / beside).
 */
export function portLabelBox(port: ResolvedPort): Bounds | undefined {
  const label = port.label.trim()
  if (label.length === 0) return undefined
  const w = portLabelLength(label)
  const px = port.absolutePosition.x
  const py = port.absolutePosition.y

  if (port.labelOrientation === 'vertical' && (port.side === 'top' || port.side === 'bottom')) {
    // rotated strip along the wire: 12px across, w long, starting
    // PORT_LABEL_BOX_OFFSET from the port center
    if (port.side === 'top') {
      return { x: px - 9, y: py - PORT_LABEL_BOX_OFFSET - w, width: PORT_LABEL_H, height: w }
    }
    return { x: px - 3, y: py + PORT_LABEL_BOX_OFFSET, width: PORT_LABEL_H, height: w }
  }

  switch (port.side) {
    case 'left':
      return { x: px - PORT_LABEL_BOX_OFFSET - 2 - w, y: py - 9, width: w, height: PORT_LABEL_H }
    case 'right':
      return { x: px + PORT_LABEL_BOX_OFFSET + 2, y: py - 9, width: w, height: PORT_LABEL_H }
    case 'top':
      return {
        x: px - w / 2,
        y: py - PORT_LABEL_BOX_OFFSET - 2 - PORT_LABEL_H,
        width: w,
        height: PORT_LABEL_H,
      }
    default:
      return { x: px - w / 2, y: py + PORT_LABEL_BOX_OFFSET + 4, width: w, height: PORT_LABEL_H }
  }
}

/**
 * Reach of a port's label measured from the node face outward, along
 * the wire (vertical labels) — how much corridor the label needs
 * between this row and the next. Horizontal labels reach PORT_LABEL_H.
 */
export function portLabelReach(port: ResolvedPort): number {
  const box = portLabelBox(port)
  if (!box) return 0
  if (port.labelOrientation === 'vertical' && (port.side === 'top' || port.side === 'bottom')) {
    return PORT_LABEL_BOX_OFFSET + box.height
  }
  return PORT_LABEL_BOX_OFFSET + PORT_LABEL_H
}

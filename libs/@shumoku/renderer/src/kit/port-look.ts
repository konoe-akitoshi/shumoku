// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * What a port looks like: the square marker where a link meets a card, and the chip that names
 * it. The chip sits one offset away from the port on the side the port faces; the text reads
 * from there, inside the chip, half the padding in from the edge nearest the port.
 */

import type { KitColors } from './colors.js'
import { type Kit, portLabelSize } from './measure.js'
import type { Point, Side } from './scene.js'

export interface PortLook {
  marker: {
    x: number
    y: number
    size: number
    rx: number
    fill: string
    stroke: string
    strokeWidth: number
  }
  label?: {
    box: { x: number; y: number; width: number; height: number; rx: number; fill: string }
    text: {
      content: string
      x: number
      y: number
      anchor: 'start' | 'middle' | 'end'
      fill: string
    }
  }
}

/** Where the label's text is set: the middle of its line, and which way it reads from there. */
function textAt(at: Point, side: Side, offset: number) {
  switch (side) {
    case 'top':
      return { x: at.x, y: at.y - offset, anchor: 'middle' as const }
    case 'bottom':
      return { x: at.x, y: at.y + offset, anchor: 'middle' as const }
    case 'left':
      return { x: at.x - offset, y: at.y, anchor: 'end' as const }
    case 'right':
      return { x: at.x + offset, y: at.y, anchor: 'start' as const }
  }
}

export function portLook(
  port: { at: Point; side: Side; label?: string },
  kit: Kit,
  colors: KitColors,
): PortLook {
  const { tokens } = kit
  const { at } = port
  const marker = {
    x: at.x - tokens.port.size / 2,
    y: at.y - tokens.port.size / 2,
    size: tokens.port.size,
    rx: tokens.port.cornerRadius,
    fill: colors.port.fill,
    stroke: colors.port.stroke,
    strokeWidth: tokens.line.thin,
  }
  const size = portLabelSize(port.label, kit)
  if (!size) return { marker }
  const text = textAt(at, port.side, tokens.port.labelOffset)
  const inset = tokens.port.labelPadding / 2
  const x =
    text.anchor === 'middle'
      ? text.x - size.width / 2
      : text.anchor === 'end'
        ? text.x - size.width + inset
        : text.x - inset
  return {
    marker,
    label: {
      box: {
        x,
        y: text.y - size.height / 2,
        ...size,
        rx: tokens.port.labelCornerRadius,
        fill: colors.port.labelBackground,
      },
      text: {
        content: (port.label ?? '').trim(),
        x: text.x,
        y: text.y + tokens.text.portLabel.shift,
        anchor: text.anchor,
        fill: colors.port.labelText,
      },
    },
  }
}

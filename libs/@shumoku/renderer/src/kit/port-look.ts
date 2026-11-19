// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * What a port looks like: the marker where a link meets a card, and the chip that names it. The
 * marker is a square, widened across its line where the line is wider than the square, so a fast
 * link's line ends in its port instead of spilling round it. The chip sits one offset away from the port on the side the port faces; the text reads
 * from there, inside the chip, half the padding in from the edge nearest the port.
 */

import type { KitColors } from './colors.js'
import { type Kit, portLabelSize } from './measure.js'
import type { Point, Side } from './scene.js'

/**
 * What tells a drawn port apart from every other: its id and the side it stands on. A port whose
 * lines leave by two sides is drawn on each under one id, so the id alone is not enough.
 */
export const drawnPortKey = (port: { id: string; side: Side }): string => `${port.id}|${port.side}`

export interface PortLook {
  marker: {
    x: number
    y: number
    width: number
    height: number
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

/**
 * The widest line ending at each drawn point: a wire's first and last points are its ports, so a
 * port finds the lines it ends by where it stands.
 */
export function portLines(wires: readonly { points: readonly Point[]; stroke: number }[]) {
  const key = (p: Point) => `${p.x},${p.y}`
  const widest = new Map<string, number>()
  for (const { points, stroke } of wires) {
    for (const end of [points[0], points[points.length - 1]]) {
      if (!end) continue
      const k = key(end)
      widest.set(k, Math.max(widest.get(k) ?? 0, stroke))
    }
  }
  return (at: Point): number | undefined => widest.get(key(at))
}

export function portLook(
  port: { at: Point; side: Side; label?: string; row?: 0 | 1; line?: number },
  kit: Kit,
  colors: KitColors,
): PortLook {
  const { tokens } = kit
  const { at } = port
  const square = tokens.port.size
  // across the line: the square, or the line with a quarter of the square on each side
  const across = Math.max(square, (port.line ?? 0) + square / 2)
  const vertical = port.side === 'top' || port.side === 'bottom'
  const width = vertical ? across : square
  const height = vertical ? square : across
  const marker = {
    x: at.x - width / 2,
    y: at.y - height / 2,
    width,
    height,
    rx: tokens.port.cornerRadius,
    fill: colors.port.fill,
    stroke: colors.port.stroke,
    strokeWidth: tokens.line.thin,
  }
  const size = portLabelSize(port.label, kit)
  if (!size) return { marker }
  // a chip in the outer row stands one chip and its air farther out
  const out = tokens.port.labelOffset + (port.row ?? 0) * (size.height + tokens.port.labelRowGap)
  const text = textAt(at, port.side, out)
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

export interface PortCaptionLook {
  box: { x: number; y: number; width: number; height: number; rx: number; fill: string }
  text: {
    content: string
    x: number
    y: number
    anchor: 'start' | 'end'
    fill: string
  }
}

/**
 * The chip that writes, once, the start the names of an edge share. It sits where an edge's first
 * chip would, at the corner the edge starts from, reaching a chip's overhang past it.
 */
export function portCaptionLook(
  caption: { at: Point; side: Side; text: string },
  kit: Kit,
  colors: KitColors,
): PortCaptionLook | undefined {
  const size = portLabelSize(caption.text, kit)
  if (!size) return undefined
  const { tokens } = kit
  const { at, side } = caption
  const inset = tokens.port.labelPadding / 2
  const rx = tokens.port.labelCornerRadius
  const fill = colors.port.labelBackground
  const textFill = colors.port.labelText
  const content = caption.text.trim()
  const shift = tokens.text.portLabel.shift
  if (side === 'top' || side === 'bottom') {
    const x = at.x - tokens.port.labelOverhang
    const y = side === 'top' ? at.y - tokens.port.labelOffset : at.y + tokens.port.labelOffset
    return {
      box: { x, y: y - size.height / 2, ...size, rx, fill },
      text: { content, x: x + inset, y: y + shift, anchor: 'start', fill: textFill },
    }
  }
  const y = at.y - tokens.port.labelOverhang + size.height / 2
  if (side === 'right') {
    const x = at.x + tokens.port.labelOffset
    return {
      box: { x: x - inset, y: y - size.height / 2, ...size, rx, fill },
      text: { content, x, y: y + shift, anchor: 'start', fill: textFill },
    }
  }
  const x = at.x - tokens.port.labelOffset
  return {
    box: { x: x - size.width + inset, y: y - size.height / 2, ...size, rx, fill },
    text: { content, x, y: y + shift, anchor: 'end', fill: textFill },
  }
}

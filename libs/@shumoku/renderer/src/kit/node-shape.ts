// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * What each node shape is: its outline as the parts it is drawn from, the central rectangle of
 * the box that is safe for text, and whether the box is made square. One definition per shape,
 * so the outline, the room inside it and the size of the box never disagree.
 */

import type { NodeShape } from '@shumoku/core'
import type { Box } from './scene'

/**
 * One piece of an outline, as the SVG element that draws it. `body` is filled and edged, `fill`
 * only filled (it hides what lies behind), `edge` only edged.
 */
export interface Part {
  tag: 'rect' | 'circle' | 'polygon' | 'ellipse' | 'line'
  geometry: Record<string, number | string>
  paint: 'body' | 'fill' | 'edge'
}

export interface ShapeDef {
  /** The safe central rectangle for text, as shares of the box. */
  inner: { x: number; y: number }
  /** Whether the box is as tall as it is wide. */
  square: boolean
  /** The outline in a box; `radius` rounds the corners of the plain card. */
  outline(box: Box, radius: number): Part[]
}

const points = (...p: [number, number][]) => p.map(([x, y]) => `${x},${y}`).join(' ')

/** Proportions of the outlines, as shares of the box. Shapes, not sizes: they stretch with the box. */
const REACH = {
  /** Horizontal reach of a hexagon's slanted corners, as a share of half the width. */
  hexagon: 0.866,
  /** Height of a cylinder's end caps, as a share of the box height. */
  cylinderCap: 0.15,
  /** How far a trapezoid's top edge is pulled in, as a share of the box width. */
  trapezoid: 0.15,
} as const

const rectangle = (box: Box, radius = 0): Part => ({
  tag: 'rect',
  paint: 'body',
  geometry: {
    x: box.x,
    y: box.y,
    width: box.width,
    height: box.height,
    ...(radius > 0 && { rx: radius, ry: radius }),
  },
})

const centre = (box: Box) => ({
  cx: box.x + box.width / 2,
  cy: box.y + box.height / 2,
  hw: box.width / 2,
  hh: box.height / 2,
})

const FLAT = { x: 1, y: 1 }

export const NODE_SHAPES: Record<NodeShape, ShapeDef> = {
  rect: { inner: FLAT, square: false, outline: (box) => [rectangle(box)] },
  rounded: { inner: FLAT, square: false, outline: (box, radius) => [rectangle(box, radius)] },
  circle: {
    inner: { x: Math.SQRT1_2, y: Math.SQRT1_2 },
    square: true,
    outline: (box) => {
      const { cx, cy, hw, hh } = centre(box)
      return [{ tag: 'circle', paint: 'body', geometry: { cx, cy, r: Math.min(hw, hh) } }]
    },
  },
  diamond: {
    inner: { x: 0.5, y: 0.5 },
    square: false,
    outline: (box) => {
      const { cx, cy, hw, hh } = centre(box)
      return [
        {
          tag: 'polygon',
          paint: 'body',
          geometry: { points: points([cx, cy - hh], [cx + hw, cy], [cx, cy + hh], [cx - hw, cy]) },
        },
      ]
    },
  },
  hexagon: {
    inner: { x: 0.75, y: 0.85 },
    square: false,
    outline: (box) => {
      const { cx, cy, hw, hh } = centre(box)
      const hx = hw * REACH.hexagon
      return [
        {
          tag: 'polygon',
          paint: 'body',
          geometry: {
            points: points(
              [cx - hw, cy],
              [cx - hx, cy - hh],
              [cx + hx, cy - hh],
              [cx + hw, cy],
              [cx + hx, cy + hh],
              [cx - hx, cy + hh],
            ),
          },
        },
      ]
    },
  },
  cylinder: {
    inner: { x: 0.9, y: 0.7 },
    square: false,
    outline: (box) => {
      const { cx, cy, hw, hh } = centre(box)
      const cap = box.height * REACH.cylinderCap
      const top = cy - hh + cap
      const bottom = cy + hh - cap
      const side = (x: number): Part => ({
        tag: 'line',
        paint: 'edge',
        geometry: { x1: x, y1: top, x2: x, y2: bottom },
      })
      return [
        { tag: 'ellipse', paint: 'body', geometry: { cx, cy: bottom, rx: hw, ry: cap } },
        {
          tag: 'rect',
          paint: 'fill',
          geometry: { x: box.x, y: top, width: box.width, height: box.height - cap * 2 },
        },
        side(cx - hw),
        side(cx + hw),
        { tag: 'ellipse', paint: 'body', geometry: { cx, cy: top, rx: hw, ry: cap } },
      ]
    },
  },
  stadium: {
    inner: { x: 0.65, y: 0.8 },
    square: false,
    outline: (box) => [rectangle(box, box.height / 2)],
  },
  trapezoid: {
    inner: { x: 0.7, y: 0.85 },
    square: false,
    outline: (box) => {
      const { cx, cy, hw, hh } = centre(box)
      const indent = box.width * REACH.trapezoid
      return [
        {
          tag: 'polygon',
          paint: 'body',
          geometry: {
            points: points(
              [cx - hw + indent, cy - hh],
              [cx + hw - indent, cy - hh],
              [cx + hw, cy + hh],
              [cx - hw, cy + hh],
            ),
          },
        },
      ]
    },
  },
}

/** The definition of a shape; a node that names none, or one that is not known, is a plain card. */
export function shapeOf(shape?: string): ShapeDef {
  return NODE_SHAPES[(shape ?? 'rounded') as NodeShape] ?? NODE_SHAPES.rounded
}

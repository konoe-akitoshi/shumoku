// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

// Layout and rendering constants
// These values are shared between layout engines and renderers to ensure consistency

/** Default icon size in pixels (both width and height for square icons) */
export const DEFAULT_ICON_SIZE = 40

/** Gap between icon and label in pixels */
export const ICON_LABEL_GAP = 8

/** Line height for node labels in pixels */
export const LABEL_LINE_HEIGHT = 16

/** Vertical padding inside node box in pixels */
export const NODE_VERTICAL_PADDING = 16

/** Horizontal padding inside node box in pixels */
export const NODE_HORIZONTAL_PADDING = 16

/** Minimum spacing between ports in pixels (fallback when no labels) */
export const MIN_PORT_SPACING = 48

/**
 * Estimated average character width for port/endpoint labels
 * (font-size: 9px). Used by both layout engine (spacing
 * calculation) and renderer (background rect sizing). Slightly
 * over-estimates a typical proportional-font 9px character —
 * the safety margin is intentional: when the layout under-
 * estimates the width, adjacent port labels collide visually,
 * and there's no recovery once positions are set.
 */
export const SMALL_LABEL_CHAR_WIDTH = 6.5

/** Padding around port label for spacing calculation */
export const PORT_LABEL_PADDING = 16

/**
 * Rendered height of a port label box (font + small bg
 * padding). Keep in sync with the renderer's port-label-bg
 * rect height.
 */
export const PORT_LABEL_HEIGHT = 12

/**
 * Distance from a port's centre to its label's centre, along
 * the port's outward normal. The renderer offsets the label
 * away from the port body so the cable line stays clear of
 * the text. Keep in sync with the renderer's `LABEL_OFFSET`
 * in `svg-coords.ts`.
 *
 * Total per-side label extent (from port to far edge of
 * label background) ≈ PORT_LABEL_OFFSET + PORT_LABEL_HEIGHT/2
 * + a small bg padding the renderer adds, ~= 21 px in
 * practice.
 */
export const PORT_LABEL_OFFSET = 12

/**
 * Outer extent of a port label measured from the port itself,
 * along the port's outward normal. Includes LABEL_OFFSET,
 * half the bg rect height, and the renderer's small extra
 * padding so the result matches the visible label box's far
 * edge. Layout uses this when reserving inter-layer space so
 * two facing labels stop touching.
 */
export const PORT_LABEL_OUTER_REACH = PORT_LABEL_OFFSET + PORT_LABEL_HEIGHT / 2 + 3

/** Maximum icon width as percentage of node width (0.0 - 1.0) */
export const MAX_ICON_WIDTH_RATIO = 0.6

/** Body label font size in pixels — matches the renderer's `.node-label` CSS. */
export const BODY_LABEL_FONT_PX = 14

/** @deprecated use `measureTextWidth(label, BODY_LABEL_FONT_PX)` instead. */
export const ESTIMATED_CHAR_WIDTH = 7

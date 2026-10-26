// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * Sizes the kit owns. The layout never reads these: it asks `measure.ts` for the size of each
 * part and is handed back positions. Values are the ones the layout engine and the components
 * used to agree on separately.
 */

/** The node card. */
export const CARD = {
  padding: 16,
  iconSize: 28,
  iconGap: 12,
  rowHeight: 16,
  sectionGap: 12,
  /** Floor so very short labels do not collapse. */
  minWidth: 80,
  minHeight: 60,
  /** Air between the first title line and its badge. */
  badgeGap: 8,
  badgeHeight: 16,
  /** Air between a fact's key and its value. */
  factGap: 12,
  cornerRadius: 8,
} as const

/** Port markers and their labels. */
export const PORT = {
  /** Side of the square marker. */
  size: 8,
  /** Minimum centre-to-centre spacing between adjacent ports on one side. */
  minSlot: 40,
  /** Air between two adjacent port-label boxes. */
  labelGap: 12,
  labelHeight: 12,
  /** Room a label box adds to its text. */
  labelPadding: 4,
  /** Distance from the port centre to its label text. */
  labelOffset: 12,
} as const

/** The caption box on a wire. */
export const CAPTION = {
  lineHeight: 14,
  paddingX: 8,
  paddingY: 5,
  cornerRadius: 5,
} as const

/** The frame around a group. */
export const GROUP = {
  padding: 20,
  /** Band above the contents that holds the label. */
  labelBand: 28,
  /** Label inset from the frame's top-left corner. */
  labelX: 10,
  labelBaseline: 20,
  cornerRadius: 12,
  strokeWidth: 3,
} as const

/** Width of a wire that names none of its own. */
export const WIRE_WIDTH = 2

/** Text as the kit draws it. Each role is one CSS class in `Diagram.svelte`. */
export type TextRole = 'nodeTitle' | 'nodeText' | 'portLabel' | 'groupLabel' | 'linkCaption'

/** Font size and the width of one ASCII character, per role. */
export const TEXT: Record<TextRole, { fontSize: number; asciiWidth: number }> = {
  nodeTitle: { fontSize: 14, asciiWidth: 14 * 0.55 },
  nodeText: { fontSize: 11, asciiWidth: 11 * 0.55 },
  portLabel: { fontSize: 9, asciiWidth: 5.6 },
  groupLabel: { fontSize: 11, asciiWidth: 11 * 0.55 },
  linkCaption: { fontSize: 10, asciiWidth: 6.6 },
}

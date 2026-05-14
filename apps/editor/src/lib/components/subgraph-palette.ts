// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Subgraph color palette shared between the inline chip in the
 * detail panel and the picker popover. Tokens are defined in the
 * theme palette (libs/@shumoku/core/src/themes/{light,dark}.ts) —
 * the renderer resolves them per theme. The `preview` hex is the
 * light-mode fill used to paint the chip in the editor UI; the
 * actual rendered diagram still goes through the theme resolver.
 *
 * Adding a new token requires updating both theme files in core.
 */

export interface PaletteEntry {
  /** Stored value (theme token id). */
  token: string
  /** Human-friendly label shown in tooltips. */
  label: string
  /** Light-mode hex used to paint the UI chip. */
  preview: string
}

export const SUBGRAPH_PALETTE: readonly PaletteEntry[] = [
  { token: 'accent-blue', label: 'Blue', preview: '#bfdbfe' },
  { token: 'accent-green', label: 'Green', preview: '#bbf7d0' },
  { token: 'accent-red', label: 'Red', preview: '#fecdd3' },
  { token: 'accent-amber', label: 'Amber', preview: '#fcd34d' },
  { token: 'accent-purple', label: 'Purple', preview: '#e9d5ff' },
  { token: 'surface-1', label: 'Neutral 1', preview: '#e2e8f0' },
  { token: 'surface-2', label: 'Neutral 2', preview: '#cbd5e1' },
  { token: 'surface-3', label: 'Neutral 3', preview: '#94a3b8' },
] as const

const PREVIEW_BY_TOKEN = new Map(SUBGRAPH_PALETTE.map((e) => [e.token, e.preview]))

/**
 * Resolve a stored `style.fill` value (token id, hex, or empty) to a
 * concrete hex usable for UI chip rendering. Falls back to the
 * neutral surface color when the value is empty or unknown.
 */
export function previewFor(fill: string | undefined | null): string {
  if (!fill) return '#e2e8f0'
  if (fill.startsWith('#')) return fill
  return PREVIEW_BY_TOKEN.get(fill) ?? '#e2e8f0'
}

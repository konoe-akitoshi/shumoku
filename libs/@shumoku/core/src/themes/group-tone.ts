// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * The colours that tell groups apart. A theme names its `GroupTone`, lightnesses and chromas in
 * OKLCH by depth, and the hues it tells apart; a group takes one of them by its id
 * (`groupHueOf`), so nobody picks a group's colour and a group of the same id is the same colour
 * in every drawing. What the numbers must meet, `surfaces.test.ts` holds every theme to, for
 * every hue:
 *
 * - **Read**: the heading keeps 4.5:1 on the fill (WCAG 2.1, 1.4.3).
 * - **Seen on**: the wires, card edges and ports keep 3:1 on the fill (1.4.11), and the fill lies
 *   within 1.2:1 of the background, so every status and metric colour keeps 83% of its contrast.
 * - **Behind**: a group's edge is fainter than a card's, and each depth is a step further from the
 *   background than the one around it.
 * - **Told apart**: two hues' edges are `GROUP_EDGE_DISTINCT` apart and their fills noticeably so.
 */

import { colorDistance, OK_JND, oklchToHex } from './tone.js'
import type { SurfaceColors } from './types.js'

/** How far apart two groups' edges are, which carry their colour: a frame's edge is a line. */
export const GROUP_EDGE_DISTINCT = 3 * OK_JND
/** How far apart two groups' fills are: a faint tint, only noticed. */
export const GROUP_FILL_DISTINCT = OK_JND

/** The tone a theme colours groups in. */
export interface GroupTone {
  /** The hue of the first group, in degrees, such as the theme's primary colour's. */
  hue: number
  /** The fill, by depth: the top level first. Deeper groups take the last. */
  fill: { lightness: readonly [number, number, number]; chroma: number }
  /** The edge, by depth. */
  stroke: { lightness: readonly [number, number, number]; chroma: number }
  /** The heading. */
  text: { lightness: number; chroma: number }
}

const at = (values: readonly [number, number, number], depth: number) =>
  values[Math.min(Math.max(0, depth), values.length - 1)] ?? values[0]

/** What a group at this depth, in this hue, is drawn in. */
export function groupColors(tone: GroupTone, depth: number, hue: number): SurfaceColors {
  return {
    fill: oklchToHex(at(tone.fill.lightness, depth), tone.fill.chroma, hue),
    stroke: oklchToHex(at(tone.stroke.lightness, depth), tone.stroke.chroma, hue),
    text: oklchToHex(tone.text.lightness, tone.text.chroma, hue),
  }
}

/** The most groups a tone can tell apart, by edge and by fill. */
export function groupHueCapacity(tone: GroupTone): number {
  // Evenly spaced hues on a circle of radius c lie 2c·sin(π/n) apart.
  const fits = (n: number) =>
    2 * tone.stroke.chroma * Math.sin(Math.PI / n) >= GROUP_EDGE_DISTINCT &&
    2 * tone.fill.chroma * Math.sin(Math.PI / n) >= GROUP_FILL_DISTINCT
  let n = 1
  while (fits(n + 1)) n++
  return n
}

/** `count` hues, evenly spaced from the tone's; `undefined` when the tone cannot tell that many apart. */
export function groupHues(tone: GroupTone, count: number): number[] | undefined {
  if (count > groupHueCapacity(tone)) return undefined
  return Array.from({ length: count }, (_, i) => (tone.hue + (360 * i) / count) % 360)
}

/**
 * The hue a group is drawn in: one of the hues the tone tells apart, picked by its id (FNV-1a), so
 * it needs nothing but the group and is the same wherever the group is drawn.
 */
export function groupHueOf(tone: GroupTone, id: string): number {
  let hash = 0x811c9dc5
  for (const ch of id) hash = Math.imul(hash ^ (ch.codePointAt(0) ?? 0), 0x01000193) >>> 0
  const hues = groupHues(tone, groupHueCapacity(tone)) ?? [tone.hue]
  return hues[hash % hues.length] ?? tone.hue
}

/** How different two groups' colours look, edge and fill, at one depth. */
export function groupDistance(
  tone: GroupTone,
  depth: number,
  p: number,
  q: number,
): { edge: number; fill: number } {
  const [a, b] = [groupColors(tone, depth, p), groupColors(tone, depth, q)]
  return { edge: colorDistance(a.stroke, b.stroke), fill: colorDistance(a.fill, b.fill) }
}

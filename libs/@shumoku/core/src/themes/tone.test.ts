// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { describe, expect, it } from 'vitest'
import { darkTheme } from './dark.js'
import { lightTheme } from './light.js'
import {
  contrastRatio,
  fittingLineTone,
  hueOf,
  LINE_DISTINCT,
  lineColorCapacity,
  lineColors,
  NON_TEXT_CONTRAST,
  toneFits,
} from './tone.js'
import type { Theme } from './types.js'

/** Every background a line can lie on: the diagram's and every group surface's. */
const backgroundsOf = (theme: Theme) => [
  theme.colors.background,
  ...Object.values(theme.colors.surfaces).map((s) => s.fill),
]

/** OKLab distance of two `#rrggbb` colours. */
function distance(a: string, b: string): number {
  const lab = (hex: string) => {
    const [r, g, bl] = [1, 3, 5].map((i) => {
      const c = Number.parseInt(hex.slice(i, i + 2), 16) / 255
      return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
    }) as [number, number, number]
    const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * bl)
    const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * bl)
    const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * bl)
    return [
      0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
      1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
      0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
    ]
  }
  const [p, q] = [lab(a), lab(b)]
  return Math.hypot(...p.map((v, i) => v - (q[i] ?? 0)))
}

/** Hex rounding moves a colour by less than this in OKLab. */
const ROUNDING = 0.005

describe.each([
  ['light', lightTheme],
  ['dark', darkTheme],
])('the %s theme', (_name, theme) => {
  const tone = theme.colors.lineTone
  const backgrounds = backgroundsOf(theme)

  it('names a line tone every hue of which is seen against every background', () => {
    expect(toneFits(tone.lightness, tone.chroma, backgrounds)).toBe(true)
  })

  it('names the tone fittingLineTone works out, and its primary colour hue', () => {
    const fitting = fittingLineTone(backgrounds, tone.hue)
    expect(fitting?.lightness).toBeCloseTo(tone.lightness, 2)
    expect(tone.chroma).toBeLessThanOrEqual(fitting?.chroma ?? 0)
    expect(tone.chroma).toBeGreaterThan((fitting?.chroma ?? 0) * 0.95)
    expect(Math.abs(hueOf(theme.colors.primary) - tone.hue)).toBeLessThan(1)
  })

  it('tells several lines apart', () => {
    expect(lineColorCapacity(tone)).toBeGreaterThanOrEqual(5)
  })

  it.each(Array.from({ length: 12 }, (_, i) => i + 1))('%i colours', (n) => {
    const colors = lineColors(tone, n)
    if (n > lineColorCapacity(tone)) {
      expect(colors).toBeUndefined()
      return
    }
    expect(colors).toHaveLength(n)
    for (const c of colors ?? []) {
      for (const b of backgrounds)
        expect(contrastRatio(c, b)).toBeGreaterThanOrEqual(NON_TEXT_CONTRAST - 0.05)
    }
    for (const [i, a] of (colors ?? []).entries())
      for (const b of (colors ?? []).slice(i + 1))
        expect(distance(a, b)).toBeGreaterThan(LINE_DISTINCT - ROUNDING)
  })
})

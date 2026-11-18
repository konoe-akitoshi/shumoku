// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { describe, expect, it } from 'vitest'
import { darkTheme } from './dark.js'
import {
  GROUP_EDGE_DISTINCT,
  GROUP_FILL_DISTINCT,
  groupColors,
  groupDistance,
  groupHueCapacity,
  groupHues,
} from './group-tone.js'
import { lightTheme } from './light.js'
import { colorDistance, contrastRatio, NON_TEXT_CONTRAST, OK_JND } from './tone.js'
import type { SurfaceColors, Theme } from './types.js'

/** WCAG 2.1, 1.4.3 Contrast (Minimum): the least contrast body text keeps. */
const TEXT_CONTRAST = 4.5
/**
 * How far a surface may lie from the background, as a contrast ratio. A colour on the far side
 * of both (every wire, port, status border and metric colour the diagram draws) loses contrast
 * by exactly this ratio on the surface, so it keeps at least 1/1.2 = 83% of what it has on the
 * background, whatever colour it is: the status and metric colours need not be listed here.
 */
const SURFACE_FROM_BACKGROUND = 1.2
/** Hex rounding moves a colour by less than this in OKLab. */
const ROUNDING = 0.005

describe.each([
  ['light', lightTheme],
  ['dark', darkTheme],
])('the %s theme’s group surfaces', (_name, theme: Theme) => {
  const { colors } = theme
  const surfaces = colors.groupSurfaces.map((s, depth) => [depth, s] as const)

  it.each(surfaces)('at depth %i keeps its heading readable', (_d, s) => {
    expect(contrastRatio(s.text, s.fill)).toBeGreaterThanOrEqual(TEXT_CONTRAST)
  })

  it.each(surfaces)('at depth %i keeps the wires and card edges on it seen', (_d, s) => {
    expect(contrastRatio(colors.textSecondary, s.fill)).toBeGreaterThanOrEqual(NON_TEXT_CONTRAST)
  })

  it.each(surfaces)('at depth %i keeps the ports on it seen', (_d, s) => {
    const port = Math.max(
      contrastRatio(colors.port.fill, s.fill),
      contrastRatio(colors.port.stroke, s.fill),
    )
    expect(port).toBeGreaterThanOrEqual(NON_TEXT_CONTRAST)
  })

  it.each(surfaces)('at depth %i keeps the status and metric colours on it seen', (_d, s) => {
    expect(contrastRatio(s.fill, colors.background)).toBeLessThanOrEqual(SURFACE_FROM_BACKGROUND)
  })

  it.each(surfaces)('at depth %i recedes behind the cards: its edge is fainter', (_d, s) => {
    expect(contrastRatio(s.stroke, colors.background)).toBeLessThan(
      contrastRatio(colors.textSecondary, colors.background),
    )
  })

  it('steps each depth a noticeable step further from the background, fill and edge', () => {
    const away = (pick: (s: (typeof colors.groupSurfaces)[number]) => string) =>
      colors.groupSurfaces.map((s) => colorDistance(pick(s), colors.background))
    for (const steps of [away((s) => s.fill), away((s) => s.stroke)]) {
      expect(steps[0] ?? 0).toBeGreaterThanOrEqual(OK_JND - ROUNDING)
      for (const [i, d] of steps.slice(1).entries())
        expect(d - (steps[i] ?? 0)).toBeGreaterThanOrEqual(OK_JND - ROUNDING)
    }
  })
})

describe.each([
  ['light', lightTheme],
  ['dark', darkTheme],
])('the %s theme’s group tone', (_name, theme: Theme) => {
  const { colors } = theme
  const tone = colors.groupTone
  // Every hue a group can take, every few degrees, at every depth.
  const hues = Array.from({ length: 72 }, (_, i) => i * 5)
  const each = (check: (s: SurfaceColors, depth: number, hue: number) => void) => {
    for (const hue of hues)
      for (const depth of [0, 1, 2]) check(groupColors(tone, depth, hue), depth, hue)
  }

  it('keeps the heading readable on every hue', () => {
    each((s, d, h) =>
      expect(contrastRatio(s.text, s.fill), `depth ${d} hue ${h}`).toBeGreaterThanOrEqual(
        TEXT_CONTRAST,
      ),
    )
  })

  it('keeps the wires, card edges and ports seen on every hue', () => {
    each((s, d, h) => {
      expect(
        contrastRatio(colors.textSecondary, s.fill),
        `depth ${d} hue ${h}`,
      ).toBeGreaterThanOrEqual(NON_TEXT_CONTRAST)
      const port = Math.max(
        contrastRatio(colors.port.fill, s.fill),
        contrastRatio(colors.port.stroke, s.fill),
      )
      expect(port, `depth ${d} hue ${h}`).toBeGreaterThanOrEqual(NON_TEXT_CONTRAST)
    })
  })

  it('keeps the status and metric colours seen on every hue', () => {
    each((s, d, h) =>
      expect(contrastRatio(s.fill, colors.background), `depth ${d} hue ${h}`).toBeLessThanOrEqual(
        SURFACE_FROM_BACKGROUND,
      ),
    )
  })

  it('keeps every hue behind the cards, each depth a step further from the background', () => {
    const card = contrastRatio(colors.textSecondary, colors.background)
    each((s) => expect(contrastRatio(s.stroke, colors.background)).toBeLessThan(card))
    for (const hue of hues) {
      for (const pick of ['fill', 'stroke'] as const) {
        const away = [0, 1, 2].map((d) =>
          colorDistance(groupColors(tone, d, hue)[pick], colors.background),
        )
        expect(away[0] ?? 0).toBeGreaterThanOrEqual(OK_JND - ROUNDING)
        for (const [i, d] of away.slice(1).entries())
          expect(d - (away[i] ?? 0), `${pick} hue ${hue}`).toBeGreaterThanOrEqual(OK_JND - ROUNDING)
      }
    }
  })

  it('tells several groups apart, by edge and by fill', () => {
    const capacity = groupHueCapacity(tone)
    expect(capacity).toBeGreaterThanOrEqual(5)
    for (let n = 2; n <= capacity; n++) {
      const spread = groupHues(tone, n) ?? []
      expect(spread).toHaveLength(n)
      for (const [i, p] of spread.entries())
        for (const q of spread.slice(i + 1))
          for (const depth of [0, 1, 2]) {
            const apart = groupDistance(tone, depth, p, q)
            expect(apart.edge, `${n} hues, ${p}/${q}`).toBeGreaterThan(
              GROUP_EDGE_DISTINCT - ROUNDING * 2,
            )
            expect(apart.fill, `${n} hues, ${p}/${q}`).toBeGreaterThan(
              GROUP_FILL_DISTINCT - ROUNDING * 2,
            )
          }
    }
    expect(groupHues(tone, capacity + 1)).toBeUndefined()
  })
})

it('gives a group the same colour of the tone in either theme: both have as many hues', () => {
  expect(groupHueCapacity(lightTheme.colors.groupTone)).toBe(
    groupHueCapacity(darkTheme.colors.groupTone),
  )
})

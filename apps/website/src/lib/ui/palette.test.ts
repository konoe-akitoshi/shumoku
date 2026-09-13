import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  brandSeeds,
  contrast,
  foundationPalettes,
  hexToOklch,
  type PaletteRole,
  paletteColor,
  paletteCss,
  themeColors,
} from './palette-model'
import { simulateColor, type Vision, visionMatrices } from './palette-vision'

const css = readFileSync(new URL('./palette.css', import.meta.url), 'utf8')

it('committed CSS is reproducibly generated from the OKLCH design', () => {
  expect(css.replaceAll('\r\n', '\n')).toBe(paletteCss())
  expect(contrast('#000000', '#ffffff')).toBe(21)
})

it('preserves the logo seeds and orders each foundation ramp by lightness', () => {
  expect(paletteColor(foundationPalettes['Brand green'][500]).hex).toBe(brandSeeds.green)
  expect(paletteColor(foundationPalettes['Brand lime'][500]).hex).toBe(brandSeeds.lime)
  for (const stops of Object.values(foundationPalettes)) {
    let previous = 1
    for (const design of Object.values(stops)) {
      const actual = hexToOklch(paletteColor(design).hex)
      expect(actual[0]).toBeLessThan(previous)
      expect(actual[1]).toBeGreaterThan(0)
      previous = actual[0]
    }
  }
})

for (const theme of ['light', 'dark'] as const) {
  const colors = themeColors(theme)
  const surfaces: PaletteRole[] = [
    'site-bg',
    'site-brand-wash',
    'site-section-alt',
    'ui-surface',
    'ui-field-surface',
    'ui-workspace-shell',
    'ui-control-hover',
    'ui-control-active',
  ]
  it(`${theme}: text, boundaries and focus survive all neutral states`, () => {
    for (const background of surfaces) {
      for (const foreground of ['site-fg', 'site-muted'] as const) {
        expect(contrast(colors[foreground], colors[background])).toBeGreaterThanOrEqual(4.5)
      }
      for (const foreground of ['site-control-line', 'ui-focus'] as const) {
        expect(contrast(colors[foreground], colors[background])).toBeGreaterThanOrEqual(3)
      }
    }
  })
  it(`${theme}: disabled text remains readable without opacity`, () => {
    expect(contrast(colors['site-muted'], colors['ui-surface'])).toBeGreaterThanOrEqual(4.5)
  })
  for (const mode of Object.keys(visionMatrices) as Vision[]) {
    it(`${theme}/${mode}: simulated labels remain readable`, () => {
      const transformed = (role: PaletteRole) => simulateColor(colors[role], mode)
      for (const background of ['ui-primary', 'ui-primary-hover', 'ui-primary-active'] as const) {
        expect(
          contrast(transformed('ui-on-primary'), transformed(background)),
        ).toBeGreaterThanOrEqual(4.5)
      }
      for (const background of surfaces) {
        expect(contrast(transformed('site-muted'), transformed(background))).toBeGreaterThanOrEqual(
          4.5,
        )
      }
    })
  }
}

function luminance(hex: string) {
  const channels = [1, 3, 5].map((offset) => {
    const value = Number.parseInt(hex.slice(offset, offset + 2), 16) / 255
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  })
  return (channels[0] ?? 0) * 0.2126 + (channels[1] ?? 0) * 0.7152 + (channels[2] ?? 0) * 0.0722
}

describe('theme palette text contrast', () => {
  for (const theme of [':root', '.dark']) {
    it(`${theme}: readable text on the intended surfaces`, () => {
      const block = css.split(`${theme} {`)[1]?.split('}')[0] ?? ''
      const colors = Object.fromEntries(
        [...block.matchAll(/(--[\w-]+):\s*(#[\da-f]{6})/g)].map((match) => [match[1], match[2]]),
      )
      const ratio = (foreground: string, background: string) => {
        const fg = colors[foreground]
        const bg = colors[background]
        if (!fg || !bg) throw new Error(`Missing palette role: ${foreground} / ${background}`)
        const a = luminance(fg)
        const b = luminance(bg)
        return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
      }
      for (const background of [
        '--site-bg',
        '--ui-surface',
        '--ui-field-surface',
        '--ui-control-hover',
        '--ui-control-active',
      ]) {
        expect(ratio('--site-fg', background)).toBeGreaterThanOrEqual(4.5)
      }
      for (const foreground of ['--site-muted', '--site-accent', '--ui-danger']) {
        for (const background of ['--site-bg', '--ui-surface', '--ui-field-surface']) {
          expect(ratio(foreground, background)).toBeGreaterThanOrEqual(4.5)
        }
      }
      for (const background of ['--ui-primary', '--ui-primary-hover', '--ui-primary-active']) {
        expect(ratio('--ui-on-primary', background)).toBeGreaterThanOrEqual(4.5)
      }
    })
  }
})

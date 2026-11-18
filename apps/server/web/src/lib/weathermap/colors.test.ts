import {
  contrastRatio,
  darkTheme,
  LINE_DISTINCT,
  lightTheme,
  NON_TEXT_CONTRAST,
} from '@shumoku/core'
import { describe, expect, it } from 'vitest'
import {
  DEVICE_STATUSES,
  METRIC_PALETTES,
  MONITORING_STATES,
  metricColorsCss,
  UTILIZATION_STEPS,
  utilizationColor,
  utilizationStep,
} from './colors'

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

/**
 * A group's surface lies within 1.2:1 of the background, so a line that keeps this much against
 * the background still keeps `NON_TEXT_CONTRAST` on any group.
 */
const LINK_CONTRAST = NON_TEXT_CONTRAST * 1.2

describe.each([
  ['light', lightTheme],
  ['dark', darkTheme],
] as const)('the %s theme’s live colours', (name, theme) => {
  const palette = METRIC_PALETTES[name]
  const { background, surface: card } = theme.colors
  const steps = UTILIZATION_STEPS.map((s) => [s.key, palette.utilization[s.key]] as const)

  it.each(steps)('draws a %s link that is seen on the diagram and on any group', (_k, c) => {
    expect(contrastRatio(c.link, background)).toBeGreaterThanOrEqual(LINK_CONTRAST)
  })

  it.each(steps)('streams a %s flow told apart from its link', (_k, c) => {
    expect(distance(c.flow, c.link)).toBeGreaterThanOrEqual(LINE_DISTINCT)
  })

  it('tells each utilization step apart from the next', () => {
    for (const [i, [key, c]] of steps.slice(1).entries()) {
      const before = steps[i]
      if (!before) continue
      const [prev, p] = before
      expect(distance(c.link, p.link), `${prev} / ${key}`).toBeGreaterThanOrEqual(LINE_DISTINCT)
    }
  })

  it.each([
    ...DEVICE_STATUSES.map((s) => [`status ${s}`, palette.status[s]] as const),
    ...MONITORING_STATES.map((s) => [`monitoring ${s}`, palette.monitoring[s]] as const),
  ])('draws the %s mark seen on its card and the diagram', (_k, color) => {
    expect(contrastRatio(color, card)).toBeGreaterThanOrEqual(NON_TEXT_CONTRAST)
    expect(contrastRatio(color, background)).toBeGreaterThanOrEqual(NON_TEXT_CONTRAST)
  })
})

describe('utilizationStep', () => {
  it.each([
    [0, 'idle'],
    [Number.NaN, 'idle'],
    [0.5, 'low'],
    [25, 'low'],
    [25.1, 'moderate'],
    [75, 'busy'],
    [90, 'high'],
    [99, 'saturated'],
    [140, 'saturated'],
    [-3, 'idle'],
  ])('puts %s%% in the %s step', (u, key) => {
    expect(utilizationStep(u).key).toBe(key)
  })

  it('names the colour as a variable that follows the theme', () => {
    expect(utilizationColor(60)).toBe('var(--shumoku-util-busy)')
  })
})

describe('metricColorsCss', () => {
  it('sets every colour for light on :root and for dark on .dark', () => {
    const css = metricColorsCss()
    const [light, dark] = css.split('.dark')
    expect(light).toContain(`--shumoku-util-high: ${METRIC_PALETTES.light.utilization.high.link};`)
    expect(dark).toContain(`--shumoku-util-high: ${METRIC_PALETTES.dark.utilization.high.link};`)
    expect(dark).toContain(
      `--shumoku-monitoring-paused: ${METRIC_PALETTES.dark.monitoring.paused};`,
    )
  })
})

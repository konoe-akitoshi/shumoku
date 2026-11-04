// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * The colours that tell lines apart, such as one per VLAN. A theme names its `LineTone`, three
 * numbers in OKLCH, where equal numbers look equally light and equally vivid whatever the hue;
 * every colour follows from them. What the numbers must meet is fixed by two standards and one
 * judgement, and `tone.test.ts` holds every theme to them:
 *
 * - **Seen** (WCAG 2.1, success criterion 1.4.11): a line is a graphical object, so every colour of
 *   the tone keeps a contrast ratio of at least 3:1 against every background a line can lie on.
 * - **Told apart** (OKLab, where equal distances look equally different): two colours are at least
 *   `LINE_DISTINCT` apart, four just-noticeable differences, since a thin line shows less of its
 *   colour than a patch does; a coloured line is that far from a grey one, too.
 * - **Soft**: of the colours that are seen and told apart, the least vivid. A few colours are
 *   muted; more of them take more chroma, up to the tone's `chroma`.
 *
 * `fittingLineTone` works out the numbers for a new theme from its backgrounds.
 */

/** WCAG 2.1, 1.4.11 Non-text Contrast: the least contrast a graphical object keeps. */
export const NON_TEXT_CONTRAST = 3
/** The just-noticeable difference in OKLab (the threshold CSS Color 4 gamut mapping uses). */
const OK_JND = 0.02
/** How far apart two line colours are, and a coloured line from a grey one. */
export const LINE_DISTINCT = 4 * OK_JND

/** The tone a theme colours lines in. */
export interface LineTone {
  /** OKLCH lightness, 0 (black) to 1 (white): one light enough and dark enough for every background. */
  lightness: number
  /** The most OKLCH chroma any hue may take at that lightness and still be seen and shown. */
  chroma: number
  /** The hue of the first colour, in degrees, such as the theme's primary colour's. */
  hue: number
}

/**
 * `count` colours of a tone, as `#rrggbb`: hues evenly spaced from the tone's, at the least chroma
 * that keeps them told apart. `undefined` when the tone has no room for that many.
 */
export function lineColors(tone: LineTone, count: number): string[] | undefined {
  if (count <= 0) return []
  // Evenly spaced hues on a circle of radius c lie 2c·sin(π/n) apart; one colour needs only to
  // differ from grey.
  const apart = count === 1 ? LINE_DISTINCT : LINE_DISTINCT / (2 * Math.sin(Math.PI / count))
  const chroma = Math.max(LINE_DISTINCT, apart)
  if (chroma > tone.chroma) return undefined
  return Array.from({ length: count }, (_, i) =>
    oklchToHex(tone.lightness, chroma, tone.hue + (360 * i) / count),
  )
}

/** The most colours a tone can tell apart. */
export function lineColorCapacity(tone: LineTone): number {
  if (tone.chroma < LINE_DISTINCT) return 0
  let n = 1
  while (LINE_DISTINCT / (2 * Math.sin(Math.PI / (n + 1))) <= tone.chroma) n++
  return n
}

/**
 * Whether every hue of a lightness and chroma is shown by a screen and seen against every
 * background, checked every few degrees.
 */
export function toneFits(
  lightness: number,
  chroma: number,
  backgrounds: readonly string[],
): boolean {
  const ys = backgrounds.map((b) => luminance(hexRgb(b)))
  for (let hue = 0; hue < 360; hue += 2) {
    const rgb = linearRgb(lightness, chroma, hue)
    if (rgb.some((v) => v < 0 || v > 1)) return false
    const y = luminance(rgb)
    if (ys.some((b) => (Math.max(y, b) + 0.05) / (Math.min(y, b) + 0.05) < NON_TEXT_CONTRAST))
      return false
  }
  return true
}

/**
 * The tone that tells the most lines apart over these backgrounds: of the lightnesses at which
 * every hue is seen, the one that leaves the most chroma. For writing a theme's `lineTone`.
 */
export function fittingLineTone(backgrounds: readonly string[], hue: number): LineTone | undefined {
  let best: LineTone | undefined
  for (let step = 0; step <= 200; step++) {
    const lightness = step / 200
    if (!toneFits(lightness, 0, backgrounds)) continue
    let lo = 0
    let hi = 0.4
    for (let i = 0; i < 20; i++) {
      const mid = (lo + hi) / 2
      if (toneFits(lightness, mid, backgrounds)) lo = mid
      else hi = mid
    }
    if (!best || lo > best.chroma) best = { lightness, chroma: lo, hue }
  }
  return best
}

/** The WCAG contrast ratio of two colours. */
export function contrastRatio(a: string, b: string): number {
  const ya = luminance(hexRgb(a))
  const yb = luminance(hexRgb(b))
  return (Math.max(ya, yb) + 0.05) / (Math.min(ya, yb) + 0.05)
}

/** A colour's OKLCH hue, in degrees. */
export function hueOf(hex: string): number {
  const [r, g, b] = hexRgb(hex)
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
  const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s
  const bb = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s
  return ((Math.atan2(bb, a) * 180) / Math.PI + 360) % 360
}

/** An OKLCH colour as `#rrggbb`. */
export function oklchToHex(lightness: number, chroma: number, hue: number): string {
  const channel = (v: number) => {
    const c = Math.min(1, Math.max(0, v))
    const encoded = c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055
    return Math.round(encoded * 255)
      .toString(16)
      .padStart(2, '0')
  }
  return `#${linearRgb(lightness, chroma, hue).map(channel).join('')}`
}

/** `#rrggbb` as linear sRGB. */
function hexRgb(hex: string): [number, number, number] {
  const at = (i: number) => {
    const c = Number.parseInt(hex.slice(i, i + 2), 16) / 255
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  return [at(1), at(3), at(5)]
}

/** The relative luminance of linear sRGB (WCAG 2.1). */
function luminance([r, g, b]: readonly number[]): number {
  return 0.2126 * (r ?? 0) + 0.7152 * (g ?? 0) + 0.0722 * (b ?? 0)
}

/** OKLCH to linear sRGB, by way of OKLab (Björn Ottosson's matrices). */
function linearRgb(lightness: number, chroma: number, hue: number): [number, number, number] {
  const h = (hue * Math.PI) / 180
  const a = chroma * Math.cos(h)
  const b = chroma * Math.sin(h)
  const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ]
}

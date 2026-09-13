// Design inputs, not browser-runtime theme state. See docs/website-color-palette.md.
export type Oklch = readonly [lightness: number, chroma: number, hue: number]
type Rgb = readonly [number, number, number]

export const brandSeeds = { green: '#14ae67', lime: '#8fc31f' } as const

export function decodeHex(hex: string): Rgb {
  const channels = [1, 3, 5].map((offset) => {
    const value = Number.parseInt(hex.slice(offset, offset + 2), 16) / 255
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  })
  return [channels[0] ?? 0, channels[1] ?? 0, channels[2] ?? 0]
}

export function hexToOklch(hex: string): Oklch {
  const [r, g, b] = decodeHex(hex)
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
  const lightness = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s
  const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s
  const axisB = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s
  return [lightness, Math.hypot(a, axisB), ((Math.atan2(axisB, a) * 180) / Math.PI + 360) % 360]
}

const greenHue = hexToOklch(brandSeeds.green)[2]
const limeHue = hexToOklch(brandSeeds.lime)[2]
const green = (lightness: number, chroma: number): Oklch => [lightness, chroma, greenHue]
const neutral = (lightness: number): Oklch => [
  lightness,
  Math.min(0.018, lightness * 0.06, (1 - lightness) * 0.35),
  80,
]
const lime = (lightness: number, chroma: number): Oklch => [lightness, chroma, limeHue]

export const foundationPalettes = {
  'Brand green': {
    50: green(0.97, 0.025),
    100: green(0.92, 0.055),
    200: green(0.88, 0.075),
    300: green(0.82, 0.1),
    400: green(0.76, 0.12),
    500: hexToOklch(brandSeeds.green),
    600: green(0.56, 0.14),
    700: green(0.46, 0.11),
    800: green(0.4, 0.1),
    900: green(0.34, 0.09),
    950: green(0.22, 0.05),
  },
  'Brand neutral': {
    25: neutral(0.995),
    50: neutral(0.98),
    100: neutral(0.92),
    200: neutral(0.86),
    300: neutral(0.8),
    400: neutral(0.74),
    500: neutral(0.5),
    600: neutral(0.44),
    700: neutral(0.38),
    800: neutral(0.32),
    850: neutral(0.26),
    900: neutral(0.2),
    950: neutral(0.14),
  },
  'Brand lime': {
    50: lime(0.97, 0.035),
    100: lime(0.92, 0.08),
    300: lime(0.84, 0.14),
    500: hexToOklch(brandSeeds.lime),
    700: lime(0.46, 0.11),
    900: lime(0.28, 0.06),
  },
} as const

export const paletteDesign = {
  light: {
    'site-bg': neutral(0.98),
    'site-fg': neutral(0.2),
    'site-muted': neutral(0.38),
    'site-line': neutral(0.74),
    'site-control-line': neutral(0.5),
    'site-accent': green(0.46, 0.11),
    'ui-focus': [0.46, 0.12, 250],
    'ui-surface': neutral(0.92),
    'ui-field-surface': neutral(0.995),
    'ui-workspace-shell': neutral(0.86),
    'ui-control-hover': neutral(0.86),
    'ui-control-active': neutral(0.8),
    'ui-primary': green(0.46, 0.11),
    'ui-primary-hover': green(0.4, 0.1),
    'ui-primary-active': green(0.34, 0.09),
    'ui-on-primary': neutral(0.98),
    'ui-danger': [0.46, 0.15, 30],
  },
  dark: {
    'site-bg': neutral(0.2),
    'site-fg': neutral(0.98),
    'site-muted': neutral(0.86),
    'site-line': neutral(0.44),
    'site-control-line': neutral(0.74),
    'site-accent': green(0.82, 0.1),
    'ui-focus': [0.82, 0.1, 250],
    'ui-surface': neutral(0.26),
    'ui-field-surface': neutral(0.32),
    'ui-workspace-shell': neutral(0.14),
    'ui-control-hover': neutral(0.38),
    'ui-control-active': neutral(0.44),
    'ui-primary': green(0.82, 0.1),
    'ui-primary-hover': green(0.88, 0.075),
    'ui-primary-active': green(0.76, 0.12),
    'ui-on-primary': neutral(0.2),
    'ui-danger': [0.82, 0.1, 30],
  },
} as const satisfies Record<string, Record<string, Oklch>>

export type PaletteTheme = keyof typeof paletteDesign
export type PaletteRole = keyof typeof paletteDesign.light

function linearRgb([lightness, chroma, hue]: Oklch): Rgb {
  const angle = (hue * Math.PI) / 180
  const a = chroma * Math.cos(angle)
  const b = chroma * Math.sin(angle)
  const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ]
}

const inGamut = (rgb: Rgb) => rgb.every((channel) => channel >= -1e-7 && channel <= 1 + 1e-7)
const encode = (channel: number) =>
  channel <= 0.0031308 ? 12.92 * channel : 1.055 * channel ** (1 / 2.4) - 0.055

export function paletteColor(value: Oklch) {
  const [lightness, chroma, hue] = value
  let mappedChroma = chroma
  if (!inGamut(linearRgb(value))) {
    let low = 0
    let high = chroma
    while (high - low > 1e-7) {
      const mid = (low + high) / 2
      if (inGamut(linearRgb([lightness, mid, hue]))) low = mid
      else high = mid
    }
    mappedChroma = low
  }
  const hex = linearRgb([lightness, mappedChroma, hue])
    .map((channel) => Math.round(Math.max(0, Math.min(1, encode(channel))) * 255))
    .map((channel) => channel.toString(16).padStart(2, '0'))
    .join('')
  return { hex: `#${hex}`, lightness, chroma: mappedChroma, hue }
}

export function themeColors(theme: PaletteTheme): Record<PaletteRole, string> {
  return Object.fromEntries(
    Object.entries(paletteDesign[theme]).map(([role, value]) => [role, paletteColor(value).hex]),
  ) as Record<PaletteRole, string>
}

export function paletteCss() {
  const foundation = Object.entries(foundationPalettes)
    .flatMap(([family, stops]) =>
      Object.entries(stops).map(
        ([stop, value]) =>
          `  --${family.toLowerCase().replaceAll(' ', '-')}-${stop}: ${paletteColor(value).hex};`,
      ),
    )
    .join('\n')
  const blocks = (['light', 'dark'] as const).map((theme) => {
    const declarations = Object.entries(themeColors(theme))
      .map(([role, hex]) => `  --${role}: ${hex};`)
      .join('\n')
    return `${theme === 'light' ? ':root' : '.dark'} {\n${theme === 'light' ? `${foundation}\n` : ''}${declarations}\n  color-scheme: ${theme};\n}`
  })
  return `/* Generated from palette-model.ts OKLCH design inputs. See docs/website-color-palette.md. */\n${blocks.join('\n\n')}\n`
}

export function contrast(foreground: string, background: string) {
  const luminance = ([r, g, b]: Rgb) => 0.2126 * r + 0.7152 * g + 0.0722 * b
  const a = luminance(decodeHex(foreground))
  const b = luminance(decodeHex(background))
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
}

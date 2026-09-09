import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const css = readFileSync(new URL('./palette.css', import.meta.url), 'utf8')
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

import createDOMPurify, { type DOMPurify } from 'dompurify'
import { JSDOM } from 'jsdom'
import { beforeAll, describe, expect, it } from 'vitest'
import { DeviceType } from '../models/types.js'
import { getDeviceIcon } from './generated-icons.js'
import { sanitizeIconSvgWith } from './sanitize.js'

// Exercises the pure, injected-purify path with a jsdom-backed instance, the
// same shape the server uses. The browser `sanitizeIconSvg()` wrapper runs the
// same code with the native window, so these tests cover it too.
let purify: DOMPurify
beforeAll(() => {
  const { window } = new JSDOM('')
  purify = createDOMPurify(window)
})

const clean = (raw: string) => sanitizeIconSvgWith(purify, raw)

describe('sanitizeIconSvgWith', () => {
  it('strips an onerror handler while keeping drawing markup', () => {
    const out = clean('<image href="x" onerror="window.__xss=1" /><path d="M1 1h4" />')
    expect(out).not.toMatch(/onerror/i)
    expect(out).toContain('<path')
  })

  it('strips <script>, javascript: URLs, and SVG animation handlers', () => {
    expect(clean('<script>window.__xss=1</script><path d="M0 0"/>')).not.toMatch(/<script/i)
    expect(clean('<a href="javascript:alert(1)"><text>x</text></a>')).not.toMatch(/javascript:/i)
    expect(clean('<animate onbegin="window.__xss=1" />')).not.toMatch(/onbegin/i)
  })

  it('preserves a bare bundled fragment (no root <svg>) with gradients', () => {
    const fragment =
      '<defs><linearGradient id="g"><stop offset="0" stop-color="#60A5FA"/></linearGradient></defs>' +
      '<g stroke="url(#g)"><circle cx="12" cy="12" r="9"/><path d="M1 1"/></g>'
    const out = clean(fragment)
    expect(out).toContain('linearGradient')
    expect(out).toContain('url(#g)')
    expect(out).toContain('<circle')
    expect(out).toContain('<path')
  })

  it('round-trips every bundled device icon without losing drawing markup', () => {
    for (const type of Object.values(DeviceType)) {
      const icon = getDeviceIcon(type)
      if (!icon) continue
      const out = clean(icon)
      expect(out, type).not.toMatch(/on\w+=/i)
      // Every bundled icon draws with at least one of these primitives.
      expect(out, type).toMatch(/<(path|circle|rect|ellipse|polygon|polyline|line)\b/)
    }
  })

  it('keeps a full <svg> icon whole', () => {
    const out = clean('<svg viewBox="0 0 24 24"><path d="M1 1"/></svg>')
    expect(out).toMatch(/^<svg/)
    expect(out).toContain('<path')
  })

  it('leaves URL and data-URI icons untouched (classified as kind: url elsewhere)', () => {
    expect(clean('https://cdn.example/icon.svg')).toBe('https://cdn.example/icon.svg')
    expect(clean('data:image/png;base64,AAAA')).toBe('data:image/png;base64,AAAA')
  })
})

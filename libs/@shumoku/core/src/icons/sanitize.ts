// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

// Sanitize an inline `spec.icon` before it reaches a renderer's `{@html}`.
// In the browser, sanitizeIconSvg() uses the native window. On the server (no
// window), inject a jsdom-backed DOMPurify via sanitizeIconSvgWith(). This
// package omits jsdom from its deps so browser bundles stay clean.

import createDOMPurify, { type DOMPurify } from 'dompurify'

const SVG_SANITIZE_CONFIG = {
  USE_PROFILES: { svg: true, svgFilters: true },
} as const

const FULL_SVG_RE = /^<svg[\s/>]/i

// URL / data: icons (not starting with `<`) pass through. Bundled icons are
// bare fragments that DOMPurify drops unless wrapped in an <svg>, so wrap then
// return the cleaned inner markup; return a full <svg> whole.
export function sanitizeIconSvgWith(purify: DOMPurify, raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed.startsWith('<')) return raw

  const isFullSvg = FULL_SVG_RE.test(trimmed)
  const wrapped = isFullSvg ? trimmed : `<svg xmlns="http://www.w3.org/2000/svg">${trimmed}</svg>`

  // RETURN_DOM gives a node from purify's own document; global `Element` is
  // absent under node/bun, so duck-type the query.
  const root = purify.sanitize(wrapped, { ...SVG_SANITIZE_CONFIG, RETURN_DOM: true }) as {
    querySelector?: (selectors: string) => { innerHTML: string; outerHTML: string } | null
  }
  const svgEl = root.querySelector?.('svg')
  if (!svgEl) return ''

  return isFullSvg ? svgEl.outerHTML : svgEl.innerHTML
}

let browserPurify: DOMPurify | null = null

// Browser only. Throws on the server; use sanitizeIconSvgWith there.
export function sanitizeIconSvg(raw: string): string {
  if (!browserPurify) {
    if (typeof window === 'undefined' || !window.document) {
      throw new Error('sanitizeIconSvg needs a browser DOM; use sanitizeIconSvgWith on the server')
    }
    browserPurify = createDOMPurify(window)
  }
  return sanitizeIconSvgWith(browserPurify, raw)
}

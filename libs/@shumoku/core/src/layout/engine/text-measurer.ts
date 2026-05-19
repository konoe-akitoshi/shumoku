// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * Default TextMeasurer implementation.
 *
 * Resolves `(text, kind)` to a font-size and asks the runtime
 * for a width. Browser / Worker uses `OffscreenCanvas`; DOM
 * uses `document.createElement('canvas')`; Node SSR / CLI
 * falls back to a conservative em-based estimate. The fallback
 * over-allocates slightly on purpose: under-allocating causes
 * layout collisions that can't be recovered from once
 * positions are set.
 *
 * Results are cached by `(text, fontPx)`. The cache lives on
 * the measurer instance — long-lived engines benefit; one-shot
 * CLI runs don't pay anything they wouldn't have paid anyway.
 *
 * Renderers with authoritative font metrics can implement
 * `TextMeasurer` themselves and pass it into `createEngine`.
 */

import { BODY_LABEL_FONT_PX } from '../../constants.js'
import type { TextMeasurer } from './types.js'

const PORT_LABEL_FONT_PX = 9
const SUBGRAPH_LABEL_FONT_PX = 11

function fontPxFor(kind: 'body' | 'port' | 'subgraph'): number {
  switch (kind) {
    case 'body':
      return BODY_LABEL_FONT_PX
    case 'port':
      return PORT_LABEL_FONT_PX
    case 'subgraph':
      return SUBGRAPH_LABEL_FONT_PX
  }
}

interface RawMeasurer {
  measure(text: string, fontPx: number): number
}

function createRawMeasurer(): RawMeasurer {
  if (typeof OffscreenCanvas !== 'undefined') {
    try {
      const cvs = new OffscreenCanvas(1, 1)
      const ctx = cvs.getContext('2d')
      if (ctx) {
        return {
          measure(text, fontPx) {
            ctx.font = `${fontPx}px sans-serif`
            return ctx.measureText(text).width
          },
        }
      }
    } catch {
      // fall through
    }
  }
  if (typeof document !== 'undefined') {
    try {
      const cvs = document.createElement('canvas')
      const ctx = cvs.getContext('2d')
      if (ctx) {
        return {
          measure(text, fontPx) {
            ctx.font = `${fontPx}px sans-serif`
            return ctx.measureText(text).width
          },
        }
      }
    } catch {
      // fall through
    }
  }
  // SSR / CLI fallback. The factor is conservative — slightly
  // over-allocates for typical sans-serif proportional fonts
  // at small sizes. Better to over-allocate than collide.
  const AVG_EM = 0.55
  return {
    measure(text, fontPx) {
      return text.length * fontPx * AVG_EM
    },
  }
}

/**
 * Create the default canvas-based `TextMeasurer`. The result
 * is a stateful object (it caches measurements); call once
 * per engine.
 */
export function createDefaultTextMeasurer(): TextMeasurer {
  const raw = createRawMeasurer()
  const cache = new Map<string, number>()
  return {
    measure(text, kind) {
      if (!text) return 0
      const fontPx = fontPxFor(kind)
      const key = `${fontPx}:${text}`
      const cached = cache.get(key)
      if (cached !== undefined) return cached
      const w = raw.measure(text, fontPx)
      cache.set(key, w)
      return w
    },
  }
}

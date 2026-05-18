// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * Text-width measurement helper.
 *
 * Layout decisions that depend on rendered label widths
 * (port-slot sizing, gap calculations, hull bounds) used to
 * estimate width as `text.length × SMALL_LABEL_CHAR_WIDTH`,
 * a per-character constant. The estimate is unreliable: real
 * proportional fonts vary by character (`l`/`i` are narrow,
 * `W`/`M` are wide), font, weight, and even rendering
 * platform. Layout based on a fixed average either over-
 * allocates (wasted space) or under-allocates (label
 * collisions).
 *
 * This module exposes a single `measureTextWidth(text,
 * fontPx)` function that:
 *   - Uses a shared `OffscreenCanvas` 2D context in the
 *     browser to get the platform's actual font-metric
 *     answer.
 *   - Falls back to a character-count estimate when no
 *     canvas is available (Node SSR / CLI render). The
 *     estimate stays conservative on purpose — better to
 *     over-allocate slightly than collide.
 *
 * Results are cached by `(text, fontPx)` so the function is
 * cheap to call repeatedly during layout.
 */

const cache = new Map<string, number>()

interface Measurer {
  measure(text: string, fontPx: number): number
}

let measurer: Measurer | null = null

function getMeasurer(): Measurer {
  if (measurer) return measurer
  // Browser / Worker with canvas API.
  if (typeof OffscreenCanvas !== 'undefined') {
    try {
      const cvs = new OffscreenCanvas(1, 1)
      const ctx = cvs.getContext('2d')
      if (ctx) {
        measurer = {
          measure(text: string, fontPx: number): number {
            ctx.font = `${fontPx}px sans-serif`
            return ctx.measureText(text).width
          },
        }
        return measurer
      }
    } catch {
      // Fall through to estimate.
    }
  }
  if (typeof document !== 'undefined') {
    try {
      const cvs = document.createElement('canvas')
      const ctx = cvs.getContext('2d')
      if (ctx) {
        measurer = {
          measure(text: string, fontPx: number): number {
            ctx.font = `${fontPx}px sans-serif`
            return ctx.measureText(text).width
          },
        }
        return measurer
      }
    } catch {
      // Fall through to estimate.
    }
  }
  // Estimate fallback. Conservative: slightly over-allocates
  // for typical sans-serif proportional fonts at small sizes.
  // The factor is in `em` units (relative to fontPx).
  const AVG_EM = 0.55
  measurer = {
    measure(text: string, fontPx: number): number {
      return text.length * fontPx * AVG_EM
    },
  }
  return measurer
}

/**
 * Width of `text` rendered in `fontPx` pixel sans-serif, in
 * SVG units. Uses platform measurement when available; falls
 * back to a per-character estimate otherwise.
 */
export function measureTextWidth(text: string, fontPx: number): number {
  if (!text) return 0
  const key = `${fontPx}:${text}`
  const cached = cache.get(key)
  if (cached !== undefined) return cached
  const w = getMeasurer().measure(text, fontPx)
  cache.set(key, w)
  return w
}

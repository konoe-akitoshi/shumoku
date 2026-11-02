// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * PNG rasterizing of a drawing's SVG string (Node.js only).
 */

import { Resvg } from '@resvg/resvg-js'
import type { ResolvedLayout, Theme } from '@shumoku/core'
import { renderSvgString } from '@shumoku/renderer/resolved-static'
import { fetchIconAsDataUrl } from '@shumoku/renderer-svg'

export interface PngOptions {
  /** Scale factor for output resolution (default: 2) */
  scale?: number
  /** Load system fonts (default: true) */
  loadSystemFonts?: boolean
  /** Fetch timeout for icon URLs (ms). Default 3000. */
  iconTimeout?: number
  /** Theme the SVG is drawn in. */
  theme?: Theme
}

/**
 * Embed external images in SVG by replacing URLs with base64 data URLs
 * This is required for resvg which cannot fetch external resources
 */
async function embedExternalImages(svgString: string, timeout = 3000): Promise<string> {
  // All Shumoku renderers emit href as the first image attribute. Matching the
  // fixed prefix avoids overlapping wildcard repetitions on untrusted SVG.
  const imageUrlRegex = /<image href="(https?:\/\/[^"]+)"/g
  const matches = [...svgString.matchAll(imageUrlRegex)]

  if (matches.length === 0) return svgString

  // Fetch all unique URLs in parallel
  const uniqueUrls = [...new Set(matches.map((m) => m[1]).filter((m) => m !== undefined))]
  const urlToBase64 = new Map<string, string>()

  await Promise.all(
    uniqueUrls.map(async (url) => {
      const base64 = await fetchIconAsDataUrl(url, timeout)
      if (base64) {
        urlToBase64.set(url, base64)
      }
    }),
  )

  // Replace URLs with base64 data URLs
  let result = svgString
  for (const [url, base64] of urlToBase64) {
    result = result.replaceAll(`href="${url}"`, `href="${base64}"`)
  }

  return result
}

/** An SVG string rasterized with resvg, its external images embedded first. */
export async function renderSvgToPng(
  svgString: string,
  options: Omit<PngOptions, 'theme'> = {},
): Promise<Buffer> {
  const scale = options.scale ?? 2
  const loadSystemFonts = options.loadSystemFonts ?? true
  const embedded = await embedExternalImages(svgString, options.iconTimeout)
  const resvg = new Resvg(embedded, {
    fitTo: { mode: 'zoom', value: scale },
    font: { loadSystemFonts },
  })
  return resvg.render().asPng()
}

/**
 * Render a resolved layout with the old static renderer. Server still bakes `ResolvedLayout`;
 * this goes when its bake moves to scenes.
 */
export async function renderResolved(
  layout: ResolvedLayout,
  options: PngOptions = {},
): Promise<Buffer> {
  return renderSvgToPng(renderSvgString(layout, { theme: options.theme }), options)
}

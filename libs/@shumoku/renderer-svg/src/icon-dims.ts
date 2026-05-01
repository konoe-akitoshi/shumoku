// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * Icon dimension and fetch utilities for URL-based icons.
 *
 * Icon URLs come from `Node.spec.icon` (snapshotted from a Product,
 * which got it from a catalog entry or a user upload). The renderer
 * resolves dimensions to size icons aspect-preservingly inside their
 * node, and PNG export embeds the bytes inline.
 *
 * Building URLs from vendor metadata is no longer this layer's job —
 * catalog entries supply URLs explicitly.
 */

import type { IconDimensions } from './parse-image-dimensions'
import { parseImageDimensions } from './parse-image-dimensions'

export type { IconDimensions } from './parse-image-dimensions'

/** Shared default fetch timeout (ms). */
export const DEFAULT_ICON_FETCH_TIMEOUT = 3000

// ============================================
// Icon body fetch (for inline PNG embedding)
// ============================================

const iconCache = new Map<string, string | null>()
const notFoundCache = new Set<string>()

/**
 * Fetch an icon URL and return its bytes as a `data:` URL. Used by the
 * PNG renderer to embed icon bodies inline so the rasterizer doesn't
 * need network access.
 */
export async function fetchIconAsDataUrl(
  url: string,
  timeout: number = DEFAULT_ICON_FETCH_TIMEOUT,
): Promise<string | null> {
  if (iconCache.has(url)) return iconCache.get(url) ?? null
  if (notFoundCache.has(url)) return null

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeout)
    const response = await fetch(url, { signal: controller.signal })
    clearTimeout(timeoutId)

    if (!response.ok) {
      if (response.status === 404) notFoundCache.add(url)
      iconCache.set(url, null)
      return null
    }

    const contentType = response.headers.get('content-type') || 'image/png'
    const arrayBuffer = await response.arrayBuffer()
    const base64 = btoa(
      new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), ''),
    )
    const dataUrl = `data:${contentType};base64,${base64}`
    iconCache.set(url, dataUrl)
    return dataUrl
  } catch {
    iconCache.set(url, null)
    return null
  }
}

/** Clear all icon caches (body + dimensions). */
export function clearIconCache(): void {
  iconCache.clear()
  notFoundCache.clear()
  dimensionsCache.clear()
}

// ============================================
// Dimension resolution
// ============================================

const dimensionsCache = new Map<string, IconDimensions | null>()

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof Image !== 'undefined'
}

function getImageDimensionsViaBrowser(
  url: string,
  timeout: number,
): Promise<IconDimensions | null> {
  return new Promise((resolve) => {
    const img = new Image()
    const timeoutId = setTimeout(() => {
      img.onload = null
      img.onerror = null
      resolve(null)
    }, timeout)
    img.onload = () => {
      clearTimeout(timeoutId)
      resolve({ width: img.naturalWidth, height: img.naturalHeight })
    }
    img.onerror = () => {
      clearTimeout(timeoutId)
      resolve(null)
    }
    img.src = url
  })
}

/**
 * Fetch image dimensions from a URL. Uses image-header byte parsing
 * for efficiency (Node.js); falls back to a browser `Image` element
 * when the fetch is blocked by CORS.
 */
export async function fetchImageDimensions(
  url: string,
  timeout: number = DEFAULT_ICON_FETCH_TIMEOUT,
): Promise<IconDimensions | null> {
  if (dimensionsCache.has(url)) return dimensionsCache.get(url) ?? null

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeout)
    const response = await fetch(url, { signal: controller.signal })
    clearTimeout(timeoutId)

    if (!response.ok) {
      if (isBrowser()) {
        const dimensions = await getImageDimensionsViaBrowser(url, timeout)
        dimensionsCache.set(url, dimensions)
        return dimensions
      }
      dimensionsCache.set(url, null)
      return null
    }

    const arrayBuffer = await response.arrayBuffer()
    const dimensions = parseImageDimensions(new Uint8Array(arrayBuffer), url)
    dimensionsCache.set(url, dimensions)
    return dimensions
  } catch {
    if (isBrowser()) {
      const dimensions = await getImageDimensionsViaBrowser(url, timeout)
      dimensionsCache.set(url, dimensions)
      return dimensions
    }
    dimensionsCache.set(url, null)
    return null
  }
}

/** Resolve dimensions for many URLs in parallel. */
export async function resolveAllIconDimensions(
  urls: string[],
  timeout: number = DEFAULT_ICON_FETCH_TIMEOUT,
): Promise<Map<string, IconDimensions>> {
  const results = await Promise.all(
    urls.map(async (url) => [url, await fetchImageDimensions(url, timeout)] as const),
  )
  const map = new Map<string, IconDimensions>()
  for (const [url, dimensions] of results) {
    if (dimensions) map.set(url, dimensions)
  }
  return map
}

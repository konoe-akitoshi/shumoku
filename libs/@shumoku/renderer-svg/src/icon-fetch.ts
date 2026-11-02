// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * Icon fetch for URL-based icons. Icon URLs come from `Node.spec.icon` (snapshotted from a
 * Product, which got it from a catalog entry or a user upload); PNG export embeds the bytes
 * inline so the rasterizer needs no network access.
 */

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

/** Clear the icon cache. */
export function clearIconCache(): void {
  iconCache.clear()
  notFoundCache.clear()
}

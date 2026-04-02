// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * CDN Icon Utilities
 * Generates CDN URLs for vendor icons
 */

import type { IconDimensions } from './parse-image-dimensions'
import { parseImageDimensions } from './parse-image-dimensions'

export type { IconDimensions } from './parse-image-dimensions'

/** CDN configuration */
export interface CDNConfig {
  /** CDN base URL */
  baseUrl: string
  /** API version (e.g., 'v1') */
  version: string
  /** Timeout for fetch in milliseconds */
  timeout?: number
}

/** Default CDN configuration */
export const DEFAULT_CDN_CONFIG: CDNConfig = {
  baseUrl: 'https://icons.shumoku.packof.me',
  version: 'v1',
  timeout: 3000,
}

/** Vendors that have SVG icons */
const SVG_VENDORS = new Set(['aruba', 'aws'])

/** Vendors that have PNG icons */
const PNG_VENDORS = new Set(['juniper', 'yamaha'])

/**
 * Normalize model name for CDN URL
 * - lowercase
 * - replace slashes with hyphens (for AWS service/resource keys like ec2/instance -> ec2-instance)
 */
function normalizeModel(model: string): string {
  return model.toLowerCase().replace(/\//g, '-')
}

/**
 * Get icon file extension for a vendor
 */
export function getIconExtension(vendor: string): 'svg' | 'png' {
  const v = vendor.toLowerCase()
  if (SVG_VENDORS.has(v)) return 'svg'
  if (PNG_VENDORS.has(v)) return 'png'
  // Default to png for unknown vendors
  return 'png'
}

/**
 * Generate CDN URL for a vendor icon
 */
export function getCDNIconUrl(
  vendor: string,
  model: string,
  config: CDNConfig = DEFAULT_CDN_CONFIG,
): string {
  const v = vendor.toLowerCase()
  const m = normalizeModel(model)
  const ext = getIconExtension(v)
  return `${config.baseUrl}/${config.version}/${v}/${m}.${ext}`
}

/**
 * Check if a vendor has CDN icons
 */
export function hasCDNIcons(vendor: string): boolean {
  const v = vendor.toLowerCase()
  return SVG_VENDORS.has(v) || PNG_VENDORS.has(v)
}

/** In-memory cache for fetched icons */
const iconCache = new Map<string, string | null>()

/** Cache for 404 URLs (to avoid repeated fetches) */
const notFoundCache = new Set<string>()

/**
 * Fetch icon from CDN with timeout and caching
 * Returns base64 data URL or null if fetch failed
 */
export async function fetchCDNIcon(url: string, timeout: number = 3000): Promise<string | null> {
  // Check cache
  if (iconCache.has(url)) {
    return iconCache.get(url) ?? null
  }

  // Check 404 cache
  if (notFoundCache.has(url)) {
    return null
  }

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeout)

    const response = await fetch(url, { signal: controller.signal })
    clearTimeout(timeoutId)

    if (!response.ok) {
      if (response.status === 404) {
        notFoundCache.add(url)
      }
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
    // Timeout or network error
    iconCache.set(url, null)
    return null
  }
}

/**
 * Clear icon cache
 */
export function clearIconCache(): void {
  iconCache.clear()
  notFoundCache.clear()
  dimensionsCache.clear()
}

// ============================================
// Icon Dimensions Resolution
// ============================================

/** Cache for icon dimensions */
const dimensionsCache = new Map<string, IconDimensions | null>()

/**
 * Check if running in browser environment
 */
function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof Image !== 'undefined'
}

/**
 * Get image dimensions using browser Image element
 * Works for cross-origin images without CORS headers
 */
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
 * Fetch image dimensions from URL
 * Uses image header parsing for efficiency (Node.js)
 * Falls back to Image.onload for CORS-blocked requests (Browser)
 */
export async function fetchImageDimensions(
  url: string,
  timeout: number = 3000,
): Promise<IconDimensions | null> {
  // Check cache
  if (dimensionsCache.has(url)) {
    return dimensionsCache.get(url) ?? null
  }

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeout)

    const response = await fetch(url, { signal: controller.signal })
    clearTimeout(timeoutId)

    if (!response.ok) {
      // Fetch failed, try browser fallback
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
    // Fetch failed (likely CORS), try browser fallback
    if (isBrowser()) {
      const dimensions = await getImageDimensionsViaBrowser(url, timeout)
      dimensionsCache.set(url, dimensions)
      return dimensions
    }
    dimensionsCache.set(url, null)
    return null
  }
}

/**
 * Resolve dimensions for an icon URL
 * Fetches the image and parses dimensions from binary data
 */
export async function resolveIconDimensions(
  url: string,
  config: CDNConfig = DEFAULT_CDN_CONFIG,
): Promise<IconDimensions | null> {
  return fetchImageDimensions(url, config.timeout)
}

/**
 * Resolve dimensions for multiple icon URLs in parallel
 */
export async function resolveAllIconDimensions(
  urls: string[],
  config: CDNConfig = DEFAULT_CDN_CONFIG,
): Promise<Map<string, IconDimensions>> {
  // Resolve all dimensions in parallel
  const results = await Promise.all(
    urls.map(async (url) => {
      const dimensions = await resolveIconDimensions(url, config)
      return [url, dimensions] as const
    }),
  )

  // Build result map (only include found dimensions)
  const map = new Map<string, IconDimensions>()
  for (const [url, dimensions] of results) {
    if (dimensions) {
      map.set(url, dimensions)
    }
  }

  return map
}

/**
 * Result of resolving icon dimensions for a graph
 */
export interface ResolvedIconDimensions {
  /** Map keyed by full URL (for svg.render) */
  byUrl: Map<string, IconDimensions>
  /** Map keyed by simple format vendor/model (for layout engine) */
  byKey: Map<string, IconDimensions>
}

/**
 * Extract simple key from CDN URL
 * https://icons.shumoku.packof.me/v1/yamaha/rtx1210.png -> yamaha/rtx1210
 */
function extractKeyFromUrl(url: string): string | null {
  const match = url.match(/\/v1\/([^/]+)\/([^.]+)\./)
  if (match) {
    return `${match[1]}/${match[2]}`
  }
  return null
}

/**
 * Resolve icon dimensions and return both URL-keyed and simple-keyed maps
 * Use byUrl for svg.render, byKey for layout engine
 */
export async function resolveIconDimensionsForGraph(
  urls: string[],
  config: CDNConfig = DEFAULT_CDN_CONFIG,
): Promise<ResolvedIconDimensions> {
  const byUrl = await resolveAllIconDimensions(urls, config)

  // Build simple key map
  const byKey = new Map<string, IconDimensions>()
  for (const [url, dims] of byUrl) {
    const key = extractKeyFromUrl(url)
    if (key) {
      byKey.set(key, dims)
    }
  }

  return { byUrl, byKey }
}

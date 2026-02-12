/**
 * CDN Icon Utilities
 * Generates CDN URLs for vendor icons
 */

import type { IconDimensions } from '@shumoku/core/models'

export type { IconDimensions }

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
    const bytes = new Uint8Array(arrayBuffer)
    const chunks: string[] = []
    for (let i = 0; i < bytes.length; i += 8192) {
      chunks.push(String.fromCharCode(...bytes.subarray(i, i + 8192)))
    }
    const base64 = btoa(chunks.join(''))
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
 * In browser: uses Image.onload directly (avoids CORS errors in console)
 * In Node.js: fetches and parses image headers for efficiency
 */
export async function fetchImageDimensions(
  url: string,
  timeout: number = 3000,
): Promise<IconDimensions | null> {
  // Check cache
  if (dimensionsCache.has(url)) {
    return dimensionsCache.get(url) ?? null
  }

  // Browser: use Image.onload directly (no CORS issues, no console errors)
  if (isBrowser()) {
    const dimensions = await getImageDimensionsViaBrowser(url, timeout)
    dimensionsCache.set(url, dimensions)
    return dimensions
  }

  // Node.js: fetch and parse image headers
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeout)

    const response = await fetch(url, { signal: controller.signal })
    clearTimeout(timeoutId)

    if (!response.ok) {
      dimensionsCache.set(url, null)
      return null
    }

    const arrayBuffer = await response.arrayBuffer()
    const dimensions = parseImageDimensions(new Uint8Array(arrayBuffer), url)

    dimensionsCache.set(url, dimensions)
    return dimensions
  } catch {
    dimensionsCache.set(url, null)
    return null
  }
}

/**
 * Parse image dimensions from binary data
 * Supports PNG, JPEG, SVG, GIF
 */
function parseImageDimensions(data: Uint8Array, url: string): IconDimensions | null {
  // PNG: dimensions at bytes 16-23
  if (data[0] === 0x89 && data[1] === 0x50 && data[2] === 0x4e && data[3] === 0x47) {
    const width = (data[16] << 24) | (data[17] << 16) | (data[18] << 8) | data[19]
    const height = (data[20] << 24) | (data[21] << 16) | (data[22] << 8) | data[23]
    return { width, height }
  }

  // JPEG: search for SOF0 marker (0xFFC0)
  if (data[0] === 0xff && data[1] === 0xd8) {
    let offset = 2
    while (offset < data.length - 8) {
      if (data[offset] === 0xff) {
        const marker = data[offset + 1]
        // SOF0, SOF1, SOF2 markers contain dimensions
        if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2) {
          const height = (data[offset + 5] << 8) | data[offset + 6]
          const width = (data[offset + 7] << 8) | data[offset + 8]
          return { width, height }
        }
        // Skip to next marker
        const length = (data[offset + 2] << 8) | data[offset + 3]
        offset += 2 + length
      } else {
        offset++
      }
    }
  }

  // GIF: dimensions at bytes 6-9
  if (data[0] === 0x47 && data[1] === 0x49 && data[2] === 0x46) {
    const width = data[6] | (data[7] << 8)
    const height = data[8] | (data[9] << 8)
    return { width, height }
  }

  // SVG: parse viewBox or width/height attributes
  if (
    url.endsWith('.svg') ||
    (data[0] === 0x3c && data[1] === 0x3f) ||
    (data[0] === 0x3c && data[1] === 0x73)
  ) {
    const text = new TextDecoder().decode(data)

    // Try viewBox first
    const viewBoxMatch = text.match(/viewBox=["']([^"']+)["']/)
    if (viewBoxMatch) {
      const parts = viewBoxMatch[1].trim().split(/\s+/)
      if (parts.length >= 4) {
        return { width: parseFloat(parts[2]), height: parseFloat(parts[3]) }
      }
    }

    // Try width/height attributes
    const widthMatch = text.match(/\bwidth=["'](\d+(?:\.\d+)?)(?:px)?["']/)
    const heightMatch = text.match(/\bheight=["'](\d+(?:\.\d+)?)(?:px)?["']/)
    if (widthMatch && heightMatch) {
      return { width: parseFloat(widthMatch[1]), height: parseFloat(heightMatch[1]) }
    }
  }

  return null
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

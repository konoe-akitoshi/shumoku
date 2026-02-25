/**
 * PNG Renderer
 * Renders NetworkGraph to PNG (Node.js only)
 */

import { Resvg } from '@resvg/resvg-js'
import type { LayoutResult, NetworkGraph } from '@shumoku/core'
import {
  type CDNConfig,
  fetchCDNIcon,
  getCDNIconUrl,
  hasCDNIcons,
  type IconDimensions,
  resolveAllIconDimensions,
} from './cdn-icons.js'
import * as svg from './svg.js'

export interface PngOptions {
  /** Scale factor for output resolution (default: 2) */
  scale?: number
  /** Load system fonts (default: true) */
  loadSystemFonts?: boolean
  /** CDN configuration for icon dimension resolution */
  cdnConfig?: CDNConfig
  /** Pre-resolved icon dimensions (skips fetching if provided) */
  iconDimensions?: Map<string, IconDimensions>
}

/**
 * Embed external images in SVG by replacing URLs with base64 data URLs
 * This is required for resvg which cannot fetch external resources
 */
async function embedExternalImages(svgString: string, timeout = 3000): Promise<string> {
  // Find all image href attributes with http(s) URLs
  const imageUrlRegex = /<image\s+[^>]*href="(https?:\/\/[^"]+)"[^>]*>/g
  const matches = [...svgString.matchAll(imageUrlRegex)]

  if (matches.length === 0) return svgString

  // Fetch all unique URLs in parallel
  const uniqueUrls = [...new Set(matches.map((m) => m[1]))]
  const urlToBase64 = new Map<string, string>()

  await Promise.all(
    uniqueUrls.map(async (url) => {
      const base64 = await fetchCDNIcon(url, timeout)
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

/**
 * Collect all icon URLs from a NetworkGraph
 * Must match the URL generation logic in svg.ts calculateIconInfo()
 */
function collectIconUrls(graph: NetworkGraph): string[] {
  const urls = new Set<string>()

  // Collect from nodes
  for (const node of graph.nodes) {
    if (node.icon) {
      urls.add(node.icon)
    } else if (node.vendor && hasCDNIcons(node.vendor)) {
      // Match the same logic as calculateIconInfo in svg.ts
      const iconKey =
        node.service && node.resource
          ? `${node.service}/${node.resource}`
          : node.service || node.model
      if (iconKey) {
        urls.add(getCDNIconUrl(node.vendor, iconKey))
      }
    }
  }

  // Collect from subgraphs (flat structure)
  if (graph.subgraphs) {
    for (const sg of graph.subgraphs) {
      if (sg.icon) {
        urls.add(sg.icon)
      }
    }
  }

  return Array.from(urls)
}

/**
 * Render NetworkGraph to PNG buffer
 * Async version that pre-resolves icon dimensions for correct aspect ratios
 */
export async function render(
  graph: NetworkGraph,
  layout: LayoutResult,
  options: PngOptions = {},
): Promise<Buffer> {
  const scale = options.scale ?? 2
  const loadSystemFonts = options.loadSystemFonts ?? true

  // Use provided dimensions or resolve them
  let iconDimensions = options.iconDimensions
  if (!iconDimensions) {
    const urls = collectIconUrls(graph)
    if (urls.length > 0) {
      iconDimensions = await resolveAllIconDimensions(urls, options.cdnConfig)
    }
  }

  let svgString = svg.render(graph, layout, { iconDimensions })

  // Embed external images as base64 (resvg cannot fetch external URLs)
  svgString = await embedExternalImages(svgString, options.cdnConfig?.timeout)

  const resvg = new Resvg(svgString, {
    fitTo: { mode: 'zoom', value: scale },
    font: { loadSystemFonts },
  })

  return resvg.render().asPng()
}

/**
 * Render NetworkGraph to PNG buffer (sync version)
 * Does not resolve icon dimensions - use for simple graphs without CDN icons
 */
export function renderSync(
  graph: NetworkGraph,
  layout: LayoutResult,
  options: Omit<PngOptions, 'cdnConfig'> = {},
): Buffer {
  const scale = options.scale ?? 2
  const loadSystemFonts = options.loadSystemFonts ?? true

  const svgString = svg.render(graph, layout, { iconDimensions: options.iconDimensions })
  const resvg = new Resvg(svgString, {
    fitTo: { mode: 'zoom', value: scale },
    font: { loadSystemFonts },
  })

  return resvg.render().asPng()
}

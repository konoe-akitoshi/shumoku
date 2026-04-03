// @ts-nocheck
// Binary parser — heavy indexed access on Uint8Array is not compatible with noUncheckedIndexedAccess.

/** Icon dimensions */
export interface IconDimensions {
  width: number
  height: number
}

/**
 * Parse image dimensions from binary data
 * Supports PNG, JPEG, SVG, GIF
 */
export function parseImageDimensions(data: Uint8Array, url: string): IconDimensions | null {
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

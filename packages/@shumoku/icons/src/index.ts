/**
 * @shumoku/icons - Vendor-specific icons for network diagrams
 *
 * Supported vendors:
 * - aws: AWS Architecture Icons
 * - aruba: Aruba Networks device icons
 * - yamaha: Yamaha router icons
 *
 * Usage:
 *   import '@shumoku/icons' // Auto-registers all vendor icons
 *   // or
 *   import { registerAllIcons } from '@shumoku/icons'
 *   registerAllIcons()
 */

import { registerVendorIcons } from '@shumoku/core/icons'
import { vendorIconSets } from './generated-icons.js'

// Re-export everything from generated icons
export * from './generated-icons.js'

/**
 * Register all vendor icons with @shumoku/core
 */
export function registerAllIcons(): void {
  for (const [vendor, icons] of Object.entries(vendorIconSets)) {
    registerVendorIcons(vendor, icons)
  }
}

// Auto-register on import
registerAllIcons()

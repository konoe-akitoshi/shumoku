/**
 * CDN Icon utilities for Cytoscape
 * Mirrors the icon resolution from @shumoku/renderer
 */

const CDN_BASE_URL = 'https://icons.shumoku.packof.me/v1'

// Vendors that have CDN icons available
const CDN_VENDORS = new Set(['aws', 'juniper', 'yamaha', 'aruba'])

// Icon file extensions by vendor
const ICON_EXTENSIONS: Record<string, string> = {
  aws: 'svg',
  juniper: 'svg',
  yamaha: 'png',
  aruba: 'svg',
}

/**
 * Check if vendor has CDN icons
 */
export function hasCDNIcons(vendor: string): boolean {
  return CDN_VENDORS.has(vendor.toLowerCase())
}

/**
 * Get CDN icon URL for vendor/model
 */
export function getCDNIconUrl(vendor: string, model: string): string | undefined {
  const vendorLower = vendor.toLowerCase()
  if (!hasCDNIcons(vendorLower)) {
    return undefined
  }

  const ext = ICON_EXTENSIONS[vendorLower] || 'svg'
  const modelPath = model.toLowerCase().replace(/[^a-z0-9\-_\/]/g, '')

  return `${CDN_BASE_URL}/${vendorLower}/${modelPath}.${ext}`
}

/**
 * Get built-in icon SVG data URL for device types without vendor icons
 * These are simple geometric icons
 */
export function getBuiltinIconUrl(deviceType: string): string | undefined {
  const icons: Record<string, string> = {
    router: createRouterIcon(),
    'l3-switch': createL3SwitchIcon(),
    'l2-switch': createL2SwitchIcon(),
    firewall: createFirewallIcon(),
    server: createServerIcon(),
    'access-point': createAccessPointIcon(),
    internet: createInternetIcon(),
    cloud: createCloudIcon(),
  }

  return icons[deviceType]
}

// Simple SVG icon generators (data URLs)
function svgToDataUrl(svg: string): string {
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

function createRouterIcon(): string {
  return svgToDataUrl(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">
      <circle cx="24" cy="24" r="18" fill="none" stroke="#60a5fa" stroke-width="2"/>
      <path d="M12 24h24M24 12v24M16 16l16 16M32 16L16 32" stroke="#60a5fa" stroke-width="2" fill="none"/>
    </svg>
  `)
}

function createL3SwitchIcon(): string {
  return svgToDataUrl(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">
      <rect x="6" y="14" width="36" height="20" rx="2" fill="none" stroke="#a78bfa" stroke-width="2"/>
      <circle cx="14" cy="24" r="3" fill="#a78bfa"/>
      <circle cx="24" cy="24" r="3" fill="#a78bfa"/>
      <circle cx="34" cy="24" r="3" fill="#a78bfa"/>
    </svg>
  `)
}

function createL2SwitchIcon(): string {
  return svgToDataUrl(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">
      <rect x="6" y="16" width="36" height="16" rx="2" fill="none" stroke="#c4b5fd" stroke-width="2"/>
      <line x1="14" y1="20" x2="14" y2="28" stroke="#c4b5fd" stroke-width="2"/>
      <line x1="22" y1="20" x2="22" y2="28" stroke="#c4b5fd" stroke-width="2"/>
      <line x1="30" y1="20" x2="30" y2="28" stroke="#c4b5fd" stroke-width="2"/>
      <line x1="38" y1="20" x2="38" y2="28" stroke="#c4b5fd" stroke-width="2"/>
    </svg>
  `)
}

function createFirewallIcon(): string {
  return svgToDataUrl(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">
      <rect x="8" y="8" width="32" height="32" rx="2" fill="none" stroke="#f87171" stroke-width="2"/>
      <rect x="14" y="14" width="20" height="20" fill="none" stroke="#f87171" stroke-width="2"/>
      <line x1="8" y1="24" x2="14" y2="24" stroke="#f87171" stroke-width="2"/>
      <line x1="34" y1="24" x2="40" y2="24" stroke="#f87171" stroke-width="2"/>
    </svg>
  `)
}

function createServerIcon(): string {
  return svgToDataUrl(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">
      <rect x="10" y="6" width="28" height="10" rx="2" fill="none" stroke="#34d399" stroke-width="2"/>
      <rect x="10" y="19" width="28" height="10" rx="2" fill="none" stroke="#34d399" stroke-width="2"/>
      <rect x="10" y="32" width="28" height="10" rx="2" fill="none" stroke="#34d399" stroke-width="2"/>
      <circle cx="32" cy="11" r="2" fill="#34d399"/>
      <circle cx="32" cy="24" r="2" fill="#34d399"/>
      <circle cx="32" cy="37" r="2" fill="#34d399"/>
    </svg>
  `)
}

function createAccessPointIcon(): string {
  return svgToDataUrl(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">
      <circle cx="24" cy="32" r="6" fill="none" stroke="#22d3ee" stroke-width="2"/>
      <path d="M14 22a14 14 0 0 1 20 0" fill="none" stroke="#22d3ee" stroke-width="2"/>
      <path d="M8 16a22 22 0 0 1 32 0" fill="none" stroke="#22d3ee" stroke-width="2"/>
    </svg>
  `)
}

function createInternetIcon(): string {
  return svgToDataUrl(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">
      <circle cx="24" cy="24" r="18" fill="none" stroke="#818cf8" stroke-width="2"/>
      <ellipse cx="24" cy="24" rx="8" ry="18" fill="none" stroke="#818cf8" stroke-width="2"/>
      <line x1="6" y1="24" x2="42" y2="24" stroke="#818cf8" stroke-width="2"/>
      <path d="M8 14h32M8 34h32" stroke="#818cf8" stroke-width="1"/>
    </svg>
  `)
}

function createCloudIcon(): string {
  return svgToDataUrl(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">
      <path d="M12 32a8 8 0 0 1 0-16 10 10 0 0 1 20 0 8 8 0 0 1 4 15H12z" fill="none" stroke="#60a5fa" stroke-width="2"/>
    </svg>
  `)
}

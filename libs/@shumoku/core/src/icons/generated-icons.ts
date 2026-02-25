/**
 * Auto-generated default icon definitions
 * DO NOT EDIT - Run build-icons.ts to regenerate
 */

import { DeviceType } from '../models/index.js'

export type IconThemeVariant = 'light' | 'dark' | 'default'

export interface IconEntry {
  default: string
  light?: string
  dark?: string
  viewBox?: string
}

// Default network device icons
const defaultIcons: Record<string, string> = {
  'access-point': `<path d="M12 10a2 2 0 100 4 2 2 0 000-4zm-4.5-2.5a6.5 6.5 0 019 0l-1.4 1.4a4.5 4.5 0 00-6.2 0l-1.4-1.4zm-2.8-2.8a10 10 0 0114.6 0l-1.4 1.4a8 8 0 00-11.8 0L4.7 4.7z"/>`,
  cloud: `<path d="M19.4 10.6A7 7 0 006 12a5 5 0 00.7 9.9h11.8a4.5 4.5 0 00.9-8.9z"/>`,
  database: `<path d="M12 4c-4.4 0-8 1.3-8 3v10c0 1.7 3.6 3 8 3s8-1.3 8-3V7c0-1.7-3.6-3-8-3zm0 2c3.3 0 6 .9 6 2s-2.7 2-6 2-6-.9-6-2 2.7-2 6-2zM6 10.5c1.4.7 3.5 1 6 1s4.6-.3 6-1V12c0 1.1-2.7 2-6 2s-6-.9-6-2v-1.5zm0 4c1.4.7 3.5 1 6 1s4.6-.3 6-1V16c0 1.1-2.7 2-6 2s-6-.9-6-2v-1.5z"/>`,
  firewall: `<path d="M12 2L4 6v6c0 5.5 3.4 10.3 8 12 4.6-1.7 8-6.5 8-12V6l-8-4zm0 2.2l6 3v5.3c0 4.3-2.6 8.1-6 9.5-3.4-1.4-6-5.2-6-9.5V7.2l6-3z"/> <path d="M11 8h2v5h-2V8zm0 6h2v2h-2v-2z"/>`,
  generic: `<path d="M4 4h16v16H4V4zm2 2v12h12V6H6zm2 2h8v2H8V8zm0 4h8v2H8v-2z"/>`,
  internet: `<path d="M12 2a10 10 0 100 20 10 10 0 000-20zm0 2c.6 0 1.3.8 1.8 2H10.2c.5-1.2 1.2-2 1.8-2zm-3.2.7A8 8 0 005 10h2.5c.1-2 .5-3.7 1.3-5.3zm6.4 0c.8 1.6 1.2 3.3 1.3 5.3H19a8 8 0 00-3.8-5.3zM5 12h2.5c.1 2 .5 3.7 1.3 5.3A8 8 0 015 12zm4.5 0h5c0 1.5-.3 3-1 4h-3c-.7-1-1-2.5-1-4zm7 0H19a8 8 0 01-3.8 5.3c.8-1.6 1.2-3.3 1.3-5.3zM10.2 18h3.6c-.5 1.2-1.2 2-1.8 2s-1.3-.8-1.8-2z"/>`,
  'l2-switch': `<path d="M3 8h18v8H3V8zm2 2v4h14v-4H5zm2 1h2v2H7v-2zm4 0h2v2h-2v-2zm4 0h2v2h-2v-2z"/>`,
  'l3-switch': `<path d="M3 6h18v12H3V6zm2 2v8h14V8H5zm2 2h4v1H7v-1zm6 0h4v1h-4v-1zm-6 3h4v1H7v-1zm6 0h4v1h-4v-1z"/>`,
  'load-balancer': `<path d="M12 4L4 8l8 4 8-4-8-4zm0 2.5L16 8l-4 2-4-2 4-1.5zM4 12l8 4 8-4v2l-8 4-8-4v-2zm0 4l8 4 8-4v2l-8 4-8-4v-2z"/>`,
  router: `<path d="M4 8h16v8H4V8zm2 2v4h12v-4H6zm1 1h2v2H7v-2zm4 0h2v2h-2v-2zm4 0h2v2h-2v-2z"/>`,
  server: `<path d="M4 4h16v4H4V4zm0 6h16v4H4v-4zm0 6h16v4H4v-4zm2-10v2h2V6H6zm0 6v2h2v-2H6zm0 6v2h2v-2H6zm10-12v2h2V6h-2zm0 6v2h2v-2h-2zm0 6v2h2v-2h-2z"/>`,
  vpn: `<path d="M12 2L4 5v6.5c0 5.3 3.4 10 8 11.5 4.6-1.5 8-6.2 8-11.5V5l-8-3zm0 4a3 3 0 110 6 3 3 0 010-6zm-4 8h8v1c0 2-1.8 3-4 3s-4-1-4-3v-1z"/>`,
}

// Map DeviceType to icon key
const deviceTypeToIcon: Record<DeviceType, string> = {
  [DeviceType.Router]: 'router',
  [DeviceType.L3Switch]: 'l3-switch',
  [DeviceType.L2Switch]: 'l2-switch',
  [DeviceType.Firewall]: 'firewall',
  [DeviceType.LoadBalancer]: 'load-balancer',
  [DeviceType.Server]: 'server',
  [DeviceType.AccessPoint]: 'access-point',
  [DeviceType.Cloud]: 'cloud',
  [DeviceType.Internet]: 'internet',
  [DeviceType.VPN]: 'vpn',
  [DeviceType.Database]: 'database',
  [DeviceType.Generic]: 'generic',
}

/**
 * Get SVG icon content for a device type
 */
export function getDeviceIcon(type?: DeviceType): string | undefined {
  if (!type) return undefined
  const iconKey = deviceTypeToIcon[type]
  if (!iconKey) return undefined
  return defaultIcons[iconKey]
}

// Vendor icon registry (populated by @shumoku/icons if installed)
const vendorIconRegistry: Record<string, Record<string, IconEntry>> = {}

/**
 * Register vendor icons (called by @shumoku/icons)
 */
export function registerVendorIcons(vendor: string, icons: Record<string, IconEntry>): void {
  vendorIconRegistry[vendor] = icons
}

/**
 * Get vendor icon entry
 */
export function getVendorIconEntry(
  vendor: string,
  service: string,
  resource?: string,
): IconEntry | undefined {
  if (vendor === 'default' || !vendor) {
    const content = defaultIcons[service] || (resource ? defaultIcons[resource] : undefined)
    return content ? { default: content } : undefined
  }

  const vendorIcons = vendorIconRegistry[vendor]
  if (!vendorIcons) return undefined

  const key = resource ? `${service}/${resource}` : service
  const entry = vendorIcons[key]
  if (!entry) {
    const serviceKey = Object.keys(vendorIcons).find((k) => k.startsWith(`${service}/`))
    if (serviceKey) return vendorIcons[serviceKey]
    return undefined
  }
  return entry
}

/**
 * Get vendor icon with theme support
 */
export function getVendorIcon(
  vendor: string,
  service: string,
  resource?: string,
  theme: IconThemeVariant = 'default',
): string | undefined {
  const entry = getVendorIconEntry(vendor, service, resource)
  if (!entry) return undefined
  return entry[theme] || entry.default
}

export const iconSets = {
  default: defaultIcons,
}

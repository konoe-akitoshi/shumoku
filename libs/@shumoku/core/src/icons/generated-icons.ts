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
  'access-point': `<defs> <linearGradient id="g-access-point" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="24"> <stop offset="0" stop-color="#60A5FA"/> <stop offset="1" stop-color="#2563EB"/> </linearGradient> </defs> <g fill="none" stroke="url(#g-access-point)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"> <circle cx="12" cy="12" r="9" fill="url(#g-access-point)" fill-opacity="0.18"/> <circle cx="12" cy="12" r="2" fill="url(#g-access-point)" stroke="none"/> <path d="M 7.5 8.5 A 4.5 4.5 0 0 0 7.5 15.5"/> <path d="M 16.5 8.5 A 4.5 4.5 0 0 1 16.5 15.5"/> </g>`,
  cloud: `<defs> <linearGradient id="g-cloud" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="24"> <stop offset="0" stop-color="#38BDF8"/> <stop offset="1" stop-color="#0284C7"/> </linearGradient> </defs> <g fill="none" stroke="url(#g-cloud)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"> <path d="M 17.5 19 H 9 A 7 7 0 1 1 15.71 10 H 17.5 A 4.5 4.5 0 1 1 17.5 19 Z" fill="url(#g-cloud)" fill-opacity="0.18"/> </g>`,
  'console-server': `<defs> <linearGradient id="g-console-server" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="24"> <stop offset="0" stop-color="#94A3B8"/> <stop offset="1" stop-color="#475569"/> </linearGradient> </defs> <g fill="none" stroke="url(#g-console-server)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"> <rect x="2" y="7" width="20" height="10" rx="1.5" fill="url(#g-console-server)" fill-opacity="0.18"/> <circle cx="5" cy="10" r="0.6" fill="url(#g-console-server)" stroke="none"/> <circle cx="8.5" cy="10" r="0.6" fill="url(#g-console-server)" stroke="none"/> <circle cx="12" cy="10" r="0.6" fill="url(#g-console-server)" stroke="none"/> <circle cx="15.5" cy="10" r="0.6" fill="url(#g-console-server)" stroke="none"/> <circle cx="19" cy="10" r="0.6" fill="url(#g-console-server)" stroke="none"/> <circle cx="5" cy="14" r="0.6" fill="url(#g-console-server)" stroke="none"/> <circle cx="8.5" cy="14" r="0.6" fill="url(#g-console-server)" stroke="none"/> <circle cx="12" cy="14" r="0.6" fill="url(#g-console-server)" stroke="none"/> <circle cx="15.5" cy="14" r="0.6" fill="url(#g-console-server)" stroke="none"/> <circle cx="19" cy="14" r="0.6" fill="url(#g-console-server)" stroke="none"/> </g>`,
  cpe: `<defs> <linearGradient id="g-cpe" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="24"> <stop offset="0" stop-color="#94A3B8"/> <stop offset="1" stop-color="#475569"/> </linearGradient> </defs> <g fill="none" stroke="url(#g-cpe)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"> <path d="M 7 12 V 5"/> <circle cx="7" cy="4" r="1" fill="url(#g-cpe)" stroke="none"/> <path d="M 17 12 V 5"/> <circle cx="17" cy="4" r="1" fill="url(#g-cpe)" stroke="none"/> <rect x="3" y="12" width="18" height="8" rx="1.5" fill="url(#g-cpe)" fill-opacity="0.18"/> <circle cx="7" cy="16" r="0.7" fill="url(#g-cpe)" stroke="none"/> <circle cx="10.5" cy="16" r="0.7" fill="url(#g-cpe)" stroke="none"/> <circle cx="14" cy="16" r="0.7" fill="url(#g-cpe)" stroke="none"/> <circle cx="17.5" cy="16" r="0.7" fill="url(#g-cpe)" stroke="none"/> </g>`,
  database: `<defs> <linearGradient id="g-database" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="24"> <stop offset="0" stop-color="#A78BFA"/> <stop offset="1" stop-color="#7C3AED"/> </linearGradient> </defs> <g fill="none" stroke="url(#g-database)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"> <ellipse cx="12" cy="5" rx="9" ry="2.5" fill="url(#g-database)" fill-opacity="0.18"/> <path d="M 3 5 V 19 A 9 2.5 0 0 0 21 19 V 5" fill="url(#g-database)" fill-opacity="0.18"/> <path d="M 3 12 A 9 2.5 0 0 0 21 12"/> </g>`,
  firewall: `<defs> <linearGradient id="g-firewall" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="24"> <stop offset="0" stop-color="#F87171"/> <stop offset="1" stop-color="#DC2626"/> </linearGradient> </defs> <g fill="none" stroke="url(#g-firewall)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"> <rect x="3" y="4" width="18" height="16" rx="1.5" fill="url(#g-firewall)" fill-opacity="0.18"/> <path d="M 3 9.5 H 21"/> <path d="M 3 14.5 H 21"/> <path d="M 12 4 V 9.5"/> <path d="M 8 9.5 V 14.5"/> <path d="M 16 9.5 V 14.5"/> <path d="M 12 14.5 V 20"/> </g>`,
  generic: `<defs> <linearGradient id="g-generic" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="24"> <stop offset="0" stop-color="#D1D5DB"/> <stop offset="1" stop-color="#6B7280"/> </linearGradient> </defs> <g fill="none" stroke="url(#g-generic)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"> <path d="M 12 3.5 L 19.794 8 V 16 L 12 20.5 L 4.206 16 V 8 Z" fill="url(#g-generic)" fill-opacity="0.18"/> <circle cx="12" cy="12" r="2" fill="url(#g-generic)" stroke="none"/> </g>`,
  internet: `<defs> <linearGradient id="g-internet" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="24"> <stop offset="0" stop-color="#38BDF8"/> <stop offset="1" stop-color="#0284C7"/> </linearGradient> </defs> <g fill="none" stroke="url(#g-internet)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"> <circle cx="12" cy="12" r="10" fill="url(#g-internet)" fill-opacity="0.18"/> <path d="M 12 2 A 14 14 0 0 0 12 22 A 14 14 0 0 0 12 2"/> <path d="M 2 12 H 22"/> </g>`,
  'l2-switch': `<defs> <linearGradient id="g-l2-switch" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="24"> <stop offset="0" stop-color="#60A5FA"/> <stop offset="1" stop-color="#2563EB"/> </linearGradient> </defs> <g fill="none" stroke="url(#g-l2-switch)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"> <rect x="3" y="11" width="18" height="9" rx="2" fill="url(#g-l2-switch)" fill-opacity="0.18"/> <path d="M 6 6 H 18"/> <path d="M 8 4.5 L 6 6 L 8 7.5"/> <path d="M 16 4.5 L 18 6 L 16 7.5"/> </g>`,
  'l3-switch': `<defs> <linearGradient id="g-l3-switch" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="24"> <stop offset="0" stop-color="#34D399"/> <stop offset="1" stop-color="#059669"/> </linearGradient> </defs> <g fill="none" stroke="url(#g-l3-switch)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"> <rect x="3" y="12" width="18" height="8" rx="2" fill="url(#g-l3-switch)" fill-opacity="0.18"/> <path d="M 6 5 H 18"/> <path d="M 16 3.5 L 18 5 L 16 6.5"/> <path d="M 18 8.5 H 6"/> <path d="M 8 7 L 6 8.5 L 8 10"/> </g>`,
  'load-balancer': `<defs> <linearGradient id="g-load-balancer" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="24"> <stop offset="0" stop-color="#FB923C"/> <stop offset="1" stop-color="#EA580C"/> </linearGradient> </defs> <g fill="none" stroke="url(#g-load-balancer)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"> <circle cx="12" cy="5" r="2" fill="url(#g-load-balancer)" fill-opacity="0.18"/> <circle cx="5" cy="19" r="2" fill="url(#g-load-balancer)" fill-opacity="0.18"/> <circle cx="12" cy="19" r="2" fill="url(#g-load-balancer)" fill-opacity="0.18"/> <circle cx="19" cy="19" r="2" fill="url(#g-load-balancer)" fill-opacity="0.18"/> <path d="M 11 6.7 L 6 17.3"/> <path d="M 12 7 V 17"/> <path d="M 13 6.7 L 18 17.3"/> </g>`,
  router: `<defs> <linearGradient id="g-router" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="24"> <stop offset="0" stop-color="#34D399"/> <stop offset="1" stop-color="#059669"/> </linearGradient> </defs> <g fill="none" stroke="url(#g-router)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"> <rect x="2" y="14" width="20" height="6" rx="2" fill="url(#g-router)" fill-opacity="0.18"/> <path d="M 5 14 V 9"/> <circle cx="5" cy="8" r="1" fill="url(#g-router)" stroke="none"/> <path d="M 9.5 14 V 5"/> <circle cx="9.5" cy="4" r="1" fill="url(#g-router)" stroke="none"/> <path d="M 14.5 14 V 5"/> <circle cx="14.5" cy="4" r="1" fill="url(#g-router)" stroke="none"/> <path d="M 19 14 V 9"/> <circle cx="19" cy="8" r="1" fill="url(#g-router)" stroke="none"/> </g>`,
  server: `<defs> <linearGradient id="g-server" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="24"> <stop offset="0" stop-color="#A78BFA"/> <stop offset="1" stop-color="#7C3AED"/> </linearGradient> </defs> <g fill="none" stroke="url(#g-server)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"> <rect x="3" y="3" width="18" height="7" rx="1.5" fill="url(#g-server)" fill-opacity="0.18"/> <rect x="3" y="14" width="18" height="7" rx="1.5" fill="url(#g-server)" fill-opacity="0.18"/> <circle cx="7" cy="6.5" r="0.7" fill="url(#g-server)" stroke="none"/> <circle cx="7" cy="17.5" r="0.7" fill="url(#g-server)" stroke="none"/> <path d="M 11 6.5 H 17"/> <path d="M 11 17.5 H 17"/> </g>`,
  vpn: `<defs> <linearGradient id="g-vpn" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="24"> <stop offset="0" stop-color="#34D399"/> <stop offset="1" stop-color="#059669"/> </linearGradient> </defs> <g fill="none" stroke="url(#g-vpn)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"> <rect x="2" y="7" width="20" height="10" rx="5" fill="url(#g-vpn)" fill-opacity="0.18"/> <rect x="5" y="9.5" width="14" height="5" rx="2.5"/> <path d="M 8 12 H 14"/> <path d="M 12 10.5 L 14 12 L 12 13.5"/> </g>`,
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
  [DeviceType.CPE]: 'cpe',
  [DeviceType.ConsoleServer]: 'console-server',
  [DeviceType.Cloud]: 'cloud',
  [DeviceType.Internet]: 'internet',
  [DeviceType.VPN]: 'vpn',
  [DeviceType.Database]: 'database',
  // No dedicated icon yet — segments are synthetic L2 transit nodes
  // produced by SNMP subnet inference. Fall back to the cloud icon
  // until a proper "bus segment" icon lands.
  [DeviceType.Segment]: 'cloud',
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

export const iconSets = {
  default: defaultIcons,
}

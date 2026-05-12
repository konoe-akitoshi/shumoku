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
  'access-point': `<defs> <linearGradient id="g-access-point" x1="0" y1="0" x2="0" y2="1"> <stop offset="0" stop-color="#60A5FA"/> <stop offset="1" stop-color="#2563EB"/> </linearGradient> </defs> <path d="M3 10 A 13 13 0 0 1 21 10"/> <path d="M6.5 13 A 8 8 0 0 1 17.5 13"/> <path d="M10 16 A 3 3 0 0 1 14 16"/> <circle cx="12" cy="19" r="1.5" fill="url(#g-access-point)" stroke="none"/>`,
  cloud: `<defs> <linearGradient id="g-cloud" x1="0" y1="0" x2="0" y2="1"> <stop offset="0" stop-color="#38BDF8"/> <stop offset="1" stop-color="#0284C7"/> </linearGradient> </defs> <path d="M7 19 H 17 A 4 4 0 0 0 17.4 11 A 5.5 5.5 0 0 0 7.2 10.2 A 4.5 4.5 0 0 0 7 19 Z"/>`,
  'console-server': `<defs> <linearGradient id="g-console-server" x1="0" y1="0" x2="0" y2="1"> <stop offset="0" stop-color="#94A3B8"/> <stop offset="1" stop-color="#475569"/> </linearGradient> </defs> <rect x="2" y="5" width="20" height="14" rx="2"/> <path d="M5.5 9.5 L 8 12 L 5.5 14.5"/> <path d="M10 14.5 H 14"/> <circle cx="18" cy="9" r="0.6" fill="url(#g-console-server)" stroke="none"/> <circle cx="18" cy="12" r="0.6" fill="url(#g-console-server)" stroke="none"/> <circle cx="18" cy="15" r="0.6" fill="url(#g-console-server)" stroke="none"/>`,
  cpe: `<defs> <linearGradient id="g-cpe" x1="0" y1="0" x2="0" y2="1"> <stop offset="0" stop-color="#94A3B8"/> <stop offset="1" stop-color="#475569"/> </linearGradient> </defs> <rect x="3" y="11" width="18" height="9" rx="1.5"/> <path d="M8 11 V 4"/> <path d="M16 11 V 4"/> <circle cx="8" cy="3.5" r="1" fill="url(#g-cpe)" stroke="none"/> <circle cx="16" cy="3.5" r="1" fill="url(#g-cpe)" stroke="none"/> <circle cx="7" cy="15.5" r="0.5" fill="url(#g-cpe)" stroke="none"/> <circle cx="10" cy="15.5" r="0.5" fill="url(#g-cpe)" stroke="none"/> <circle cx="13" cy="15.5" r="0.5" fill="url(#g-cpe)" stroke="none"/>`,
  database: `<defs> <linearGradient id="g-database" x1="0" y1="0" x2="0" y2="1"> <stop offset="0" stop-color="#A78BFA"/> <stop offset="1" stop-color="#7C3AED"/> </linearGradient> </defs> <ellipse cx="12" cy="5" rx="7" ry="2.5"/> <path d="M5 5 V 19 C 5 20.4 8.1 21.5 12 21.5 C 15.9 21.5 19 20.4 19 19 V 5"/> <path d="M5 10 C 5 11.4 8.1 12.5 12 12.5 C 15.9 12.5 19 11.4 19 10"/> <path d="M5 14.5 C 5 15.9 8.1 17 12 17 C 15.9 17 19 15.9 19 14.5"/>`,
  firewall: `<defs> <linearGradient id="g-firewall" x1="0" y1="0" x2="0" y2="1"> <stop offset="0" stop-color="#F87171"/> <stop offset="1" stop-color="#DC2626"/> </linearGradient> </defs> <path d="M12 2.5 L20 5 V 11 C 20 16 16.5 20 12 21.5 C 7.5 20 4 16 4 11 V 5 Z"/> <path d="M12 7.5 V 14.5"/> <path d="M9 11 H 15"/>`,
  generic: `<defs> <linearGradient id="g-generic" x1="0" y1="0" x2="0" y2="1"> <stop offset="0" stop-color="#D1D5DB"/> <stop offset="1" stop-color="#6B7280"/> </linearGradient> </defs> <path d="M12 2.5 L 20.5 7 V 17 L 12 21.5 L 3.5 17 V 7 Z"/> <circle cx="12" cy="12" r="2.5" fill="url(#g-generic)" stroke="none"/>`,
  internet: `<defs> <linearGradient id="g-internet" x1="0" y1="0" x2="0" y2="1"> <stop offset="0" stop-color="#38BDF8"/> <stop offset="1" stop-color="#0284C7"/> </linearGradient> </defs> <circle cx="12" cy="12" r="9"/> <ellipse cx="12" cy="12" rx="3.6" ry="9"/> <path d="M3 12 H 21"/>`,
  'l2-switch': `<defs> <linearGradient id="g-l2-switch" x1="0" y1="0" x2="0" y2="1"> <stop offset="0" stop-color="#60A5FA"/> <stop offset="1" stop-color="#2563EB"/> </linearGradient> </defs> <rect x="2" y="6" width="20" height="12" rx="2.5"/> <path d="M7 12 H 17"/> <path d="M9 10 L7 12 L9 14"/> <path d="M15 10 L17 12 L15 14"/>`,
  'l3-switch': `<defs> <linearGradient id="g-l3-switch" x1="0" y1="0" x2="0" y2="1"> <stop offset="0" stop-color="#34D399"/> <stop offset="1" stop-color="#059669"/> </linearGradient> </defs> <rect x="2" y="6" width="20" height="12" rx="2.5"/> <path d="M7 12 H 17"/> <path d="M9 10 L7 12 L9 14"/> <path d="M15 10 L17 12 L15 14"/> <path d="M12 8.5 V 15.5"/> <path d="M10 10.5 L12 8.5 L14 10.5"/> <path d="M10 13.5 L12 15.5 L14 13.5"/>`,
  'load-balancer': `<defs> <linearGradient id="g-load-balancer" x1="0" y1="0" x2="0" y2="1"> <stop offset="0" stop-color="#FB923C"/> <stop offset="1" stop-color="#EA580C"/> </linearGradient> </defs> <circle cx="12" cy="4.5" r="2.5" fill="url(#g-load-balancer)" stroke="none"/> <circle cx="5" cy="19.5" r="2.5" fill="url(#g-load-balancer)" stroke="none"/> <circle cx="12" cy="19.5" r="2.5" fill="url(#g-load-balancer)" stroke="none"/> <circle cx="19" cy="19.5" r="2.5" fill="url(#g-load-balancer)" stroke="none"/> <path d="M11 6.7 L 6 17.3"/> <path d="M12 7 V 17"/> <path d="M13 6.7 L 18 17.3"/>`,
  router: `<defs> <linearGradient id="g-router" x1="0" y1="0" x2="0" y2="1"> <stop offset="0" stop-color="#34D399"/> <stop offset="1" stop-color="#059669"/> </linearGradient> </defs> <circle cx="12" cy="12" r="3" fill="url(#g-router)" stroke="none"/> <path d="M12 7.5 V 3"/> <path d="M9.5 5.5 L12 3 L14.5 5.5"/> <path d="M12 16.5 V 21"/> <path d="M9.5 18.5 L12 21 L14.5 18.5"/> <path d="M7.5 12 H 3"/> <path d="M5.5 9.5 L3 12 L5.5 14.5"/> <path d="M16.5 12 H 21"/> <path d="M18.5 9.5 L21 12 L18.5 14.5"/>`,
  server: `<defs> <linearGradient id="g-server" x1="0" y1="0" x2="0" y2="1"> <stop offset="0" stop-color="#A78BFA"/> <stop offset="1" stop-color="#7C3AED"/> </linearGradient> </defs> <rect x="3" y="3" width="18" height="6" rx="1.5"/> <rect x="3" y="11" width="18" height="6" rx="1.5"/> <rect x="3" y="19" width="18" height="2.5" rx="1"/> <circle cx="6.5" cy="6" r="0.5" fill="url(#g-server)" stroke="none"/> <circle cx="6.5" cy="14" r="0.5" fill="url(#g-server)" stroke="none"/> <path d="M10 6 H 17.5"/> <path d="M10 14 H 17.5"/>`,
  vpn: `<defs> <linearGradient id="g-vpn" x1="0" y1="0" x2="0" y2="1"> <stop offset="0" stop-color="#34D399"/> <stop offset="1" stop-color="#059669"/> </linearGradient> </defs> <path d="M8 10 V 7 A 4 4 0 0 1 16 7 V 10"/> <rect x="5" y="10" width="14" height="11" rx="2"/> <circle cx="12" cy="14.5" r="1.5" fill="url(#g-vpn)" stroke="none"/> <path d="M12 16 V 18.5"/>`,
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

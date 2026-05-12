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
  'access-point': `<defs> <linearGradient id="g-access-point" x1="0" y1="0" x2="0" y2="1"> <stop offset="0" stop-color="#60A5FA"/> <stop offset="1" stop-color="#2563EB"/> </linearGradient> </defs> <rect width="24" height="24" rx="5" fill="url(#g-access-point)"/> <path d="M5 7.4C6.9 5.8 9.3 5 12 5s5.1.8 7 2.4" fill="none" stroke="#FFFFFF" stroke-width="1.8" stroke-linecap="round"/> <path d="M7.7 10c1.2-1 2.7-1.5 4.3-1.5s3.1.5 4.3 1.5" fill="none" stroke="#FFFFFF" stroke-width="1.8" stroke-linecap="round" opacity=".85"/> <ellipse cx="12" cy="15.1" rx="5.7" ry="3.5" fill="#FFFFFF"/> <circle cx="12" cy="14.6" r="1.2" fill="#2563EB" opacity=".75"/> <path d="M5.5 3.4h13" fill="none" stroke="#FFFFFF" stroke-width="1.2" stroke-linecap="round" opacity=".16"/>`,
  cloud: `<defs> <linearGradient id="g-cloud" x1="0" y1="0" x2="0" y2="1"> <stop offset="0" stop-color="#38BDF8"/> <stop offset="1" stop-color="#0284C7"/> </linearGradient> </defs> <rect width="24" height="24" rx="5" fill="url(#g-cloud)"/> <path d="M8.3 17.2h8.6a3.2 3.2 0 0 0 .3-6.4 4.8 4.8 0 0 0-9.1-1.4A3.9 3.9 0 0 0 8.3 17.2z" fill="#FFFFFF"/> <path d="M5.5 3.4h13" fill="none" stroke="#FFFFFF" stroke-width="1.2" stroke-linecap="round" opacity=".16"/>`,
  'console-server': `<defs> <linearGradient id="g-console-server" x1="0" y1="0" x2="0" y2="1"> <stop offset="0" stop-color="#94A3B8"/> <stop offset="1" stop-color="#475569"/> </linearGradient> </defs> <rect width="24" height="24" rx="5" fill="url(#g-console-server)"/> <rect x="6.5" y="4.8" width="11" height="14.4" rx="2" fill="#FFFFFF"/> <rect x="8.5" y="7.1" width="7" height="1.6" rx=".8" fill="#475569" opacity=".7"/> <rect x="8.5" y="10.2" width="7" height="1.6" rx=".8" fill="#475569" opacity=".7"/> <rect x="8.5" y="13.3" width="7" height="1.6" rx=".8" fill="#475569" opacity=".7"/> <circle cx="9.6" cy="17" r=".8" fill="#475569" opacity=".75"/> <circle cx="12" cy="17" r=".8" fill="#475569" opacity=".75"/> <circle cx="14.4" cy="17" r=".8" fill="#475569" opacity=".75"/> <path d="M5.5 3.4h13" fill="none" stroke="#FFFFFF" stroke-width="1.2" stroke-linecap="round" opacity=".14"/>`,
  cpe: `<defs> <linearGradient id="g-cpe" x1="0" y1="0" x2="0" y2="1"> <stop offset="0" stop-color="#94A3B8"/> <stop offset="1" stop-color="#475569"/> </linearGradient> </defs> <rect width="24" height="24" rx="5" fill="url(#g-cpe)"/> <path d="M16.2 7.5l2.6-2.6" fill="none" stroke="#FFFFFF" stroke-width="1.7" stroke-linecap="round"/> <rect x="5.2" y="10" width="13.6" height="7.1" rx="2" fill="#FFFFFF"/> <circle cx="8.1" cy="13.55" r="1" fill="#475569" opacity=".72"/> <path d="M11.2 13.55h4.7" fill="none" stroke="#475569" stroke-width="1.4" stroke-linecap="round" opacity=".62"/> <path d="M5.5 3.4h13" fill="none" stroke="#FFFFFF" stroke-width="1.2" stroke-linecap="round" opacity=".14"/>`,
  database: `<defs> <linearGradient id="g-database" x1="0" y1="0" x2="0" y2="1"> <stop offset="0" stop-color="#A78BFA"/> <stop offset="1" stop-color="#7C3AED"/> </linearGradient> </defs> <rect width="24" height="24" rx="5" fill="url(#g-database)"/> <path d="M6.5 7.4c0-1.7 2.5-3 5.5-3s5.5 1.3 5.5 3v9.2c0 1.7-2.5 3-5.5 3s-5.5-1.3-5.5-3z" fill="#FFFFFF"/> <path d="M6.5 7.4c0 1.7 2.5 3 5.5 3s5.5-1.3 5.5-3M6.5 11.9c0 1.7 2.5 3 5.5 3s5.5-1.3 5.5-3" fill="none" stroke="#7C3AED" stroke-width="1.2" stroke-linecap="round" opacity=".55"/> <path d="M5.5 3.4h13" fill="none" stroke="#FFFFFF" stroke-width="1.2" stroke-linecap="round" opacity=".16"/>`,
  firewall: `<defs> <linearGradient id="g-firewall" x1="0" y1="0" x2="0" y2="1"> <stop offset="0" stop-color="#F87171"/> <stop offset="1" stop-color="#DC2626"/> </linearGradient> </defs> <rect width="24" height="24" rx="5" fill="url(#g-firewall)"/> <rect x="5" y="6" width="14" height="12" rx="1.8" fill="#FFFFFF"/> <path d="M5 10h14M5 14h14M9.7 6v4M14.3 10v4M9.7 14v4" fill="none" stroke="#DC2626" stroke-width="1.3" stroke-linecap="round" opacity=".62"/> <path d="M5.5 3.4h13" fill="none" stroke="#FFFFFF" stroke-width="1.2" stroke-linecap="round" opacity=".16"/>`,
  generic: `<defs> <linearGradient id="g-generic" x1="0" y1="0" x2="0" y2="1"> <stop offset="0" stop-color="#D1D5DB"/> <stop offset="1" stop-color="#6B7280"/> </linearGradient> </defs> <rect width="24" height="24" rx="5" fill="url(#g-generic)"/> <rect x="6.2" y="6.2" width="11.6" height="11.6" rx="2.4" fill="#FFFFFF"/> <circle cx="9.4" cy="9.4" r="1.1" fill="#6B7280" opacity=".7"/> <circle cx="14.6" cy="9.4" r="1.1" fill="#6B7280" opacity=".7"/> <circle cx="9.4" cy="14.6" r="1.1" fill="#6B7280" opacity=".7"/> <circle cx="14.6" cy="14.6" r="1.1" fill="#6B7280" opacity=".7"/> <path d="M5.5 3.4h13" fill="none" stroke="#FFFFFF" stroke-width="1.2" stroke-linecap="round" opacity=".15"/>`,
  internet: `<defs> <linearGradient id="g-internet" x1="0" y1="0" x2="0" y2="1"> <stop offset="0" stop-color="#38BDF8"/> <stop offset="1" stop-color="#0284C7"/> </linearGradient> </defs> <rect width="24" height="24" rx="5" fill="url(#g-internet)"/> <circle cx="12" cy="12" r="7" fill="none" stroke="#FFFFFF" stroke-width="1.8"/> <path d="M5.7 9.4h12.6M5.7 14.6h12.6M12 5c2 1.8 3 4.1 3 7s-1 5.2-3 7M12 5c-2 1.8-3 4.1-3 7s1 5.2 3 7" fill="none" stroke="#FFFFFF" stroke-width="1.35" stroke-linecap="round" opacity=".88"/> <path d="M5.5 3.4h13" fill="none" stroke="#FFFFFF" stroke-width="1.2" stroke-linecap="round" opacity=".16"/>`,
  'l2-switch': `<defs> <linearGradient id="g-l2-switch" x1="0" y1="0" x2="0" y2="1"> <stop offset="0" stop-color="#60A5FA"/> <stop offset="1" stop-color="#2563EB"/> </linearGradient> </defs> <rect width="24" height="24" rx="5" fill="url(#g-l2-switch)"/> <rect x="5" y="7" width="14" height="10" rx="2.2" fill="#FFFFFF"/> <path d="M8 10h8M8 12.9h8M8 15.8h8" fill="none" stroke="#2563EB" stroke-width="1.5" stroke-linecap="round" opacity=".68"/> <circle cx="6.9" cy="10" r=".7" fill="#2563EB" opacity=".78"/> <circle cx="6.9" cy="12.9" r=".7" fill="#2563EB" opacity=".78"/> <circle cx="6.9" cy="15.8" r=".7" fill="#2563EB" opacity=".78"/> <path d="M5.5 3.4h13" fill="none" stroke="#FFFFFF" stroke-width="1.2" stroke-linecap="round" opacity=".16"/>`,
  'l3-switch': `<defs> <linearGradient id="g-l3-switch" x1="0" y1="0" x2="0" y2="1"> <stop offset="0" stop-color="#34D399"/> <stop offset="1" stop-color="#059669"/> </linearGradient> </defs> <rect width="24" height="24" rx="5" fill="url(#g-l3-switch)"/> <rect x="5" y="10" width="14" height="7" rx="2" fill="#FFFFFF"/> <path d="M8.4 14.8h7.2" fill="none" stroke="#059669" stroke-width="1.4" stroke-linecap="round" opacity=".65"/> <path d="M8 7.2h8M8 7.2l2-2M8 7.2l2 2M16 7.2l-2-2M16 7.2l-2 2" fill="none" stroke="#FFFFFF" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/> <path d="M5.5 3.4h13" fill="none" stroke="#FFFFFF" stroke-width="1.2" stroke-linecap="round" opacity=".16"/>`,
  'load-balancer': `<defs> <linearGradient id="g-load-balancer" x1="0" y1="0" x2="0" y2="1"> <stop offset="0" stop-color="#FB923C"/> <stop offset="1" stop-color="#EA580C"/> </linearGradient> </defs> <rect width="24" height="24" rx="5" fill="url(#g-load-balancer)"/> <circle cx="7" cy="12" r="2.1" fill="#FFFFFF"/> <circle cx="17" cy="7.2" r="2" fill="#FFFFFF"/> <circle cx="17" cy="12" r="2" fill="#FFFFFF"/> <circle cx="17" cy="16.8" r="2" fill="#FFFFFF"/> <path d="M9.1 12l5.7-4.8M9.1 12h5.7M9.1 12l5.7 4.8" fill="none" stroke="#FFFFFF" stroke-width="1.7" stroke-linecap="round"/> <path d="M5.5 3.4h13" fill="none" stroke="#FFFFFF" stroke-width="1.2" stroke-linecap="round" opacity=".16"/>`,
  router: `<defs> <linearGradient id="g-router" x1="0" y1="0" x2="0" y2="1"> <stop offset="0" stop-color="#34D399"/> <stop offset="1" stop-color="#059669"/> </linearGradient> </defs> <rect width="24" height="24" rx="5" fill="url(#g-router)"/> <rect x="5.2" y="11" width="13.6" height="6.8" rx="2.1" fill="#FFFFFF"/> <path d="M8.4 14.4h7.2" fill="none" stroke="#059669" stroke-width="1.4" stroke-linecap="round" opacity=".65"/> <path d="M7.4 8.1h8.2M7.4 8.1l2-2M7.4 8.1l2 2M16.6 8.1l-2-2M16.6 8.1l-2 2" fill="none" stroke="#FFFFFF" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/> <path d="M5.5 3.4h13" fill="none" stroke="#FFFFFF" stroke-width="1.2" stroke-linecap="round" opacity=".16"/>`,
  server: `<defs> <linearGradient id="g-server" x1="0" y1="0" x2="0" y2="1"> <stop offset="0" stop-color="#A78BFA"/> <stop offset="1" stop-color="#7C3AED"/> </linearGradient> </defs> <rect width="24" height="24" rx="5" fill="url(#g-server)"/> <rect x="6.4" y="4.8" width="11.2" height="14.4" rx="2.1" fill="#FFFFFF"/> <path d="M9.4 8h5.2M9.4 12h5.2M9.4 16h5.2" fill="none" stroke="#7C3AED" stroke-width="1.45" stroke-linecap="round" opacity=".6"/> <circle cx="8.4" cy="8" r=".75" fill="#7C3AED" opacity=".72"/> <circle cx="8.4" cy="12" r=".75" fill="#7C3AED" opacity=".72"/> <circle cx="8.4" cy="16" r=".75" fill="#7C3AED" opacity=".72"/> <path d="M5.5 3.4h13" fill="none" stroke="#FFFFFF" stroke-width="1.2" stroke-linecap="round" opacity=".16"/>`,
  vpn: `<defs> <linearGradient id="g-vpn" x1="0" y1="0" x2="0" y2="1"> <stop offset="0" stop-color="#34D399"/> <stop offset="1" stop-color="#059669"/> </linearGradient> </defs> <rect width="24" height="24" rx="5" fill="url(#g-vpn)"/> <path d="M8.3 10.5V8.8a3.7 3.7 0 0 1 7.4 0v1.7" fill="none" stroke="#FFFFFF" stroke-width="1.9" stroke-linecap="round"/> <rect x="6.2" y="10" width="11.6" height="8.3" rx="2.2" fill="#FFFFFF"/> <path d="M8.5 14.2c1.8-1.4 5.2-1.4 7 0" fill="none" stroke="#059669" stroke-width="1.5" stroke-linecap="round" opacity=".7"/> <circle cx="12" cy="14.3" r="1" fill="#059669" opacity=".75"/> <path d="M5.5 3.4h13" fill="none" stroke="#FFFFFF" stroke-width="1.2" stroke-linecap="round" opacity=".16"/>`,
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

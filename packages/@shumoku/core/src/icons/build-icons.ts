/**
 * Build script to convert default SVG icons to TypeScript
 * Run with: bun src/icons/build-icons.ts
 */

import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const ICONS_DIR = path.join(__dirname)
const OUTPUT_FILE = path.join(__dirname, 'generated-icons.ts')

function extractSvgContent(svgContent: string): string {
  const contentMatch = svgContent.match(/<svg[^>]*>([\s\S]*?)<\/svg>/i)
  if (!contentMatch) return ''
  return contentMatch[1].trim().replace(/\s+/g, ' ')
}

function scanDefaultIconFolder(folderPath: string): Record<string, string> {
  const icons: Record<string, string> = {}

  if (!fs.existsSync(folderPath)) {
    return icons
  }

  const files = fs.readdirSync(folderPath)

  for (const file of files) {
    if (!file.endsWith('.svg')) continue

    const filePath = path.join(folderPath, file)
    const content = fs.readFileSync(filePath, 'utf-8')
    const iconName = file.replace('.svg', '')
    const svgContent = extractSvgContent(content)

    if (svgContent) {
      icons[iconName] = svgContent
    }
  }

  return icons
}

function generateTypeScript(icons: Record<string, string>): string {
  const lines: string[] = [
    '/**',
    ' * Auto-generated default icon definitions',
    ' * DO NOT EDIT - Run build-icons.ts to regenerate',
    ' */',
    '',
    "import { DeviceType } from '../models/index.js'",
    '',
    "export type IconThemeVariant = 'light' | 'dark' | 'default'",
    '',
    'export interface IconEntry {',
    '  default: string',
    '  light?: string',
    '  dark?: string',
    '  viewBox?: string',
    '}',
    '',
    '// Default network device icons',
    'const defaultIcons: Record<string, string> = {',
  ]

  for (const [name, content] of Object.entries(icons)) {
    lines.push(`  '${name}': \`${content}\`,`)
  }

  lines.push('}')
  lines.push('')

  // DeviceType mapping
  lines.push('// Map DeviceType to icon key')
  lines.push('const deviceTypeToIcon: Record<DeviceType, string> = {')
  lines.push("  [DeviceType.Router]: 'router',")
  lines.push("  [DeviceType.L3Switch]: 'l3-switch',")
  lines.push("  [DeviceType.L2Switch]: 'l2-switch',")
  lines.push("  [DeviceType.Firewall]: 'firewall',")
  lines.push("  [DeviceType.LoadBalancer]: 'load-balancer',")
  lines.push("  [DeviceType.Server]: 'server',")
  lines.push("  [DeviceType.AccessPoint]: 'access-point',")
  lines.push("  [DeviceType.Cloud]: 'cloud',")
  lines.push("  [DeviceType.Internet]: 'internet',")
  lines.push("  [DeviceType.VPN]: 'vpn',")
  lines.push("  [DeviceType.Database]: 'database',")
  lines.push("  [DeviceType.Generic]: 'generic',")
  lines.push('}')
  lines.push('')

  // Getter function
  lines.push('/**')
  lines.push(' * Get SVG icon content for a device type')
  lines.push(' */')
  lines.push('export function getDeviceIcon(type?: DeviceType): string | undefined {')
  lines.push('  if (!type) return undefined')
  lines.push('  const iconKey = deviceTypeToIcon[type]')
  lines.push('  if (!iconKey) return undefined')
  lines.push('  return defaultIcons[iconKey]')
  lines.push('}')
  lines.push('')

  // Vendor icon stubs (for compatibility, actual implementation in @shumoku/icons)
  lines.push('// Vendor icon registry (populated by @shumoku/icons if installed)')
  lines.push('let vendorIconRegistry: Record<string, Record<string, IconEntry>> = {}')
  lines.push('')

  lines.push('/**')
  lines.push(' * Register vendor icons (called by @shumoku/icons)')
  lines.push(' */')
  lines.push('export function registerVendorIcons(vendor: string, icons: Record<string, IconEntry>): void {')
  lines.push('  vendorIconRegistry[vendor] = icons')
  lines.push('}')
  lines.push('')

  lines.push('/**')
  lines.push(' * Get vendor icon entry')
  lines.push(' */')
  lines.push('export function getVendorIconEntry(')
  lines.push('  vendor: string,')
  lines.push('  service: string,')
  lines.push('  resource?: string')
  lines.push('): IconEntry | undefined {')
  lines.push("  if (vendor === 'default' || !vendor) {")
  lines.push('    const content = defaultIcons[service] || (resource ? defaultIcons[resource] : undefined)')
  lines.push('    return content ? { default: content } : undefined')
  lines.push('  }')
  lines.push('')
  lines.push('  const vendorIcons = vendorIconRegistry[vendor]')
  lines.push('  if (!vendorIcons) return undefined')
  lines.push('')
  lines.push('  const key = resource ? `${service}/${resource}` : service')
  lines.push('  const entry = vendorIcons[key]')
  lines.push('  if (!entry) {')
  lines.push("    const serviceKey = Object.keys(vendorIcons).find(k => k.startsWith(service + '/'))")
  lines.push('    if (serviceKey) return vendorIcons[serviceKey]')
  lines.push('    return undefined')
  lines.push('  }')
  lines.push('  return entry')
  lines.push('}')
  lines.push('')

  lines.push('/**')
  lines.push(' * Get vendor icon with theme support')
  lines.push(' */')
  lines.push('export function getVendorIcon(')
  lines.push('  vendor: string,')
  lines.push('  service: string,')
  lines.push('  resource?: string,')
  lines.push("  theme: IconThemeVariant = 'default'")
  lines.push('): string | undefined {')
  lines.push('  const entry = getVendorIconEntry(vendor, service, resource)')
  lines.push('  if (!entry) return undefined')
  lines.push('  return entry[theme] || entry.default')
  lines.push('}')
  lines.push('')

  // Export
  lines.push('export const iconSets = {')
  lines.push('  default: defaultIcons,')
  lines.push('}')
  lines.push('')

  return lines.join('\n')
}

function main() {
  console.log('Building default icons...')

  const defaultFolder = path.join(ICONS_DIR, 'default')
  const icons = scanDefaultIconFolder(defaultFolder)

  if (Object.keys(icons).length === 0) {
    console.log('No default icons found!')
    return
  }

  console.log(`  Found ${Object.keys(icons).length} default icons`)

  const output = generateTypeScript(icons)
  fs.writeFileSync(OUTPUT_FILE, output, 'utf-8')

  console.log(`Generated ${OUTPUT_FILE}`)
}

main()

/**
 * Build script to convert SVG files to TypeScript
 * Run with: npx tsx src/icons/build-icons.ts
 */

import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const ICONS_DIR = path.join(__dirname)
const OUTPUT_FILE = path.join(__dirname, 'generated-icons.ts')

interface IconSet {
  name: string
  icons: Record<string, string>
}

function extractSvgContent(svgContent: string): string {
  // Extract the inner content of the SVG (everything inside <svg>...</svg>)
  const match = svgContent.match(/<svg[^>]*>([\s\S]*?)<\/svg>/i)
  if (!match) return ''

  // Clean up whitespace
  return match[1].trim().replace(/\s+/g, ' ')
}

function scanIconFolder(folderPath: string): Record<string, string> {
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

function generateTypeScript(iconSets: IconSet[]): string {
  const lines: string[] = [
    '/**',
    ' * Auto-generated icon definitions',
    ' * DO NOT EDIT - Run build-icons.ts to regenerate',
    ' */',
    '',
    "import { DeviceType } from '../models/v2'",
    '',
  ]

  // Generate icon set objects
  for (const set of iconSets) {
    lines.push(`// ${set.name} icons`)
    lines.push(`const ${set.name}Icons: Record<string, string> = {`)

    for (const [name, content] of Object.entries(set.icons)) {
      lines.push(`  '${name}': \`${content}\`,`)
    }

    lines.push('}')
    lines.push('')
  }

  // Generate DeviceType to icon mapping for default set
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

  // Generate getter function
  lines.push('/**')
  lines.push(' * Get SVG icon content for a device type')
  lines.push(' * @param type - Device type')
  lines.push(' * @param vendor - Optional vendor name (e.g., "cisco", "juniper")')
  lines.push(' */')
  lines.push('export function getDeviceIcon(type?: DeviceType, _vendor?: string): string | undefined {')
  lines.push('  if (!type) return undefined')
  lines.push('  ')
  lines.push('  const iconKey = deviceTypeToIcon[type]')
  lines.push('  if (!iconKey) return undefined')
  lines.push('  ')
  lines.push('  // TODO: Add vendor-specific icon lookup when available')
  lines.push('  // For now, always use default icons')
  lines.push('  return defaultIcons[iconKey]')
  lines.push('}')
  lines.push('')

  // Export all icon sets
  lines.push('export const iconSets = {')
  for (const set of iconSets) {
    lines.push(`  ${set.name}: ${set.name}Icons,`)
  }
  lines.push('}')
  lines.push('')

  return lines.join('\n')
}

function main() {
  console.log('Building icons...')

  const iconSets: IconSet[] = []

  // Scan for icon folders
  const entries = fs.readdirSync(ICONS_DIR, { withFileTypes: true })

  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    if (entry.name.startsWith('.')) continue

    const folderPath = path.join(ICONS_DIR, entry.name)
    const icons = scanIconFolder(folderPath)

    if (Object.keys(icons).length > 0) {
      iconSets.push({ name: entry.name, icons })
      console.log(`  Found ${Object.keys(icons).length} icons in ${entry.name}/`)
    }
  }

  if (iconSets.length === 0) {
    console.log('No icons found!')
    return
  }

  const output = generateTypeScript(iconSets)
  fs.writeFileSync(OUTPUT_FILE, output, 'utf-8')

  console.log(`Generated ${OUTPUT_FILE}`)
}

main()

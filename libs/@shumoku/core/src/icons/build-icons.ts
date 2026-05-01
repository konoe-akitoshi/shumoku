// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * Build script to convert default SVG icons to TypeScript
 * Run with: bun src/icons/build-icons.ts
 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const ICONS_DIR = path.join(__dirname)
const OUTPUT_FILE = path.join(__dirname, 'generated-icons.ts')

function extractSvgContent(svgContent: string): string {
  const contentMatch = svgContent.match(/<svg[^>]*>([\s\S]*?)<\/svg>/i)
  if (!contentMatch?.[1]) return ''
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

/**
 * Build script to convert vendor SVG files to TypeScript
 * Run with: npx tsx src/build-icons.ts
 */

import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'
import sharp from 'sharp'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const ICONS_DIR = path.join(__dirname)
const OUTPUT_FILE = path.join(__dirname, 'generated-icons.ts')

// Max width for resized PNG icons (height scales proportionally)
const MAX_ICON_WIDTH = 400

// Vendor icons with theme variants
interface IconEntry {
  default: string
  light?: string
  dark?: string
  viewBox?: string
}

interface VendorIconSet {
  name: string
  icons: Record<string, IconEntry>
}

interface SvgExtractResult {
  content: string
  viewBox?: string
}

function extractSvgContent(svgContent: string): SvgExtractResult {
  const svgTagMatch = svgContent.match(/<svg([^>]*)>/i)
  let viewBox: string | undefined

  if (svgTagMatch) {
    const viewBoxMatch = svgTagMatch[1].match(/viewBox="([^"]+)"/i)
    if (viewBoxMatch) {
      viewBox = viewBoxMatch[1]
    }
  }

  const contentMatch = svgContent.match(/<svg[^>]*>([\s\S]*?)<\/svg>/i)
  if (!contentMatch) return { content: '' }

  const content = contentMatch[1].trim().replace(/\s+/g, ' ')

  return { content, viewBox }
}

async function convertPngToOptimizedImageTag(filePath: string): Promise<string> {
  // Read and get original dimensions
  const image = sharp(filePath)
  const metadata = await image.metadata()
  const origWidth = metadata.width || 100
  const origHeight = metadata.height || 100

  // Calculate new dimensions (max width 400, maintain aspect ratio)
  let newWidth = origWidth
  let newHeight = origHeight
  if (origWidth > MAX_ICON_WIDTH) {
    newWidth = MAX_ICON_WIDTH
    newHeight = Math.round((origHeight / origWidth) * MAX_ICON_WIDTH)
  }

  // Resize and compress
  const optimizedBuffer = await image
    .resize(newWidth, newHeight, { fit: 'inside' })
    .png({ compressionLevel: 9, palette: true })
    .toBuffer()

  const base64 = optimizedBuffer.toString('base64')

  // Normalize for viewBox (height = 48)
  const normalizedWidth = Math.round((newWidth / newHeight) * 48)
  const normalizedHeight = 48

  return `<svg viewBox="0 0 ${normalizedWidth} ${normalizedHeight}" width="100%" height="100%"><image href="data:image/png;base64,${base64}" width="${normalizedWidth}" height="${normalizedHeight}" preserveAspectRatio="xMidYMid meet"/></svg>`
}

function parseAWSFilename(filename: string): { key: string; variant: 'default' | 'light' | 'dark' } | null {
  let name = filename.replace(/\.svg$/i, '')

  let variant: 'default' | 'light' | 'dark' = 'default'
  if (name.endsWith('_Light')) {
    variant = 'light'
    name = name.slice(0, -6)
  } else if (name.endsWith('_Dark')) {
    variant = 'dark'
    name = name.slice(0, -5)
  }

  if (!name.startsWith('Res_')) {
    return null
  }
  name = name.slice(4)
  name = name.replace(/_48$/, '')

  const amazonMatch = name.match(/^Amazon-([^_]+)_(.+)$/)
  if (amazonMatch) {
    const service = normalizeServiceName(amazonMatch[1])
    const resource = normalizeResourceName(amazonMatch[2])
    return { key: `${service}/${resource}`, variant }
  }

  const awsMatch = name.match(/^AWS-([^_]+)_(.+)$/)
  if (awsMatch) {
    const service = normalizeServiceName(awsMatch[1])
    const resource = normalizeResourceName(awsMatch[2])
    return { key: `${service}/${resource}`, variant }
  }

  const resource = normalizeResourceName(name)
  return { key: `general/${resource}`, variant }
}

function normalizeServiceName(name: string): string {
  return name.toLowerCase().replace(/-/g, '')
}

function normalizeResourceName(name: string): string {
  return name.toLowerCase().replace(/_/g, '-').replace(/\s+/g, '-')
}

function normalizeArubaIconName(filename: string): string {
  let name = filename.replace(/\.(svg|png)$/i, '')

  const prefixes = ['Device - ', 'Client - ', 'Generic - ', 'Function - ']
  for (const prefix of prefixes) {
    if (name.startsWith(prefix)) {
      name = name.slice(prefix.length)
      break
    }
  }

  return name.toLowerCase().replace(/\s+/g, '-')
}

async function scanVendorIconFolder(folderPath: string, vendorName: string): Promise<Record<string, IconEntry>> {
  const icons: Record<string, IconEntry> = {}

  if (!fs.existsSync(folderPath)) {
    return icons
  }

  const files = fs.readdirSync(folderPath)

  for (const file of files) {
    const filePath = path.join(folderPath, file)

    if (file.endsWith('.svg')) {
      const content = fs.readFileSync(filePath, 'utf-8')
      const iconName = vendorName === 'aruba'
        ? normalizeArubaIconName(file)
        : file.replace('.svg', '').toLowerCase()
      const { content: svgContent, viewBox } = extractSvgContent(content)

      if (svgContent) {
        icons[iconName] = { default: svgContent, viewBox }
      }
    } else if (file.endsWith('.png')) {
      const iconName = vendorName === 'aruba'
        ? normalizeArubaIconName(file)
        : file.replace('.png', '').toLowerCase()
      try {
        const imageContent = await convertPngToOptimizedImageTag(filePath)
        icons[iconName] = { default: imageContent }
      } catch (err) {
        console.warn(`  Warning: Failed to process ${file}: ${err}`)
      }
    }
  }

  return icons
}

function scanAWSIconFolder(folderPath: string): Record<string, IconEntry> {
  const icons: Record<string, IconEntry> = {}

  if (!fs.existsSync(folderPath)) {
    return icons
  }

  const files = fs.readdirSync(folderPath)

  for (const file of files) {
    if (!file.endsWith('.svg')) continue

    const parsed = parseAWSFilename(file)
    if (!parsed) continue

    const filePath = path.join(folderPath, file)
    const content = fs.readFileSync(filePath, 'utf-8')
    const { content: svgContent, viewBox } = extractSvgContent(content)

    if (!svgContent) continue

    const { key, variant } = parsed

    if (!icons[key]) {
      icons[key] = { default: '', viewBox: viewBox || '0 0 48 48' }
    }

    if (variant === 'light') {
      icons[key].light = svgContent
      if (!icons[key].default) {
        icons[key].default = svgContent
      }
    } else if (variant === 'dark') {
      icons[key].dark = svgContent
    } else {
      icons[key].default = svgContent
    }
  }

  for (const [_key, entry] of Object.entries(icons)) {
    if (!entry.default && entry.light) {
      entry.default = entry.light
    }
  }

  return icons
}

function generateTypeScript(iconSets: VendorIconSet[]): string {
  const lines: string[] = [
    '/**',
    ' * Auto-generated vendor icon definitions',
    ' * DO NOT EDIT - Run build-icons.ts to regenerate',
    ' */',
    '',
    "export type IconThemeVariant = 'light' | 'dark' | 'default'",
    '',
    'export interface VendorIconEntry {',
    '  default: string',
    '  light?: string',
    '  dark?: string',
    '  viewBox?: string',
    '}',
    '',
  ]

  const vendorVarNames: Record<string, string> = {}
  for (const vendorSet of iconSets) {
    const varName = `${vendorSet.name}Icons`
    vendorVarNames[vendorSet.name] = varName

    lines.push(`// ${vendorSet.name.toUpperCase()} icons`)
    lines.push(`const ${varName}: Record<string, VendorIconEntry> = {`)
    const sortedKeys = Object.keys(vendorSet.icons).sort()
    for (const key of sortedKeys) {
      const entry = vendorSet.icons[key]
      const escapedDefault = entry.default.replace(/`/g, '\\`')

      if (entry.light || entry.dark || entry.viewBox) {
        lines.push(`  '${key}': {`)
        lines.push(`    default: \`${escapedDefault}\`,`)
        if (entry.light) {
          const escapedLight = entry.light.replace(/`/g, '\\`')
          lines.push(`    light: \`${escapedLight}\`,`)
        }
        if (entry.dark) {
          const escapedDark = entry.dark.replace(/`/g, '\\`')
          lines.push(`    dark: \`${escapedDark}\`,`)
        }
        if (entry.viewBox) {
          lines.push(`    viewBox: '${entry.viewBox}',`)
        }
        lines.push('  },')
      } else {
        lines.push(`  '${key}': { default: \`${escapedDefault}\` },`)
      }
    }
    lines.push('}')
    lines.push('')
  }

  // Generate all vendor icons lookup
  lines.push('// All vendor icon sets')
  lines.push('export const vendorIconSets: Record<string, Record<string, VendorIconEntry>> = {')
  for (const vendorSet of iconSets) {
    lines.push(`  '${vendorSet.name}': ${vendorVarNames[vendorSet.name]},`)
  }
  lines.push('}')
  lines.push('')

  // Generate getter function
  lines.push('/**')
  lines.push(' * Get vendor icon entry by vendor, service, and optional resource')
  lines.push(' */')
  lines.push('export function getVendorIconEntry(')
  lines.push('  vendor: string,')
  lines.push('  service: string,')
  lines.push('  resource?: string')
  lines.push('): VendorIconEntry | undefined {')
  lines.push('  const vendorIcons = vendorIconSets[vendor]')
  lines.push('  if (!vendorIcons) return undefined')
  lines.push('')
  lines.push('  const key = resource ? `${service}/${resource}` : service')
  lines.push('  const entry = vendorIcons[key]')
  lines.push('  if (!entry) {')
  lines.push("    const serviceKey = Object.keys(vendorIcons).find(k => k.startsWith(service + '/'))")
  lines.push('    if (serviceKey) {')
  lines.push('      return vendorIcons[serviceKey]')
  lines.push('    }')
  lines.push('    return undefined')
  lines.push('  }')
  lines.push('  return entry')
  lines.push('}')
  lines.push('')

  // Generate icon getter with theme support
  lines.push('/**')
  lines.push(' * Get vendor icon content with theme support')
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

  // Export individual sets
  lines.push('// Individual vendor exports')
  for (const vendorSet of iconSets) {
    lines.push(`export { ${vendorVarNames[vendorSet.name]} }`)
  }
  lines.push('')

  return lines.join('\n')
}

async function main() {
  console.log('Building vendor icons...')

  const iconSets: VendorIconSet[] = []

  const entries = fs.readdirSync(ICONS_DIR, { withFileTypes: true })

  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    if (entry.name.startsWith('.')) continue

    const folderPath = path.join(ICONS_DIR, entry.name)

    if (entry.name === 'aws') {
      const icons = scanAWSIconFolder(folderPath)
      if (Object.keys(icons).length > 0) {
        iconSets.push({ name: 'aws', icons })
        console.log(`  Found ${Object.keys(icons).length} AWS icons`)
      }
    } else {
      const icons = await scanVendorIconFolder(folderPath, entry.name)
      if (Object.keys(icons).length > 0) {
        iconSets.push({ name: entry.name, icons })
        console.log(`  Found ${Object.keys(icons).length} ${entry.name} icons`)
      }
    }
  }

  if (iconSets.length === 0) {
    console.log('No vendor icons found!')
    return
  }

  const output = generateTypeScript(iconSets)
  fs.writeFileSync(OUTPUT_FILE, output, 'utf-8')

  console.log(`Generated ${OUTPUT_FILE}`)
}

main()

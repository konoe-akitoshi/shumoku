#!/usr/bin/env node
/**
 * NetBox to Shumoku CLI
 */

import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { buildHierarchicalSheets } from '@shumoku/core'
import { HierarchicalLayout } from '@shumoku/core/layout'
import { html, svg } from '@shumoku/renderer'
import { INTERACTIVE_IIFE } from '@shumoku/renderer/iife-string'
import '@shumoku/icons' // Register vendor icons
import pkg from '../package.json' with { type: 'json' }
import type { QueryParams } from './client.js'
import { NetBoxClient } from './client.js'
import { convertToNetworkGraph, toYaml } from './converter.js'
import type { ConverterOptions, GroupBy } from './types.js'

const VERSION = pkg.version

const HELP = `
netbox-to-shumoku v${VERSION} - Convert NetBox topology to Shumoku YAML/JSON/SVG/HTML

Usage: netbox-to-shumoku [options]

Connection:
  -u, --url <url>       NetBox API URL (or NETBOX_URL env)
  -t, --token <token>   API token (or NETBOX_TOKEN env)

Output:
  -f, --format <type>   Output format: yaml|json|svg|html (default: auto from extension)
  -o, --output <file>   Output file (default: topology.yaml)
  --theme <theme>       Theme: light|dark (default: light)

Filtering:
  -s, --site <slug>     Filter by site
  -r, --role <slug>     Filter by device role
  --status <status>     Filter by status (active|planned|staged|failed|offline)
  --tag <slug>          Filter by tag

Display:
  -g, --group-by <type> Group by: tag|site|location|prefix|none (default: tag)
  --no-ports            Hide port names
  --no-colors           Disable cable type colors
  --color-by-status     Color devices by status
  --legend              Show legend (SVG/HTML)

Other:
  -d, --debug           Show debug output (API requests/responses)
  -h, --help            Show help
  -v, --version         Show version

Examples:
  netbox-to-shumoku -f html -o topology
  netbox-to-shumoku --site tokyo-dc -g location -o tokyo.svg
  netbox-to-shumoku --color-by-status --theme dark -f svg
  netbox-to-shumoku -f json -o netbox.json   # Export as NetworkGraph JSON
`

type OutputFormat = 'yaml' | 'json' | 'svg' | 'html'

function cli() {
  const { values } = parseArgs({
    options: {
      url: { type: 'string', short: 'u' },
      token: { type: 'string', short: 't' },
      format: { type: 'string', short: 'f' },
      output: { type: 'string', short: 'o', default: 'topology' },
      theme: { type: 'string' },
      site: { type: 'string', short: 's' },
      role: { type: 'string', short: 'r' },
      status: { type: 'string' },
      tag: { type: 'string' },
      'group-by': { type: 'string', short: 'g' },
      'no-ports': { type: 'boolean', default: false },
      'no-colors': { type: 'boolean', default: false },
      'color-by-status': { type: 'boolean', default: false },
      legend: { type: 'boolean', default: false },
      debug: { type: 'boolean', short: 'd', default: false },
      help: { type: 'boolean', short: 'h', default: false },
      version: { type: 'boolean', short: 'v', default: false },
    },
    strict: true,
  })

  if (values.help) {
    console.log(HELP)
    process.exit(0)
  }

  if (values.version) {
    console.log(VERSION)
    process.exit(0)
  }

  return values
}

async function main(): Promise<void> {
  const opts = cli()

  const url = opts.url ?? process.env.NETBOX_URL
  const token = opts.token ?? process.env.NETBOX_TOKEN

  if (!url || !token) {
    console.error('Error: NetBox URL and token required.')
    console.error('Use --url/--token or set NETBOX_URL/NETBOX_TOKEN env vars.')
    process.exit(1)
  }

  try {
    console.log('Connecting to NetBox...')
    const client = new NetBoxClient({ url, token, debug: opts.debug })

    // Build filters
    const queryParams: QueryParams = {}
    if (opts.site) queryParams.site = opts.site
    if (opts.role) queryParams.role = opts.role
    if (opts.status) queryParams.status = opts.status
    if (opts.tag) queryParams.tag = opts.tag

    const hasFilters = Object.keys(queryParams).length > 0
    if (hasFilters) console.log('Filters:', queryParams)

    // Fetch data
    console.log('Fetching devices...')
    const devices = await client.fetchDevices(queryParams)
    console.log(`  Found ${devices.results.length} devices`)

    console.log('Fetching interfaces...')
    const interfaces = await client.fetchInterfaces(hasFilters ? { site: opts.site } : undefined)
    console.log(`  Found ${interfaces.results.length} interfaces`)

    console.log('Fetching cables...')
    const cables = await client.fetchCables()
    console.log(`  Found ${cables.results.length} cables`)

    // Convert
    console.log('Converting to Shumoku format...')
    const converterOptions: ConverterOptions = {
      theme: (opts.theme as 'light' | 'dark') ?? 'light',
      showPorts: !opts['no-ports'],
      groupBy: (opts['group-by'] as GroupBy) ?? 'tag',
      colorByCableType: !opts['no-colors'],
      colorByStatus: opts['color-by-status'],
      legend: opts.legend,
    }

    const graph = convertToNetworkGraph(devices, interfaces, cables, converterOptions)
    console.log(`  Created ${graph.nodes.length} nodes, ${graph.links.length} links`)
    if (graph.subgraphs) console.log(`  Created ${graph.subgraphs.length} subgraphs`)

    // Determine format: explicit --format takes priority, then infer from extension
    const outputBase = opts.output!
    const extMatch = outputBase.toLowerCase().match(/\.(yaml|yml|json|svg|html|htm)$/)
    const format: OutputFormat =
      (opts.format as OutputFormat) ??
      (extMatch
        ? extMatch[1] === 'yml'
          ? 'yaml'
          : extMatch[1] === 'htm'
            ? 'html'
            : (extMatch[1] as OutputFormat)
        : 'yaml')

    // Build output path with extension if not present
    const hasExt = /\.(yaml|yml|json|svg|html|htm)$/i.test(outputBase)
    const outputPath = resolve(process.cwd(), hasExt ? outputBase : `${outputBase}.${format}`)

    // Ensure output directory exists
    mkdirSync(dirname(outputPath), { recursive: true })

    if (format === 'svg' || format === 'html') {
      console.log('Generating layout...')
      const layout = new HierarchicalLayout()
      const layoutResult = await layout.layoutAsync(graph)

      if (format === 'html') {
        console.log('Rendering HTML...')
        html.setIIFE(INTERACTIVE_IIFE)

        // Build hierarchical sheets (includes export connectors for boundary connections)
        const sheets = await buildHierarchicalSheets(graph, layoutResult, layout)

        // Use hierarchical rendering if we have subgraphs
        if (sheets.size > 1) {
          writeFileSync(outputPath, html.renderHierarchical(sheets), 'utf-8')
        } else {
          writeFileSync(outputPath, html.render(graph, layoutResult), 'utf-8')
        }
      } else {
        console.log('Rendering SVG...')
        writeFileSync(outputPath, svg.render(graph, layoutResult), 'utf-8')
      }
    } else if (format === 'json') {
      console.log('Exporting NetworkGraph JSON...')
      writeFileSync(outputPath, JSON.stringify(graph, null, 2), 'utf-8')
    } else {
      writeFileSync(outputPath, toYaml(graph), 'utf-8')
    }
    console.log(`Output written to: ${outputPath}`)

    console.log('Done!')
  } catch (err) {
    console.error('Error:', err instanceof Error ? err.message : String(err))
    process.exit(1)
  }
}

main()

#!/usr/bin/env node
/**
 * NetBox to Shumoku CLI
 */

import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import {
  html,
  prepareRender,
  renderHtmlHierarchical,
  renderPng,
  renderSvg,
} from '@shumoku/renderer'
import { INTERACTIVE_IIFE } from '@shumoku/renderer/iife-string'
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
  -k, --insecure        Skip TLS certificate verification (for self-signed certs)

Output:
  -f, --format <type>   Output format: yaml|json|svg|html (default: auto from extension)
  -o, --output <file>   Output file (default: topology.yaml)
  --theme <theme>       Theme: light|dark (default: light)

Filtering:
  -s, --site <slug>     Filter by site
  -r, --role <slug>     Filter by device role (can specify multiple: -r router -r switch)
  --exclude-role <slug> Exclude by device role (e.g., --exclude-role ap)
  --status <status>     Filter by status (active|planned|staged|failed|offline)
  --tag <slug>          Filter by tag
  --exclude-tag <slug>  Exclude by tag

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
  netbox-to-shumoku --exclude-role ap -o no-aps.svg    # Exclude access points
  netbox-to-shumoku --color-by-status --theme dark -f svg
  netbox-to-shumoku -f json -o netbox.json             # Export as NetworkGraph JSON
`

type OutputFormat = 'yaml' | 'json' | 'svg' | 'html' | 'png'

function cli() {
  const { values } = parseArgs({
    options: {
      url: { type: 'string', short: 'u' },
      token: { type: 'string', short: 't' },
      insecure: { type: 'boolean', short: 'k', default: false },
      format: { type: 'string', short: 'f' },
      output: { type: 'string', short: 'o', default: 'topology' },
      theme: { type: 'string' },
      site: { type: 'string', short: 's' },
      role: { type: 'string', short: 'r', multiple: true },
      'exclude-role': { type: 'string', multiple: true },
      status: { type: 'string' },
      tag: { type: 'string', multiple: true },
      'exclude-tag': { type: 'string', multiple: true },
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

  // Handle insecure mode
  if (opts.insecure) {
    console.warn('Warning: TLS certificate verification disabled')
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
  }

  try {
    console.log('Connecting to NetBox...')
    const client = new NetBoxClient({ url, token, debug: opts.debug })

    // Build filters
    const queryParams: QueryParams = {}
    if (opts.site) queryParams.site = opts.site
    if (opts.role?.length) queryParams.role = opts.role.length === 1 ? opts.role[0] : opts.role
    if (opts['exclude-role']?.length)
      queryParams.role__n =
        opts['exclude-role'].length === 1 ? opts['exclude-role'][0] : opts['exclude-role']
    if (opts.status) queryParams.status = opts.status
    if (opts.tag?.length) queryParams.tag = opts.tag.length === 1 ? opts.tag[0] : opts.tag
    if (opts['exclude-tag']?.length)
      queryParams.tag__n =
        opts['exclude-tag'].length === 1 ? opts['exclude-tag'][0] : opts['exclude-tag']

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
    const extMatch = outputBase.toLowerCase().match(/\.(yaml|yml|json|svg|html|htm|png)$/)
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
    const hasExt = /\.(yaml|yml|json|svg|html|htm|png)$/i.test(outputBase)
    const outputPath = resolve(process.cwd(), hasExt ? outputBase : `${outputBase}.${format}`)

    // Ensure output directory exists
    mkdirSync(dirname(outputPath), { recursive: true })

    if (format === 'svg' || format === 'html' || format === 'png') {
      console.log('Preparing render (resolving icons, computing layout)...')
      const prepared = await prepareRender(graph)

      if (format === 'html') {
        console.log('Rendering HTML...')
        html.setIIFE(INTERACTIVE_IIFE)

        // Use hierarchical rendering if we have subgraphs
        const content = await renderHtmlHierarchical(prepared)
        writeFileSync(outputPath, content, 'utf-8')
      } else if (format === 'png') {
        console.log('Rendering PNG...')
        writeFileSync(outputPath, await renderPng(prepared))
      } else {
        console.log('Rendering SVG...')
        writeFileSync(outputPath, await renderSvg(prepared), 'utf-8')
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

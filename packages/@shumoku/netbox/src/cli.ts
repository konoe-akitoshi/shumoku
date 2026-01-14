#!/usr/bin/env node
/**
 * NetBox to Shumoku CLI
 *
 * Usage:
 *   netbox-to-shumoku --url $NETBOX_URL --token $NETBOX_TOKEN --output topology.yaml
 *   netbox-to-shumoku --output topology.svg
 *   netbox-to-shumoku --output topology.html
 */

import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { HierarchicalLayout } from '@shumoku/core/layout'
import { html, svg } from '@shumoku/renderer'
import { INTERACTIVE_IIFE } from '@shumoku/renderer/iife-string'
import '@shumoku/icons' // Register vendor icons
import type { QueryParams } from './client.js'
import { NetBoxClient } from './client.js'
import { convertToNetworkGraph, toYaml } from './converter.js'
import type { ConverterOptions, GroupBy } from './types.js'

interface CliOptions {
  url?: string
  token?: string
  output: string
  theme?: 'light' | 'dark'
  site?: string
  role?: string
  status?: string
  tag?: string
  groupBy?: GroupBy
  noPorts?: boolean
  noColors?: boolean
  colorByStatus?: boolean
  legend?: boolean
}

function parseArgs(args: string[]): CliOptions {
  const options: CliOptions = {
    output: 'topology.yaml',
  }

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]

    switch (arg) {
      case '--url':
      case '-u':
        options.url = args[++i]
        break
      case '--token':
      case '-t':
        options.token = args[++i]
        break
      case '--output':
      case '-o':
        options.output = args[++i]
        break
      case '--theme':
        options.theme = args[++i] as 'light' | 'dark'
        break
      case '--site':
      case '-s':
        options.site = args[++i]
        break
      case '--role':
      case '-r':
        options.role = args[++i]
        break
      case '--status':
        options.status = args[++i]
        break
      case '--tag':
        options.tag = args[++i]
        break
      case '--group-by':
      case '-g':
        options.groupBy = args[++i] as GroupBy
        break
      case '--no-ports':
        options.noPorts = true
        break
      case '--no-colors':
        options.noColors = true
        break
      case '--color-by-status':
        options.colorByStatus = true
        break
      case '--legend':
        options.legend = true
        break
      case '--help':
      case '-h':
        printHelp()
        process.exit(0)
    }
  }

  return options
}

function printHelp(): void {
  console.log(`
netbox-to-shumoku - Convert NetBox topology to Shumoku YAML/SVG/HTML

Usage:
  netbox-to-shumoku [options]

Connection Options:
  -u, --url <url>       NetBox API URL (or set NETBOX_URL env var)
  -t, --token <token>   NetBox API token (or set NETBOX_TOKEN env var)

Output Options:
  -o, --output <file>   Output file (default: topology.yaml)
                        Use .svg for static SVG output
                        Use .html for interactive HTML output
  --theme <theme>       Theme: light or dark (default: light)

Filtering Options:
  -s, --site <slug>     Filter by site slug
  -r, --role <slug>     Filter by device role slug
  --status <status>     Filter by status (active, planned, staged, failed, offline)
  --tag <slug>          Filter by tag slug

Display Options:
  -g, --group-by <type> Group devices: tag, site, location, prefix, none (default: tag)
  --no-ports            Don't include port names in links
  --no-colors           Don't color links by cable type
  --color-by-status     Color devices by their status
  --legend              Show legend in the diagram (SVG/HTML output)

Other:
  -h, --help            Show this help message

Examples:
  # Using environment variables
  export NETBOX_URL=https://netbox.example.com
  export NETBOX_TOKEN=abc123
  netbox-to-shumoku --output topology.yaml

  # Filter by site and group by location
  netbox-to-shumoku --site tokyo-dc --group-by location -o tokyo.svg

  # Generate interactive HTML with tooltips and pan/zoom
  netbox-to-shumoku --output topology.html

  # Show device status colors
  netbox-to-shumoku --color-by-status --output topology.svg

  # Generate dark theme SVG
  netbox-to-shumoku --theme dark --output topology.svg
`)
}

async function main(): Promise<void> {
  const args = process.argv.slice(2)
  const options = parseArgs(args)

  // Get credentials from options or environment
  const url = options.url ?? process.env.NETBOX_URL
  const token = options.token ?? process.env.NETBOX_TOKEN

  if (!url || !token) {
    console.error('Error: NetBox URL and token are required.')
    console.error('Set NETBOX_URL and NETBOX_TOKEN environment variables,')
    console.error('or use --url and --token options.')
    process.exit(1)
  }

  console.log('Connecting to NetBox...')
  const client = new NetBoxClient({ url, token })

  try {
    // Build query parameters for filtering
    const queryParams: QueryParams = {}
    if (options.site) queryParams.site = options.site
    if (options.role) queryParams.role = options.role
    if (options.status) queryParams.status = options.status
    if (options.tag) queryParams.tag = options.tag

    const hasFilters = Object.keys(queryParams).length > 0
    if (hasFilters) {
      console.log('Filters:', queryParams)
    }

    // Fetch data from NetBox
    console.log('Fetching devices...')
    const devices = await client.fetchDevices(queryParams)
    console.log(`  Found ${devices.results.length} devices`)

    console.log('Fetching interfaces...')
    const interfaces = await client.fetchInterfaces(hasFilters ? { site: options.site } : undefined)
    console.log(`  Found ${interfaces.results.length} interfaces`)

    console.log('Fetching cables...')
    const cables = await client.fetchCables()
    console.log(`  Found ${cables.results.length} cables`)

    // Convert to NetworkGraph
    console.log('Converting to Shumoku format...')
    const converterOptions: ConverterOptions = {
      theme: options.theme ?? 'light',
      showPorts: !options.noPorts,
      groupBy: options.groupBy ?? 'tag',
      colorByCableType: !options.noColors,
      colorByStatus: options.colorByStatus,
      legend: options.legend,
    }

    const graph = convertToNetworkGraph(devices, interfaces, cables, converterOptions)

    console.log(`  Created ${graph.nodes.length} nodes, ${graph.links.length} links`)
    if (graph.subgraphs) {
      console.log(`  Created ${graph.subgraphs.length} subgraphs`)
    }

    // Determine output format
    const outputPath = resolve(process.cwd(), options.output)
    const outputLower = options.output.toLowerCase()
    const isSvg = outputLower.endsWith('.svg')
    const isHtml = outputLower.endsWith('.html') || outputLower.endsWith('.htm')

    if (isSvg || isHtml) {
      // Generate SVG or HTML (both need layout)
      console.log('Generating layout...')
      const layout = new HierarchicalLayout()
      const layoutResult = await layout.layoutAsync(graph)

      if (isHtml) {
        // Generate interactive HTML
        console.log('Rendering HTML...')
        html.setIIFE(INTERACTIVE_IIFE)
        const htmlOutput = html.render(graph, layoutResult)

        writeFileSync(outputPath, htmlOutput, 'utf-8')
        console.log(`HTML written to: ${outputPath}`)
      } else {
        // Generate SVG
        console.log('Rendering SVG...')
        const svgOutput = svg.render(graph, layoutResult)

        writeFileSync(outputPath, svgOutput, 'utf-8')
        console.log(`SVG written to: ${outputPath}`)
      }
    } else {
      // Generate YAML
      const yaml = toYaml(graph)
      writeFileSync(outputPath, yaml, 'utf-8')
      console.log(`YAML written to: ${outputPath}`)
    }

    console.log('Done!')
  } catch (err) {
    console.error('Error:', err instanceof Error ? err.message : String(err))
    process.exit(1)
  }
}

main()

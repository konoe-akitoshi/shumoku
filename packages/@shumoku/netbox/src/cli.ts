#!/usr/bin/env node
/**
 * NetBox to Shumoku CLI
 *
 * Usage:
 *   netbox-to-shumoku --url $NETBOX_URL --token $NETBOX_TOKEN --output topology.yaml
 *   netbox-to-shumoku --output topology.svg
 */

import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { HierarchicalLayout } from '@shumoku/core/layout'
import { SVGRenderer } from '@shumoku/core/renderer'
import '@shumoku/icons' // Register vendor icons
import { NetBoxClient } from './client.js'
import { convertToNetworkGraph, toYaml } from './converter.js'
import type { ConverterOptions } from './types.js'

interface CliOptions {
  url?: string
  token?: string
  output: string
  theme?: 'light' | 'dark'
  noPorts?: boolean
  noGroups?: boolean
  noColors?: boolean
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
      case '--no-ports':
        options.noPorts = true
        break
      case '--no-groups':
        options.noGroups = true
        break
      case '--no-colors':
        options.noColors = true
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
netbox-to-shumoku - Convert NetBox topology to Shumoku YAML/SVG

Usage:
  netbox-to-shumoku [options]

Options:
  -u, --url <url>       NetBox API URL (or set NETBOX_URL env var)
  -t, --token <token>   NetBox API token (or set NETBOX_TOKEN env var)
  -o, --output <file>   Output file (default: topology.yaml)
                        Use .svg extension for direct SVG output
  --theme <theme>       Theme: light or dark (default: light)
  --no-ports            Don't include port names in links
  --no-groups           Don't group devices into subgraphs
  --no-colors           Don't color links by cable type
  -h, --help            Show this help message

Examples:
  # Using environment variables
  export NETBOX_URL=https://netbox.example.com
  export NETBOX_TOKEN=abc123
  netbox-to-shumoku --output topology.yaml

  # With explicit credentials
  netbox-to-shumoku -u https://netbox.example.com -t abc123 -o topology.svg

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
    // Fetch data from NetBox
    console.log('Fetching devices...')
    const devices = await client.fetchDevices()
    console.log(`  Found ${devices.results.length} devices`)

    console.log('Fetching interfaces...')
    const interfaces = await client.fetchInterfaces()
    console.log(`  Found ${interfaces.results.length} interfaces`)

    console.log('Fetching cables...')
    const cables = await client.fetchCables()
    console.log(`  Found ${cables.results.length} cables`)

    // Convert to NetworkGraph
    console.log('Converting to Shumoku format...')
    const converterOptions: ConverterOptions = {
      theme: options.theme ?? 'light',
      showPorts: !options.noPorts,
      groupByTag: !options.noGroups,
      colorByCableType: !options.noColors,
    }

    const graph = convertToNetworkGraph(
      devices,
      interfaces,
      cables,
      converterOptions
    )

    console.log(`  Created ${graph.nodes.length} nodes, ${graph.links.length} links`)
    if (graph.subgraphs) {
      console.log(`  Created ${graph.subgraphs.length} subgraphs`)
    }

    // Determine output format
    const outputPath = resolve(process.cwd(), options.output)
    const isSvg = options.output.toLowerCase().endsWith('.svg')

    if (isSvg) {
      // Generate SVG
      console.log('Generating layout...')
      const layout = new HierarchicalLayout()
      const layoutResult = await layout.layoutAsync(graph)

      console.log('Rendering SVG...')
      const renderer = new SVGRenderer()
      const svg = renderer.render(graph, layoutResult)

      writeFileSync(outputPath, svg, 'utf-8')
      console.log(`SVG written to: ${outputPath}`)
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

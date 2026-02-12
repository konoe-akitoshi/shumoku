#!/usr/bin/env node
/**
 * Shumoku CLI - Render NetworkGraph YAML/JSON to SVG/HTML/PNG
 */

// Import @shumoku/icons to auto-register vendor icons
import '@shumoku/icons'

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, extname, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { Resvg } from '@resvg/resvg-js'
import type { NetworkGraph } from '@shumoku/core'
import { buildHierarchicalSheets, HierarchicalLayout } from '@shumoku/core'
import { parser } from '@shumoku/parser-yaml'
import pkg from '../package.json' with { type: 'json' }
import * as html from './html/index.js'
import { INTERACTIVE_IIFE } from './iife-string.js'
import * as svg from './svg.js'

const VERSION = pkg.version

const HELP = `
shumoku v${VERSION} - Render NetworkGraph YAML/JSON to SVG/HTML/PNG

Usage: shumoku render [options] <input>

Input:
  <input>             NetworkGraph YAML or JSON file (use - for stdin)
                      Format auto-detected from extension (.yaml, .yml, .json)

Output:
  -f, --format <type> Output format: svg|html|png (default: auto from extension)
  -o, --output <file> Output file (default: output.svg)
  --theme <theme>     Theme: light|dark (default: light)
  --scale <number>    PNG scale factor (default: 2)

Other:
  -h, --help          Show help
  -v, --version       Show version

Examples:
  shumoku render network.yaml -o diagram.svg
  shumoku render network.yaml -f html -o diagram.html
  shumoku render network.yaml -f png -o diagram.png
  shumoku render topology.json -o diagram.svg
  cat network.yaml | shumoku render - -o diagram.svg
`

type OutputFormat = 'svg' | 'html' | 'png'

function cli() {
  const args = process.argv.slice(2)

  // Handle subcommand
  if (args[0] === 'render') {
    args.shift()
  }

  const { values, positionals } = parseArgs({
    args,
    options: {
      format: { type: 'string', short: 'f' },
      output: { type: 'string', short: 'o', default: 'output' },
      theme: { type: 'string' },
      scale: { type: 'string', default: '2' },
      help: { type: 'boolean', short: 'h', default: false },
      version: { type: 'boolean', short: 'v', default: false },
    },
    allowPositionals: true,
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

  return { values, inputFile: positionals[0] }
}

function parseInput(content: string, filename: string): NetworkGraph {
  const ext = extname(filename).toLowerCase()

  if (ext === '.json') {
    return JSON.parse(content) as NetworkGraph
  }

  // Default to YAML (for .yaml, .yml, or stdin)
  const result = parser.parse(content)
  if (result.warnings && result.warnings.length > 0) {
    for (const warning of result.warnings) {
      if (warning.severity === 'error') {
        throw new Error(`YAML parse error: ${warning.message}`)
      }
      console.warn(`Warning: ${warning.message}`)
    }
  }
  return result.graph
}

async function main(): Promise<void> {
  const { values, inputFile } = cli()

  if (!inputFile) {
    console.error('Error: Input file required.')
    console.error('Usage: shumoku render <input.yaml|json>')
    console.error('Use --help for more information.')
    process.exit(1)
  }

  try {
    // Read input
    let content: string
    let filename: string
    if (inputFile === '-') {
      // Read from stdin (assume YAML)
      console.log('Reading from stdin...')
      const chunks: Buffer[] = []
      for await (const chunk of process.stdin) {
        chunks.push(chunk)
      }
      content = Buffer.concat(chunks).toString('utf-8')
      filename = 'stdin.yaml'
    } else {
      console.log(`Reading ${inputFile}...`)
      content = readFileSync(resolve(process.cwd(), inputFile), 'utf-8')
      filename = inputFile
    }

    // Parse input
    const graph = parseInput(content, filename)
    console.log(`Loaded graph: ${graph.nodes.length} nodes, ${graph.links.length} links`)
    if (graph.subgraphs) {
      console.log(`  ${graph.subgraphs.length} subgraphs`)
    }

    // Determine format
    const outputBase = values.output!
    const extMatch = outputBase.toLowerCase().match(/\.(svg|html|htm|png)$/)
    const format: OutputFormat =
      (values.format as OutputFormat) ??
      (extMatch ? (extMatch[1] === 'htm' ? 'html' : (extMatch[1] as OutputFormat)) : 'svg')

    // Build output path
    const hasExt = /\.(svg|html|htm|png)$/i.test(outputBase)
    const outputPath = resolve(process.cwd(), hasExt ? outputBase : `${outputBase}.${format}`)

    // Ensure output directory exists
    mkdirSync(dirname(outputPath), { recursive: true })

    // Layout
    console.log('Generating layout...')
    const layout = new HierarchicalLayout()
    const layoutResult = await layout.layoutAsync(graph)

    // Render
    if (format === 'html') {
      console.log('Rendering HTML...')
      html.setIIFE(INTERACTIVE_IIFE)

      const sheets = await buildHierarchicalSheets(graph, layoutResult, layout)

      if (sheets.size > 1) {
        writeFileSync(outputPath, html.renderHierarchical(sheets), 'utf-8')
      } else {
        writeFileSync(outputPath, html.render(graph, layoutResult), 'utf-8')
      }
    } else if (format === 'png') {
      console.log('Rendering PNG...')
      const svgString = svg.render(graph, layoutResult)
      const scale = Number.parseFloat(values.scale!) || 2
      const resvg = new Resvg(svgString, {
        fitTo: { mode: 'zoom', value: scale },
        font: {
          loadSystemFonts: true,
        },
      })
      const pngData = resvg.render()
      writeFileSync(outputPath, pngData.asPng())
    } else {
      console.log('Rendering SVG...')
      writeFileSync(outputPath, svg.render(graph, layoutResult), 'utf-8')
    }

    console.log(`Output written to: ${outputPath}`)
    console.log('Done!')
  } catch (err) {
    if (err instanceof SyntaxError) {
      console.error('Error: Invalid JSON format')
      console.error(err.message)
    } else {
      console.error('Error:', err instanceof Error ? err.message : String(err))
    }
    process.exit(1)
  }
}

void main()

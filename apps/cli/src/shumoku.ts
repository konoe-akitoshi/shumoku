#!/usr/bin/env node
// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev
/**
 * Shumoku CLI - Render NetworkGraph YAML/JSON to SVG/HTML/PNG
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, extname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import {
  buildHierarchicalSheets,
  computeNetworkLayout,
  createNetworkLayoutEngine,
  darkTheme,
  lightTheme,
  type NetworkGraph,
  parser,
  type Theme,
  type ThemeType,
} from '@shumoku/core'
import { renderSvgString } from '@shumoku/renderer/static'
import {
  render as renderHtml,
  renderHierarchical as renderHtmlHierarchical,
  setIIFE,
} from '@shumoku/renderer-html'
import { INTERACTIVE_IIFE } from '@shumoku/renderer-html/iife-string'
import { png } from '@shumoku/renderer-png'
import { createParseArgsOptions, renderCommand, renderCommandHelp } from './command.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const pkg = JSON.parse(readFileSync(resolve(__dirname, '../package.json'), 'utf-8'))
const VERSION = pkg.version as string

const HELP = renderCommandHelp(VERSION)

type OutputFormat = 'svg' | 'html' | 'png'

function resolveTheme(value: string | undefined): { name: ThemeType; theme: Theme } {
  const name = value ?? 'light'
  if (name !== 'light' && name !== 'dark') {
    throw new Error(`Invalid theme "${name}". Expected light or dark.`)
  }
  return { name, theme: name === 'dark' ? darkTheme : lightTheme }
}

function cli() {
  const args = process.argv.slice(2)

  // Handle subcommand
  if (args[0] === renderCommand.name) {
    args.shift()
  }

  const { values: rawValues, positionals } = parseArgs({
    args,
    options: createParseArgsOptions(renderCommand),
    allowPositionals: true,
    strict: true,
  })

  const values = {
    format: typeof rawValues['format'] === 'string' ? rawValues['format'] : undefined,
    output: typeof rawValues['output'] === 'string' ? rawValues['output'] : 'output',
    theme: typeof rawValues['theme'] === 'string' ? rawValues['theme'] : undefined,
    scale: typeof rawValues['scale'] === 'string' ? rawValues['scale'] : '2',
    help: rawValues['help'] === true,
    version: rawValues['version'] === true,
  }

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
    const outputBase = values.output
    const extMatch = outputBase.toLowerCase().match(/\.(svg|html|htm|png)$/)
    const format: OutputFormat =
      (values.format as OutputFormat) ??
      (extMatch ? (extMatch[1] === 'htm' ? 'html' : (extMatch[1] as OutputFormat)) : 'svg')

    // Build output path
    const hasExt = /\.(svg|html|htm|png)$/i.test(outputBase)
    const outputPath = resolve(process.cwd(), hasExt ? outputBase : `${outputBase}.${format}`)
    const { name: themeName, theme } = resolveTheme(values.theme)
    const renderGraph: NetworkGraph = {
      ...graph,
      settings: { ...graph.settings, theme: themeName },
    }

    // Ensure output directory exists
    mkdirSync(dirname(outputPath), { recursive: true })

    // Layout
    console.log('Generating layout...')
    const engine = createNetworkLayoutEngine()
    const { resolved, layout: layoutResult } = await computeNetworkLayout(renderGraph)

    // Render
    if (format === 'html') {
      console.log('Rendering HTML...')
      setIIFE(INTERACTIVE_IIFE)

      const sheets = await buildHierarchicalSheets(renderGraph, layoutResult, engine)
      const rootSheet = sheets.get('root')
      if (rootSheet) sheets.set('root', { ...rootSheet, resolved })

      if (sheets.size > 1) {
        writeFileSync(outputPath, renderHtmlHierarchical(sheets, { theme: themeName }), 'utf-8')
      } else {
        writeFileSync(
          outputPath,
          renderHtml(renderGraph, layoutResult, { theme: themeName, resolved }),
          'utf-8',
        )
      }
    } else if (format === 'png') {
      console.log('Rendering PNG...')
      const scale = Number.parseFloat(values.scale) || 2
      const pngBuffer = await png.renderResolved(resolved, { scale, theme })
      writeFileSync(outputPath, pngBuffer)
    } else {
      console.log('Rendering SVG...')
      writeFileSync(outputPath, renderSvgString(resolved, { theme }), 'utf-8')
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

main()

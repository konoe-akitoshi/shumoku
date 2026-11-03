#!/usr/bin/env node
// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev
/**
 * Shumoku CLI - Render a network YAML to SVG/HTML/PNG
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import {
  darkTheme,
  lightTheme,
  readNetworkModel,
  type Theme,
  type ThemeType,
  toNetworkGraph,
} from '@shumoku/core'
import { renderNetworkSvg } from '@shumoku/renderer/static'
import { renderHtml, setIIFE } from '@shumoku/renderer-html'
import { INTERACTIVE_IIFE } from '@shumoku/renderer-html/iife-string'
import { renderNetworkPng } from '@shumoku/renderer-png'
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

async function main(): Promise<void> {
  const { values, inputFile } = cli()

  if (!inputFile) {
    console.error('Error: Input file required.')
    console.error('Usage: shumoku render <input.yaml>')
    console.error('Use --help for more information.')
    process.exit(1)
  }

  try {
    // Read input
    let content: string
    if (inputFile === '-') {
      // Read from stdin
      console.log('Reading from stdin...')
      const chunks: Buffer[] = []
      for await (const chunk of process.stdin) {
        chunks.push(chunk)
      }
      content = Buffer.concat(chunks).toString('utf-8')
    } else {
      console.log(`Reading ${inputFile}...`)
      content = readFileSync(resolve(process.cwd(), inputFile), 'utf-8')
    }

    // Parse input
    const model = readNetworkModel(content)
    const graph = toNetworkGraph(model)
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

    // Ensure output directory exists
    mkdirSync(dirname(outputPath), { recursive: true })

    if (format === 'html') {
      console.log('Rendering HTML...')
      setIIFE(INTERACTIVE_IIFE)
      writeFileSync(outputPath, renderHtml(model, { theme: themeName }), 'utf-8')
    } else if (format === 'png') {
      console.log('Rendering PNG...')
      const scale = Number.parseFloat(values.scale) || 2
      writeFileSync(outputPath, await renderNetworkPng(model, { scale, theme }))
    } else {
      console.log('Rendering SVG...')
      writeFileSync(outputPath, renderNetworkSvg(model, { theme }), 'utf-8')
    }

    console.log(`Output written to: ${outputPath}`)
    console.log('Done!')
  } catch (err) {
    console.error('Error:', err instanceof Error ? err.message : String(err))
    process.exit(1)
  }
}

main()

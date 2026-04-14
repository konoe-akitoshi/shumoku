#!/usr/bin/env bun
// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Build script: reads YAML data files and generates builtin-data.ts
 * Run: bun src/build-data.ts
 */

import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseCatalogYaml } from './loader.js'

const dataDir = join(import.meta.dirname, '../data')
const outFile = join(import.meta.dirname, 'builtin-data.ts')

function collectYamlFiles(dir: string): string[] {
  const files: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      files.push(...collectYamlFiles(full))
    } else if (entry.endsWith('.yaml') || entry.endsWith('.yml')) {
      files.push(full)
    }
  }
  return files
}

const files = collectYamlFiles(dataDir)
const entries = files.map((f) => parseCatalogYaml(readFileSync(f, 'utf-8')))

const code = `// Auto-generated from YAML data files — do not edit manually
// Run: bun src/build-data.ts

import type { CatalogEntry } from './types.js'

export const builtinData = ${JSON.stringify(entries, null, 2)} as unknown as CatalogEntry[]
`

writeFileSync(outFile, code, 'utf-8')
console.log(`Generated ${outFile} with ${entries.length} entries`)

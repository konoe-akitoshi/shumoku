// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * Built-in catalog entries loaded from YAML data files.
 * These serve as the initial dataset — community contributions welcome.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseCatalogYaml } from './loader.js'
import type { CatalogEntry } from './types.js'

const dataDir = join(fileURLToPath(import.meta.url), '../../data')

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

function loadBuiltinEntries(): CatalogEntry[] {
  const files = collectYamlFiles(dataDir)
  const entries: CatalogEntry[] = []
  for (const file of files) {
    const content = readFileSync(file, 'utf-8')
    entries.push(parseCatalogYaml(content))
  }
  return entries
}

export const builtinEntries: CatalogEntry[] = loadBuiltinEntries()

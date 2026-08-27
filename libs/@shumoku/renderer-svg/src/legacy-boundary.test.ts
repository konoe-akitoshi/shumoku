// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'
import { SVGRenderer as RootSVGRenderer, svg as rootSvg } from './index.js'
import { SVGRenderer as LegacySVGRenderer, svg as legacySvg } from './legacy.js'

const sourceRoot = import.meta.dirname
const allowedDirectImports = new Set(['legacy.ts'])

function sourceFiles(directory: string): string[] {
  const files: string[] = []
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry)
    if (statSync(path).isDirectory()) {
      files.push(...sourceFiles(path))
    } else if (path.endsWith('.ts')) {
      files.push(path)
    }
  }
  return files
}

describe('legacy renderer boundary', () => {
  it('preserves deprecated root exports through the explicit legacy entry', () => {
    expect(RootSVGRenderer).toBe(LegacySVGRenderer)
    expect(rootSvg).toBe(legacySvg)
  })

  it('keeps direct legacy implementation imports inside legacy.ts', () => {
    const violations: string[] = []
    for (const file of sourceFiles(sourceRoot)) {
      const name = relative(sourceRoot, file)
      if (allowedDirectImports.has(name) || name.endsWith('.test.ts')) continue
      const source = readFileSync(file, 'utf8')
      if (source.includes("from './svg.js'") || source.includes("from './svg'")) {
        violations.push(name)
      }
    }
    expect(violations).toEqual([])
  })
})

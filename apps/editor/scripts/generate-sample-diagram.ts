/**
 * One-off generator: parse the sample YAML fixtures, run layout, and emit
 * a positioned NetworkGraph as a TS const. Output is checked in so runtime
 * sample load no longer needs to go through the YAML parser.
 *
 * Run: `bun apps/editor/scripts/generate-sample-diagram.ts`
 */

import { spawnSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  computeNetworkLayout,
  createMemoryFileResolver,
  HierarchicalParser,
  sampleNetwork,
} from '@shumoku/core'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const OUT_PATH = resolve(SCRIPT_DIR, '../src/lib/sample-diagram.ts')

async function main() {
  const fileMap = new Map<string, string>()
  for (const f of sampleNetwork) {
    fileMap.set(f.name, f.content)
    fileMap.set(`./${f.name}`, f.content)
    fileMap.set(`/${f.name}`, f.content)
  }
  const resolver = createMemoryFileResolver(fileMap, '/')
  const hp = new HierarchicalParser(resolver)
  const mainFile = sampleNetwork.find((f) => f.name === 'main.yaml')
  if (!mainFile) throw new Error('main.yaml not found')
  const { graph } = await hp.parse(mainFile.content, '/main.yaml')
  const { resolved } = await computeNetworkLayout(graph)

  // Copy computed positions back onto Node/Subgraph records.
  const positionedNodes = [...resolved.nodes.values()]
  const positionedSubgraphs = [...resolved.subgraphs.values()]

  const diagram = {
    version: graph.version,
    name: graph.name,
    description: graph.description,
    settings: graph.settings,
    nodes: positionedNodes,
    links: graph.links,
    subgraphs: positionedSubgraphs,
  }

  const out = `// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Positioned NetworkGraph for the sample project.
 * Generated from sampleNetwork YAML by scripts/generate-sample-diagram.ts —
 * run that script to regenerate after editing the YAML fixtures.
 *
 * Cast via \`as unknown as NetworkGraph\`: DeviceType is a string enum and
 * the serialized JSON has raw string literals where the type wants enum
 * references. The runtime values match — the cast only papers over the
 * nominal type check.
 */

import type { NetworkGraph } from '@shumoku/core'

export const sampleDiagram = ${JSON.stringify(diagram, null, 2)} as unknown as NetworkGraph
`

  writeFileSync(OUT_PATH, out)

  // Let biome format the generated file so it matches repo style (single
  // quotes, no-quote keys, trailing commas). Otherwise `bun run lint` trips
  // on the JSON-shaped output.
  const fmt = spawnSync('bun', ['x', 'biome', 'check', '--write', OUT_PATH], {
    stdio: 'inherit',
    shell: true,
  })
  if (fmt.status !== 0) {
    throw new Error(`biome check --write failed on ${OUT_PATH}`)
  }

  console.log(`wrote ${OUT_PATH}`)
  console.log(`  nodes: ${positionedNodes.length}`)
  console.log(`  subgraphs: ${positionedSubgraphs.length}`)
  console.log(`  links: ${graph.links.length}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

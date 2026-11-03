// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { createHash } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { sampleNetworkYaml } from '../fixtures/index.js'
import { layoutDrawing } from './layout.js'
import { randomYaml } from './testing/random.js'
import { generatedYaml, networkOf, testMetrics } from './testing/support.js'

/**
 * The whole drawing of a fixed set of networks, pinned. A change that moves any box or line fails
 * here, which is the point of a pass that must not change the output; when the change is meant,
 * the snapshot is accepted with `vitest -u`. Next to the hash of the full scene are a few plain
 * numbers, so that a failure says roughly what moved.
 */

const fileDir = (relative: string) => fileURLToPath(new URL(relative, import.meta.url))
const yamlsIn = (dir: string): [string, string][] =>
  readdirSync(dir)
    .filter((f) => f.endsWith('.yaml'))
    .sort()
    .map((f) => [f, readFileSync(`${dir}/${f}`, 'utf8')])

const cases: [string, string, string[]][] = [
  ['sample', sampleNetworkYaml, []],
  ...yamlsIn(fileDir('../../../../../examples')).map(([f, yaml]): [string, string, string[]] => [
    `examples/${f}`,
    yaml,
    [],
  ]),
  ...yamlsIn(fileDir('../input/fixtures/pass')).map(([f, yaml]): [string, string, string[]] => [
    `fixtures/${f}`,
    yaml,
    [],
  ]),
  ...[1, 2, 3, 4, 5, 6].map((seed): [string, string, string[]] => [
    `random:${seed}`,
    randomYaml(seed),
    ['top'],
  ]),
  // 120 nodes takes about 10 s on CI, past the test timeout; 60 already runs the same generator
  ...[30, 60].map((n): [string, string, string[]] => [`generated:${n}`, generatedYaml(n), ['top']]),
]

function summary(yaml: string, boundary: string[]) {
  const { network, structure } = networkOf(yaml, boundary)
  const scene = layoutDrawing(network, structure, testMetrics)
  return {
    nodes: scene.nodes.length,
    groups: scene.groups.length,
    wires: scene.wires.length,
    bounds: scene.bounds,
    hash: createHash('sha1').update(JSON.stringify(scene)).digest('hex').slice(0, 16),
  }
}

describe('the drawing of fixed networks', () => {
  it.each(cases)('%s', (_name, yaml, boundary) => {
    expect(summary(yaml, boundary)).toMatchSnapshot()
  })
})

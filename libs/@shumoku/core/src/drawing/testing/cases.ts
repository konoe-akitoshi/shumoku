// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { sampleNetworkYaml } from '../../fixtures/index.js'
import { randomYaml } from './random.js'
import { generatedYaml } from './support.js'

/**
 * The fixed set of networks the drawing is pinned on (the golden snapshots) and checked on in
 * other modes: name, YAML, and the boundary to name for a generated one (none: the drawing finds
 * it).
 */
const fileDir = (relative: string) => fileURLToPath(new URL(relative, import.meta.url))
const yamlsIn = (dir: string): [string, string][] =>
  readdirSync(dir)
    .filter((f) => f.endsWith('.yaml'))
    .sort()
    .map((f) => [f, readFileSync(`${dir}/${f}`, 'utf8')])

export const goldenCases: [string, string, string[]][] = [
  ['sample', sampleNetworkYaml, []],
  ...yamlsIn(fileDir('../../../../../../examples')).map(([f, yaml]): [string, string, string[]] => [
    `examples/${f}`,
    yaml,
    [],
  ]),
  ...yamlsIn(fileDir('../../input/fixtures/pass')).map(([f, yaml]): [string, string, string[]] => [
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

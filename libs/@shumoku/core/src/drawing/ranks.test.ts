// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { describe, expect, it } from 'vitest'
import { sampleNetworkYaml } from '../fixtures/index.js'
import { ranksOf } from './ranks.js'
import { randomYaml } from './testing/random.js'
import { generatedYaml, problemOf } from './testing/support.js'

const networks: [string, string, string[]][] = [
  ['sample', sampleNetworkYaml, []],
  ['gen:60', generatedYaml(60), ['top']],
  ...[1, 2, 3, 4, 5, 6].map((seed): [string, string, string[]] => [
    `random:${seed}`,
    randomYaml(seed),
    ['top'],
  ]),
]

// The heights give a flow its room only between rank bands, so this is what keeps every upper
// item above its lower one.
describe('the ranks of the flows', () => {
  it.each(networks)('%s: every flow goes down at least one rank', (_n, yaml, bd) => {
    const problem = problemOf(yaml, bd)
    const ranks = ranksOf(problem)
    for (const { upper, lower } of problem.above) {
      expect(ranks.rank.get(upper) ?? 0).toBeLessThan(ranks.rank.get(lower) ?? 0)
    }
  })
})

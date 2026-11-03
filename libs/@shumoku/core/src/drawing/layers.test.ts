// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { describe, expect, it } from 'vitest'
import { sampleNetworkYaml } from '../fixtures/index.js'
import { layersOf } from './layers.js'
import { ranksOf } from './ranks.js'
import { generatedYaml, problemOf } from './testing.js'

/**
 * Sifting counts again only the gaps beside the rows a move changed. `verify` counts every gap
 * of the whole order after each trial and throws where the two differ, so these runs hold the
 * quick count to the slow one.
 */
const fixtures: [string, string, string[]][] = [
  ['sample', sampleNetworkYaml, []],
  ['gen:12', generatedYaml(12), ['top']],
  ['gen:30', generatedYaml(30), ['top']],
  ['gen:60', generatedYaml(60), ['top']],
]

describe('sifting counts the same as the whole order', () => {
  for (const [name, yaml, boundary] of fixtures) {
    it(name, () => {
      const problem = problemOf(yaml, boundary)
      const ranks = ranksOf(problem)
      const quick = layersOf(problem, ranks, {}, { verify: true })
      expect(quick.crossings).toBeGreaterThanOrEqual(0)
    })
  }
})

// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { describe, expect, it } from 'vitest'
import { sampleNetworkYaml } from '../../fixtures/index.js'
import { axesOf } from '../geometry.js'
import { ledgerOf } from '../ledger.js'
import { randomYaml } from '../testing/random.js'
import { planningOf } from '../testing/stages.js'
import { generatedYaml } from '../testing/support.js'
import { alignDown } from './align.js'
import { frameSpans, shortOf, solveCompact } from './system.js'
import { layWidths, stepsOf } from './widths.js'

const networks: [string, string, string[]][] = [
  ['sample', sampleNetworkYaml, []],
  ['gen:30', generatedYaml(30), ['top']],
  ...[1, 2, 3].map((seed): [string, string, string[]] => [
    `random:${seed}`,
    randomYaml(seed),
    ['top'],
  ]),
]

describe('aligning lines down the ranks', () => {
  it.each(networks)(
    '%s: breaks no separation and holds every equality it chose',
    (_n, yaml, bd) => {
      const pl = planningOf(yaml, bd)
      const { X } = axesOf(pl)
      layWidths(pl, X)
      const held = ledgerOf(X.sys.n, X.sys.sep, X.sys.equal)
      const straight = alignDown(pl, X, stepsOf(pl), held)
      const xv = solveCompact(pl, X.sys, frameSpans(pl, X), [], { equal: straight })
      expect(shortOf(pl, X.sys, xv)).toBe(0)
      for (const eq of straight)
        expect(Math.abs((xv[eq.j] ?? 0) - (xv[eq.i] ?? 0) - eq.d)).toBeLessThan(pl.tolerance)
    },
  )

  it('chooses at least one equality where a chain of single links runs down', () => {
    const pl = planningOf(generatedYaml(30), ['top'])
    const { X } = axesOf(pl)
    layWidths(pl, X)
    const held = ledgerOf(X.sys.n, X.sys.sep, X.sys.equal)
    expect(alignDown(pl, X, stepsOf(pl), held).length).toBeGreaterThan(0)
  })
})

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
import { frameSpans, shortOf, solveCompact, systemOf } from './system.js'
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
      const plan = planningOf(yaml, bd)
      const { xAxis } = axesOf(plan)
      const sys = systemOf(xAxis, layWidths(plan, xAxis))
      const held = ledgerOf(sys.n, sys.sep, sys.equal)
      const straight = alignDown(plan, xAxis, stepsOf(plan), held)
      const xValues = solveCompact(plan, sys, frameSpans(plan, xAxis), [], {
        equal: straight,
      })
      expect(shortOf(plan, sys, xValues)).toBe(0)
      for (const eq of straight)
        expect(Math.abs((xValues[eq.j] ?? 0) - (xValues[eq.i] ?? 0) - eq.d)).toBeLessThan(
          plan.tolerance,
        )
    },
  )

  it('chooses at least one equality where a chain of single links runs down', () => {
    const plan = planningOf(generatedYaml(30), ['top'])
    const { xAxis } = axesOf(plan)
    const sys = systemOf(xAxis, layWidths(plan, xAxis))
    const held = ledgerOf(sys.n, sys.sep, sys.equal)
    expect(alignDown(plan, xAxis, stepsOf(plan), held).length).toBeGreaterThan(0)
  })
})

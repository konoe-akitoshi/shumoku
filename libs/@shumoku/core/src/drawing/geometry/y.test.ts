// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { describe, expect, it } from 'vitest'
import { sampleNetworkYaml } from '../../fixtures/index.js'
import { solveAxes } from '../geometry.js'
import { randomYaml } from '../testing/random.js'
import { planningOf } from '../testing/stages.js'
import { generatedYaml } from '../testing/support.js'

const networks: [string, string, string[]][] = [
  ['sample', sampleNetworkYaml, []],
  ['gen:30', generatedYaml(30), ['top']],
  ['gen:60', generatedYaml(60), ['top']],
  ...[1, 2, 3].map((seed): [string, string, string[]] => [
    `random:${seed}`,
    randomYaml(seed),
    ['top'],
  ]),
]

describe('the heights of the rank bands', () => {
  it.each(networks)('%s: a band ends before the band of the next rank begins', (_n, yaml, bd) => {
    const plan = planningOf(yaml, bd)
    const { yValues, bands } = solveAxes(plan)
    const at = (r: { v: number; off: number }) => (yValues[r.v] ?? 0) + r.off
    for (const [r, bottom] of bands.bottom.entries()) {
      const next = bands.top[r + 1]
      if (next) expect(at(bottom)).toBeLessThanOrEqual(at(next) + plan.tolerance)
    }
  })

  it.each(networks)('%s: every box lies inside the band of its rank', (_n, yaml, bd) => {
    const plan = planningOf(yaml, bd)
    const { yAxis, yValues, bands } = solveAxes(plan)
    for (const item of plan.problem.items) {
      const r = plan.ranks.rank.get(item.id) ?? 0
      const [top, bottom] = [bands.top[r], bands.bottom[r]]
      const [lo, hi] = [yAxis.lowRef(item.id), yAxis.highRef(item.id)]
      expect((yValues[lo.v] ?? 0) + lo.off).toBeGreaterThanOrEqual(
        (yValues[top?.v ?? 0] ?? 0) - plan.tolerance,
      )
      expect((yValues[hi.v] ?? 0) + hi.off).toBeLessThanOrEqual(
        (yValues[bottom?.v ?? 0] ?? 0) + plan.tolerance,
      )
    }
  })
})

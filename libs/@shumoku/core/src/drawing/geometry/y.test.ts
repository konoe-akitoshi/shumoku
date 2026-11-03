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
    const pl = planningOf(yaml, bd)
    const { yv, bands } = solveAxes(pl)
    const at = (r: { v: number; off: number }) => (yv[r.v] ?? 0) + r.off
    for (const [r, bottom] of bands.bottom.entries()) {
      const next = bands.top[r + 1]
      if (next) expect(at(bottom)).toBeLessThanOrEqual(at(next) + pl.tolerance)
    }
  })

  it.each(networks)('%s: every box lies inside the band of its rank', (_n, yaml, bd) => {
    const pl = planningOf(yaml, bd)
    const { Y, yv, bands } = solveAxes(pl)
    for (const item of pl.problem.items) {
      const r = pl.ranks.rank.get(item.id) ?? 0
      const [top, bottom] = [bands.top[r], bands.bottom[r]]
      const [lo, hi] = [Y.lowRef(item.id), Y.highRef(item.id)]
      expect((yv[lo.v] ?? 0) + lo.off).toBeGreaterThanOrEqual((yv[top?.v ?? 0] ?? 0) - pl.tolerance)
      expect((yv[hi.v] ?? 0) + hi.off).toBeLessThanOrEqual((yv[bottom?.v ?? 0] ?? 0) + pl.tolerance)
    }
  })
})

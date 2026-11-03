// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { describe, expect, it } from 'vitest'
import { sampleNetworkYaml } from '../../fixtures/index.js'
import { solveAxes } from '../geometry.js'
import { flowRoom } from '../kin.js'
import { randomYaml } from '../testing/random.js'
import { planningOf } from '../testing/stages.js'
import { generatedYaml } from '../testing/support.js'
import { after, type Sep } from './system.js'

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

describe('the rank band constraints, read as data', () => {
  it.each(networks)(
    '%s: every gap between bands and every box in its band is asked for',
    (_n, yaml, bd) => {
      const plan = planningOf(yaml, bd)
      const { yAxis, ySys, bands } = solveAxes(plan)
      const room = flowRoom(plan.metrics)
      const asked = (s: Sep) => ySys.sep.some((c) => c.i === s.i && c.j === s.j && c.d === s.d)
      for (let r = 0; r < plan.ranks.max; r++) {
        const [bottom, top] = [bands.bottom[r], bands.top[r + 1]]
        if (bottom && top) expect(asked(after(bottom, top, room))).toBe(true)
      }
      for (const item of plan.problem.items) {
        const r = plan.ranks.rank.get(item.id) ?? 0
        const [top, bottom] = [bands.top[r], bands.bottom[r]]
        if (!top || !bottom) continue
        expect(asked(after(top, yAxis.lowRef(item.id), 0))).toBe(true)
        expect(asked(after(yAxis.highRef(item.id), bottom, 0))).toBe(true)
      }
    },
  )

  it('numbers the band edges after every other unknown, so no stage allocates', () => {
    const plan = planningOf(generatedYaml(30), ['top'])
    const { yAxis, ySys } = solveAxes(plan)
    expect(ySys.n).toBe(yAxis.n)
    const first = yAxis.bands.top[0]
    expect(first?.v).toBe(ySys.n - 2 * (plan.ranks.max + 1))
  })
})

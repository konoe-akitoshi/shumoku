// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { describe, expect, it } from 'vitest'
import { randomYaml } from '../testing/random.js'
import { layerStagesOf } from '../testing/stages.js'
import { generatedYaml } from '../testing/support.js'
import { total } from './cost.js'
import { flatten } from './flatten.js'
import { median } from './median.js'
import { sweepFrom } from './sweep.js'

describe('the median', () => {
  it('is the middle of an odd count and the mean of the two middles of an even one', () => {
    expect(median([5, 1, 3])).toBe(3)
    expect(median([4, 1, 2, 3])).toBe(2.5)
  })

  it('does not reorder what it is given', () => {
    const xs = [3, 1, 2]
    median(xs)
    expect(xs).toEqual([3, 1, 2])
  })
})

const networks: [string, string, string[]][] = [
  ['gen:30', generatedYaml(30), ['top']],
  ...[1, 2, 3, 4, 5].map((seed): [string, string, string[]] => [
    `random:${seed}`,
    randomYaml(seed),
    ['top'],
  ]),
]

describe('the median sweeps', () => {
  it.each(networks)('%s: return an order no worse than the one they began with', (_n, yaml, bd) => {
    const { lookup, initial, judge } = layerStagesOf(yaml, bd)
    const swept = sweepFrom(lookup, judge, initial)
    const before = total(judge.costs(flatten(lookup, initial)))
    const after = total(judge.costs(flatten(lookup, swept)))
    expect(judge.better(before, initial, after, swept)).toBe(false)
  })

  it('keep the same children in every frame, in some order', () => {
    const { lookup, initial, judge } = layerStagesOf(generatedYaml(30), ['top'])
    const swept = sweepFrom(lookup, judge, initial)
    const keys = (row: { movable: readonly { anchor: string }[]; tail: readonly string[] }) =>
      [...row.movable.map((c) => c.anchor), ...row.tail].sort()
    for (const [frame, row] of initial.rows) {
      const after = swept.rows.get(frame)
      expect(after && keys(after)).toEqual(keys(row))
    }
  })
})

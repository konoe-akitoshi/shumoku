// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { describe, expect, it } from 'vitest'
import { randomYaml } from '../testing/random.js'
import { layerStagesOf } from '../testing/stages.js'
import { generatedYaml } from '../testing/support.js'
import { total } from './cost.js'
import { flatten } from './flatten.js'
import { siftFrom } from './sift.js'
import { sweepFrom } from './sweep.js'

const networks: [string, string, string[]][] = [
  ['gen:30', generatedYaml(30), ['top']],
  ...[1, 2, 3, 4, 5, 6].map((seed): [string, string, string[]] => [
    `random:${seed}`,
    randomYaml(seed),
    ['top'],
  ]),
]

describe('sifting', () => {
  it.each(networks)('%s: never leaves the judged cost worse than before', (_n, yaml, bd) => {
    const { lookup, initial, judge } = layerStagesOf(yaml, bd)
    const swept = sweepFrom(lookup, judge, initial)
    const sifted = siftFrom(lookup, judge, swept)
    const before = total(judge.costs(flatten(lookup, swept)))
    const after = total(judge.costs(flatten(lookup, sifted)))
    expect(judge.better(before, swept, after, sifted)).toBe(false)
  })

  it.each(networks)('%s: counts the changed gaps the same as the whole order', (_n, yaml, bd) => {
    const { lookup, initial, judge } = layerStagesOf(yaml, bd)
    // `verify` throws where the quick count and the whole count differ
    expect(() => siftFrom(lookup, judge, initial, { verify: true })).not.toThrow()
  })

  it('does not move a child the hints name', () => {
    const hint = ['d3', 'd1', 'd2']
    const { lookup, initial, judge } = layerStagesOf(generatedYaml(60), ['top'], {
      order: new Map([['', hint]]),
    })
    const order = (s: typeof initial) =>
      (s.rows.get('')?.movable ?? []).map((c) => c.anchor).filter((k) => hint.includes(k))
    expect(order(siftFrom(lookup, judge, initial))).toEqual(order(initial))
  })
})

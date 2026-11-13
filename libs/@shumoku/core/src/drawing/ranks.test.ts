// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { describe, expect, it } from 'vitest'
import { sampleNetworkYaml } from '../fixtures/index.js'
import { frameKey } from './keys.js'
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

describe('sibling places stacked one under the other', () => {
  // two sites, each entered from its own carrier, and a branch entered only from the first
  const yaml = (crossLine: boolean) => `
name: t
groups:
  - id: a
    groups: [{ id: a1 }]
  - id: b
    groups: [{ id: b1 }]
  - id: c
    groups: [{ id: c1 }]
nodes:
  - { id: isp, type: external }
  - { id: fiber, type: external }
  - { id: a-edge, type: router, group: a }
  - { id: a-core, type: l3-switch, group: a }
  - { id: a-sw, group: a1 }
  - { id: b-edge, type: router, group: b }
  - { id: b-core, type: l3-switch, group: b }
  - { id: b-sw, group: b1 }
  - { id: c-edge, type: router, group: c }
  - { id: c-sw, group: c1 }
links:
  - { endpoints: [{ node: isp }, { node: a-edge }] }
  - { endpoints: [{ node: a-edge }, { node: a-core }] }
  - { endpoints: [{ node: a-core }, { node: a-sw }] }
  - { endpoints: [{ node: fiber }, { node: b-edge }] }
  - { endpoints: [{ node: b-edge }, { node: b-core }] }
  - { endpoints: [{ node: b-core }, { node: b-sw }] }
  - { endpoints: [{ node: a-core }, { node: c-edge }] }
  - { endpoints: [{ node: c-edge }, { node: c-sw }] }
${crossLine ? '  - { endpoints: [{ node: b-sw }, { node: a-core }] }' : ''}
`
  const frame = (id: string) => frameKey(id)

  it('hangs a branch whose only way in is the hub under it', () => {
    const ranks = ranksOf(problemOf(yaml(false), ['isp', 'fiber']))
    expect(ranks.ordered(frame('a'), frame('c'))).toBe(true)
    expect(ranks.ordered(frame('a'), frame('b'))).toBe(false)
  })

  it('does not put a place entered at its own height under another for one line between them', () => {
    const flat = ranksOf(problemOf(yaml(false), ['isp', 'fiber']))
    const crossed = ranksOf(problemOf(yaml(true), ['isp', 'fiber']))
    expect(crossed.ordered(frame('b'), frame('a'))).toBe(false)
    // the way into the first site stays where its carrier puts it
    expect(crossed.rank.get('a-edge')).toBe(flat.rank.get('a-edge'))
  })
})

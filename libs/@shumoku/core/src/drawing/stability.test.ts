// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { isDeepStrictEqual } from 'node:util'
import { describe, expect, it } from 'vitest'
import { layoutParts } from './layout.js'
import {
  decisionsOf,
  generatedYaml,
  type Jitter,
  jittered,
  networkOf,
  testMetrics,
} from './testing.js'

/**
 * What is decided from relations must not move when a length moves a little: the order of
 * siblings, the cells each line runs through, the order of lines at a door, the crossings.
 * Each stage of the layout is held to this as it is made to decide from indices alone; the
 * checks of a stage not yet made so are written as `it.fails` with the stage that will make
 * them pass, so that finishing the stage turns the mark into a failure to be removed.
 */

const small = `
groups:
  - id: site
    groups: [{ id: floor1 }, { id: floor2 }]
routingDomains: [{ id: wan }]
redundancy:
  - { id: core, nodes: [c1, c2], kind: mlag }
nodes:
  - { id: edge, type: router, group: site }
  - { id: c1, type: l3-switch, group: site }
  - { id: c2, type: l3-switch, group: site }
  - { id: sw1, group: floor1 }
  - { id: sw2, group: floor2 }
  - { id: ap1, group: floor1 }
  - { id: ap2, group: floor1 }
  - { id: ap3, group: floor2 }
  - { id: srv, type: server, group: site }
  - { id: vm1, type: vm, host: srv, group: site }
links:
  - { endpoints: [{ node: edge }, { routingDomain: wan }] }
  - { endpoints: [{ node: edge }, { node: c1 }] }
  - { endpoints: [{ node: edge }, { node: c2 }] }
  - { endpoints: [{ node: c1 }, { node: c2 }] }
  - { endpoints: [{ node: c1 }, { node: sw1 }] }
  - { endpoints: [{ node: c2 }, { node: sw2 }] }
  - { endpoints: [{ node: c1 }, { node: srv }] }
  - { endpoints: [{ node: sw1 }, { node: ap1 }] }
  - { endpoints: [{ node: sw1 }, { node: ap2 }] }
  - { endpoints: [{ node: sw2 }, { node: ap3 }] }
`

const jitters: [string, Jitter][] = [
  ['inset +0.25', { inset: 0.25 }],
  ['inset +0.5', { inset: 0.5 }],
  ['inset +1', { inset: 1 }],
  ['card 1 px', { card: 1 }],
  ['card 1 px flipped', { card: 1, flip: true }],
  ['text 5 %', { text: 0.05 }],
  ['text 5 % flipped', { text: 0.05, flip: true }],
]

type Check = 'order' | 'routes' | 'ordering' | 'crossings'

/**
 * The checks not yet met, and the stage of the restructure that makes each pass. The small
 * fixture already keeps its order and its crossings, which stay as a guard.
 */
const pending: Record<string, Partial<Record<Check, string>>> = {
  small: { routes: 'S3', ordering: 'S4' },
  'gen:30': { order: 'S1', routes: 'S3', ordering: 'S4', crossings: 'S4' },
}

function decide(yaml: string, boundary: string[], jitter?: Jitter) {
  const { network, structure } = networkOf(yaml, boundary)
  const metrics = jitter ? jittered(testMetrics, jitter) : testMetrics
  return decisionsOf(layoutParts(network, structure, metrics), network, structure, metrics)
}

const fixtures: [string, string, string[]][] = [
  ['small', small, ['wan']],
  ['gen:30', generatedYaml(30), ['top']],
]

for (const [name, yaml, boundary] of fixtures) {
  describe(`stability of ${name}`, () => {
    const base = decide(yaml, boundary)
    const cache = new Map<string, ReturnType<typeof decide>>()
    const moved = (label: string, jitter: Jitter) => {
      const known = cache.get(label) ?? decide(yaml, boundary, jitter)
      cache.set(label, known)
      return known
    }
    for (const check of ['order', 'routes', 'ordering', 'crossings'] as const) {
      const stage = pending[name]?.[check]
      // A check is met only when every jitter leaves it as it was; that one of them happens to
      // is no reason to take the mark off.
      const run = () => {
        const differs = jitters
          .filter(([label, jitter]) => !isDeepStrictEqual(moved(label, jitter)[check], base[check]))
          .map(([label]) => label)
        expect(differs).toEqual([])
      }
      if (stage) it.fails(`${check} is invariant under jitter (until ${stage})`, run, 300_000)
      else it(`${check} is invariant under jitter`, run, 300_000)
    }
  })
}

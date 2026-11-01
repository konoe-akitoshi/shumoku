// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { describe, expect, it } from 'vitest'
import { demandsOf } from './demands.js'
import { haloOf, keepOff, pitchOf } from './kin.js'
import type { Metrics, Point } from './metrics.js'
import { type Geometry, readProblem } from './problem.js'
import { networkOf, testMetrics } from './testing.js'

const yaml = `
nodes:
  - { id: a }
  - { id: b }
  - { id: c }
links:
  - { endpoints: [{ node: a }, { node: b }] }
  - { endpoints: [{ node: a }, { node: b }] }
  - { endpoints: [{ node: a }, { node: c }] }
`

const geometry: Geometry = {
  boxes: new Map([
    ['a', { x: 0, y: 0, width: 100, height: 40 }],
    ['b', { x: 0, y: 100, width: 100, height: 40 }],
    ['c', { x: 200, y: 100, width: 100, height: 40 }],
  ]),
}

/** Three lines side by side in the corridor between a and the cards below it. */
function demandFor(width: number) {
  const { network, structure } = networkOf(yaml, [])
  const metrics: Metrics = { ...testMetrics, line: () => ({ stroke: width, width }) }
  const problem = readProblem(network, structure, metrics)
  const wires = new Map<string, Point[]>(
    problem.lines.map((line, i) => {
      const x = 10 + 20 * i
      const y = 55 + 12 * i
      return [
        line.id,
        [
          { x, y: 40 },
          { x, y },
          { x: x + 300, y },
          { x: x + 300, y: 100 },
        ],
      ]
    }),
  )
  const demands = demandsOf(problem, geometry, wires)
  return { problem, demands, metrics }
}

describe('demandsOf', () => {
  it('asks for the room the runs in a corridor need at once, from the pitches and the margins', () => {
    const { problem, demands, metrics } = demandFor(20)
    const lines = problem.lines
    const [p, q, r] = lines
    if (!p || !q || !r) throw new Error('three lines expected')
    const asked = demands.find((d) => d.axis === 'y' && d.before === 'a')
    // the three runs are stacked in order of their y; the outer ones keep half their width off the
    // boxes they are between, on top of the white or lead-out
    const need =
      pitchOf(metrics, p, q) +
      pitchOf(metrics, q, r) +
      keepOff(metrics, false) +
      keepOff(metrics, false) +
      haloOf(p) +
      haloOf(r)
    expect(asked?.min).toBeGreaterThanOrEqual(need - 1e-6)
  })

  it('asks for more as the lines are wider', () => {
    const thin = demandFor(20).demands.find((d) => d.axis === 'y')
    const wide = demandFor(30).demands.find((d) => d.axis === 'y')
    expect(wide?.min ?? 0).toBeGreaterThan(thin?.min ?? 0)
  })
})

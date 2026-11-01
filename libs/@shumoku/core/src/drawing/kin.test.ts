// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { describe, expect, it } from 'vitest'
import { joinKey } from '../structure/keys.js'
import { narrowest } from './demands.js'
import { keepOff, keepsOf, pitchOf, slotOf, spacingOf, twin } from './kin.js'
import type { Metrics } from './metrics.js'
import { type Line, readProblem } from './problem.js'
import { networkOf, testMetrics } from './testing.js'

const line = (id: string, a: string, b: string, width = 0): Line => ({
  id,
  link: { from: { node: a, port: '' }, to: { node: b, port: '' } },
  a: { item: a },
  b: { item: b },
  width,
  family: joinKey([a, b].sort()),
  role: 'oriented',
})

/** A white of 1 for twins and 11 for the rest; a port slot of 20 over the labels. */
const metrics: Metrics = { ...testMetrics, gapTwin: 1, gapApart: 11 }

describe('twin', () => {
  it('is two lines between the same two items, whichever way round they run', () => {
    expect(twin(line('p', 'a', 'b'), line('q', 'a', 'b'))).toBe(true)
    expect(twin(line('p', 'a', 'b'), line('q', 'b', 'a'))).toBe(true)
  })

  it('is not two lines that part at either end', () => {
    expect(twin(line('p', 'a', 'b'), line('q', 'a', 'c'))).toBe(false)
    expect(twin(line('p', 'a', 'b'), line('q', 'c', 'b'))).toBe(false)
    expect(twin(line('p', 'a', 'a'), line('q', 'a', 'b'))).toBe(false)
  })
})

describe('pitchOf', () => {
  it('is the white of the pair and half of each width', () => {
    const p = line('p', 'a', 'b', 4)
    const q = line('q', 'a', 'b', 2)
    const r = line('r', 'a', 'c', 2)
    expect(pitchOf(metrics, p, q)).toBe(1 + 3)
    expect(pitchOf(metrics, p, r)).toBe(11 + 3)
  })

  it('is symmetric', () => {
    const p = line('p', 'a', 'b', 5)
    const q = line('q', 'a', 'c', 1)
    expect(pitchOf(metrics, p, q)).toBe(pitchOf(metrics, q, p))
  })

  it('is each pair its own: a wide line far away asks nothing of two narrow ones', () => {
    const lines = [line('p', 'a', 'b', 1), line('q', 'a', 'c', 1), line('w', 'x', 'y', 50)]
    const { pitch } = spacingOf({ metrics, lines, slots: new Map() })
    expect(pitch('p', 'q')).toBe(11 + 1)
    expect(pitch('p', 'w')).toBe(11 + 25.5)
    expect(pitch('p', 'missing')).toBe(11)
  })
})

describe('a line is read with its width and family', () => {
  it('takes the width from the metrics once, when the problem is read', () => {
    const { network, structure } = networkOf(
      'nodes:\n  - { id: a }\n  - { id: b }\nlinks:\n  - { endpoints: [{ node: a }, { node: b }] }\n',
      [],
    )
    const read = readProblem(network, structure, { ...testMetrics, width: () => 7 })
    expect(read.lines.map((l) => l.width)).toEqual([7])
  })
})

describe('a port slot', () => {
  it('is the labels alone where the lines are thin', () => {
    expect(slotOf(metrics, [], [line('p', 'a', 'b', 1)])).toBe(20)
  })

  it('is widened by a wide line at the port, with the white off its neighbour', () => {
    expect(slotOf(metrics, [], [line('p', 'a', 'b', 1), line('w', 'a', 'c', 40)])).toBe(11 + 40)
  })

  it('is widened by the wide line of its own box only', () => {
    const { network, structure } = networkOf(
      'nodes:\n  - { id: a }\n  - { id: b }\n  - { id: c }\n  - { id: d }\nlinks:\n  - { endpoints: [{ node: a }, { node: b }] }\n  - { endpoints: [{ node: c }, { node: d }] }\n',
      [],
    )
    const read = readProblem(network, structure, {
      ...testMetrics,
      width: (l) => (l.from.node === 'a' ? 60 : 1),
    })
    expect(read.slots.get('a')).toBe(testMetrics.gapApart + 60)
    expect(read.slots.get('c')).toBe(testMetrics.portSlot([]))
  })
})

describe('keepOff', () => {
  it('is a lead-out from a side with a port and a white from one without', () => {
    expect(keepOff(metrics, true)).toBe(metrics.leadOut)
    expect(keepOff(metrics, false)).toBe(metrics.gapApart)
  })
})

describe('a corridor of lines of different widths', () => {
  it('asks for the gaps between neighbours, the white from each box, and half of the outer widths', () => {
    const lines = new Map<string, Line>([
      ['p', line('p', 'a', 'b', 2)],
      ['q', line('q', 'a', 'b', 4)],
      ['r', line('r', 'c', 'd', 6)],
    ])
    const keeps = keepsOf(metrics, (id) => lines.get(String(id)))
    const runs = [
      { line: 'p', at: 40, from: 0, to: 100 },
      { line: 'q', at: 50, from: 0, to: 100 },
      { line: 'r', at: 60, from: 0, to: 100 },
    ]
    const boxes = [
      { x: 0, y: 0, width: 100, height: 10 },
      { x: 0, y: 100, width: 100, height: 10 },
    ]
    const c = narrowest(
      runs[0] ?? { line: '', at: 0, from: 0, to: 0 },
      runs,
      boxes,
      true,
      keeps,
      () => 11,
    )
    // p-q are twins (1 + 3), q-r are strangers (11 + 5), 11 from each box, half of 2 and of 6
    expect(c?.need).toBeCloseTo(4 + 16 + 11 + 1 + 11 + 3)
  })
})

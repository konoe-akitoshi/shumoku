// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { describe, expect, it } from 'vitest'
import { joinKey } from '../structure/keys.js'
import {
  above,
  below,
  clearance,
  flowRoom,
  inflate,
  keepOff,
  keepsOf,
  pitchOf,
  snapOf,
  twin,
  whiteOf,
} from './kin.js'
import { layoutDrawing } from './layout.js'
import type { Metrics } from './metrics.js'
import { gapsOf } from './ports.js'
import { type Line, readProblem } from './problem.js'
import { narrowest } from './testing/report.js'
import { networkOf, testMetrics } from './testing/support.js'

const line = (id: string, a: string, b: string, width = 0): Line => ({
  id,
  link: { from: { node: a, port: '' }, to: { node: b, port: '' } },
  a: { item: a },
  b: { item: b },
  stroke: width,
  family: joinKey([a, b].sort()),
  role: 'oriented',
  flow: 'level',
})

/** A white of 1 for twins and 11 for the rest; a port slot of 20 over the labels. */
const metrics: Metrics = { ...testMetrics, stroke: 1, gapApart: 11 }

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
  it('is the ground of each line, and a white between the grounds of lines that part', () => {
    const p = line('p', 'a', 'b', 4)
    const q = line('q', 'a', 'b', 2)
    const r = line('r', 'a', 'c', 2)
    expect(pitchOf(metrics, p, q)).toBe(4 + 2)
    expect(pitchOf(metrics, p, r)).toBe(11 + 4 + 2)
  })

  it('is symmetric', () => {
    const p = line('p', 'a', 'b', 5)
    const q = line('q', 'a', 'c', 1)
    expect(pitchOf(metrics, p, q)).toBe(pitchOf(metrics, q, p))
  })
})

describe('a line is read with its width and family', () => {
  it('takes the width from the metrics once, when the problem is read', () => {
    const { network, structure } = networkOf(
      'nodes:\n  - { id: a }\n  - { id: b }\nlinks:\n  - { endpoints: [{ node: a }, { node: b }] }\n',
      [],
    )
    const read = readProblem(network, structure, {
      ...testMetrics,
      line: () => 7,
    })
    expect(read.lines.map((l) => l.stroke)).toEqual([7])
  })
})

describe('the room of a port', () => {
  it('is the white and the ground of the two lines of each pair of neighbouring ports', () => {
    expect(gapsOf(undefined, { apart: 11, halos: [1, 40, 1] })).toEqual([
      { from: 0, to: 1, d: 11 + 1 + 40 },
      { from: 1, to: 2, d: 11 + 40 + 1 },
    ])
  })

  it('is widened by a wide line at its own port only, not by one elsewhere on the box', () => {
    // `a` has one wide line up to `b` and three thin ones down to `c`, `d` and `e`
    const { network, structure } = networkOf(
      `nodes:
  - { id: a }
  - { id: b }
  - { id: c }
  - { id: d }
  - { id: e }
links:
  - { endpoints: [{ node: b }, { node: a, port: up }] }
  - { endpoints: [{ node: a, port: d1 }, { node: c }] }
  - { endpoints: [{ node: a, port: d2 }, { node: d }] }
  - { endpoints: [{ node: a, port: d3 }, { node: e }] }
`,
      ['b'],
    )
    const scene = layoutDrawing(network, structure, {
      ...testMetrics,
      line: (l) => (l.from.node === 'b' ? 60 : 1),
    })
    // the wide line's one port asks its edge for twice a margin each side (white / 2 + 60); the
    // three thin ports below ask for less, so they do not set the width, as they did when every
    // port on the box was spaced by its widest line (then 2 * 62 + 2 * 62 + 2 * 124 = 496)
    const a = scene.nodes.find((n) => n.node.id === 'a')
    expect(a?.box.width).toBeCloseTo(4 * (testMetrics.gapApart / 2 + 60))
  })
})

describe('keepOff', () => {
  it('is a lead-out from a side with a port and a white from one without', () => {
    expect(keepOff(metrics, true)).toBe(metrics.leadOut)
    expect(keepOff(metrics, false)).toBe(metrics.gapApart)
  })
})

describe('a corridor of lines of different widths', () => {
  it('asks for the gaps between neighbours, the white from each box, and the ground of the outer ones', () => {
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
    // p-q are twins (2 + 4), q-r are strangers (11 + 4 + 6), 11 from each box, the ground of 2 and of 6
    expect(c?.need).toBeCloseTo(6 + 21 + 11 + 2 + 11 + 6)
  })
})

describe('the rest of what a line keeps', () => {
  const m: Metrics = { ...testMetrics, stroke: 1, gapApart: 11, leadOut: 30 }

  it('keeps a white off a card, a lead-out where ports leave it', () => {
    expect(whiteOf(m)).toBe(11)
    expect(keepOff(m, false)).toBe(11)
    expect(keepOff(m, true)).toBe(30)
    expect(clearance(m, true)).toBe(30 - 11)
    expect(clearance(m, false)).toBe(0)
    expect(inflate(m)).toBe(whiteOf(m))
  })

  it('has a flow between two items hold a lead-out off each and one white', () => {
    expect(flowRoom(m)).toBe(2 * 30 + 11)
  })

  it('snaps at a quarter of the white between twins (under the half that is the bound)', () => {
    expect(snapOf(m)).toBe(0.25)
  })

  it('puts the centre of a line its off and half its width from the edge, on either side', () => {
    expect(above(100, 11, 2)).toBe(113)
    expect(below(100, 11, 2)).toBe(87)
  })
})

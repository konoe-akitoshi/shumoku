// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { describe, expect, it } from 'vitest'
import type { Link } from '../models/types.js'
import { type Keeps, narrowest } from './demands.js'
import { familyOf, pitchMax, pitchOf, twin } from './kin.js'
import type { Metrics } from './metrics.js'
import type { Line } from './problem.js'
import { testMetrics } from './testing.js'

const wide = (speed: number): Link => ({
  from: { node: 'x', port: '' },
  to: { node: 'y', port: '' },
  rateBps: speed,
})
const line = (id: string, a: string, b: string, link: Link = wide(0)): Line => ({
  id,
  link,
  a: { item: a },
  b: { item: b },
  role: 'oriented',
})

/** A white of 1 for twins and 11 for the rest; a line is as wide as its rate says in Gbps. */
const metrics: Metrics = {
  ...testMetrics,
  gapTwin: 1,
  gapApart: 11,
  width: (l) => (l.rateBps ?? 0) / 1e9,
}

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

describe('familyOf', () => {
  it('is the same for twins and for no other lines', () => {
    const lines = [line('p', 'a', 'b'), line('q', 'b', 'a'), line('r', 'a', 'c')]
    const family = familyOf(lines)
    expect(family('p')).toBe(family('q'))
    expect(family('p')).not.toBe(family('r'))
  })
})

describe('pitchOf', () => {
  it('is the white of the pair and half of each width', () => {
    const p = line('p', 'a', 'b', wide(4e9))
    const q = line('q', 'a', 'b', wide(2e9))
    const r = line('r', 'a', 'c', wide(2e9))
    expect(pitchOf(metrics, p, q)).toBe(1 + 3)
    expect(pitchOf(metrics, p, r)).toBe(11 + 3)
  })

  it('is symmetric', () => {
    const p = line('p', 'a', 'b', wide(5e9))
    const q = line('q', 'a', 'c', wide(1e9))
    expect(pitchOf(metrics, p, q)).toBe(pitchOf(metrics, q, p))
  })

  it('has its most in the white of strangers and the widest line', () => {
    const lines = [line('p', 'a', 'b', wide(5e9)), line('q', 'a', 'c', wide(1e9))]
    expect(pitchMax(metrics, lines)).toBe(11 + 5)
    expect(pitchMax(metrics, [])).toBe(11)
  })
})

describe('a corridor of lines of different widths', () => {
  it('asks for the gaps between neighbours, the white from each box, and half of the outer widths', () => {
    const lines = new Map<string, Line>([
      ['p', line('p', 'a', 'b', wide(2e9))],
      ['q', line('q', 'a', 'b', wide(4e9))],
      ['r', line('r', 'c', 'd', wide(6e9))],
    ])
    const get = (id: string | number | undefined) => lines.get(String(id))
    const keeps: Keeps = {
      between: (a, b) => {
        const [p, q] = [get(a), get(b)]
        return p && q ? pitchOf(metrics, p, q) : 0
      },
      half: (a) => (get(a) ? metrics.width(get(a)?.link as Link) / 2 : 0),
    }
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

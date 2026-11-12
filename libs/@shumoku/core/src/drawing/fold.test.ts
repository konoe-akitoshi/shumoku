// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { describe, expect, it } from 'vitest'
import { FAN_FOLD, FAN_WIDTH, foldsOf } from './fold.js'
import { layoutParts } from './layout.js'
import { ranksOf } from './ranks.js'
import type { Scene } from './scene.js'
import { networkOf, problemOf, testMetrics } from './testing/support.js'

/** `leaves` terminals on one switch `sw`, under `core`; one `side` switch with a single leaf. */
const fanYaml = (leaves: number, extra = ''): string => {
  const ids = Array.from({ length: leaves }, (_, i) => `t${String(i).padStart(2, '0')}`)
  return [
    'nodes:',
    '  - { id: core }',
    '  - { id: sw }',
    ...ids.map((id) => `  - { id: ${id} }`),
    extra,
    'links:',
    '  - endpoints: [{ node: core }, { node: sw }]',
    ...ids.map((id) => `  - endpoints: [{ node: sw }, { node: ${id} }]`),
  ].join('\n')
}

const foldsFor = (yaml: string, order: ReadonlyMap<string, readonly string[]> = new Map()) => {
  const problem = problemOf(yaml, ['core'])
  return foldsOf(problem, ranksOf(problem), order).rank
}

describe('foldsOf', () => {
  it('does not fold a fan of FAN_FOLD boxes or fewer', () => {
    expect(foldsFor(fanYaml(FAN_FOLD)).size).toBe(0)
    expect(foldsFor(fanYaml(3)).size).toBe(0)
  })

  it('folds a wider fan into equal rows, one rank lower each, the first row staying', () => {
    const n = FAN_FOLD + 1
    const folds = foldsFor(fanYaml(n))
    const lower = [...folds.values()]
    // 7 boxes in 2 rows: 4 and 3
    expect(new Set(lower).size).toBe(1)
    expect(folds.size).toBe(Math.floor(n / 2))
    const problem = problemOf(fanYaml(n), ['core'])
    const base = ranksOf(problem).rank.get('t00') ?? 0
    expect(lower[0]).toBe(base + 1)
  })

  it('deals the boxes to the rows in id order, so the first ids stay in the first row', () => {
    const folds = foldsFor(fanYaml(FAN_WIDTH + 2))
    expect(folds.has('t00')).toBe(false)
    expect(folds.has(`t${String(FAN_WIDTH + 1).padStart(2, '0')}`)).toBe(true)
  })

  it('deals the boxes in the order the frame names them before the rest', () => {
    const n = FAN_WIDTH + 2
    const last = `t${String(n - 1).padStart(2, '0')}`
    const folds = foldsFor(fanYaml(n), new Map([['', [last]]]))
    expect(folds.has(last)).toBe(false)
    expect(folds.has('t00')).toBe(false)
  })

  it('leaves out a box that hands on to another, however wide the fan', () => {
    // every terminal below the switch has a child of its own: no leaves, no fan
    const ids = Array.from({ length: FAN_WIDTH + 3 }, (_, i) => `m${i}`)
    const yaml = [
      'nodes:',
      '  - { id: core }',
      '  - { id: sw }',
      ...ids.flatMap((id) => [`  - { id: ${id} }`, `  - { id: ${id}x }`]),
      'links:',
      '  - endpoints: [{ node: core }, { node: sw }]',
      ...ids.flatMap((id) => [
        `  - endpoints: [{ node: sw }, { node: ${id} }]`,
        `  - endpoints: [{ node: ${id} }, { node: ${id}x }]`,
      ]),
    ].join('\n')
    expect(foldsFor(yaml).size).toBe(0)
  })

  it('is the same every time', () => {
    const a = [...foldsFor(fanYaml(25))]
    expect(a).toEqual([...foldsFor(fanYaml(25))])
    // 25 boxes: 5 rows of 5, the first keeping its rank
    expect(new Set(a.map(([, r]) => r)).size).toBe(4)
  })
})

describe('the columns of a folded fan', () => {
  it('stands each box of a later row under the box of the first row in its column', () => {
    const problem = problemOf(fanYaml(FAN_FOLD + 2), ['core'])
    const { under, fans } = foldsOf(problem, ranksOf(problem))
    // 8 boxes: t00..t03 in the first row, t04..t07 under them in order
    expect([...under]).toEqual([
      ['t04', 't00'],
      ['t05', 't01'],
      ['t06', 't02'],
      ['t07', 't03'],
    ])
    expect(fans).toHaveLength(1)
    expect(fans[0]).toHaveLength(8)
  })
})

describe('a folded fan in the layout', () => {
  /** The x-range of the boxes with these ids. */
  const xRange = (scene: Scene, ids: string[]): [number, number] => {
    const boxes = scene.nodes.filter((x) => ids.includes(x.node.id)).map((x) => x.box)
    return [Math.min(...boxes.map((b) => b.x)), Math.max(...boxes.map((b) => b.x + b.width))]
  }

  it('is one block: a later row lies under the first, not beside it', () => {
    for (const n of [FAN_FOLD + 1, 14, 23]) {
      const { network, structure } = networkOf(fanYaml(n), ['core'])
      const parts = layoutParts(network, structure, testMetrics)
      const rows = new Map<number, string[]>()
      for (const [id, r] of parts.ranks.rank) {
        if (id.startsWith('t')) rows.set(r, [...(rows.get(r) ?? []), id])
      }
      expect(rows.size).toBe(Math.ceil(n / FAN_WIDTH))
      const [first, ...later] = [...rows].sort(([a], [b]) => a - b).map(([, ids]) => ids)
      const top = xRange(parts.scene, first ?? [])
      for (const ids of later) {
        const [lo, hi] = xRange(parts.scene, ids)
        // inside the span of the first row, give or take a box (a staircase would be a row wide
        // beyond it)
        expect(lo).toBeGreaterThanOrEqual(top[0] - 150)
        expect(hi).toBeLessThanOrEqual(top[1] + 150)
        expect(Math.min(hi, top[1]) - Math.max(lo, top[0])).toBeGreaterThan(0.8 * (hi - lo))
      }
      // and the block is narrower than the same fan in one row would be
      const wide = n * 130 - 30
      const [lo, hi] = xRange(parts.scene, [...rows.values()].flat())
      expect(hi - lo).toBeLessThan(wide * 0.6)
    }
  })

  it('stands in as many ranks as it has rows, and every box is drawn once', () => {
    const n = FAN_WIDTH * 2 + 1 // 11 boxes: 4, 4 and 3
    const { network, structure } = networkOf(fanYaml(n), ['core'])
    const parts = layoutParts(network, structure, testMetrics)
    const ranks = new Set(
      [...parts.ranks.rank].filter(([id]) => id.startsWith('t')).map(([, r]) => r),
    )
    expect(ranks.size).toBe(3)
    expect(parts.scene.nodes.filter((x) => x.node.id.startsWith('t'))).toHaveLength(n)
  })
})

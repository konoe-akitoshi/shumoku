// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { describe, expect, it } from 'vitest'
import { layerStagesOf } from '../testing/stages.js'
import { generatedYaml } from '../testing/support.js'
import { pinned } from './start.js'

const twoRoots = `
nodes:
  - { id: a }
  - { id: z }
  - { id: ca }
  - { id: cz }
links:
  - { endpoints: [{ node: a }, { node: ca }] }
  - { endpoints: [{ node: z }, { node: cz }] }
`

const rootAnchors = (s: ReturnType<typeof layerStagesOf>['initial']) =>
  (s.rows.get('')?.movable ?? []).map((c) => c.anchor)

describe('the order to start from', () => {
  it('follows the boundary in the order the reader named it', () => {
    expect(rootAnchors(layerStagesOf(twoRoots, ['z', 'a']).initial).slice(0, 2)).toEqual([
      'z',
      'cz',
    ])
    expect(rootAnchors(layerStagesOf(twoRoots, ['a', 'z']).initial).slice(0, 2)).toEqual([
      'a',
      'ca',
    ])
  })

  it('stands every item once', () => {
    const { lookup, initial } = layerStagesOf(generatedYaml(30), ['top'])
    const seen = [...initial.rows.values()].flatMap((row) => [
      ...row.movable.flatMap((c) => [c.anchor, ...c.satellites]),
      ...row.tail,
    ])
    expect(new Set(seen).size).toBe(seen.length)
    for (const item of lookup.problem.items) expect(seen).toContain(item.id)
  })

  it('lays a hinted order over the children it names and leaves the rest', () => {
    const hints = { order: new Map([['', ['ca', 'a']]]) }
    const free = rootAnchors(layerStagesOf(twoRoots, ['a', 'z']).initial)
    const pinned = rootAnchors(layerStagesOf(twoRoots, ['a', 'z'], hints).initial)
    expect(pinned.indexOf('ca')).toBeLessThan(pinned.indexOf('a'))
    expect(pinned.filter((k) => k !== 'ca' && k !== 'a')).toEqual(
      free.filter((k) => k !== 'ca' && k !== 'a'),
    )
  })
})

const cluster = (anchor: string) => ({ anchor, satellites: [] })
const anchorsOf = (list: readonly { anchor: string }[]) => list.map((c) => c.anchor)
const over = (hint: string[], movable: string[]) =>
  anchorsOf(pinned({ hints: { order: new Map([['f', hint]]) } }, 'f', movable.map(cluster)))

describe('pinned', () => {
  it('moves only the named child that is out of the hinted order, to just after its predecessor', () => {
    // a dragged between u and v: v stays where it is, x and y are not touched
    expect(over(['u', 'a', 'v'], ['u', 'v', 'x', 'y', 'a'])).toEqual(['u', 'a', 'v', 'x', 'y'])
  })

  it('puts a child named first just before the one the hint names after it', () => {
    expect(over(['a', 'u', 'v'], ['u', 'x', 'v', 'a'])).toEqual(['a', 'u', 'x', 'v'])
  })

  it('leaves an order that already holds alone, and ignores names it does not know', () => {
    expect(over(['u', 'gone', 'v'], ['u', 'x', 'v'])).toEqual(['u', 'x', 'v'])
    expect(over(['v', 'u'], ['u', 'x', 'v'])).toEqual(['v', 'u', 'x'])
  })

  it('keeps the frame untouched without a hint for it', () => {
    expect(over([], ['u', 'v'])).toEqual(['u', 'v'])
    expect(anchorsOf(pinned({ hints: {} }, 'f', ['u', 'v'].map(cluster)))).toEqual(['u', 'v'])
  })
})

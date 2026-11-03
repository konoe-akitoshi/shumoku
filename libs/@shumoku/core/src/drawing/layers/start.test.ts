// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { describe, expect, it } from 'vitest'
import { layerStagesOf } from '../testing/stages.js'
import { generatedYaml } from '../testing/support.js'

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
    const { ctx, initial } = layerStagesOf(generatedYaml(30), ['top'])
    const seen = [...initial.rows.values()].flatMap((row) => [
      ...row.movable.flatMap((c) => [c.anchor, ...c.satellites]),
      ...row.tail,
    ])
    expect(new Set(seen).size).toBe(seen.length)
    for (const item of ctx.problem.items) expect(seen).toContain(item.id)
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

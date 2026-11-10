// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { describe, expect, it } from 'vitest'
import { readNetworkModel } from '../models/index.js'
import { drawNetwork, layoutNetwork } from './draw.js'
import { layoutParts } from './layout.js'
import { networkOf, testMetrics } from './testing/support.js'

const yaml = `
groups:
  - id: site
    groups: [{ id: floor }]
redundancy:
  - { id: core, nodes: [c1, c2], kind: mlag }
nodes:
  - { id: edge, type: router, group: site }
  - { id: c1, group: site }
  - { id: c2, group: site }
  - { id: sw1, group: floor }
  - { id: sw2, group: floor }
  - { id: sw3, group: floor }
  - { id: lonely, group: floor }
  - { id: srv, type: server, group: site }
  - { id: vm, type: vm, host: srv }
links:
  - { endpoints: [{ node: edge }, { node: c1 }] }
  - { endpoints: [{ node: edge }, { node: c2 }] }
  - { endpoints: [{ node: c1 }, { node: c2 }] }
  - { endpoints: [{ node: c1 }, { node: sw1 }] }
  - { endpoints: [{ node: c2 }, { node: sw2 }] }
  - { endpoints: [{ node: c1 }, { node: sw3 }] }
  - { endpoints: [{ node: c2 }, { node: srv }] }
`

const partsOf = (siblings?: Record<string, readonly string[]>) => {
  const { network, structure } = networkOf(yaml, ['edge'])
  return layoutParts(network, structure, testMetrics, { hints: { siblings } })
}
const ids = (parts: ReturnType<typeof partsOf>, frame: string) =>
  (parts.arrangement.frames[frame] ?? []).map((p) => p.id)

describe('the arrangement', () => {
  it('names each frame’s children left to right with the rows they hold, and no coordinate', () => {
    const parts = partsOf()
    const { arrangement } = parts
    expect(Object.keys(arrangement.frames).sort()).toEqual(['', 'floor', 'site'])
    expect(ids(parts, '')).toEqual(['site'])
    const site = arrangement.frames.site ?? []
    const byId = new Map(site.map((p) => [p.id, p]))
    expect(byId.get('edge')).toMatchObject({ kind: 'node', rows: [0, 0], movable: true })
    expect(byId.get('core')).toMatchObject({ kind: 'unit', rows: [1, 1], movable: true })
    expect(byId.get('core')?.members?.slice().sort()).toEqual(['c1', 'c2'])
    expect(byId.get('floor')).toMatchObject({ kind: 'group', rows: [2, 2] })
    expect(byId.get('vm')).toBeUndefined()
    const fields = new Set(['id', 'kind', 'rows', 'movable', 'members'])
    for (const p of site) for (const k of Object.keys(p)) expect(fields.has(k)).toBe(true)
    // what the structure gives no place has no order to take
    const floor = new Map((arrangement.frames.floor ?? []).map((p) => [p.id, p]))
    expect(floor.get('lonely')?.movable).toBe(false)
    expect(floor.get('sw1')?.movable).toBe(true)
    expect(arrangement.unmet).toEqual({})
  })

  it('honours an order it is given, and says so by leaving unmet empty', () => {
    const free = ids(partsOf(), 'floor').filter((id) => id !== 'lonely')
    const wanted = [...free].reverse()
    const parts = partsOf({ floor: wanted })
    expect(ids(parts, 'floor').filter((id) => id !== 'lonely')).toEqual(wanted)
    expect(parts.arrangement.unmet).toEqual({})
  })

  it('ignores an intent whose target is gone, drawing as if it were not there', () => {
    const plain = partsOf()
    const stale = partsOf({ floor: ['ghost', 'sw1'], gone: ['a', 'b'] })
    expect(stale.scene).toEqual(plain.scene)
    expect(stale.arrangement.unmet).toEqual({})
  })

  it('lets the structure win over an intent it contradicts, and reports what it did not honour', () => {
    const plain = partsOf()
    // lonely has no place in the flow, sw1 is a child of floor, not of site
    const parts = partsOf({ floor: ['lonely', 'sw1'], site: ['sw1', 'edge'] })
    expect(ids(parts, 'floor')).toEqual(ids(plain, 'floor'))
    expect(ids(parts, 'site')).toEqual(ids(plain, 'site'))
    expect(parts.arrangement.unmet).toEqual({ floor: ['lonely'], site: ['sw1'] })
  })
})

describe('drawNetwork', () => {
  it('reads the order the model keeps in drawing.order, so every caller draws the same', () => {
    const model = readNetworkModel(yaml)
    const plain = layoutNetwork(model, { metrics: () => testMetrics })
    const floor = plain.arrangement.frames.floor?.filter((p) => p.movable).map((p) => p.id) ?? []
    const order = { floor: [...floor].reverse() }
    const hinted = layoutNetwork(
      { ...model, drawing: { ...model.drawing, order } },
      { metrics: () => testMetrics },
    )
    expect(hinted.arrangement.frames.floor?.filter((p) => p.movable).map((p) => p.id)).toEqual(
      order.floor,
    )
    expect(hinted.scene).not.toEqual(plain.scene)
    expect(drawNetwork({ ...model, drawing: { order } }, { metrics: () => testMetrics })).toEqual(
      hinted.scene,
    )
  })
})

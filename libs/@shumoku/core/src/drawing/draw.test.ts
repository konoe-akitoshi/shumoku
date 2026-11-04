// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { describe, expect, it } from 'vitest'
import { readNetworkModel } from '../models/network-model-graph.js'
import { boundaryOf, drawNetwork } from './draw.js'
import { testMetrics } from './testing/support.js'

const wan = `
nodes:
  - { id: wan, type: external }
  - { id: edge }
  - { id: sw }
links:
  - endpoints: [{ node: wan }, { node: edge }]
  - endpoints: [{ node: edge }, { node: sw }]
`

describe('drawNetwork', () => {
  it('draws every node and line of a model', () => {
    const scene = drawNetwork(readNetworkModel(wan), { metrics: () => testMetrics })
    expect(scene.nodes.map((n) => n.node.id).sort()).toEqual(['edge', 'sw', 'wan'])
    expect(scene.wires).toHaveLength(2)
  })

  it('draws what the layers add to the configuration', () => {
    const model = readNetworkModel(wan)
    const scene = drawNetwork(
      { ...model, drawing: { nodes: { sw: { icon: '<svg viewBox="0 0 1 1"/>' } } } },
      { metrics: () => testMetrics },
    )
    expect(scene.nodes.find((n) => n.node.id === 'sw')?.node.spec?.icon).toBe(
      '<svg viewBox="0 0 1 1"/>',
    )
  })

  it('puts upstream above downstream from the external node', () => {
    const scene = drawNetwork(readNetworkModel(wan), { metrics: () => testMetrics })
    const top = (id: string) => scene.nodes.find((n) => n.node.id === id)?.box.y ?? Number.NaN
    expect(top('wan')).toBeLessThan(top('edge'))
    expect(top('edge')).toBeLessThan(top('sw'))
  })
})

describe('a guest of a host with no line', () => {
  it('is drawn beside its host, and a line to it finds its way', () => {
    const model = readNetworkModel(`
nodes:
  - { id: aws, type: cloud }
  - { id: fw }
  - { id: sw }
  - { id: vgw, host: aws }
links:
  - endpoints: [{ node: fw }, { node: sw }]
  - { endpoints: [{ node: fw }, { node: vgw }], virtual: true }
`)
    const scene = drawNetwork(model, { metrics: () => testMetrics })
    expect(scene.nodes.map((n) => n.node.id).sort()).toEqual(['aws', 'fw', 'sw', 'vgw'])
  })
})

describe('two lines straight across between two boxes', () => {
  it('are drawn when their ports are named in opposite orders on the two sides', () => {
    const model = readNetworkModel(`
nodes:
  - { id: a }
  - { id: b }
links:
  - endpoints: [{ node: a, port: p0 }, { node: b, port: q1 }]
  - { endpoints: [{ node: a, port: p1 }, { node: b, port: q0 }], virtual: true }
`)
    expect(drawNetwork(model, { metrics: () => testMetrics }).wires).toHaveLength(2)
  })
})

describe('boundaryOf', () => {
  it('takes the external node when the structure names no candidate', () => {
    expect(boundaryOf(readNetworkModel(wan))).toEqual(['wan'])
  })

  it('takes where the physical meets the virtual', () => {
    const model = readNetworkModel(`
nodes:
  - { id: a }
  - { id: b }
  - { id: c }
links:
  - endpoints: [{ node: a }, { node: b }]
  - { endpoints: [{ node: b }, { node: c }], virtual: true }
`)
    expect(boundaryOf(model)).toEqual(['b'])
  })

  it('takes the external node over where the physical meets the virtual', () => {
    const model = readNetworkModel(`
nodes:
  - { id: isp, type: external }
  - { id: rt }
  - { id: br }
links:
  - endpoints: [{ node: isp }, { node: rt }]
  - endpoints: [{ node: rt }, { node: br }]
  - { endpoints: [{ node: rt }, { node: br }], virtual: true }
`)
    expect(boundaryOf(model)).toEqual(['isp'])
  })

  it('is overridden by the drawing layer alone', () => {
    const model = readNetworkModel(wan)
    expect(boundaryOf({ ...model, drawing: { settings: { boundary: ['sw'] } } })).toEqual(['sw'])
  })
})

import { describe, expect, it } from 'vitest'
import type { Node } from '../models/types.js'
import { channelsFromLayers, detectLayers } from './layer-detection.js'

function n(id: string, x: number, y: number, shape: 'rounded' = 'rounded' as const): Node {
  return { id, label: id, shape, position: { x, y } }
}

describe('detectLayers', () => {
  it('groups nodes sharing the same y coord into one layer (TB)', () => {
    const nodes = new Map([
      ['a', n('a', 100, 100)],
      ['b', n('b', 300, 100)],
      ['c', n('c', 500, 100)],
      ['d', n('d', 200, 300)],
      ['e', n('e', 400, 300)],
    ])
    const { layerOf, layers, rankAxis } = detectLayers(nodes, 'TB')
    expect(rankAxis).toBe('y')
    expect(layers.length).toBe(2)
    expect(layers[0]?.nodes.sort()).toEqual(['a', 'b', 'c'])
    expect(layers[1]?.nodes.sort()).toEqual(['d', 'e'])
    expect(layerOf.get('a')).toBe(0)
    expect(layerOf.get('d')).toBe(1)
  })

  it('orders layers by ascending rank (top → bottom in TB)', () => {
    const nodes = new Map([
      ['top', n('top', 0, 50)],
      ['mid', n('mid', 0, 250)],
      ['bot', n('bot', 0, 450)],
    ])
    const { layers } = detectLayers(nodes, 'TB')
    expect(layers.map((l) => l.rankCentre)).toEqual([50, 250, 450])
  })

  it('uses X axis as rank axis in LR layouts', () => {
    const nodes = new Map([
      ['a', n('a', 100, 0)],
      ['b', n('b', 100, 200)],
      ['c', n('c', 300, 100)],
    ])
    const { rankAxis, layers, layerOf } = detectLayers(nodes, 'LR')
    expect(rankAxis).toBe('x')
    expect(layers.length).toBe(2)
    expect(layerOf.get('a')).toBe(0)
    expect(layerOf.get('b')).toBe(0)
    expect(layerOf.get('c')).toBe(1)
  })

  it('skips nodes without a position', () => {
    const nodes = new Map<string, Node>([
      ['placed', n('placed', 0, 100)],
      ['unplaced', { id: 'unplaced', label: 'X', shape: 'rounded' }],
    ])
    const { layerOf, layers } = detectLayers(nodes, 'TB')
    expect(layers.length).toBe(1)
    expect(layerOf.has('unplaced')).toBe(false)
    expect(layerOf.get('placed')).toBe(0)
  })

  it('tolerates a 1px rounding difference within a layer', () => {
    const nodes = new Map([
      ['a', n('a', 100, 100)],
      ['b', n('b', 200, 100.4)],
    ])
    const { layers } = detectLayers(nodes, 'TB')
    expect(layers.length).toBe(1)
  })

  it('inflates layer rank bounds with node halves', () => {
    // Two nodes at y=100; default size is 180w x 60h, so half-height
    // is 30 → rankStart should be 70, rankEnd 130.
    const nodes = new Map([
      ['a', n('a', 0, 100)],
      ['b', n('b', 200, 100)],
    ])
    const { layers } = detectLayers(nodes, 'TB')
    expect(layers[0]?.rankStart).toBe(70)
    expect(layers[0]?.rankEnd).toBe(130)
  })
})

describe('channelsFromLayers', () => {
  it('returns a channel for every adjacent layer pair', () => {
    const layers = [
      { index: 0, rankStart: 0, rankEnd: 100, rankCentre: 50, nodes: [] },
      { index: 1, rankStart: 200, rankEnd: 300, rankCentre: 250, nodes: [] },
      { index: 2, rankStart: 400, rankEnd: 500, rankCentre: 450, nodes: [] },
    ]
    const channels = channelsFromLayers(layers, 0)
    expect(channels.length).toBe(2)
    expect(channels[0]).toMatchObject({ index: 0, rankStart: 100, rankEnd: 200 })
    expect(channels[1]).toMatchObject({ index: 1, rankStart: 300, rankEnd: 400 })
  })

  it('inflates clearance away from both layer edges', () => {
    const layers = [
      { index: 0, rankStart: 0, rankEnd: 100, rankCentre: 50, nodes: [] },
      { index: 1, rankStart: 200, rankEnd: 300, rankCentre: 250, nodes: [] },
    ]
    const channels = channelsFromLayers(layers, 10)
    expect(channels[0]).toMatchObject({ rankStart: 110, rankEnd: 190 })
  })

  it('drops channels where clearance eats the entire gap', () => {
    const layers = [
      { index: 0, rankStart: 0, rankEnd: 100, rankCentre: 50, nodes: [] },
      { index: 1, rankStart: 105, rankEnd: 200, rankCentre: 150, nodes: [] },
    ]
    const channels = channelsFromLayers(layers, 10)
    expect(channels.length).toBe(0)
  })

  it('returns empty for a single-layer graph', () => {
    const layers = [{ index: 0, rankStart: 0, rankEnd: 100, rankCentre: 50, nodes: [] }]
    expect(channelsFromLayers(layers, 0)).toEqual([])
  })
})

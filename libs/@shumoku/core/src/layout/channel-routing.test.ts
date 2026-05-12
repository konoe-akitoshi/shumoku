import { describe, expect, it } from 'vitest'
import type { Link, Node } from '../models/types.js'
import { assignChannelLanes, checkpointFromLane } from './channel-routing.js'
import type { Channel, LayerDetectionResult } from './layer-detection.js'
import type { ResolvedPort } from './resolved-types.js'

function port(
  id: string,
  nodeId: string,
  x: number,
  y: number,
  side: 'top' | 'bottom' = 'top',
): ResolvedPort {
  return {
    id,
    nodeId,
    label: id,
    absolutePosition: { x, y },
    side,
    size: { width: 8, height: 8 },
  }
}

/** Build a minimal Node map from port positions — the channel router
 *  reads node centres to group fan-out edges, so every test needs at
 *  least a position per node id. The y is irrelevant for our TB tests
 *  (the router uses crossAxis = x); we just need a defined position. */
function nodesFromPorts(ports: Map<string, ResolvedPort>): Map<string, Node> {
  const nodes = new Map<string, Node>()
  for (const p of ports.values()) {
    if (nodes.has(p.nodeId)) continue
    nodes.set(p.nodeId, {
      id: p.nodeId,
      label: p.nodeId,
      shape: 'rounded',
      position: { x: p.absolutePosition.x, y: p.absolutePosition.y },
    })
  }
  return nodes
}

function buildLayers(
  spec: Array<{ nodes: string[]; rankStart: number; rankEnd: number; rankCentre: number }>,
): LayerDetectionResult {
  const layerOf = new Map<string, number>()
  const layers = spec.map((s, i) => {
    for (const n of s.nodes) layerOf.set(n, i)
    return { ...s, index: i }
  })
  return { layerOf, layers, rankAxis: 'y' }
}

describe('assignChannelLanes', () => {
  it('groups by source x; within a source, far peers get shallower lanes than near peers', () => {
    // Three switches at top (y=100), three APs at bottom (y=400).
    // Each switch fans to its OWN AP at matching x, so distances are
    // all zero — the outer source-x ordering decides lane Y.
    const layers = buildLayers([
      { nodes: ['sw-l', 'sw-m', 'sw-r'], rankStart: 80, rankEnd: 120, rankCentre: 100 },
      { nodes: ['ap-l', 'ap-m', 'ap-r'], rankStart: 380, rankEnd: 420, rankCentre: 400 },
    ])
    const channels: Channel[] = [{ index: 0, rankStart: 130, rankEnd: 370 }]
    const ports = new Map<string, ResolvedPort>([
      ['sw-l:p', port('sw-l:p', 'sw-l', 100, 120)],
      ['sw-m:p', port('sw-m:p', 'sw-m', 300, 120)],
      ['sw-r:p', port('sw-r:p', 'sw-r', 500, 120)],
      ['ap-l:p', port('ap-l:p', 'ap-l', 100, 380)],
      ['ap-m:p', port('ap-m:p', 'ap-m', 300, 380)],
      ['ap-r:p', port('ap-r:p', 'ap-r', 500, 380)],
    ])
    const links: Link[] = [
      { id: 'link-r', from: { node: 'sw-r', port: 'p' }, to: { node: 'ap-r', port: 'p' } },
      { id: 'link-l', from: { node: 'sw-l', port: 'p' }, to: { node: 'ap-l', port: 'p' } },
      { id: 'link-m', from: { node: 'sw-m', port: 'p' }, to: { node: 'ap-m', port: 'p' } },
    ]
    const result = assignChannelLanes(links, nodesFromPorts(ports), ports, layers, channels, 'TB')
    const l = result.get('link-l')?.rankCoords[0]
    const m = result.get('link-m')?.rankCoords[0]
    const r = result.get('link-r')?.rankCoords[0]
    expect(l).toBeLessThan(m as number)
    expect(m).toBeLessThan(r as number)
  })

  it('fan-out: same source, far targets bend at shallower lanes than near targets', () => {
    // One switch at x=500, three APs scattered left/right.
    // Distances: ap-near at x=480 (Δ=20), ap-mid at x=300 (Δ=200), ap-far at x=900 (Δ=400).
    // Expected lane order (low → high rank coord): ap-far, ap-mid, ap-near.
    const layers = buildLayers([
      { nodes: ['sw'], rankStart: 80, rankEnd: 120, rankCentre: 100 },
      { nodes: ['ap-far', 'ap-mid', 'ap-near'], rankStart: 380, rankEnd: 420, rankCentre: 400 },
    ])
    const channels: Channel[] = [{ index: 0, rankStart: 130, rankEnd: 370 }]
    const ports = new Map<string, ResolvedPort>([
      ['sw:a', port('sw:a', 'sw', 500, 120)],
      ['sw:b', port('sw:b', 'sw', 500, 120)],
      ['sw:c', port('sw:c', 'sw', 500, 120)],
      ['ap-far:p', port('ap-far:p', 'ap-far', 900, 380)],
      ['ap-mid:p', port('ap-mid:p', 'ap-mid', 300, 380)],
      ['ap-near:p', port('ap-near:p', 'ap-near', 480, 380)],
    ])
    const links: Link[] = [
      { id: 'near', from: { node: 'sw', port: 'a' }, to: { node: 'ap-near', port: 'p' } },
      { id: 'mid', from: { node: 'sw', port: 'b' }, to: { node: 'ap-mid', port: 'p' } },
      { id: 'far', from: { node: 'sw', port: 'c' }, to: { node: 'ap-far', port: 'p' } },
    ]
    const result = assignChannelLanes(links, nodesFromPorts(ports), ports, layers, channels, 'TB')
    const farY = result.get('far')?.rankCoords[0] as number
    const midY = result.get('mid')?.rankCoords[0] as number
    const nearY = result.get('near')?.rankCoords[0] as number
    expect(farY).toBeLessThan(midY) // far peels off first (shallow lane = small Y in TB)
    expect(midY).toBeLessThan(nearY) // near stays deep
  })

  it('spreads lanes evenly within the channel span', () => {
    const layers = buildLayers([
      { nodes: ['a', 'b', 'c'], rankStart: 80, rankEnd: 120, rankCentre: 100 },
      { nodes: ['x', 'y', 'z'], rankStart: 380, rankEnd: 420, rankCentre: 400 },
    ])
    const channels: Channel[] = [{ index: 0, rankStart: 130, rankEnd: 370 }]
    // 3 lanes in [130, 370] → 1/4, 2/4, 3/4 → 190, 250, 310.
    const ports = new Map<string, ResolvedPort>([
      ['a:p', port('a:p', 'a', 100, 120)],
      ['b:p', port('b:p', 'b', 200, 120)],
      ['c:p', port('c:p', 'c', 300, 120)],
      ['x:p', port('x:p', 'x', 100, 380)],
      ['y:p', port('y:p', 'y', 200, 380)],
      ['z:p', port('z:p', 'z', 300, 380)],
    ])
    const links: Link[] = [
      { id: 'ax', from: { node: 'a', port: 'p' }, to: { node: 'x', port: 'p' } },
      { id: 'by', from: { node: 'b', port: 'p' }, to: { node: 'y', port: 'p' } },
      { id: 'cz', from: { node: 'c', port: 'p' }, to: { node: 'z', port: 'p' } },
    ]
    const result = assignChannelLanes(links, nodesFromPorts(ports), ports, layers, channels, 'TB')
    expect(result.get('ax')?.rankCoords[0]).toBe(190)
    expect(result.get('by')?.rankCoords[0]).toBe(250)
    expect(result.get('cz')?.rankCoords[0]).toBe(310)
  })

  it('handles a flipped-direction edge (target above source) by walking channels high→low', () => {
    const layers = buildLayers([
      { nodes: ['hi'], rankStart: 80, rankEnd: 120, rankCentre: 100 },
      { nodes: ['lo'], rankStart: 380, rankEnd: 420, rankCentre: 400 },
    ])
    const channels: Channel[] = [{ index: 0, rankStart: 130, rankEnd: 370 }]
    const ports = new Map([
      ['hi:p', port('hi:p', 'hi', 200, 120)],
      ['lo:p', port('lo:p', 'lo', 200, 380)],
    ])
    // link.from is the LOWER-rank node (lo, layer 1); link.to is the upper.
    const links: Link[] = [
      { id: 'flip', from: { node: 'lo', port: 'p' }, to: { node: 'hi', port: 'p' } },
    ]
    const result = assignChannelLanes(links, nodesFromPorts(ports), ports, layers, channels, 'TB')
    expect(result.get('flip')?.channelIndices).toEqual([0])
  })

  it('issues one checkpoint per crossed boundary for multi-layer edges', () => {
    const layers = buildLayers([
      { nodes: ['top'], rankStart: 80, rankEnd: 120, rankCentre: 100 },
      { nodes: ['mid'], rankStart: 280, rankEnd: 320, rankCentre: 300 },
      { nodes: ['bot'], rankStart: 480, rankEnd: 520, rankCentre: 500 },
    ])
    const channels: Channel[] = [
      { index: 0, rankStart: 130, rankEnd: 270 },
      { index: 1, rankStart: 330, rankEnd: 470 },
    ]
    const ports = new Map([
      ['top:p', port('top:p', 'top', 200, 120)],
      ['bot:p', port('bot:p', 'bot', 200, 480)],
    ])
    const links: Link[] = [
      { id: 'long', from: { node: 'top', port: 'p' }, to: { node: 'bot', port: 'p' } },
    ]
    const result = assignChannelLanes(links, nodesFromPorts(ports), ports, layers, channels, 'TB')
    expect(result.get('long')?.channelIndices).toEqual([0, 1])
    expect(result.get('long')?.rankCoords.length).toBe(2)
  })

  it('skips intra-layer (same-rank) edges — those are HA / lateral, channel routing not applicable', () => {
    const layers = buildLayers([
      { nodes: ['a', 'b'], rankStart: 80, rankEnd: 120, rankCentre: 100 },
    ])
    const ports = new Map([
      ['a:p', port('a:p', 'a', 100, 100)],
      ['b:p', port('b:p', 'b', 300, 100)],
    ])
    const links: Link[] = [
      { id: 'ha', from: { node: 'a', port: 'p' }, to: { node: 'b', port: 'p' }, redundancy: 'ha' },
    ]
    const result = assignChannelLanes(links, nodesFromPorts(ports), ports, layers, [], 'TB')
    expect(result.has('ha')).toBe(false)
  })

  it('falls back gracefully when an endpoint port is missing', () => {
    const layers = buildLayers([
      { nodes: ['a'], rankStart: 80, rankEnd: 120, rankCentre: 100 },
      { nodes: ['b'], rankStart: 380, rankEnd: 420, rankCentre: 400 },
    ])
    const channels: Channel[] = [{ index: 0, rankStart: 130, rankEnd: 370 }]
    const ports = new Map([['a:p', port('a:p', 'a', 100, 120)]])
    const links: Link[] = [
      { id: 'bad', from: { node: 'a', port: 'p' }, to: { node: 'b', port: 'missing' } },
    ]
    const result = assignChannelLanes(links, nodesFromPorts(ports), ports, layers, channels, 'TB')
    expect(result.has('bad')).toBe(false)
  })

  it('produces deterministic lane order for the same input', () => {
    const layers = buildLayers([
      { nodes: ['a'], rankStart: 80, rankEnd: 120, rankCentre: 100 },
      { nodes: ['b', 'c'], rankStart: 380, rankEnd: 420, rankCentre: 400 },
    ])
    const channels: Channel[] = [{ index: 0, rankStart: 130, rankEnd: 370 }]
    const ports = new Map([
      ['a:p1', port('a:p1', 'a', 100, 120)],
      ['a:p2', port('a:p2', 'a', 200, 120)],
      ['b:p', port('b:p', 'b', 100, 380)],
      ['c:p', port('c:p', 'c', 200, 380)],
    ])
    const links: Link[] = [
      { id: 'l1', from: { node: 'a', port: 'p1' }, to: { node: 'b', port: 'p' } },
      { id: 'l2', from: { node: 'a', port: 'p2' }, to: { node: 'c', port: 'p' } },
    ]
    const r1 = assignChannelLanes(links, nodesFromPorts(ports), ports, layers, channels, 'TB')
    const r2 = assignChannelLanes(links, nodesFromPorts(ports), ports, layers, channels, 'TB')
    expect(r1.get('l1')?.rankCoords).toEqual(r2.get('l1')?.rankCoords)
    expect(r1.get('l2')?.rankCoords).toEqual(r2.get('l2')?.rankCoords)
  })
})

describe('checkpointFromLane', () => {
  it('places TB checkpoint at midpoint of source/dest X with rank coord as Y', () => {
    const cp = checkpointFromLane(
      200,
      port('a:p', 'a', 100, 0, 'bottom'),
      port('b:p', 'b', 400, 500, 'top'),
      'y',
    )
    expect(cp).toEqual({ x: 250, y: 200 })
  })

  it('places LR checkpoint at midpoint of source/dest Y with rank coord as X', () => {
    const cp = checkpointFromLane(
      300,
      port('a:p', 'a', 0, 100, 'bottom'),
      port('b:p', 'b', 500, 400, 'top'),
      'x',
    )
    expect(cp).toEqual({ x: 300, y: 250 })
  })
})

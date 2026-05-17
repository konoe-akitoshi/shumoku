// Lane offset router — invariant tests. The renderer collapses to a
// stub when ports are missing, so the test focus is on the lateral
// offset assignment: only edges sharing a port get an offset, the
// fan stays centred on zero, and lane order follows the peer's
// lateral coordinate so adjacent lanes never cross each other.

import { describe, expect, test } from 'vitest'
import type { Link, Node } from '../models/types.js'
import { routeEdges } from './route-edges.js'
import type { ResolvedPort } from './resolved-types.js'

function port(id: string, nodeId: string, x: number, y: number, side: ResolvedPort['side']): ResolvedPort {
  return {
    id,
    nodeId,
    label: id,
    absolutePosition: { x, y },
    side,
    size: { width: 6, height: 6 },
  }
}

function link(from: string, to: string): Link {
  const [fn, fp] = from.split(':')
  const [tn, tp] = to.split(':')
  return {
    from: { node: fn ?? '', port: fp ?? '' },
    to: { node: tn ?? '', port: tp ?? '' },
  }
}

function makePorts(entries: Array<[string, ResolvedPort]>): Map<string, ResolvedPort> {
  return new Map(entries)
}

const NOOP_NODES = new Map<string, Node>()

describe('routeEdges — lane offset', () => {
  test('single edge per port has no lateral offset', async () => {
    const ports = makePorts([
      ['a:p1', port('a:p1', 'a', 0, 0, 'bottom')],
      ['b:p1', port('b:p1', 'b', 0, 100, 'top')],
    ])
    const edges = await routeEdges(NOOP_NODES, ports, [link('a:p1', 'b:p1')])
    const [edge] = [...edges.values()]
    expect(edge?.fromLateralOffset).toBeUndefined()
    expect(edge?.toLateralOffset).toBeUndefined()
  })

  test('fan-out: three edges from one bottom port get symmetric lateral offsets', async () => {
    const ports = makePorts([
      ['hub:p1', port('hub:p1', 'hub', 100, 0, 'bottom')],
      ['c1:p1', port('c1:p1', 'c1', 50, 100, 'top')],
      ['c2:p1', port('c2:p1', 'c2', 100, 100, 'top')],
      ['c3:p1', port('c3:p1', 'c3', 150, 100, 'top')],
    ])
    const edges = await routeEdges(NOOP_NODES, ports, [
      link('hub:p1', 'c1:p1'),
      link('hub:p1', 'c2:p1'),
      link('hub:p1', 'c3:p1'),
    ])
    const list = [...edges.values()]
    const offsets = list
      .sort((a, b) => a.toPort.absolutePosition.x - b.toPort.absolutePosition.x)
      .map((e) => e.fromLateralOffset)
    expect(offsets).toEqual([-8, 0, 8])
    // None of these should have target-side offsets because each peer port is unique.
    for (const e of list) expect(e.toLateralOffset).toBeUndefined()
  })

  test('lane order follows peer x for top/bottom ports', async () => {
    // hub at x=100, three children at x=200, 0, 100 (i.e. right, left, middle)
    // Lanes should run -8, 0, +8 when sorted left-to-right.
    const ports = makePorts([
      ['hub:p1', port('hub:p1', 'hub', 100, 0, 'bottom')],
      ['c1:p1', port('c1:p1', 'c1', 200, 100, 'top')],
      ['c2:p1', port('c2:p1', 'c2', 0, 100, 'top')],
      ['c3:p1', port('c3:p1', 'c3', 100, 100, 'top')],
    ])
    const edges = await routeEdges(NOOP_NODES, ports, [
      link('hub:p1', 'c1:p1'),
      link('hub:p1', 'c2:p1'),
      link('hub:p1', 'c3:p1'),
    ])
    const get = (id: string) => [...edges.values()].find((e) => e.toPortId === id)
    // c2 is leftmost target → leftmost lane (-8)
    expect(get('c2:p1')?.fromLateralOffset).toBe(-8)
    expect(get('c3:p1')?.fromLateralOffset).toBe(0)
    expect(get('c1:p1')?.fromLateralOffset).toBe(8)
  })

  test('fan-in: edges converging on one target port get target-side offsets', async () => {
    const ports = makePorts([
      ['s1:p', port('s1:p', 's1', 50, 0, 'bottom')],
      ['s2:p', port('s2:p', 's2', 100, 0, 'bottom')],
      ['s3:p', port('s3:p', 's3', 150, 0, 'bottom')],
      ['hub:p', port('hub:p', 'hub', 100, 100, 'top')],
    ])
    const edges = await routeEdges(NOOP_NODES, ports, [
      link('s1:p', 'hub:p'),
      link('s2:p', 'hub:p'),
      link('s3:p', 'hub:p'),
    ])
    const list = [...edges.values()].sort(
      (a, b) => a.fromPort.absolutePosition.x - b.fromPort.absolutePosition.x,
    )
    const offsets = list.map((e) => e.toLateralOffset)
    expect(offsets).toEqual([-8, 0, 8])
    // Each source is unique, so no source-side offset.
    for (const e of list) expect(e.fromLateralOffset).toBeUndefined()
  })

  test('group of 10+ edges shrinks stride to stay within the cap', async () => {
    // Default cap is 28px half-width → stride of (28*2)/(N-1) when
    // the natural stride would overflow. For N=10 the natural span
    // is 9 * 8 = 72px (half = 36) which exceeds 28; expect a
    // shrunk stride.
    const N = 10
    const entries: Array<[string, ResolvedPort]> = [
      ['hub:p', port('hub:p', 'hub', 100, 0, 'bottom')],
    ]
    const links: Link[] = []
    for (let i = 0; i < N; i++) {
      const id = `c${i}:p`
      entries.push([id, port(id, `c${i}`, i * 50, 100, 'top')])
      links.push(link('hub:p', id))
    }
    const edges = await routeEdges(NOOP_NODES, new Map(entries), links)
    const list = [...edges.values()]
    const offsets = list
      .filter((e) => e.fromLateralOffset !== undefined)
      .map((e) => e.fromLateralOffset as number)
      .sort((a, b) => a - b)
    // Symmetric around 0: pairwise sum is zero.
    for (let i = 0; i < offsets.length / 2; i++) {
      const lo = offsets[i] ?? 0
      const hi = offsets[offsets.length - 1 - i] ?? 0
      expect(lo + hi).toBeCloseTo(0, 5)
    }
    // Total half-width capped at 28.
    expect(Math.max(...offsets.map(Math.abs))).toBeLessThanOrEqual(28)
  })

  test('two unrelated fan-outs do not interfere', async () => {
    const ports = makePorts([
      ['h1:p', port('h1:p', 'h1', 0, 0, 'bottom')],
      ['h2:p', port('h2:p', 'h2', 200, 0, 'bottom')],
      ['a:p', port('a:p', 'a', -50, 100, 'top')],
      ['b:p', port('b:p', 'b', 50, 100, 'top')],
      ['c:p', port('c:p', 'c', 150, 100, 'top')],
      ['d:p', port('d:p', 'd', 250, 100, 'top')],
    ])
    const edges = await routeEdges(NOOP_NODES, ports, [
      link('h1:p', 'a:p'),
      link('h1:p', 'b:p'),
      link('h2:p', 'c:p'),
      link('h2:p', 'd:p'),
    ])
    const get = (id: string) => [...edges.values()].find((e) => e.id === id || e.toPortId === id)
    expect(get('a:p')?.fromLateralOffset).toBe(-4)
    expect(get('b:p')?.fromLateralOffset).toBe(4)
    expect(get('c:p')?.fromLateralOffset).toBe(-4)
    expect(get('d:p')?.fromLateralOffset).toBe(4)
  })
})

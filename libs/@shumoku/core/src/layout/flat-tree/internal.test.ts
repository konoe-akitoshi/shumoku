// Block-internal layout variants.

import { describe, expect, test } from 'vitest'
import {
  layoutBlockInternal,
  layoutEmitterWithSideChain,
  layoutWrappedSubtree,
} from './internal.js'

function sizes(...entries: Array<[string, number, number]>): Map<string, { width: number; height: number }> {
  return new Map(entries.map(([id, w, h]) => [id, { width: w, height: h }]))
}

describe('layoutBlockInternal — single member', () => {
  test('positions the single node at its centre', () => {
    const layout = layoutBlockInternal(['a'], new Map(), sizes(['a', 80, 60]))
    expect(layout.positions.get('a')).toEqual({ x: 40, y: 30 })
    expect(layout.width).toBe(80)
    expect(layout.height).toBe(60)
  })

  test('uses default size when missing', () => {
    const layout = layoutBlockInternal(['a'], new Map(), new Map())
    expect(layout.width).toBe(80)
    expect(layout.height).toBe(60)
  })
})

describe('layoutBlockInternal — multi-root row', () => {
  test('two roots with no children sit side-by-side', () => {
    const layout = layoutBlockInternal(
      ['a', 'b'],
      new Map(), // no parent in same block ⇒ both intra-roots
      sizes(['a', 80, 60], ['b', 100, 60]),
    )
    const a = layout.positions.get('a')
    const b = layout.positions.get('b')
    expect(a?.x).toBe(40) // a centred at width/2
    expect(b?.x).toBeGreaterThan(80) // b sits right of a
    expect(layout.height).toBe(60)
  })

  test('one root with two children fans out in a row', () => {
    const parents = new Map<string, string>([
      ['c1', 'root'],
      ['c2', 'root'],
    ])
    const layout = layoutBlockInternal(
      ['root', 'c1', 'c2'],
      parents,
      sizes(['root', 80, 60], ['c1', 60, 40], ['c2', 60, 40]),
    )
    const root = layout.positions.get('root')
    const c1 = layout.positions.get('c1')
    const c2 = layout.positions.get('c2')
    expect(root?.y).toBe(30)
    // Root is centred over the band of children.
    expect(root?.x).toBeCloseTo(((c1?.x ?? 0) + (c2?.x ?? 0)) / 2, 1)
    // c1 sits left of c2.
    expect((c1?.x ?? 0) < (c2?.x ?? 0)).toBe(true)
    // Children sit below root.
    expect((c1?.y ?? 0) > (root?.y ?? 0)).toBe(true)
  })
})

describe('layoutBlockInternal — emitter with side chain', () => {
  test('root sits at block centre; chain hangs to the right', () => {
    // Block: root → chain1 → chain2. Pass rootIsExternalEmitter=true.
    const parents = new Map<string, string>([
      ['chain1', 'root'],
      ['chain2', 'chain1'],
    ])
    const layout = layoutBlockInternal(
      ['root', 'chain1', 'chain2'],
      parents,
      sizes(['root', 80, 60], ['chain1', 60, 40], ['chain2', 60, 40]),
      true, // external emitter
    )
    const root = layout.positions.get('root')
    const chain1 = layout.positions.get('chain1')
    const chain2 = layout.positions.get('chain2')
    // Root at block centre.
    expect(root?.x).toBeCloseTo(layout.width / 2, 5)
    // Chain sits to the right of root.
    expect((chain1?.x ?? 0) > (root?.x ?? 0)).toBe(true)
    // chain2 is in the same column as chain1.
    expect(chain1?.x).toBe(chain2?.x)
    // Chain descends.
    expect((chain2?.y ?? 0) > (chain1?.y ?? 0)).toBe(true)
  })

  test('left gutter exists so external child can run straight down', () => {
    const parents = new Map<string, string>([['chain1', 'root']])
    const layout = layoutBlockInternal(
      ['root', 'chain1'],
      parents,
      sizes(['root', 80, 60], ['chain1', 60, 40]),
      true,
    )
    const root = layout.positions.get('root')
    // Root.x − half-root-width is the left edge of the root.
    // Block left edge is at 0 (local coords). Gutter width = root.x − rootWidth/2.
    const gutterWidth = (root?.x ?? 0) - 40 // rootWidth/2
    expect(gutterWidth).toBeGreaterThan(0)
  })
})

describe('layoutWrappedSubtree', () => {
  test('leaf node fits to its own size', () => {
    const layout = layoutWrappedSubtree('leaf', new Map(), sizes(['leaf', 80, 60]))
    expect(layout.width).toBe(80)
    expect(layout.height).toBe(60)
  })

  test('root with one child stacks vertically', () => {
    const children = new Map([['root', ['child']]])
    const layout = layoutWrappedSubtree('root', children, sizes(['root', 80, 60], ['child', 80, 60]))
    const root = layout.positions.get('root')
    const child = layout.positions.get('child')
    expect(root?.x).toBe(child?.x)
    expect((child?.y ?? 0) > (root?.y ?? 0)).toBe(true)
  })

  test('root with four children fans out in one row', () => {
    const children = new Map([['root', ['c1', 'c2', 'c3', 'c4']]])
    const layout = layoutWrappedSubtree(
      'root',
      children,
      sizes(['root', 80, 60], ['c1', 60, 40], ['c2', 60, 40], ['c3', 60, 40], ['c4', 60, 40]),
    )
    const ys = ['c1', 'c2', 'c3', 'c4'].map((id) => layout.positions.get(id)?.y ?? -1)
    // All children share the same y (single row).
    expect(new Set(ys).size).toBe(1)
    // Children spread laterally.
    const xs = ['c1', 'c2', 'c3', 'c4'].map((id) => layout.positions.get(id)?.x ?? -1)
    expect(xs[0]).toBeLessThan(xs[1])
    expect(xs[1]).toBeLessThan(xs[2])
    expect(xs[2]).toBeLessThan(xs[3])
  })
})

describe('layoutEmitterWithSideChain direct', () => {
  test('block width grows with chain depth', () => {
    const sizesMap = sizes(
      ['root', 80, 60],
      ['c1', 60, 40],
      ['c2', 60, 40],
      ['c3', 60, 40],
    )
    const shortChain = layoutEmitterWithSideChain('root', new Map([['root', ['c1']]]), sizesMap)
    const longChain = layoutEmitterWithSideChain(
      'root',
      new Map([
        ['root', ['c1']],
        ['c1', ['c2']],
        ['c2', ['c3']],
      ]),
      sizesMap,
    )
    expect(longChain.height).toBeGreaterThan(shortChain.height)
  })

  test('empty chain (root only) returns a centred single node', () => {
    const layout = layoutEmitterWithSideChain('root', new Map(), sizes(['root', 80, 60]))
    expect(layout.width).toBe(80)
    expect(layout.height).toBe(60)
    expect(layout.positions.get('root')).toEqual({ x: 40, y: 30 })
  })
})

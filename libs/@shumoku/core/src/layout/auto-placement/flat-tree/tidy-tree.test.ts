// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it } from 'vitest'
import { layoutTree, type TreeLayoutEdge, type TreeLayoutNode } from './tidy-tree.js'

const sz = { width: 100, height: 50 }
function n(id: string): TreeLayoutNode {
  return { id, size: sz }
}
function e(parent: string, child: string): TreeLayoutEdge {
  return { parent, child }
}

describe('layoutTree (Buchheim)', () => {
  it('places a single node at origin', () => {
    const { positions } = layoutTree([n('a')], [])
    expect(positions.get('a')).toEqual({ x: 0, y: 25 })
  })

  it('lays out a linear chain along y, x stays at 0', () => {
    const { positions } = layoutTree([n('a'), n('b'), n('c')], [e('a', 'b'), e('b', 'c')])
    expect(positions.get('a')?.x).toBe(0)
    expect(positions.get('b')?.x).toBe(0)
    expect(positions.get('c')?.x).toBe(0)
    expect((positions.get('a')?.y ?? 0) < (positions.get('b')?.y ?? 0)).toBe(true)
    expect((positions.get('b')?.y ?? 0) < (positions.get('c')?.y ?? 0)).toBe(true)
  })

  it('centres a parent over its two children', () => {
    // root with 2 children — parent should sit at the midpoint of
    // its children's x coordinates.
    const { positions } = layoutTree([n('p'), n('a'), n('b')], [e('p', 'a'), e('p', 'b')], {
      nodeGap: 20,
    })
    const px = positions.get('p')?.x ?? 0
    const ax = positions.get('a')?.x ?? 0
    const bx = positions.get('b')?.x ?? 0
    expect(px).toBeCloseTo((ax + bx) / 2)
    expect(bx - ax).toBeGreaterThanOrEqual(100 + 20 - 1e-9) // width + gap
  })

  it('keeps siblings of the same parent contiguous', () => {
    // p1 has children a, b, c. p2 has children x, y. Siblings of p1
    // should be left-to-right contiguous; same for p2. No intruder.
    const { positions } = layoutTree(
      [n('root'), n('p1'), n('p2'), n('a'), n('b'), n('c'), n('x'), n('y')],
      [
        e('root', 'p1'),
        e('root', 'p2'),
        e('p1', 'a'),
        e('p1', 'b'),
        e('p1', 'c'),
        e('p2', 'x'),
        e('p2', 'y'),
      ],
      { nodeGap: 20 },
    )
    const xs = (id: string) => positions.get(id)?.x ?? 0
    const layer3 = [
      { id: 'a', x: xs('a') },
      { id: 'b', x: xs('b') },
      { id: 'c', x: xs('c') },
      { id: 'x', x: xs('x') },
      { id: 'y', x: xs('y') },
    ].sort((u, v) => u.x - v.x)
    // a/b/c should be contiguous, then x/y should be contiguous.
    // Concretely: the order should partition into {a,b,c} then {x,y},
    // or {x,y} then {a,b,c} — never interleaved.
    const ids = layer3.map((it) => it.id).join('')
    const matchABC = /^(abc|cba)(xy|yx)$/
    const matchXY = /^(xy|yx)(abc|cba)$/
    expect(matchABC.test(ids) || matchXY.test(ids)).toBe(true)
  })

  it('handles a forest (multiple roots) by laying out side by side', () => {
    // Two disconnected components, each with its own root.
    const { positions } = layoutTree([n('a'), n('b'), n('c'), n('d')], [e('a', 'b'), e('c', 'd')])
    // a/b form one tree, c/d another. All four get positions.
    expect(positions.get('a')).toBeDefined()
    expect(positions.get('b')).toBeDefined()
    expect(positions.get('c')).toBeDefined()
    expect(positions.get('d')).toBeDefined()
    // a and c should be at the same depth (both roots) → same y.
    expect(positions.get('a')?.y).toBe(positions.get('c')?.y)
  })

  it('asymmetric subtree widths: no horizontal blow-up for the narrow sibling', () => {
    // Mirrors the noc-sw01 / eps-sw01 case: one peer has 1 leaf, the
    // other has 4. The narrow-side peer shouldn't be dragged
    // arbitrarily far from its parent.
    //
    //     root
    //     /  \
    //    p    q
    //    |    /|\\
    //   x    a b c d
    //
    // Under Buchheim: q's subtree spans 4 leaves (~4 * (width + gap)),
    // p's subtree spans 1 leaf. The two siblings sit at minimum gap
    // apart in the parent layer. The horizontal blowup we saw with
    // BK 4-alignment shouldn't happen.
    const { positions, bounds } = layoutTree(
      [n('root'), n('p'), n('q'), n('x'), n('a'), n('b'), n('c'), n('d')],
      [
        e('root', 'p'),
        e('root', 'q'),
        e('p', 'x'),
        e('q', 'a'),
        e('q', 'b'),
        e('q', 'c'),
        e('q', 'd'),
      ],
      { nodeGap: 20 },
    )
    const px = positions.get('p')?.x ?? 0
    const qx = positions.get('q')?.x ?? 0
    // p and q live at depth 1. Their separation should be the
    // minimum needed for their subtree contours to not collide —
    // roughly the width of q's 4-leaf subtree midpoint.
    // For BK 4-alignment this gap was ~2900px on the real diagram;
    // Buchheim should yield something on the order of a few hundred.
    expect(Math.abs(qx - px)).toBeLessThan(bounds.width) // sanity: within frame
    // p sits over its only leaf x — single child, no centroid shift.
    const xx = positions.get('x')?.x ?? 0
    expect(px).toBeCloseTo(xx)
  })

  it('rotates output for LR direction', () => {
    const tb = layoutTree([n('a'), n('b')], [e('a', 'b')])
    const lr = layoutTree([n('a'), n('b')], [e('a', 'b')], { direction: 'LR' })
    // In TB, a above b: ya < yb, xa == xb
    expect((tb.positions.get('a')?.y ?? 0) < (tb.positions.get('b')?.y ?? 0)).toBe(true)
    // In LR, a left of b: xa < xb, ya == yb
    expect((lr.positions.get('a')?.x ?? 0) < (lr.positions.get('b')?.x ?? 0)).toBe(true)
    expect(lr.positions.get('a')?.y).toBe(lr.positions.get('b')?.y)
  })
})

// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it } from 'vitest'
import { type CompoundNode, type CompoundSubgraph, layoutCompound } from './compound.js'
import type { NodeSize } from './coords.js'
import type { Edge } from './types.js'

function nodes(ids: [string, string | null, NodeSize?][]): CompoundNode[] {
  return ids.map(([id, parent, size]) => ({ id, parent, ...(size && { size }) }))
}

function subgraphs(ids: [string, string | null][]): CompoundSubgraph[] {
  return ids.map(([id, parent]) => ({ id, parent }))
}

function edges(pairs: [string, string, string][]): Edge[] {
  return pairs.map(([s, t, id]) => ({ id, source: s, target: t }))
}

const uniformSize: NodeSize = { width: 100, height: 50 }

describe('layoutCompound', () => {
  it('lays out top-level-only nodes (no subgraphs) like flat layout', () => {
    const { nodePositions, subgraphBounds } = layoutCompound(
      nodes([
        ['a', null],
        ['b', null],
      ]),
      [],
      edges([['a', 'b', 'e1']]),
      { defaultSize: uniformSize },
    )
    expect(subgraphBounds.size).toBe(0)
    expect(nodePositions.size).toBe(2)
    // a above b (TB default)
    expect((nodePositions.get('a')?.y ?? 0) < (nodePositions.get('b')?.y ?? 0)).toBe(true)
  })

  it('places children inside their parent subgraph bounds', () => {
    // One subgraph with two children
    const { nodePositions, subgraphBounds } = layoutCompound(
      nodes([
        ['a', 'sg'],
        ['b', 'sg'],
      ]),
      subgraphs([['sg', null]]),
      edges([['a', 'b', 'e1']]),
      { defaultSize: uniformSize, subgraphPadding: 20, subgraphLabelHeight: 28 },
    )

    const bounds = subgraphBounds.get('sg')
    expect(bounds).toBeDefined()
    if (!bounds) return

    // Both children must be inside the bounds rectangle.
    for (const id of ['a', 'b']) {
      const p = nodePositions.get(id)
      expect(p).toBeDefined()
      if (!p) continue
      expect(p.x).toBeGreaterThanOrEqual(bounds.x)
      expect(p.x).toBeLessThanOrEqual(bounds.x + bounds.width)
      expect(p.y).toBeGreaterThanOrEqual(bounds.y)
      expect(p.y).toBeLessThanOrEqual(bounds.y + bounds.height)
    }
  })

  it('reserves label height at the top of the subgraph', () => {
    const { nodePositions, subgraphBounds } = layoutCompound(
      nodes([['a', 'sg']]),
      subgraphs([['sg', null]]),
      [],
      { defaultSize: uniformSize, subgraphPadding: 20, subgraphLabelHeight: 28 },
    )
    const bounds = subgraphBounds.get('sg')
    const a = nodePositions.get('a')
    if (!bounds || !a) throw new Error('missing layout result')

    // a's top edge should be below (>=) the label line.
    const aTop = a.y - uniformSize.height / 2
    expect(aTop).toBeGreaterThanOrEqual(bounds.y + 28 - 0.001)
  })

  it('nests subgraphs: inner fits inside outer with padding', () => {
    // outer contains innerSg, innerSg contains a
    const { nodePositions, subgraphBounds } = layoutCompound(
      nodes([['a', 'inner']]),
      subgraphs([
        ['outer', null],
        ['inner', 'outer'],
      ]),
      [],
      { defaultSize: uniformSize, subgraphPadding: 15, subgraphLabelHeight: 20 },
    )

    const outer = subgraphBounds.get('outer')
    const inner = subgraphBounds.get('inner')
    const a = nodePositions.get('a')
    if (!outer || !inner || !a) throw new Error('missing layout result')

    // inner's rectangle must fit inside outer's
    expect(inner.x).toBeGreaterThanOrEqual(outer.x)
    expect(inner.y).toBeGreaterThanOrEqual(outer.y)
    expect(inner.x + inner.width).toBeLessThanOrEqual(outer.x + outer.width + 0.001)
    expect(inner.y + inner.height).toBeLessThanOrEqual(outer.y + outer.height + 0.001)

    // a fits inside inner
    expect(a.x).toBeGreaterThanOrEqual(inner.x)
    expect(a.x).toBeLessThanOrEqual(inner.x + inner.width)
  })

  it('places a leaf node alongside a subgraph at the top level', () => {
    const { nodePositions, subgraphBounds } = layoutCompound(
      nodes([
        ['lone', null],
        ['inside', 'sg'],
      ]),
      subgraphs([['sg', null]]),
      [],
      { defaultSize: uniformSize },
    )

    const lone = nodePositions.get('lone')
    const sgBounds = subgraphBounds.get('sg')
    const inside = nodePositions.get('inside')
    expect(lone).toBeDefined()
    expect(sgBounds).toBeDefined()
    expect(inside).toBeDefined()
    if (!lone || !sgBounds || !inside) return

    // inside must be within the subgraph's bounds
    expect(inside.x).toBeGreaterThanOrEqual(sgBounds.x)
    expect(inside.x).toBeLessThanOrEqual(sgBounds.x + sgBounds.width)

    // lone and the subgraph should be separate (lone not inside sg bounds)
    const insideSg =
      lone.x >= sgBounds.x &&
      lone.x <= sgBounds.x + sgBounds.width &&
      lone.y >= sgBounds.y &&
      lone.y <= sgBounds.y + sgBounds.height
    expect(insideSg).toBe(false)
  })

  it('computes rootBounds covering every element', () => {
    const { rootBounds, nodePositions, subgraphBounds } = layoutCompound(
      nodes([
        ['a', null],
        ['b', 'sg'],
      ]),
      subgraphs([['sg', null]]),
      [],
      { defaultSize: uniformSize },
    )

    for (const [, p] of nodePositions) {
      expect(p.x - uniformSize.width / 2).toBeGreaterThanOrEqual(rootBounds.x - 0.001)
      expect(p.y - uniformSize.height / 2).toBeGreaterThanOrEqual(rootBounds.y - 0.001)
    }
    for (const [, b] of subgraphBounds) {
      expect(b.x).toBeGreaterThanOrEqual(rootBounds.x - 0.001)
      expect(b.y).toBeGreaterThanOrEqual(rootBounds.y - 0.001)
      expect(b.x + b.width).toBeLessThanOrEqual(rootBounds.x + rootBounds.width + 0.001)
      expect(b.y + b.height).toBeLessThanOrEqual(rootBounds.y + rootBounds.height + 0.001)
    }
  })

  it('handles cross-container edges without crashing', () => {
    // Cross-container edges influence layout only at the level where
    // both endpoints are visible (in this case nowhere — both containers
    // treat them as external), but they must not blow up the algorithm.
    const { nodePositions } = layoutCompound(
      nodes([
        ['a', 'sg1'],
        ['b', 'sg2'],
      ]),
      subgraphs([
        ['sg1', null],
        ['sg2', null],
      ]),
      edges([['a', 'b', 'cross']]),
      { defaultSize: uniformSize },
    )
    // Both nodes placed, no throw
    expect(nodePositions.get('a')).toBeDefined()
    expect(nodePositions.get('b')).toBeDefined()
  })

  it('gives an empty subgraph a small but non-zero footprint', () => {
    const { subgraphBounds } = layoutCompound([], subgraphs([['empty', null]]), [], {
      subgraphPadding: 20,
      subgraphLabelHeight: 28,
    })
    const bounds = subgraphBounds.get('empty')
    expect(bounds).toBeDefined()
    if (!bounds) return
    // Padding + label give a minimum visible rectangle
    expect(bounds.width).toBeGreaterThanOrEqual(40)
    expect(bounds.height).toBeGreaterThanOrEqual(28)
  })
})

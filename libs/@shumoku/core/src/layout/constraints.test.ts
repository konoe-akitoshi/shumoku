// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Constraint registry (#482): verification derives from the declared specs,
 * blocking violations throw under test env, and the extracted pierce finder
 * matches the verbatim O(n²) reference.
 */

import { describe, expect, test } from 'bun:test'
import type { Node } from '../models/types.js'
import {
  assertLayoutConstraints,
  LAYOUT_CONSTRAINTS,
  verifyLayoutConstraints,
} from './constraints.js'
import { findEdgeNodePiercing, type PierceLineSpec, segmentsIntersect } from './invariants.js'
import type { ResolvedLayout } from './resolved-types.js'

const mkNode = (id: string, parent?: string): Node =>
  ({ id, label: id, shape: 'rect', ...(parent ? { parent } : {}) }) as Node

function layoutOf(input: {
  nodes: Array<{ id: string; x: number; y: number; w?: number; h?: number; parent?: string }>
  subgraphs?: Array<{
    id: string
    x: number
    y: number
    w: number
    h: number
    parent?: string
  }>
}): ResolvedLayout {
  return {
    nodes: new Map(
      input.nodes.map((n) => [
        n.id,
        {
          ...mkNode(n.id, n.parent),
          position: { x: n.x, y: n.y },
          size: { width: n.w ?? 60, height: n.h ?? 40 },
        },
      ]),
    ),
    ports: new Map(),
    edges: new Map(),
    subgraphs: new Map(
      (input.subgraphs ?? []).map((s) => [
        s.id,
        {
          id: s.id,
          label: s.id,
          ...(s.parent ? { parent: s.parent } : {}),
          bounds: { x: s.x, y: s.y, width: s.w, height: s.h },
        },
      ]),
    ),
    bounds: { x: 0, y: 0, width: 1000, height: 1000 },
    metadata: { algorithm: 'test', duration: 0 },
  } as ResolvedLayout
}

describe('constraint registry', () => {
  test('every constraint id is unique and carries a level', () => {
    const ids = LAYOUT_CONSTRAINTS.map((s) => s.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const s of LAYOUT_CONSTRAINTS) {
      expect(['blocking', 'warn', 'score-only']).toContain(s.level)
    }
  })

  test('clean layout verifies ok', () => {
    const report = verifyLayoutConstraints(
      layoutOf({
        nodes: [
          { id: 'a', x: 100, y: 100, parent: 'g' },
          { id: 'b', x: 300, y: 100, parent: 'g' },
        ],
        subgraphs: [{ id: 'g', x: 0, y: 0, w: 500, h: 300 }],
      }),
    )
    expect(report.ok).toBe(true)
    expect(report.counts['node-overlap']).toBe(0)
    expect(report.counts.containment).toBe(0)
  })

  test('node overlap is a blocking violation and asserts throw under test env', () => {
    const layout = layoutOf({
      nodes: [
        { id: 'a', x: 100, y: 100 },
        { id: 'b', x: 110, y: 105 },
      ],
    })
    const report = verifyLayoutConstraints(layout)
    expect(report.counts['node-overlap']).toBe(1)
    expect(report.blockingViolations).toContain('node-overlap')
    expect(report.ok).toBe(false)
    expect(() => assertLayoutConstraints(layout, 'unit-test')).toThrow(/node-overlap/)
  })

  test('member outside its parent box is a blocking containment violation', () => {
    const report = verifyLayoutConstraints(
      layoutOf({
        nodes: [{ id: 'a', x: 900, y: 900, parent: 'g' }],
        subgraphs: [{ id: 'g', x: 0, y: 0, w: 200, h: 200 }],
      }),
    )
    expect(report.counts.containment).toBe(1)
    expect(report.blockingViolations).toContain('containment')
  })

  test('nested container boxes are legal; sibling overlap is reported (warn level)', () => {
    const nested = verifyLayoutConstraints(
      layoutOf({
        nodes: [],
        subgraphs: [
          { id: 'outer', x: 0, y: 0, w: 500, h: 500 },
          { id: 'inner', x: 50, y: 50, w: 100, h: 100, parent: 'outer' },
        ],
      }),
    )
    expect(nested.counts['container-overlap']).toBe(0)
    expect(nested.ok).toBe(true)

    const siblings = verifyLayoutConstraints(
      layoutOf({
        nodes: [],
        subgraphs: [
          { id: 'g1', x: 0, y: 0, w: 300, h: 300 },
          { id: 'g2', x: 200, y: 200, w: 300, h: 300 },
        ],
      }),
    )
    expect(siblings.counts['container-overlap']).toBe(1)
    // warn level: reported but NOT blocking (promotion tracked by #483)
    expect(siblings.blockingViolations).not.toContain('container-overlap')
    expect(siblings.ok).toBe(true)
  })
})

describe('findEdgeNodePiercing equals the O(n²) reference', () => {
  /** Deterministic PRNG (mulberry32). */
  function rng(seed: number): () => number {
    let s = seed
    return () => {
      s = (s + 0x6d2b79f5) | 0
      let t = Math.imul(s ^ (s >>> 15), 1 | s)
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
  }

  function referencePierce(
    lines: readonly PierceLineSpec[],
    boxes: readonly { id: string; x: number; y: number; width: number; height: number }[],
    inflate: number,
  ): string[] {
    const out: string[] = []
    for (const line of lines) {
      for (const box of boxes) {
        if (box.id === line.fromNodeId || box.id === line.toNodeId) continue
        const bx = box.x - box.width / 2 - inflate
        const by = box.y - box.height / 2 - inflate
        const bw = box.width + inflate * 2
        const bh = box.height + inflate * 2
        let hit = false
        for (let s = 1; s < line.points.length && !hit; s++) {
          const a = line.points[s - 1]
          const b = line.points[s]
          if (!a || !b) continue
          if (Math.max(a.x, b.x) < bx || Math.min(a.x, b.x) > bx + bw) continue
          if (Math.max(a.y, b.y) < by || Math.min(a.y, b.y) > by + bh) continue
          hit =
            segmentsIntersect(a, b, { x: bx, y: by }, { x: bx + bw, y: by }) ||
            segmentsIntersect(a, b, { x: bx, y: by + bh }, { x: bx + bw, y: by + bh }) ||
            segmentsIntersect(a, b, { x: bx, y: by }, { x: bx, y: by + bh }) ||
            segmentsIntersect(a, b, { x: bx + bw, y: by }, { x: bx + bw, y: by + bh })
        }
        if (hit) out.push(`${line.id}|${box.id}`)
      }
    }
    return out.sort()
  }

  test('random polylines vs random boxes', () => {
    const rand = rng(21)
    for (let round = 0; round < 5; round++) {
      const boxes = Array.from({ length: 60 }, (_, i) => ({
        id: `n${i}`,
        x: rand() * 2000,
        y: rand() * 1200,
        width: 40 + rand() * 100,
        height: 30 + rand() * 50,
      }))
      const lines: PierceLineSpec[] = Array.from({ length: 80 }, (_, i) => {
        const pts = [{ x: rand() * 2000, y: rand() * 1200 }]
        for (let s = 0; s < 3; s++) {
          const last = pts[pts.length - 1]
          if (!last) break
          pts.push(rand() < 0.5 ? { x: rand() * 2000, y: last.y } : { x: last.x, y: rand() * 1200 })
        }
        return {
          id: `e${i}`,
          points: pts,
          fromNodeId: `n${Math.floor(rand() * 60)}`,
          toNodeId: `n${Math.floor(rand() * 60)}`,
        }
      })
      const actual = findEdgeNodePiercing(lines, boxes, 2)
        .map((p) => `${p.edgeId}|${p.nodeId}`)
        .sort()
      expect(actual).toEqual(referencePierce(lines, boxes, 2))
    }
  })
})

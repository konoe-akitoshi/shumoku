// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { describe, expect, it } from 'vitest'
import type { Link, Node, Subgraph } from '../models/types.js'
import type { Structure } from '../structure/types.js'
import { drawingReport } from './drawing-report.js'
import type { Box, Point } from './metrics.js'
import type { Scene } from './scene.js'
import { testMetrics } from './testing.js'

const node = (id: string, parent?: string): Node => ({ id, label: id, ...(parent && { parent }) })
const group = (id: string, parent?: string): Subgraph => ({
  id,
  label: id,
  ...(parent && { parent }),
})
const link = (a: string, b: string): Link => ({
  from: { node: a, port: '' },
  to: { node: b, port: '' },
})
const box = (x: number, y: number, width: number, height: number): Box => ({ x, y, width, height })

const structure = (planes: Structure['planes']): Structure => ({
  nodes: {},
  candidates: [],
  boundary: [],
  planes,
})
const network = { nodes: [], links: [] }
const empty: Scene = {
  nodes: [],
  groups: [],
  wires: [],
  bounds: box(0, 0, 200, 100),
}
/** A wire drawn square-cornered, with no room of its own. */
const wire = (link: Link, points: Point[]): Scene['wires'][number] => ({
  link,
  points,
  radii: points.map(() => 0),
  stroke: 0,
  width: 0,
})

/** The size, crossings and flow of the report, flat. */
const sceneReport = (scene: Scene, context: { network: typeof network; structure: Structure }) => {
  const r = drawingReport(scene, { ...context, metrics: testMetrics })
  return { ...r.size, ...r.crossings, ...r.flow }
}

describe('the scene part of the drawing report', () => {
  it('gives the size and the aspect', () => {
    const r = sceneReport(empty, { network, structure: structure([]) })
    expect([r.width, r.height, r.aspect]).toEqual([200, 100, 2])
  })

  it('counts boxes that overlap, not boxes that touch', () => {
    const scene: Scene = {
      ...empty,
      nodes: [
        { node: node('a'), box: box(0, 0, 20, 20) },
        { node: node('b'), box: box(10, 10, 20, 20) },
        { node: node('c'), box: box(20, 0, 10, 10) },
      ],
    }
    expect(sceneReport(scene, { network, structure: structure([]) }).overlaps).toBe(1)
  })

  it('counts a line through the outline of a hull as through a node, unless it ends at a member', () => {
    const scene: Scene = {
      ...empty,
      nodes: [
        { node: node('a'), box: box(0, 0, 20, 20) },
        { node: node('b'), box: box(40, 0, 20, 20) },
      ],
      hulls: [{ members: ['a', 'b'], box: box(-5, -5, 70, 30), boxes: [], seams: [] }],
      wires: [
        wire(link('c', 'd'), [
          { x: 30, y: -20 },
          { x: 30, y: 40 },
        ]),
        wire(link('a', 'e'), [
          { x: 10, y: 0 },
          { x: 10, y: -40 },
        ]),
      ],
    }
    expect(sceneReport(scene, { network, structure: structure([]) }).throughNodes).toBe(1)
  })

  it('counts the crossings of two lines, not the lines that share an end', () => {
    const scene: Scene = {
      ...empty,
      wires: [
        wire(link('a', 'b'), [
          { x: 0, y: 0 },
          { x: 10, y: 10 },
        ]),
        wire(link('c', 'd'), [
          { x: 0, y: 10 },
          { x: 10, y: 0 },
        ]),
        wire(link('a', 'e'), [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
        ]),
      ],
    }
    const r = sceneReport(scene, { network, structure: structure([]) })
    expect(r.crossings).toBe(1)
    expect(r.bends).toBe(0)
    expect(r.wireLength).toBeCloseTo(Math.SQRT2 * 20 + 10)
  })

  it('counts a line through a box or a group it does not end at', () => {
    const scene: Scene = {
      ...empty,
      nodes: [
        { node: node('a'), box: box(0, 0, 10, 10) },
        { node: node('b'), box: box(90, 0, 10, 10) },
        { node: node('mid'), box: box(40, 0, 10, 10) },
        { node: node('in', 'g'), box: box(40, 40, 10, 10) },
      ],
      groups: [{ group: group('g'), box: box(30, 30, 40, 40) }],
      wires: [
        wire(link('a', 'b'), [
          { x: 10, y: 5 },
          { x: 90, y: 5 },
        ]),
        wire(link('a', 'b'), [
          { x: 10, y: 45 },
          { x: 90, y: 45 },
        ]),
      ],
    }
    const r = sceneReport(scene, { network, structure: structure([]) })
    expect(r.throughNodes).toBe(2)
    expect(r.throughGroups).toBe(1)
  })

  it('does not count a line that only runs along an edge', () => {
    const scene: Scene = {
      ...empty,
      nodes: [{ node: node('m'), box: box(40, 0, 10, 10) }],
      wires: [
        wire(link('a', 'b'), [
          { x: 0, y: 0 },
          { x: 100, y: 0 },
        ]),
      ],
    }
    expect(sceneReport(scene, { network, structure: structure([]) }).throughNodes).toBe(0)
  })

  it('finds boxes outside their group and inside one that is not theirs', () => {
    const scene: Scene = {
      ...empty,
      nodes: [
        { node: node('in', 'g'), box: box(5, 5, 10, 10) },
        { node: node('out', 'g'), box: box(80, 5, 10, 10) },
        { node: node('stray'), box: box(8, 8, 4, 4) },
      ],
      groups: [{ group: group('g'), box: box(0, 0, 50, 50) }],
    }
    const r = sceneReport(scene, { network, structure: structure([]) })
    expect(r.outside).toBe(1)
    expect(r.intrusions).toBe(1)
    expect(r.fill.groups).toEqual([{ id: 'g', fill: 200 / 2500 }])
  })

  it('reads the flows and the level pairs from the structure', () => {
    const scene: Scene = {
      ...empty,
      nodes: [
        { node: node('a'), box: box(0, 0, 10, 10) },
        { node: node('b'), box: box(0, 40, 10, 10) },
        { node: node('c'), box: box(40, 0, 10, 10) },
        { node: node('d'), box: box(40, 3, 10, 10) },
      ],
    }
    const s = structure([
      {
        plane: 'default',
        side: 'physical',
        flows: [
          [{ unit: 'a' }, { unit: 'b' }],
          [{ unit: 'b' }, { unit: 'a' }],
        ],
        even: [[{ unit: 'c' }, { unit: 'd' }]],
      },
      { plane: 'default', side: 'virtual', flows: [[{ unit: 'a' }, { unit: 'b' }]], even: [] },
    ])
    const r = sceneReport(scene, { network, structure: s })
    expect(r.flowViolations).toBe(2)
    expect(r.even).toEqual({ pairs: 1, apart: 1, worst: 3 })
  })
})

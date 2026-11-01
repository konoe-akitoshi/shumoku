// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { describe, expect, it } from 'vitest'
import type { Link, Node } from '../models/types.js'
import type { Box, Point } from './metrics.js'
import type { Scene } from './scene.js'
import { testMetrics, wiringOf } from './testing.js'

const node = (id: string): Node => ({ id, label: id })
const link = (a: string, b: string, port = ''): Link => ({
  from: { node: a, port },
  to: { node: b, port: '' },
})
const box = (x: number, y: number, width: number, height: number): Box => ({ x, y, width, height })
/** A wire with no room of its own unless it is given one. */
type Wire = Omit<Scene['wires'][number], 'stroke' | 'width'>
const scene = (wires: Wire[], nodes: Scene['nodes'] = [], ports?: Scene['ports']): Scene => ({
  nodes,
  groups: [],
  wires: wires.map((w) => ({ stroke: 0, width: 0, ...w })),
  ...(ports && { ports }),
  bounds: box(0, 0, 200, 100),
})

/** pitch 4 and leadOut 10: a run alone in a gap asks for 20. */
const between = (room: number, ys: number[] = [0], ported = true) => {
  const top = box(0, 0, 100, 10)
  const bottom = box(0, 10 + room, 100, 10)
  const wires: Wire[] = ys.map((dy, i) => {
    const y = 10 + dy
    const points: Point[] = [
      { x: 5 + i, y: -20 },
      { x: 5 + i, y },
      { x: 95 - i, y },
      { x: 95 - i, y: 100 },
    ]
    return { link: link(`a${i}`, `b${i}`), points }
  })
  const ports: Scene['ports'] = ported
    ? [
        { id: 'top/1', nodeId: 'top', at: { x: 5, y: 10 }, side: 'bottom' },
        { id: 'bottom/1', nodeId: 'bottom', at: { x: 5, y: 10 + room }, side: 'top' },
      ]
    : []
  return scene(
    wires,
    [
      { node: node('top'), box: top },
      { node: node('bottom'), box: bottom },
    ],
    ports,
  )
}

describe('the wiring part of the drawing report', () => {
  it('compares the room between boxes with what one run asks for', () => {
    const at = (room: number) => wiringOf(between(room), testMetrics).gap.horizontalRuns
    expect(at(20).median).toBeCloseTo(1)
    expect(at(20).below).toBe(0)
    expect(at(10)).toMatchObject({ median: 0.5, below: 1 })
    expect(at(40)).toMatchObject({ median: 2, below: 0 })
  })

  it('keeps a pitch, not a lead-out, from a side of a box that has no port', () => {
    const r = wiringOf(between(8, [0], false), testMetrics).gap.horizontalRuns
    expect(r.min).toBeCloseTo(1)
    expect(r.below).toBe(0)
  })

  it('asks for a pitch more for each run that is in the room at the same time', () => {
    const r = wiringOf(between(24, [8, 12]), testMetrics).gap.horizontalRuns
    expect(r.runs).toBe(2)
    expect(r.min).toBeCloseTo(1)
  })

  it('counts runs at one coordinate once', () => {
    const r = wiringOf(between(24, [8, 8]), testMetrics).gap.horizontalRuns
    expect(r.min).toBeCloseTo(24 / 20)
  })

  it('leaves out a run with no box to one side', () => {
    const open = scene([
      {
        link: link('a', 'b'),
        points: [
          { x: 0, y: 0 },
          { x: 0, y: 30 },
          { x: 50, y: 30 },
          { x: 50, y: 60 },
        ],
      },
    ])
    expect(wiringOf(open, testMetrics).gap.horizontalRuns.runs).toBe(0)
  })

  it('finds segments of different lines that run closer than a pitch or on top of each other', () => {
    const run = (y: number, from = 0): Wire => ({
      link: link('a', 'b'),
      ...testMetrics.line(link('a', 'b')),
      points: [
        { x: from, y },
        { x: from + 50, y },
      ],
    })
    const r = (...wires: Wire[]) => wiringOf(scene(wires), testMetrics).parallel
    expect(r(run(0), run(2))).toEqual({ near: 1, overlapping: 0 })
    expect(r(run(0), run(0))).toEqual({ near: 0, overlapping: 1 })
    // twins keep the ground of both, 4 and 4
    expect(r(run(0), run(7))).toEqual({ near: 1, overlapping: 0 })
    expect(r(run(0), run(8))).toEqual({ near: 0, overlapping: 0 })
    expect(r(run(0), run(0, 50))).toEqual({ near: 0, overlapping: 0 })
  })

  it('counts the ends of lines, sharing a port with one name', () => {
    const wires: Wire[] = [
      { link: link('a', 'b', 'p1'), points: [] },
      { link: link('a', 'c', 'p1'), points: [] },
      { link: link('a', 'd'), points: [] },
    ]
    expect(wiringOf(scene(wires), testMetrics).ports).toEqual({ drawn: 0, ends: 5 })
  })

  it('counts the crossings right after the ports of one side of a box, and the lines that go against the flow', () => {
    const port = (id: string, nodeId: string, x: number, y: number, side: 'top' | 'bottom') => ({
      id,
      nodeId,
      at: { x, y },
      side,
    })
    // two lines leave the bottom of `u` and cross each other in the fan; one goes up before down
    const wires: Wire[] = [
      {
        link: link('u', 'p'),
        points: [
          { x: 10, y: 0 },
          { x: 10, y: 3 },
          { x: 40, y: 3 },
          { x: 40, y: 50 },
        ],
      },
      {
        link: link('u', 'q'),
        points: [
          { x: 20, y: 0 },
          { x: 20, y: 5 },
          { x: 5, y: 5 },
          { x: 5, y: 50 },
        ],
      },
      {
        link: link('u', 'r'),
        points: [
          { x: 30, y: 0 },
          { x: 30, y: 5 },
          { x: 60, y: 5 },
          { x: 60, y: -10 },
          { x: 70, y: -10 },
          { x: 70, y: 50 },
        ],
      },
    ]
    const ports = [
      port('u/1', 'u', 10, 0, 'bottom'),
      port('u/2', 'u', 20, 0, 'bottom'),
      port('u/3', 'u', 30, 0, 'bottom'),
      port('p/1', 'p', 40, 50, 'top'),
      port('q/1', 'q', 5, 50, 'top'),
      port('r/1', 'r', 70, 50, 'top'),
    ]
    const r = wiringOf(scene(wires, [], ports), testMetrics)
    expect(r.portCrossings.total).toBe(3)
    expect(r.reversals.plain).toBe(1)
    expect(r.reversals.examples[0]?.at).toEqual({ x: 60, y: -10 })
  })

  it('finds segments off the 0, 45 and 90 degree directions and corners that turn back', () => {
    const wires: Wire[] = [
      {
        link: link('a', 'b'),
        points: [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
          { x: 20, y: 10 },
          { x: 20, y: 20 },
          { x: 10, y: 25 },
          { x: 15, y: 25 },
        ],
      },
    ]
    const r = wiringOf(scene(wires), testMetrics)
    expect(r.offAxis).toBe(1)
    expect(r.sharp).toBe(1)
  })
})

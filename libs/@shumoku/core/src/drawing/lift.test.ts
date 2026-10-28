// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { describe, expect, it } from 'vitest'
import { liftFlows, type Stackable } from './lift.js'
import { frameKey, ROOT } from './problem.js'
import { problemOf } from './testing.js'

const groups = (ids: string[]) => `groups: [${ids.map((id) => `{ id: ${id} }`).join(', ')}]`
const link = (a: string, b: string, extra = '') =>
  `  - { endpoints: [{ node: ${a} }, { node: ${b} }]${extra} }`

const net = (nodes: string[], links: string[], gs: string[] = ['ga', 'gb', 'gc']) =>
  `${groups(gs)}\nnodes:\n${nodes.join('\n')}\nlinks:\n${links.join('\n')}\n`

const root = (stackables: Stackable[]) => {
  const s = stackables.find((x) => x.frame === ROOT)
  if (!s) throw new Error('no root')
  return s
}
const pair = (s: Stackable, upper: string, lower: string) =>
  s.pairs.some((p) => p.upper === frameKey(upper) && p.lower === frameKey(lower))

const fan = net(
  ['  - { id: top, group: ga }', '  - { id: b1, group: gb }', '  - { id: c1, group: gc }'],
  [link('top', 'b1'), link('top', 'c1')],
)

describe('liftFlows', () => {
  it('stacks what is downstream under what is upstream, and nothing the flows do not relate', () => {
    const s = root(liftFlows(problemOf(fan, ['top'])))
    expect(pair(s, 'ga', 'gb')).toBe(true)
    expect(pair(s, 'ga', 'gc')).toBe(true)
    expect(pair(s, 'gb', 'gc')).toBe(false)
    expect(pair(s, 'gc', 'gb')).toBe(false)
    expect(pair(s, 'gb', 'ga')).toBe(false)
  })

  it('also stacks across a middle sibling, by the flow that runs through it', () => {
    const chain = net(
      ['  - { id: top, group: ga }', '  - { id: b1, group: gb }', '  - { id: c1, group: gc }'],
      [link('top', 'b1'), link('b1', 'c1')],
    )
    const s = root(liftFlows(problemOf(chain, ['top'])))
    expect(pair(s, 'ga', 'gc')).toBe(true)
    expect(s.layers.get(frameKey('gc'))).toBe(2)
    const p = s.pairs.find((x) => x.upper === frameKey('ga') && x.lower === frameKey('gc'))
    expect([p?.from, p?.to]).toEqual([0, 2])
  })

  it('does not stack siblings that are each upstream of the other', () => {
    const loop = net(
      [
        '  - { id: top, group: ga }',
        '  - { id: b1, group: gb }',
        '  - { id: x, group: ga }',
        '  - { id: c1, group: gc }',
      ],
      [link('top', 'b1'), link('b1', 'x'), link('x', 'c1')],
    )
    const s = root(liftFlows(problemOf(loop, ['top'])))
    expect(pair(s, 'ga', 'gb')).toBe(false)
    expect(pair(s, 'gb', 'ga')).toBe(false)
    expect(pair(s, 'ga', 'gc')).toBe(true)
    expect(pair(s, 'gb', 'gc')).toBe(true)
  })

  it('does not take a pair at one level, or a line over the drawing, as a flow', () => {
    const level = net(
      ['  - { id: top, group: ga }', '  - { id: b1, group: gb }', '  - { id: c1, group: gc }'],
      [
        link('top', 'b1'),
        link('top', 'c1'),
        link('b1', 'c1'),
        link('b1', 'top', ', virtual: true'),
      ],
    )
    const p = problemOf(level, ['top'])
    expect(p.level).toEqual([{ a: 'b1', b: 'c1' }])
    const s = root(liftFlows(p))
    expect(pair(s, 'gb', 'gc')).toBe(false)
    expect(pair(s, 'gc', 'gb')).toBe(false)
    expect(pair(s, 'gb', 'ga')).toBe(false)
  })

  it('lifts a flow from inside a frame to the siblings of that frame, at each depth', () => {
    const nested = `groups:
  - { id: ga, groups: [{ id: gaa }] }
  - { id: gb }
nodes:
  - { id: top, group: ga }
  - { id: x, group: gaa }
  - { id: b1, group: gb }
links:
${[link('top', 'x'), link('x', 'b1')].join('\n')}
`
    const all = liftFlows(problemOf(nested, ['top']))
    expect(pair(root(all), 'ga', 'gb')).toBe(true)
    const inner = all.find((s) => s.frame === 'ga')
    expect(inner?.pairs.some((p) => p.upper === 'top' && p.lower === frameKey('gaa'))).toBe(true)
  })

  it('gives the same answer however the network is written', () => {
    const flipped = net(
      ['  - { id: c1, group: gc }', '  - { id: b1, group: gb }', '  - { id: top, group: ga }'],
      [link('top', 'c1'), link('top', 'b1')],
      ['gc', 'gb', 'ga'],
    )
    expect(liftFlows(problemOf(flipped, ['top']))).toEqual(liftFlows(problemOf(fan, ['top'])))
  })
})

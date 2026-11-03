// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { describe, expect, it } from 'vitest'
import { layoutDrawing } from './layout.js'
import { networkOf, testMetrics, wiringOf } from './testing.js'

const EPS = 1e-6

const yaml = `
name: t
routingDomains: [{ id: wan }]
nodes:
  - { id: edge, type: router }
  - { id: sw1 }
  - { id: sw2 }
  - { id: ap1 }
segments: [{ id: lan }]
links:
  - { endpoints: [{ routingDomain: wan }, { node: edge, port: wan0 }] }
  - { endpoints: [{ node: edge, port: ge0 }, { node: sw1 }] }
  - { endpoints: [{ node: edge, port: ge0 }, { node: sw2 }] }
  - { endpoints: [{ node: edge }, { segment: lan }] }
  - { endpoints: [{ segment: lan }, { node: ap1 }] }
`

describe('ports', () => {
  const { network, structure } = networkOf(yaml, ['wan'])
  const scene = layoutDrawing(network, structure, testMetrics)
  const ports = scene.ports ?? []
  const box = (id: string) => scene.nodes.find((n) => n.node.id === id)?.box

  it('stands one at every end of every line, a name or not', () => {
    // wan0 once, ge0 once for two lines, and an unnamed port for every other end
    expect(ports).toHaveLength(2 + (2 * network.links.length - 3))
    expect(wiringOf(scene, testMetrics).ports.drawn).toBe(wiringOf(scene, testMetrics).ports.ends)
  })

  it('writes a name beside the ports that have one and nothing beside the others', () => {
    expect(ports.filter((p) => p.label !== undefined).map((p) => p.id)).toEqual(
      expect.arrayContaining(['edge/wan0', 'edge/ge0']),
    )
    expect(ports.filter((p) => p.label !== undefined)).toHaveLength(2)
    for (const p of ports.filter((p) => p.label === undefined)) expect(p.id).toContain('#link:')
  })

  it('shares one point between the lines that come to one named port', () => {
    const ge0 = ports.filter((p) => p.id === 'edge/ge0')
    expect(ge0).toHaveLength(1)
    const at = ge0[0]?.at
    const starts = scene.wires.filter((w) => w.link.from.port === 'ge0').map((w) => w.points[0])
    expect(starts).toHaveLength(2)
    for (const s of starts) expect(s).toEqual(at)
  })

  it('starts and ends every line at a port of its own boxes', () => {
    for (const w of scene.wires) {
      const first = w.points[0]
      const last = w.points.at(-1)
      expect(
        ports.some(
          (p) => p.nodeId === w.link.from.node && p.at.x === first?.x && p.at.y === first?.y,
        ),
      ).toBe(true)
      expect(
        ports.some((p) => p.nodeId === w.link.to.node && p.at.x === last?.x && p.at.y === last?.y),
      ).toBe(true)
    }
  })

  it('stands every port on an edge of its box, a slot from the next on that edge', () => {
    for (const p of ports) {
      const b = box(p.nodeId)
      if (!b) continue
      const onEdge =
        (p.side === 'top' && Math.abs(p.at.y - b.y) < EPS) ||
        (p.side === 'bottom' && Math.abs(p.at.y - (b.y + b.height)) < EPS) ||
        (p.side === 'left' && Math.abs(p.at.x - b.x) < EPS) ||
        (p.side === 'right' && Math.abs(p.at.x - (b.x + b.width)) < EPS)
      expect(onEdge).toBe(true)
      for (const q of ports) {
        if (q === p || q.nodeId !== p.nodeId || q.side !== p.side) continue
        const d = Math.hypot(p.at.x - q.at.x, p.at.y - q.at.y)
        expect(d).toBeGreaterThanOrEqual(testMetrics.portSlot([]) - EPS)
      }
    }
  })
})

describe('a card that the lines between equals leave by its sides', () => {
  // a and b are each one cable from top, so they are level, and three cables run between them
  const yaml = `
nodes:
  - { id: top }
  - { id: a }
  - { id: b }
links:
  - { endpoints: [{ node: top }, { node: a }] }
  - { endpoints: [{ node: top }, { node: b }] }
  - { endpoints: [{ node: a, port: p1 }, { node: b, port: q1 }] }
  - { endpoints: [{ node: a, port: p2 }, { node: b, port: q2 }] }
  - { endpoints: [{ node: a, port: p3 }, { node: b, port: q3 }] }
`
  const { network, structure } = networkOf(yaml, ['top'])
  const scene = layoutDrawing(network, structure, testMetrics)
  const box = (id: string) => scene.nodes.find((n) => n.node.id === id)?.box

  it('is high enough for a slot for each of those ports, and a slot more', () => {
    const slot = testMetrics.portSlot([])
    const sides = (scene.ports ?? []).filter((p) => p.side === 'left' || p.side === 'right')
    expect(sides.length).toBeGreaterThan(0)
    for (const id of ['a', 'b']) {
      const n = sides.filter(
        (p) => p.nodeId === id && p.side === (id === 'a' ? 'right' : 'left'),
      ).length
      expect(box(id)?.height ?? 0).toBeGreaterThanOrEqual((n + 1) * slot - EPS)
    }
  })

  it('keeps those ports a slot from each other and from the corners', () => {
    const slot = testMetrics.portSlot([])
    for (const id of ['a', 'b']) {
      const b = box(id)
      const ys = (scene.ports ?? [])
        .filter((p) => p.nodeId === id && (p.side === 'left' || p.side === 'right'))
        .map((p) => p.at.y)
        .sort((p, q) => p - q)
      for (const [i, y] of ys.entries()) {
        const next = ys[i + 1]
        if (next !== undefined) expect(next - y).toBeGreaterThanOrEqual(slot - EPS)
        if (b) {
          expect(y).toBeGreaterThanOrEqual(b.y + slot / 2 - EPS)
          expect(y).toBeLessThanOrEqual(b.y + b.height - slot / 2 + EPS)
        }
      }
    }
  })
})

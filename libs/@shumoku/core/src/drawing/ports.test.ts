// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { describe, expect, it } from 'vitest'
import { layoutDrawing } from './layout.js'
import { networkOf, testMetrics } from './testing.js'
import { wiringReport } from './wiring-report.js'

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
    expect(wiringReport(scene, testMetrics).ports.drawn).toBe(
      wiringReport(scene, testMetrics).ports.ends,
    )
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

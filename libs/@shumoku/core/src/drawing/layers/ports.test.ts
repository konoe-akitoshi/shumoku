// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { describe, expect, it } from 'vitest'
import { readNetworkModel } from '../../models/network-model-graph.js'
import { drawNetwork } from '../draw.js'
import { testMetrics } from '../testing/support.js'

describe('two lines between the same two boxes', () => {
  it('stand in one order at both ends, so they do not cross', () => {
    // by name the switch's ports go Ethernet12, Ethernet2 and the access point's Ethernet1, eth0:
    // ordered by their own names the two ends disagree
    const scene = drawNetwork(
      readNetworkModel(`
nodes:
  - { id: sw, type: l2-switch }
  - { id: ap, type: access-point }
links:
  - endpoints: [{ node: sw, port: Ethernet2 }, { node: ap, port: Ethernet1 }]
  - endpoints: [{ node: sw, port: Ethernet12 }, { node: ap, port: eth0 }]
`),
      { metrics: () => testMetrics },
    )
    expect(scene.wires).toHaveLength(2)
    for (const w of scene.wires) {
      const xs = w.points.map((p) => p.x)
      for (const x of xs) expect(x).toBeCloseTo(xs[0] ?? Number.NaN, 6)
    }
  })
})

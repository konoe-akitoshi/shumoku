// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it } from 'vitest'
import type { NetworkGraph, Subgraph } from '../models/types.js'
import {
  absenceImpliesRetraction,
  computeEffectivePolicy,
  effectivePolicyForNode,
  isExcluded,
} from './discovery-policy.js'

function sg(
  id: string,
  parent: string | undefined,
  discovery: Subgraph['discovery'],
): [string, Pick<Subgraph, 'parent' | 'discovery'>] {
  return [id, { parent, discovery }]
}

describe('computeEffectivePolicy', () => {
  it('falls back to runtime defaults when nothing is supplied', () => {
    const e = computeEffectivePolicy({ node: {} })
    expect(e.mode).toBe('auto')
    expect(e.intervalMs).toBe(30 * 60 * 1000)
    expect(e.source.mode).toBe('default')
    expect(e.source.intervalMs).toBe('default')
  })

  it('uses topology default when node and subgraph are silent', () => {
    const e = computeEffectivePolicy({
      node: {},
      topologyDefault: { mode: 'observe', intervalMs: 600_000 },
    })
    expect(e.mode).toBe('observe')
    expect(e.intervalMs).toBe(600_000)
    expect(e.source.mode).toBe('topology')
    expect(e.source.intervalMs).toBe('topology')
  })

  it('subgraph beats topology default', () => {
    const subgraphs = new Map([sg('prod', undefined, { mode: 'auto', intervalMs: 60_000 })])
    const e = computeEffectivePolicy({
      node: { parent: 'prod' },
      subgraphs,
      topologyDefault: { mode: 'observe', intervalMs: 600_000 },
    })
    expect(e.mode).toBe('auto')
    expect(e.intervalMs).toBe(60_000)
    expect(e.source.mode).toBe('subgraph')
    expect(e.source.intervalMs).toBe('subgraph')
  })

  it('node override beats subgraph and topology', () => {
    const subgraphs = new Map([sg('prod', undefined, { mode: 'auto', intervalMs: 60_000 })])
    const e = computeEffectivePolicy({
      node: { parent: 'prod', discovery: { mode: 'disabled' } },
      subgraphs,
      topologyDefault: { mode: 'observe', intervalMs: 600_000 },
    })
    expect(e.mode).toBe('disabled')
    expect(e.source.mode).toBe('node')
    // intervalMs not overridden by node — comes from subgraph.
    expect(e.intervalMs).toBe(60_000)
    expect(e.source.intervalMs).toBe('subgraph')
  })

  it('nested subgraphs: nearest ancestor wins', () => {
    const subgraphs = new Map([
      sg('prod', undefined, { mode: 'auto', intervalMs: 600_000 }),
      sg('prod-core', 'prod', { intervalMs: 60_000 }),
    ])
    const e = computeEffectivePolicy({
      node: { parent: 'prod-core' },
      subgraphs,
    })
    // intervalMs comes from the nearest ancestor (prod-core, 60s)…
    expect(e.intervalMs).toBe(60_000)
    expect(e.source.intervalMs).toBe('subgraph')
    // …but mode falls through to the further ancestor (prod, 'auto').
    expect(e.mode).toBe('auto')
    expect(e.source.mode).toBe('subgraph')
  })

  it('per-field merge — node sets only mode, subgraph supplies interval', () => {
    const subgraphs = new Map([sg('lab', undefined, { intervalMs: 5 * 60_000 })])
    const e = computeEffectivePolicy({
      node: { parent: 'lab', discovery: { mode: 'observe' } },
      subgraphs,
    })
    expect(e.mode).toBe('observe')
    expect(e.source.mode).toBe('node')
    expect(e.intervalMs).toBe(5 * 60_000)
    expect(e.source.intervalMs).toBe('subgraph')
  })

  it('survives a self-referencing subgraph chain without looping', () => {
    const subgraphs = new Map([sg('loop', 'loop', { mode: 'disabled' })])
    const e = computeEffectivePolicy({ node: { parent: 'loop' }, subgraphs })
    expect(e.mode).toBe('disabled')
  })

  it('survives a missing subgraph parent gracefully', () => {
    const e = computeEffectivePolicy({
      node: { parent: 'ghost' },
      subgraphs: new Map(),
      topologyDefault: { mode: 'disabled' },
    })
    expect(e.mode).toBe('disabled')
    expect(e.source.mode).toBe('topology')
  })
})

describe('isExcluded', () => {
  it('excludes disabled', () => {
    expect(
      isExcluded({
        mode: 'disabled',
        intervalMs: 0,
        source: { mode: 'default', intervalMs: 'default' },
      }),
    ).toBe(true)
  })
  it('does not exclude auto / observe', () => {
    expect(
      isExcluded({
        mode: 'auto',
        intervalMs: 0,
        source: { mode: 'default', intervalMs: 'default' },
      }),
    ).toBe(false)
    expect(
      isExcluded({
        mode: 'observe',
        intervalMs: 0,
        source: { mode: 'default', intervalMs: 'default' },
      }),
    ).toBe(false)
  })
})

describe('effectivePolicyForNode (NetworkGraph context)', () => {
  // Realistic-ish graph: nested subgraphs + topology default.
  // tun-gw01 sits in `prod-core` which sits in `prod`.
  const graph: Pick<NetworkGraph, 'subgraphs' | 'discovery'> = {
    discovery: { mode: 'observe', intervalMs: 600_000 },
    subgraphs: [
      { id: 'prod', label: 'Production', discovery: { mode: 'auto' } },
      { id: 'prod-core', label: 'Core', parent: 'prod', discovery: { intervalMs: 60_000 } },
      { id: 'lab', label: 'Lab', discovery: { mode: 'disabled' } },
    ],
  }

  it(`walks the graph's subgraphs and resolves nearest-ancestor + topology default`, () => {
    const e = effectivePolicyForNode(graph, { parent: 'prod-core' })
    expect(e.mode).toBe('auto') // from `prod`, since `prod-core` only sets intervalMs
    expect(e.intervalMs).toBe(60_000) // from `prod-core` (nearest)
  })

  it('node override beats the subgraph chain', () => {
    const e = effectivePolicyForNode(graph, {
      parent: 'prod-core',
      discovery: { mode: 'disabled' },
    })
    expect(e.mode).toBe('disabled')
    expect(e.source.mode).toBe('node')
  })

  it('falls back to topology default for a node outside any subgraph', () => {
    const e = effectivePolicyForNode(graph, {})
    expect(e.mode).toBe('observe')
    expect(e.intervalMs).toBe(600_000)
    expect(e.source.mode).toBe('topology')
  })

  it('lab subgraph propagates disabled to its descendants', () => {
    const e = effectivePolicyForNode(graph, { parent: 'lab' })
    expect(e.mode).toBe('disabled')
    // intervalMs not set in `lab` or in topology default for the lab path
    // → falls through to topology 's intervalMs.
    expect(e.intervalMs).toBe(600_000)
    expect(e.source.intervalMs).toBe('topology')
  })

  it('handles a graph with no subgraphs at all', () => {
    const e = effectivePolicyForNode({ discovery: { mode: 'auto' } }, {})
    expect(e.mode).toBe('auto')
    expect(e.source.mode).toBe('topology')
  })
})

describe('absenceImpliesRetraction', () => {
  it('absence is meaningful for auto / observe', () => {
    expect(
      absenceImpliesRetraction({
        mode: 'auto',
        intervalMs: 0,
        source: { mode: 'default', intervalMs: 'default' },
      }),
    ).toBe(true)
    expect(
      absenceImpliesRetraction({
        mode: 'observe',
        intervalMs: 0,
        source: { mode: 'default', intervalMs: 'default' },
      }),
    ).toBe(true)
  })
  it('absence is meaningless for disabled', () => {
    expect(
      absenceImpliesRetraction({
        mode: 'disabled',
        intervalMs: 0,
        source: { mode: 'default', intervalMs: 'default' },
      }),
    ).toBe(false)
  })
})

// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it } from 'vitest'
import type { Subgraph } from '../models/types.js'
import { absenceImpliesRetraction, computeEffectivePolicy, isExcluded } from './discovery-policy.js'

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
      node: { parent: 'prod', discovery: { mode: 'manual-only' } },
      subgraphs,
      topologyDefault: { mode: 'observe', intervalMs: 600_000 },
    })
    expect(e.mode).toBe('manual-only')
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
      topologyDefault: { mode: 'manual-only' },
    })
    expect(e.mode).toBe('manual-only')
    expect(e.source.mode).toBe('topology')
  })
})

describe('isExcluded', () => {
  it('excludes manual-only and disabled', () => {
    expect(
      isExcluded({
        mode: 'manual-only',
        intervalMs: 0,
        source: { mode: 'default', intervalMs: 'default' },
      }),
    ).toBe(true)
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
  it('absence is meaningless for manual-only / disabled', () => {
    expect(
      absenceImpliesRetraction({
        mode: 'manual-only',
        intervalMs: 0,
        source: { mode: 'default', intervalMs: 'default' },
      }),
    ).toBe(false)
    expect(
      absenceImpliesRetraction({
        mode: 'disabled',
        intervalMs: 0,
        source: { mode: 'default', intervalMs: 'default' },
      }),
    ).toBe(false)
  })
})

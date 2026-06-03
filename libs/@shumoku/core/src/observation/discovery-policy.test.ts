// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it } from 'vitest'
import type { Attachment, NetworkGraph, Subgraph } from '../models/types.js'
import {
  absenceImpliesRetraction,
  computeEffectivePolicy,
  effectivePolicyForNode,
  isExcluded,
} from './discovery-policy.js'

/** One-element policy-attachment list (omit a field to leave it inherited). */
function pol(mode?: 'auto' | 'observe' | 'disabled', intervalMs?: number): Attachment[] {
  return [
    {
      kind: 'policy',
      ...(mode !== undefined ? { mode } : {}),
      ...(intervalMs !== undefined ? { intervalMs } : {}),
    },
  ]
}

/** One-element access:snmp attachment list. */
function snmp(community: string): Attachment[] {
  return [{ kind: 'access', protocol: 'snmp', community }]
}

function sg(
  id: string,
  parent: string | undefined,
  attachments: Attachment[],
): [string, Pick<Subgraph, 'parent' | 'attachments'>] {
  return [id, { parent, attachments }]
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
    const e = computeEffectivePolicy({ node: {}, topologyDefault: pol('observe', 600_000) })
    expect(e.mode).toBe('observe')
    expect(e.intervalMs).toBe(600_000)
    expect(e.source.mode).toBe('topology')
    expect(e.source.intervalMs).toBe('topology')
  })

  it('subgraph beats topology default', () => {
    const subgraphs = new Map([sg('prod', undefined, pol('auto', 60_000))])
    const e = computeEffectivePolicy({
      node: { parent: 'prod' },
      subgraphs,
      topologyDefault: pol('observe', 600_000),
    })
    expect(e.mode).toBe('auto')
    expect(e.intervalMs).toBe(60_000)
    expect(e.source.mode).toBe('subgraph')
    expect(e.source.intervalMs).toBe('subgraph')
  })

  it('node override beats subgraph and topology', () => {
    const subgraphs = new Map([sg('prod', undefined, pol('auto', 60_000))])
    const e = computeEffectivePolicy({
      node: { parent: 'prod', attachments: pol('disabled') },
      subgraphs,
      topologyDefault: pol('observe', 600_000),
    })
    expect(e.mode).toBe('disabled')
    expect(e.source.mode).toBe('node')
    // intervalMs not overridden by node — comes from subgraph.
    expect(e.intervalMs).toBe(60_000)
    expect(e.source.intervalMs).toBe('subgraph')
  })

  it('nested subgraphs: nearest ancestor wins', () => {
    const subgraphs = new Map([
      sg('prod', undefined, pol('auto', 600_000)),
      sg('prod-core', 'prod', pol(undefined, 60_000)),
    ])
    const e = computeEffectivePolicy({ node: { parent: 'prod-core' }, subgraphs })
    expect(e.intervalMs).toBe(60_000)
    expect(e.source.intervalMs).toBe('subgraph')
    expect(e.mode).toBe('auto')
    expect(e.source.mode).toBe('subgraph')
  })

  it('per-field merge — node sets only mode, subgraph supplies interval', () => {
    const subgraphs = new Map([sg('lab', undefined, pol(undefined, 5 * 60_000))])
    const e = computeEffectivePolicy({
      node: { parent: 'lab', attachments: pol('observe') },
      subgraphs,
    })
    expect(e.mode).toBe('observe')
    expect(e.source.mode).toBe('node')
    expect(e.intervalMs).toBe(5 * 60_000)
    expect(e.source.intervalMs).toBe('subgraph')
  })

  it('survives a self-referencing subgraph chain without looping', () => {
    const subgraphs = new Map([sg('loop', 'loop', pol('disabled'))])
    const e = computeEffectivePolicy({ node: { parent: 'loop' }, subgraphs })
    expect(e.mode).toBe('disabled')
  })

  it('survives a missing subgraph parent gracefully', () => {
    const e = computeEffectivePolicy({
      node: { parent: 'ghost' },
      subgraphs: new Map(),
      topologyDefault: pol('disabled'),
    })
    expect(e.mode).toBe('disabled')
    expect(e.source.mode).toBe('topology')
  })

  it('resolves SNMP community from an access attachment, inherited from subgraph', () => {
    const subgraphs = new Map([sg('mgmt', undefined, snmp('as38649'))])
    const e = computeEffectivePolicy({ node: { parent: 'mgmt' }, subgraphs })
    expect(e.community).toBe('as38649')
    expect(e.source.community).toBe('subgraph')
  })

  it('node access attachment overrides inherited community', () => {
    const subgraphs = new Map([sg('mgmt', undefined, snmp('as38649'))])
    const e = computeEffectivePolicy({
      node: { parent: 'mgmt', attachments: snmp('smys-itc') },
      subgraphs,
    })
    expect(e.community).toBe('smys-itc')
    expect(e.source.community).toBe('node')
  })
})

describe('isExcluded', () => {
  it('excludes disabled', () => {
    expect(
      isExcluded({
        mode: 'disabled',
        intervalMs: 0,
        source: { mode: 'default', intervalMs: 'default', community: 'default' },
      }),
    ).toBe(true)
  })
  it('does not exclude auto / observe', () => {
    expect(
      isExcluded({
        mode: 'auto',
        intervalMs: 0,
        source: { mode: 'default', intervalMs: 'default', community: 'default' },
      }),
    ).toBe(false)
    expect(
      isExcluded({
        mode: 'observe',
        intervalMs: 0,
        source: { mode: 'default', intervalMs: 'default', community: 'default' },
      }),
    ).toBe(false)
  })
})

describe('effectivePolicyForNode (NetworkGraph context)', () => {
  // Realistic-ish graph: nested subgraphs + topology default.
  // tun-gw01 sits in `prod-core` which sits in `prod`.
  const graph: Pick<NetworkGraph, 'subgraphs' | 'attachments'> = {
    attachments: pol('observe', 600_000),
    subgraphs: [
      { id: 'prod', label: 'Production', attachments: pol('auto') },
      { id: 'prod-core', label: 'Core', parent: 'prod', attachments: pol(undefined, 60_000) },
      { id: 'lab', label: 'Lab', attachments: pol('disabled') },
    ],
  }

  it(`walks the graph's subgraphs and resolves nearest-ancestor + topology default`, () => {
    const e = effectivePolicyForNode(graph, { parent: 'prod-core' })
    expect(e.mode).toBe('auto') // from `prod`, since `prod-core` only sets intervalMs
    expect(e.intervalMs).toBe(60_000) // from `prod-core` (nearest)
  })

  it('node override beats the subgraph chain', () => {
    const e = effectivePolicyForNode(graph, { parent: 'prod-core', attachments: pol('disabled') })
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
    // intervalMs not set in `lab` → falls through to topology's intervalMs.
    expect(e.intervalMs).toBe(600_000)
    expect(e.source.intervalMs).toBe('topology')
  })

  it('handles a graph with no subgraphs at all', () => {
    const e = effectivePolicyForNode({ attachments: pol('auto') }, {})
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
        source: { mode: 'default', intervalMs: 'default', community: 'default' },
      }),
    ).toBe(true)
    expect(
      absenceImpliesRetraction({
        mode: 'observe',
        intervalMs: 0,
        source: { mode: 'default', intervalMs: 'default', community: 'default' },
      }),
    ).toBe(true)
  })
  it('absence is meaningless for disabled', () => {
    expect(
      absenceImpliesRetraction({
        mode: 'disabled',
        intervalMs: 0,
        source: { mode: 'default', intervalMs: 'default', community: 'default' },
      }),
    ).toBe(false)
  })
})

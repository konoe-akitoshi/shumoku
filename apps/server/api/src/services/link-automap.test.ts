// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import type { LinkMetricsMapping } from '@shumoku/core'
import { describe, expect, it } from 'vitest'
import {
  type LinkAutoMapDeps,
  matchInterface,
  type PlannableLink,
  planLinkAutoMap,
} from './link-automap.js'

describe('matchInterface', () => {
  it('returns null for empty candidates', () => {
    expect(matchInterface(['GE0/1'], [])).toBeNull()
  })

  it('returns null for empty port names', () => {
    expect(matchInterface([], ['GigabitEthernet0/1'])).toBeNull()
  })

  it('exact case-insensitive match', () => {
    expect(matchInterface(['GE0/1'], ['ge0/1', 'GE0/2'])).toBe('ge0/1')
  })

  it('normalised fuzzy match: GE0/1 matches GigabitEthernet0/1', () => {
    expect(matchInterface(['GE0/1'], ['GigabitEthernet0/1', 'GigabitEthernet0/2'])).toBe(
      'GigabitEthernet0/1',
    )
  })

  it('normalised fuzzy match: ifName takes priority over label', () => {
    // port.identity.ifName is listed before port.label in the candidates array
    expect(matchInterface(['GE0/1', 'port-A'], ['GigabitEthernet0/1', 'GigabitEthernet0/2'])).toBe(
      'GigabitEthernet0/1',
    )
  })

  it('number-sequence cross-vocabulary fallback: unique number match', () => {
    // hg0/1 and Ethernet0/1 share numbers [0,1]; only one candidate
    expect(matchInterface(['hg0/1'], ['Ethernet0/1'])).toBe('Ethernet0/1')
  })

  it('returns null when no match at threshold', () => {
    expect(matchInterface(['GE0/1'], ['GigabitEthernet1/2', 'GigabitEthernet2/3'])).toBeNull()
  })

  it('perfect number match wins over partial', () => {
    const candidates = ['GigabitEthernet0/0/1', 'GigabitEthernet0/1']
    // GE0/1 should match GigabitEthernet0/1 (shorter, same numbers)
    expect(matchInterface(['GE0/1'], candidates)).toBe('GigabitEthernet0/1')
  })
})

// ------------------------------------------------------------------------
// planLinkAutoMap — the pure decision core of server-side link auto-map.
// ------------------------------------------------------------------------

/** Build deps from a nodeId→hostId map, an endpoint→port-names map, and a
 *  hostId→interface-names map. Endpoints are keyed `${nodeId}:${portId}`. */
function makeDeps(
  hostByNode: Record<string, string>,
  portCandidates: Record<string, string[]>,
  ifacesByHost: Record<string, string[]>,
): LinkAutoMapDeps {
  return {
    hostForNode: (nodeId) => hostByNode[nodeId],
    portCandidates: (nodeId, portId) => portCandidates[`${nodeId}:${portId}`] ?? [],
    interfacesForHost: (hostId) => ifacesByHost[hostId] ?? [],
  }
}

function link(key: string, from: [string, string], to: [string, string]): PlannableLink {
  return {
    key,
    from: { node: from[0], port: from[1] },
    to: { node: to[0], port: to[1] },
  }
}

describe('planLinkAutoMap', () => {
  it('resolves the monitored endpoint + interface by port identity', () => {
    const deps = makeDeps(
      { sw1: 'host-1', sw2: 'host-2' },
      { 'sw1:GE0/1': ['GE0/1'], 'sw2:GE0/2': ['GE0/2'] },
      { 'host-1': ['GigabitEthernet0/1'], 'host-2': ['GigabitEthernet0/2'] },
    )
    const plan = planLinkAutoMap([link('l0', ['sw1', 'GE0/1'], ['sw2', 'GE0/2'])], {}, deps)
    expect(plan.matched).toBe(1)
    expect(plan.skipped).toBe(0)
    // from-endpoint (sw1) is tried first and resolves → it's the monitored node.
    expect(plan.resolved.l0).toEqual({
      monitoredNodeId: 'sw1',
      interface: 'GigabitEthernet0/1',
    })
  })

  it('falls back to the to-endpoint when the from-endpoint has no match', () => {
    const deps = makeDeps(
      { sw1: 'host-1', sw2: 'host-2' },
      { 'sw1:GE0/1': ['GE0/1'], 'sw2:GE0/2': ['GE0/2'] },
      // host-1 reports nothing matching sw1's port; host-2 matches sw2's.
      { 'host-1': ['Loopback0'], 'host-2': ['GigabitEthernet0/2'] },
    )
    const plan = planLinkAutoMap([link('l0', ['sw1', 'GE0/1'], ['sw2', 'GE0/2'])], {}, deps)
    expect(plan.matched).toBe(1)
    expect(plan.resolved.l0?.monitoredNodeId).toBe('sw2')
    expect(plan.resolved.l0?.interface).toBe('GigabitEthernet0/2')
  })

  it('skips a link with no mapped endpoint (not counted as skipped)', () => {
    const deps = makeDeps({}, {}, {})
    const plan = planLinkAutoMap([link('l0', ['sw1', 'GE0/1'], ['sw2', 'GE0/2'])], {}, deps)
    expect(plan.matched).toBe(0)
    expect(plan.skipped).toBe(0) // "skipped" is reserved for already-mapped links
    expect(plan.resolved.l0).toBeUndefined()
  })

  it('leaves a link with no resolvable interface unmatched', () => {
    const deps = makeDeps(
      { sw1: 'host-1' },
      { 'sw1:GE0/1': ['GE0/1'] },
      { 'host-1': ['Serial0', 'Loopback0'] }, // nothing matches GE0/1
    )
    const plan = planLinkAutoMap([link('l0', ['sw1', 'GE0/1'], ['sw2', 'GE0/2'])], {}, deps)
    expect(plan.matched).toBe(0)
    expect(plan.resolved.l0).toBeUndefined()
  })

  it('respects overwrite:false — a fully-mapped link is skipped, not re-matched', () => {
    const deps = makeDeps(
      { sw1: 'host-1' },
      { 'sw1:GE0/1': ['GE0/1'] },
      { 'host-1': ['GigabitEthernet0/1'] },
    )
    const existing: Record<string, LinkMetricsMapping> = {
      l0: { monitoredNodeId: 'sw1', interface: 'manual-choice' },
    }
    const plan = planLinkAutoMap([link('l0', ['sw1', 'GE0/1'], ['sw2', 'GE0/2'])], existing, deps)
    expect(plan.matched).toBe(0)
    expect(plan.skipped).toBe(1)
    expect(plan.resolved.l0).toBeUndefined() // untouched
  })

  it('overwrite:true re-matches a fully-mapped link', () => {
    const deps = makeDeps(
      { sw1: 'host-1' },
      { 'sw1:GE0/1': ['GE0/1'] },
      { 'host-1': ['GigabitEthernet0/1'] },
    )
    const existing: Record<string, LinkMetricsMapping> = {
      l0: { monitoredNodeId: 'sw1', interface: 'stale' },
    }
    const plan = planLinkAutoMap([link('l0', ['sw1', 'GE0/1'], ['sw2', 'GE0/2'])], existing, deps, {
      overwrite: true,
    })
    expect(plan.matched).toBe(1)
    expect(plan.skipped).toBe(0)
    expect(plan.resolved.l0?.interface).toBe('GigabitEthernet0/1')
  })

  it('preserves an existing bandwidth override when it re-matches', () => {
    const deps = makeDeps(
      { sw1: 'host-1' },
      { 'sw1:GE0/1': ['GE0/1'] },
      { 'host-1': ['GigabitEthernet0/1'] },
    )
    // A link with a bandwidth override but no interface yet → eligible to match.
    const existing: Record<string, LinkMetricsMapping> = { l0: { bandwidth: 10_000_000_000 } }
    const plan = planLinkAutoMap([link('l0', ['sw1', 'GE0/1'], ['sw2', 'GE0/2'])], existing, deps)
    expect(plan.matched).toBe(1)
    expect(plan.resolved.l0).toEqual({
      bandwidth: 10_000_000_000,
      monitoredNodeId: 'sw1',
      interface: 'GigabitEthernet0/1',
    })
  })

  it('counts matched/skipped across a mix of links', () => {
    const deps = makeDeps(
      { a: 'ha', b: 'hb' },
      { 'a:GE0/1': ['GE0/1'], 'b:GE0/2': ['GE0/2'] },
      { ha: ['GigabitEthernet0/1'], hb: ['GigabitEthernet0/2'] },
    )
    const existing: Record<string, LinkMetricsMapping> = {
      done: { monitoredNodeId: 'a', interface: 'already' },
    }
    const plan = planLinkAutoMap(
      [
        link('fresh', ['a', 'GE0/1'], ['b', 'GE0/2']),
        link('done', ['a', 'GE0/1'], ['b', 'GE0/2']),
        link('unmapped', ['x', 'GE9/9'], ['y', 'GE9/9']),
      ],
      existing,
      deps,
    )
    expect(plan.matched).toBe(1) // fresh
    expect(plan.skipped).toBe(1) // done (already mapped, overwrite false)
    // unmapped contributes to neither counter
    expect(Object.keys(plan.resolved)).toEqual(['fresh'])
  })
})

// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import type { LinkMetricsMapping } from '@shumoku/core'
import { describe, expect, it } from 'vitest'
import {
  extractInterfaceNames,
  type LinkAutoMapDeps,
  matchInterface,
  type PlannableLink,
  planLinkAutoMap,
  unionInterfacesAcrossSources,
} from './link-automap.js'

describe('extractInterfaceNames', () => {
  it('prefers the structured interfaceName over the decorated item name', () => {
    const items = [
      { name: 'Interface ge-0/0/1: Bits received', interfaceName: 'ge-0/0/1' },
      { name: 'Interface ge-0/0/1: Bits sent', interfaceName: 'ge-0/0/1' },
      { name: 'Interface ge-0/0/2: Bits received', interfaceName: 'ge-0/0/2' },
    ]
    // Deduped (in + out share one interface) — this is what a port identity
    // matches against; the full item name never would.
    expect(extractInterfaceNames(items)).toEqual(['ge-0/0/1', 'ge-0/0/2'])
  })

  it('strips the decoration when interfaceName is absent', () => {
    expect(
      extractInterfaceNames([
        { name: 'Interface GigabitEthernet0/1: Bits received' },
        { name: 'GigabitEthernet0/2 - Inbound' },
      ]),
    ).toEqual(['GigabitEthernet0/1', 'GigabitEthernet0/2'])
  })

  it('falls back to the raw name for an undecorated item', () => {
    expect(extractInterfaceNames([{ name: 'eth0' }])).toEqual(['eth0'])
  })
})

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

// ---------------------------------------------------------------------------
// Wave B-3 (#569) — planLinkAutoMap is agnostic to which source's interface
// lists are fed in. The multi-source addressing is handled above planLinkAutoMap
// (in TopologyService.autoMapLinks) by fetching the chosen source's interfaces.
// These tests verify that plan resolution is deterministic given different sets
// of interfaces (simulating two distinct sources).
// ---------------------------------------------------------------------------

describe('planLinkAutoMap — multi-source interface feeds (Wave B-3, #569)', () => {
  it('plan from source-A interfaces differs from plan from source-B interfaces', () => {
    const linkList = [link('l0', ['sw1', 'GE0/1'], ['sw2', 'GE0/2'])]
    const common = {
      hostByNode: { sw1: 'host-1', sw2: 'host-2' },
      portCandidates: { 'sw1:GE0/1': ['GE0/1'], 'sw2:GE0/2': ['GE0/2'] },
    }

    // Source A reports sw1's interface; source B reports sw2's interface.
    const depsA = makeDeps(common.hostByNode, common.portCandidates, {
      'host-1': ['GigabitEthernet0/1'],
      'host-2': [],
    })
    const depsB = makeDeps(common.hostByNode, common.portCandidates, {
      'host-1': [],
      'host-2': ['GigabitEthernet0/2'],
    })

    const planA = planLinkAutoMap(linkList, {}, depsA)
    const planB = planLinkAutoMap(linkList, {}, depsB)

    // Source A resolves sw1 (from-endpoint); source B resolves sw2 (to-endpoint).
    expect(planA.resolved.l0?.monitoredNodeId).toBe('sw1')
    expect(planA.resolved.l0?.interface).toBe('GigabitEthernet0/1')
    expect(planB.resolved.l0?.monitoredNodeId).toBe('sw2')
    expect(planB.resolved.l0?.interface).toBe('GigabitEthernet0/2')
  })

  it('using the wrong source (no matching interfaces) produces zero matches', () => {
    const deps = makeDeps(
      { sw1: 'host-1' },
      { 'sw1:GE0/1': ['GE0/1'] },
      // source has no interface that matches sw1's port
      { 'host-1': ['Management0', 'Loopback0'] },
    )
    const plan = planLinkAutoMap([link('l0', ['sw1', 'GE0/1'], ['sw2', 'GE0/2'])], {}, deps)
    expect(plan.matched).toBe(0)
    expect(plan.resolved.l0).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// unionInterfacesAcrossSources — the all-sources self-select union that makes
// link auto-map "auto" on a multi-source topology.
// ---------------------------------------------------------------------------

describe('unionInterfacesAcrossSources', () => {
  const mapSerial = async <T, R>(items: T[], _limit: number, fn: (item: T) => Promise<R>) =>
    Promise.all(items.map(fn))

  it('unions interfaces from whichever source recognizes each host', async () => {
    // Source "prom" knows the switch; source "cvcue" knows the AP.
    const getHostItems = async (sourceId: string, hostId: string) => {
      if (sourceId === 'prom' && hostId === 'sw-1')
        return [{ name: 'Ethernet13 in', interfaceName: 'Ethernet13' }]
      if (sourceId === 'cvcue' && hostId === 'ap-28')
        return [{ name: 'eth0 received', interfaceName: 'eth0' }]
      return []
    }
    const out = await unionInterfacesAcrossSources(
      ['sw-1', 'ap-28'],
      ['prom', 'cvcue'],
      getHostItems,
      mapSerial,
    )
    expect(out.get('sw-1')).toEqual(['Ethernet13'])
    expect(out.get('ap-28')).toEqual(['eth0'])
  })

  it('a throwing source self-deselects instead of failing the run', async () => {
    const getHostItems = async (sourceId: string, _hostId: string) => {
      if (sourceId === 'broken') throw new Error('upstream down')
      return [{ name: 'GE0/1', interfaceName: 'GE0/1' }]
    }
    const out = await unionInterfacesAcrossSources(
      ['h1'],
      ['broken', 'ok'],
      getHostItems,
      mapSerial,
    )
    expect(out.get('h1')).toEqual(['GE0/1'])
  })

  it('drops a repeatedly-failing source after maxConsecutiveFailures (circuit breaker)', async () => {
    let deadCalls = 0
    const getHostItems = async (sourceId: string, _hostId: string) => {
      if (sourceId === 'dead') {
        deadCalls++
        throw new Error('unreachable')
      }
      return [{ name: 'x', interfaceName: 'GE0/1' }]
    }
    // Strictly serial map: the breaker counts CONSECUTIVE failures, so the
    // deterministic assertion needs hosts processed one at a time (production
    // runs a small concurrent window, which just means a few extra calls
    // before the breaker engages).
    const mapStrictSerial = async <T, R>(items: T[], _l: number, fn: (i: T) => Promise<R>) => {
      const out: R[] = []
      for (const item of items) out.push(await fn(item))
      return out
    }
    const out = await unionInterfacesAcrossSources(
      ['h1', 'h2', 'h3', 'h4'],
      ['dead', 'ok'],
      getHostItems,
      mapStrictSerial,
      { maxConsecutiveFailures: 2 },
    )
    // The dead source is consulted for the first two hosts, then skipped.
    expect(deadCalls).toBe(2)
    // The healthy source still answers for every host.
    expect(out.get('h4')).toEqual(['GE0/1'])
  })

  it('dedupes the same interface reported by two sources', async () => {
    const getHostItems = async () => [{ name: 'x', interfaceName: 'GE0/1' }]
    const out = await unionInterfacesAcrossSources(['h1'], ['a', 'b'], getHostItems, mapSerial)
    expect(out.get('h1')).toEqual(['GE0/1'])
  })
})

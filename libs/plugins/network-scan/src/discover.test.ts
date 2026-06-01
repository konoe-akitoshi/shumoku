// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { beforeEach, describe, expect, it, vi } from 'vitest'

// Mock only `SnmpClient` from ./client.js; keep the real value coercion
// helpers (asString / indexByRow / …) so discover() parses our canned
// varbinds exactly as it would real ones.
vi.mock('./client.js', async () => {
  const actual = await vi.importActual<typeof import('./client.js')>('./client.js')
  const SYS_NAME = '1.3.6.1.2.1.1.5.0'
  class FakeSnmpClient {
    address: string
    constructor(target: { address: string }) {
      this.address = target.address
    }
    // get() answers the system scalars; only sysName needs a value for the
    // device to count as alive and to get a label.
    get(oids: string[]): Promise<Array<{ oid: string; value: unknown }>> {
      return Promise.resolve(
        oids.map((oid) => ({
          oid,
          value: oid === SYS_NAME ? `host-${this.address}` : '',
        })),
      )
    }
    // walk() returns nothing — no ports / LLDP / IP tables. The device is
    // still a fully-walked (synced) node, just with empty tables.
    walk(): Promise<Array<{ oid: string; value: unknown }>> {
      return Promise.resolve([])
    }
    close(): void {}
  }
  return { ...actual, SnmpClient: FakeSnmpClient }
})

// Reachability is irrelevant here (every target answers SNMP, so it's
// "alive" before Phase A matters); stub it to report nothing reachable.
vi.mock('./reachability.js', () => ({
  probeReachable: () => Promise.resolve(new Map()),
}))

import { discover } from './discover.js'

type AccessSnmp = { kind: 'access'; protocol: 'snmp'; community?: string }

describe('discover() records the credential it read with', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('stamps the config-wide community as an SNMP access attachment on a synced node', async () => {
    const result = await discover({
      targets: ['10.0.0.1'],
      community: 'public',
      sourceId: 'scan1',
    })

    expect(result.stats.walked).toBe(1)
    const node = result.graph.nodes.find((n) => n.identity?.mgmtIp === '10.0.0.1')
    expect(node).toBeDefined()
    // The node was read over SNMP — that fact must be backed by the
    // credential it was read with, not an invisible fallback.
    expect(node?.metadata?.['readVia']).toBe('snmp')
    const access = node?.attachments?.find(
      (a): a is AccessSnmp => a.kind === 'access' && a.protocol === 'snmp',
    )
    expect(access).toBeDefined()
    expect(access?.community).toBe('public')
  })

  it('stamps the per-target community when one is given for that address', async () => {
    const result = await discover({
      targets: ['10.0.0.1', '10.0.0.2'],
      community: 'public',
      credentialsByTarget: { '10.0.0.2': 'secret-rw' },
      sourceId: 'scan1',
    })

    const byIp = (ip: string) => result.graph.nodes.find((n) => n.identity?.mgmtIp === ip)
    const communityOf = (ip: string) =>
      byIp(ip)?.attachments?.find(
        (a): a is AccessSnmp => a.kind === 'access' && a.protocol === 'snmp',
      )?.community

    expect(communityOf('10.0.0.1')).toBe('public')
    expect(communityOf('10.0.0.2')).toBe('secret-rw')
  })
})

// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it, vi } from 'vitest'

const subtree = vi.fn()
const createSession = vi.fn(() => ({ subtree, close: vi.fn(), get: vi.fn() }))

vi.mock('net-snmp', () => ({
  createSession: (...args: unknown[]) => createSession(...(args as [])),
  Version2c: 1,
  isVarbindError: () => false,
}))

const { SnmpClient, compareOids } = await import('./snmp-client.js')

/** Drive the mocked `subtree` with a scripted sequence of feed batches. */
function scriptWalk(batches: { oid: string; value: unknown }[][], done?: Error | null) {
  subtree.mockImplementation((_oid, _max, feed, finish) => {
    for (const batch of batches) feed(batch)
    if (done !== undefined) finish(done)
  })
}

describe('compareOids', () => {
  it('orders by numeric arc, not lexicographically', () => {
    // '10' < '9' as text, but arc 10 comes after arc 9.
    expect(compareOids('1.3.6.1.2.1.2.2.1.2.10', '1.3.6.1.2.1.2.2.1.2.9')).toBeGreaterThan(0)
  })
  it('treats a prefix as smaller than what extends it', () => {
    expect(compareOids('1.3.6.1', '1.3.6.1.0')).toBeLessThan(0)
  })
  it('reports equality as zero', () => {
    expect(compareOids('1.3.6.1', '1.3.6.1')).toBe(0)
  })
})

describe('SnmpClient.walk', () => {
  it('collects a well-behaved subtree', async () => {
    scriptWalk(
      [
        [
          { oid: '1.3.6.1.2.1.2.2.1.2.1', value: 'Gi1/0/1' },
          { oid: '1.3.6.1.2.1.2.2.1.2.2', value: 'Gi1/0/2' },
        ],
      ],
      null,
    )
    const client = new SnmpClient({ address: '10.0.0.1', community: 'public' })
    await expect(client.walk('1.3.6.1.2.1.2.2.1.2')).resolves.toHaveLength(2)
  })

  it('keeps the rows read before a non-increasing OID and stops there', async () => {
    // The defect this guards: the agent repeats a row forever, inside the
    // requested subtree, so net-snmp's own loop guard never trips and the
    // done callback is never called. Feeding no `done` models exactly that.
    scriptWalk([
      [{ oid: '1.0.8802.1.1.2.1.4.1.1.4.1667288780.15.49', value: 4 }],
      [{ oid: '1.0.8802.1.1.2.1.4.1.1.4.1667288780.15.49', value: 4 }],
      [{ oid: '1.0.8802.1.1.2.1.4.1.1.4.1667288780.15.49', value: 4 }],
    ])
    const client = new SnmpClient({ address: '10.0.0.1', community: 'public' })
    // Resolves despite `done` never firing — without the feed-side guard
    // this promise would hang forever.
    await expect(client.walk('1.0.8802.1.1.2.1.4.1.1')).resolves.toEqual([
      { oid: '1.0.8802.1.1.2.1.4.1.1.4.1667288780.15.49', value: 4 },
    ])
  })

  it('stops on an OID that goes backwards, not just one that repeats', async () => {
    scriptWalk([
      [{ oid: '1.3.6.1.2.1.2.2.1.2.5', value: 'Gi1/0/5' }],
      [{ oid: '1.3.6.1.2.1.2.2.1.2.3', value: 'Gi1/0/3' }],
    ])
    const client = new SnmpClient({ address: '10.0.0.1', community: 'public' })
    await expect(client.walk('1.3.6.1.2.1.2.2.1.2')).resolves.toEqual([
      { oid: '1.3.6.1.2.1.2.2.1.2.5', value: 'Gi1/0/5' },
    ])
  })

  it('still resolves when net-snmp is the one to report "OID not increasing"', async () => {
    scriptWalk(
      [[{ oid: '1.3.6.1.2.1.2.2.1.2.1', value: 'Gi1/0/1' }]],
      new Error('OID not increasing: 1.3.6.1.2.1.2.2.1.2.1'),
    )
    const client = new SnmpClient({ address: '10.0.0.1', community: 'public' })
    await expect(client.walk('1.3.6.1.2.1.2.2.1.2')).resolves.toHaveLength(1)
  })

  it('rejects on any other error', async () => {
    scriptWalk([], new Error('Request timed out'))
    const client = new SnmpClient({ address: '10.0.0.1', community: 'public' })
    await expect(client.walk('1.3.6.1.2.1.2.2.1.2')).rejects.toThrow('Request timed out')
  })

  it('settles once even if the agent keeps feeding after the guard fires', async () => {
    scriptWalk(
      [
        [{ oid: '1.3.6.1.2.1.2.2.1.2.1', value: 'Gi1/0/1' }],
        [{ oid: '1.3.6.1.2.1.2.2.1.2.1', value: 'Gi1/0/1' }],
      ],
      new Error('Request timed out'),
    )
    const client = new SnmpClient({ address: '10.0.0.1', community: 'public' })
    // The late error must not turn an already-resolved walk into a rejection.
    await expect(client.walk('1.3.6.1.2.1.2.2.1.2')).resolves.toHaveLength(1)
  })
})

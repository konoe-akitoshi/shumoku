// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

import { beforeEach, describe, expect, it, vi } from 'vitest'

const E_OUT_OF_ORDER = 8

class MockResponseInvalidError extends Error {
  code: number

  constructor(message: string, code: number) {
    super(message)
    this.name = 'ResponseInvalidError'
    this.code = code
  }
}

const subtree = vi.fn()
const createSession = vi.fn(() => ({ subtree, close: vi.fn(), get: vi.fn() }))

vi.mock('net-snmp', () => ({
  createSession: (...args: unknown[]) => createSession(...(args as [])),
  Version2c: 1,
  ResponseInvalidCode: { EOutOfOrder: E_OUT_OF_ORDER },
  ResponseInvalidError: MockResponseInvalidError,
  isVarbindError: () => false,
}))

const { SnmpClient } = await import('./snmp-client.js')

/** Drive the mocked `subtree` with a scripted sequence of feed batches. */
function scriptWalk(batches: { oid: string; value: unknown }[][], done?: Error | null) {
  subtree.mockImplementation((_oid, _max, feed, finish) => {
    for (const batch of batches) feed(batch)
    if (done !== undefined) finish(done)
  })
}

describe('SnmpClient.walk', () => {
  beforeEach(() => {
    subtree.mockReset()
    createSession.mockClear()
  })

  it('enables net-snmp out-of-order response validation', () => {
    new SnmpClient({ address: '10.0.0.1', community: 'public' })
    expect(createSession).toHaveBeenCalledWith(
      '10.0.0.1',
      'public',
      expect.objectContaining({ backwardsGetNexts: false }),
    )
  })

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

  it('keeps rows collected before net-snmp reports an out-of-order OID', async () => {
    scriptWalk(
      [[{ oid: '1.0.8802.1.1.2.1.4.1.1.4.1667288780.15.49', value: 4 }]],
      new MockResponseInvalidError('OID did not advance', E_OUT_OF_ORDER),
    )
    const client = new SnmpClient({ address: '10.0.0.1', community: 'public' })
    await expect(client.walk('1.0.8802.1.1.2.1.4.1.1')).resolves.toEqual([
      { oid: '1.0.8802.1.1.2.1.4.1.1.4.1667288780.15.49', value: 4 },
    ])
  })

  it('retains compatibility with legacy "OID not increasing" errors', async () => {
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
})

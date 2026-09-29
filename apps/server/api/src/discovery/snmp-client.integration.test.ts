// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

import * as snmp from 'net-snmp'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SnmpClient } from './snmp-client.js'

// Keep net-snmp's subtree/walk control flow real; replace only network requests.
afterEach(() => vi.restoreAllMocks())

describe('SnmpClient.walk cancellation', () => {
  it.each([
    ['repeated', '1.3.6.1.2.5'],
    ['backwards', '1.3.6.1.2.3'],
  ])('stops issuing GETBULK requests after a %s OID', async (_kind, nextOid) => {
    const first = { oid: '1.3.6.1.2.5', type: snmp.ObjectType.Integer, value: 4 }
    const batches = [[first], [{ ...first, oid: nextOid }]]
    let requestCount = 0
    const simpleGet = vi
      .spyOn(snmp.Session.prototype, 'simpleGet')
      .mockImplementation((_pduClass, feed, requestVarbinds, response) => {
        const batch = batches[requestCount++]
        if (!batch) throw new Error('Walk exceeded the response limit')
        const request = {
          message: { pdu: { varbinds: requestVarbinds } },
          responseCb: response,
        } as Parameters<typeof feed>[0]
        const message = { pdu: { varbinds: batch } } as Parameters<typeof feed>[1]
        feed(request, message)
      })
    const client = new SnmpClient({ address: '127.0.0.1', community: 'public' })
    try {
      await expect(client.walk('1.3.6.1.2')).resolves.toEqual([{ oid: first.oid, value: 4 }])
      expect(simpleGet).toHaveBeenCalledTimes(2)
    } finally {
      client.close()
    }
  })
})

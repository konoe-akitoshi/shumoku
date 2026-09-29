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
    const batches = [
      [first],
      [{ ...first, oid: nextOid }],
      // Bound a broken walk so a regression fails without hanging the test.
      [{ ...first, type: snmp.ObjectType.EndOfMibView }],
    ]
    let requestCount = 0
    const getBulk = vi.spyOn(snmp.Session.prototype, 'getBulk').mockImplementation(function (
      this: snmp.Session,
      ...args
    ) {
      const callback = args.find((arg): arg is snmp.GetBulkCallback => typeof arg === 'function')
      if (!callback) throw new Error('Missing GETBULK callback')
      const batch = batches[requestCount++]
      if (!batch) throw new Error('Walk exceeded the response limit')
      callback(null, [batch])
      return this
    })
    const client = new SnmpClient({ address: '127.0.0.1', community: 'public' })
    try {
      await expect(client.walk('1.3.6.1.2')).resolves.toEqual([{ oid: first.oid, value: 4 }])
      expect(getBulk).toHaveBeenCalledTimes(2)
    } finally {
      client.close()
    }
  })
})

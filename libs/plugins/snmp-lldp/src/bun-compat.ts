// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * Bun compatibility smoke check for the `net-snmp` library.
 *
 * `net-snmp` is a pure-JavaScript SNMP implementation that uses
 * `node:dgram` for UDP. Bun supports `node:dgram` since v1.0+, so
 * the loader path should work. This file exists to verify:
 *
 *   1. `import` of the module succeeds in Bun
 *   2. `Version` constants are present
 *   3. A session object can be constructed without throwing
 *   4. The session can be closed cleanly
 *
 * No real SNMP traffic is emitted — the spike runs without any
 * network device. The integration test that actually walks a device
 * lives in the full plugin and uses `snmpsim` in CI.
 */

import * as snmp from 'net-snmp'

export interface SpikeResult {
  loadedOk: boolean
  hasVersion2c: boolean
  sessionConstructed: boolean
  sessionClosed: boolean
  error?: string
}

/**
 * Run the smoke check and return a structured result. Useful for
 * CI / a one-off `bun run` invocation.
 */
export function spikeBunCompat(): SpikeResult {
  const result: SpikeResult = {
    loadedOk: false,
    hasVersion2c: false,
    sessionConstructed: false,
    sessionClosed: false,
  }

  try {
    result.loadedOk = typeof snmp.createSession === 'function'
    result.hasVersion2c = typeof snmp.Version2c !== 'undefined'

    // Construct a session against an unreachable address. net-snmp does
    // not perform a sync handshake on createSession, so this only
    // exercises the constructor and underlying dgram socket open.
    const session = snmp.createSession('127.0.0.1', 'public', {
      port: 161,
      version: snmp.Version2c,
      timeout: 1000,
      retries: 0,
    })
    result.sessionConstructed = true

    session.close()
    result.sessionClosed = true
  } catch (err) {
    result.error = err instanceof Error ? err.message : String(err)
  }

  return result
}

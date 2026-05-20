// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { describe, expect, it } from 'vitest'
import { spikeBunCompat } from './bun-compat.js'

/**
 * Bun compatibility smoke. Runs in the standard test suite — if this
 * starts failing in CI, the SNMP plugin will need an alternate UDP
 * library or a Bun-side fix.
 */
describe('net-snmp / Bun compatibility', () => {
  it('loads the module, builds a v2c session, closes cleanly', () => {
    const r = spikeBunCompat()
    expect(r.error).toBeUndefined()
    expect(r.loadedOk).toBe(true)
    expect(r.hasVersion2c).toBe(true)
    expect(r.sessionConstructed).toBe(true)
    expect(r.sessionClosed).toBe(true)
  })
})

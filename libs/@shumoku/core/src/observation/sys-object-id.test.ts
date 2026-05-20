// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { describe, expect, it } from 'vitest'
import { lookupSysObjectID, vendorFromSysObjectID } from './sys-object-id.js'

describe('sysObjectID lookup', () => {
  it('returns specific model when a Catalyst 9300 OID is given', () => {
    const r = lookupSysObjectID('1.3.6.1.4.1.9.1.2030')
    expect(r?.vendor).toBe('Cisco')
    expect(r?.model).toBe('Catalyst 9300-24T')
    expect(r?.matchedPrefix).toBe('1.3.6.1.4.1.9.1.2030')
  })

  it('falls back to vendor-level match when no model is registered', () => {
    // A Cisco enterprise OID we don't have a specific entry for
    const r = lookupSysObjectID('1.3.6.1.4.1.9.1.99999')
    expect(r?.vendor).toBe('Cisco')
    expect(r?.model).toBeUndefined()
    expect(r?.matchedPrefix).toBe('1.3.6.1.4.1.9')
  })

  it('returns Juniper for a Juniper OID', () => {
    expect(vendorFromSysObjectID('1.3.6.1.4.1.2636.1.1.1.2.29')).toBe('Juniper')
  })

  it('returns Aruba for an Aruba OID', () => {
    expect(vendorFromSysObjectID('1.3.6.1.4.1.14823.1.2.3')).toBe('Aruba Networks')
  })

  it('returns null for OIDs outside the dictionary', () => {
    // Made-up enterprise number that does not exist in our dict
    expect(lookupSysObjectID('1.3.6.1.4.1.99999999.1.2.3')).toBeNull()
  })

  it('tolerates a leading-dot form', () => {
    const r = lookupSysObjectID('.1.3.6.1.4.1.30065.1.3000')
    expect(r?.vendor).toBe('Arista')
    expect(r?.model).toBe('7050 series')
  })

  it('matches exact vendor OID without a child component', () => {
    const r = lookupSysObjectID('1.3.6.1.4.1.9')
    expect(r?.vendor).toBe('Cisco')
    expect(r?.model).toBeUndefined()
  })

  it('Meraki long-prefix wins over a hypothetical Cisco fallback', () => {
    // 29671 is dedicated to Meraki even though Meraki is a Cisco brand
    expect(vendorFromSysObjectID('1.3.6.1.4.1.29671.123.456')).toBe('Meraki')
  })
})

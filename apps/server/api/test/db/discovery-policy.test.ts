// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * The discovery-policy PATCH locates an existing overlay entry by identity when
 * its authored local id no longer matches the resolved id (post Phase 3 entity-id
 * flip). `nodeIdentitiesMatch` is the anchor predicate; its normalization must
 * mirror the entity registry (chassisId case-preserving; mgmtIp / sysName
 * case-insensitive) so the match agrees with clustering.
 *
 * Lives under test/db (bun test) because importing the route module transitively
 * pulls in `bun:sqlite`; the predicate itself needs no database.
 *
 * Run with: cd apps/server/api && bun test test/db/discovery-policy.test.ts
 */

import { describe, expect, test } from 'bun:test'
import type { Identity } from '@shumoku/core'
import { nodeIdentitiesMatch } from '../../src/api/discovery-policy.ts'

describe('nodeIdentitiesMatch', () => {
  test('matches on a shared mgmtIp (case-insensitive)', () => {
    const a: Identity = { mgmtIp: '10.0.0.1' }
    const b: Identity = { mgmtIp: '10.0.0.1', sysName: 'core-1' }
    expect(nodeIdentitiesMatch(a, b)).toBe(true)
  })

  test('matches sysName case-insensitively (registry lowercases it)', () => {
    expect(nodeIdentitiesMatch({ sysName: 'Core-SW-1' }, { sysName: 'core-sw-1' })).toBe(true)
  })

  test('matches chassisId case-sensitively (registry preserves case)', () => {
    expect(nodeIdentitiesMatch({ chassisId: 'AA:BB:CC' }, { chassisId: 'AA:BB:CC' })).toBe(true)
    // Different case → chassisId does not match (and no other shared key).
    expect(nodeIdentitiesMatch({ chassisId: 'AA:BB:CC' }, { chassisId: 'aa:bb:cc' })).toBe(false)
  })

  test('does not match when no strong key is shared', () => {
    expect(nodeIdentitiesMatch({ mgmtIp: '10.0.0.1' }, { mgmtIp: '10.0.0.2' })).toBe(false)
    expect(nodeIdentitiesMatch({ sysName: 'a' }, { chassisId: 'AA' })).toBe(false)
  })

  test('is false when either identity is missing or empty', () => {
    expect(nodeIdentitiesMatch(undefined, { mgmtIp: '10.0.0.1' })).toBe(false)
    expect(nodeIdentitiesMatch({ mgmtIp: '10.0.0.1' }, undefined)).toBe(false)
    // Empty-string keys make no claim.
    expect(nodeIdentitiesMatch({ mgmtIp: '' }, { mgmtIp: '' })).toBe(false)
  })
})

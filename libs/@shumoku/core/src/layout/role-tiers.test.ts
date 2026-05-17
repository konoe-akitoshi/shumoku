// role-tiers.ts smoke tests. The table itself is opinionated; what
// the test pins is the resolver contract: the right tier number is
// produced for each kind, unknown specs fall through gracefully,
// and the result carries enough diagnostic info to debug it later.

import { describe, expect, test } from 'vitest'
import { DeviceType, type NodeSpec } from '../models/types.js'
import { DEVICE_TYPE_TIER, resolveTierFromSpec } from './role-tiers.js'

describe('resolveTierFromSpec', () => {
  test('returns null for missing spec', () => {
    expect(resolveTierFromSpec(undefined)).toBeNull()
  })

  test('hardware: known DeviceType maps to its default tier with `device-type` source', () => {
    const spec: NodeSpec = { kind: 'hardware', type: DeviceType.L3Switch }
    const hint = resolveTierFromSpec(spec)
    expect(hint).toEqual({ tier: 30, strength: 'soft', source: 'device-type' })
  })

  test('hardware: unknown / missing DeviceType falls back to tier 60 / fallback source', () => {
    const spec: NodeSpec = { kind: 'hardware' } // no type
    const hint = resolveTierFromSpec(spec)
    expect(hint).toEqual({ tier: 60, strength: 'soft', source: 'fallback' })
  })

  test('compute spec lands at tier 80', () => {
    const spec: NodeSpec = { kind: 'compute' }
    expect(resolveTierFromSpec(spec)).toEqual({ tier: 80, strength: 'soft', source: 'compute' })
  })

  test('service spec lands at tier 90', () => {
    const spec: NodeSpec = { kind: 'service', service: 's3' }
    expect(resolveTierFromSpec(spec)).toEqual({ tier: 90, strength: 'soft', source: 'service' })
  })

  test('table covers every member of the DeviceType enum', () => {
    for (const t of Object.values(DeviceType)) {
      expect(DEVICE_TYPE_TIER[t as DeviceType]).toBeTypeOf('number')
    }
  })
})

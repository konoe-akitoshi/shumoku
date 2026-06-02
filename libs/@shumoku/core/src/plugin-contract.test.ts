// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { describe, expect, it } from 'vitest'
import {
  type DataSourcePlugin,
  hasConfigOptions,
  hasConnectionInfo,
  missingCapabilityMethods,
} from './plugin-types.js'

function makePlugin(
  capabilities: string[],
  methods: Record<string, unknown> = {},
): DataSourcePlugin {
  return {
    type: 'x',
    displayName: 'X',
    capabilities,
    initialize() {},
    testConnection: async () => ({ success: true, message: 'ok' }),
    ...methods,
  } as unknown as DataSourcePlugin
}

describe('missingCapabilityMethods', () => {
  it('passes a plugin that implements every declared capability', () => {
    expect(missingCapabilityMethods(makePlugin(['alerts'], { getAlerts: () => [] }))).toEqual([])
    expect(
      missingCapabilityMethods(
        makePlugin(['topology', 'hosts'], { fetchTopology: () => ({}), getHosts: () => [] }),
      ),
    ).toEqual([])
  })

  it('reports a declared capability whose method is missing', () => {
    expect(
      missingCapabilityMethods(makePlugin(['alerts', 'topology'], { getAlerts: () => [] })),
    ).toEqual(['topology → fetchTopology()'])
  })

  it('ignores unknown (open) capabilities — no method contract to check', () => {
    expect(missingCapabilityMethods(makePlugin(['some-future-capability']))).toEqual([])
  })

  it('passes a plugin that declares nothing', () => {
    expect(missingCapabilityMethods(makePlugin([]))).toEqual([])
  })
})

describe('optional capability guards', () => {
  it('detects getConfigOptions (optionsSource candidates)', () => {
    expect(hasConfigOptions(makePlugin([]))).toBe(false)
    expect(hasConfigOptions(makePlugin([], { getConfigOptions: async () => [] }))).toBe(true)
  })

  it('detects getConnectionInfo (derived display)', () => {
    expect(hasConnectionInfo(makePlugin([]))).toBe(false)
    expect(hasConnectionInfo(makePlugin([], { getConnectionInfo: () => [] }))).toBe(true)
  })
})

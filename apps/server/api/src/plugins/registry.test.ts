// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import type { DataSourcePlugin } from '@shumoku/core'
import { describe, expect, it } from 'vitest'
import { pluginRegistry } from './registry.js'

const plugin = (
  type: string,
  capabilities: string[],
  methods: Record<string, unknown> = {},
): DataSourcePlugin =>
  ({
    type,
    displayName: type,
    capabilities,
    initialize() {},
    testConnection: async () => ({ success: true, message: 'ok' }),
    ...methods,
  }) as unknown as DataSourcePlugin

describe('PluginRegistry', () => {
  it('register (4-arg) delegates to registerDescriptor and creates without error', () => {
    pluginRegistry.register('reg-legacy', 'Legacy', ['alerts'], () =>
      plugin('reg-legacy', ['alerts'], { getAlerts: () => [] }),
    )
    expect(pluginRegistry.has('reg-legacy')).toBe(true)
    expect(() => pluginRegistry.create('reg-legacy', {})).not.toThrow()
  })

  it('registerDescriptor carries configSchema through getInfo (the asymmetry fix)', () => {
    pluginRegistry.registerDescriptor(
      {
        type: 'reg-desc',
        displayName: 'Desc',
        capabilities: ['alerts'],
        configSchema: { type: 'object', properties: { url: { type: 'string', format: 'uri' } } },
      },
      () => plugin('reg-desc', ['alerts'], { getAlerts: () => [] }),
    )
    expect(pluginRegistry.getInfo('reg-desc')?.configSchema?.properties.url?.format).toBe('uri')
  })

  it('throws on create when a declared capability is not implemented (C6, dev)', () => {
    pluginRegistry.registerDescriptor(
      { type: 'reg-bad', displayName: 'Bad', capabilities: ['topology'] },
      () => plugin('reg-bad', ['topology']), // missing fetchTopology
    )
    expect(() => pluginRegistry.create('reg-bad', {})).toThrow(/fetchTopology/)
  })

  it('ignores an unknown (open) capability during verification', () => {
    pluginRegistry.registerDescriptor(
      { type: 'reg-open', displayName: 'Open', capabilities: ['some-future-thing'] },
      () => plugin('reg-open', ['some-future-thing']),
    )
    expect(() => pluginRegistry.create('reg-open', {})).not.toThrow()
  })
})

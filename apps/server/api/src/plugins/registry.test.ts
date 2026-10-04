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
  it('register (4-arg) delegates to registerDescriptor and creates without error', async () => {
    pluginRegistry.register('reg-legacy', 'Legacy', ['alerts'], () =>
      plugin('reg-legacy', ['alerts'], { getAlerts: () => [] }),
    )
    expect(pluginRegistry.has('reg-legacy')).toBe(true)
    await expect(pluginRegistry.create('reg-legacy', {})).resolves.toBeTruthy()
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

  it.each([
    ['sync', (type: string) => () => plugin(type, ['topology'])],
    ['async', (type: string) => async () => plugin(type, ['topology'])],
  ])(
    'throws on create when a declared capability is not implemented (%s factory)',
    async (kind, makeFactory) => {
      const type = `reg-bad-${kind}`
      pluginRegistry.registerDescriptor(
        { type, displayName: 'Bad', capabilities: ['topology'] },
        makeFactory(type), // missing fetchTopology
      )
      await expect(pluginRegistry.create(type, {})).rejects.toThrow(/fetchTopology/)
    },
  )

  it('ignores an unknown (open) capability during verification', async () => {
    pluginRegistry.registerDescriptor(
      { type: 'reg-open', displayName: 'Open', capabilities: ['some-future-thing'] },
      () => plugin('reg-open', ['some-future-thing']),
    )
    await expect(pluginRegistry.create('reg-open', {})).resolves.toBeTruthy()
  })

  it('calls the factory once when getInstance is called concurrently for the same id', async () => {
    let calls = 0
    pluginRegistry.registerDescriptor(
      { type: 'reg-once', displayName: 'Once', capabilities: [] },
      async () => {
        calls += 1
        await new Promise((resolve) => setTimeout(resolve, 10))
        return plugin('reg-once', [])
      },
    )

    const [first, second] = await Promise.all([
      pluginRegistry.getInstance('ds-once', 'reg-once', {}),
      pluginRegistry.getInstance('ds-once', 'reg-once', {}),
    ])

    expect(calls).toBe(1)
    expect(first.type).toBe('reg-once')
    expect(second).toBe(first)
    pluginRegistry.removeInstance('ds-once')
  })

  it('forgets a failed creation, so the next getInstance tries again', async () => {
    let calls = 0
    pluginRegistry.registerDescriptor(
      { type: 'reg-retry', displayName: 'Retry', capabilities: [] },
      async () => {
        calls += 1
        if (calls === 1) throw new Error('upstream not ready')
        return plugin('reg-retry', [])
      },
    )

    await expect(pluginRegistry.getInstance('ds-retry', 'reg-retry', {})).rejects.toThrow(
      'upstream not ready',
    )
    await expect(pluginRegistry.getInstance('ds-retry', 'reg-retry', {})).resolves.toBeTruthy()
    expect(calls).toBe(2)
    pluginRegistry.removeInstance('ds-retry')
  })

  it('disposes an instance removed while it was still being created, and creates afresh after', async () => {
    const disposed: string[] = []
    let calls = 0
    pluginRegistry.registerDescriptor(
      { type: 'reg-pending', displayName: 'Pending', capabilities: [] },
      async () => {
        calls += 1
        const name = `instance-${calls}`
        await new Promise((resolve) => setTimeout(resolve, 10))
        return plugin('reg-pending', [], { name, dispose: () => disposed.push(name) })
      },
    )

    const pending = pluginRegistry.getInstance('ds-pending', 'reg-pending', {})
    pluginRegistry.removeInstance('ds-pending')
    await pending

    expect(disposed).toEqual(['instance-1'])
    const fresh = (await pluginRegistry.getInstance(
      'ds-pending',
      'reg-pending',
      {},
    )) as unknown as {
      name: string
    }
    expect(fresh.name).toBe('instance-2')
    pluginRegistry.removeInstance('ds-pending')
  })

  it('keeps a newer instance when an older, removed creation fails late', async () => {
    let calls = 0
    pluginRegistry.registerDescriptor(
      { type: 'reg-late-fail', displayName: 'Late Fail', capabilities: [] },
      async () => {
        calls += 1
        if (calls === 1) {
          await new Promise((resolve) => setTimeout(resolve, 20))
          throw new Error('first creation failed')
        }
        return plugin('reg-late-fail', [])
      },
    )

    const older = pluginRegistry.getInstance('ds-late-fail', 'reg-late-fail', {})
    pluginRegistry.removeInstance('ds-late-fail')
    const newer = pluginRegistry.getInstance('ds-late-fail', 'reg-late-fail', {})
    await expect(older).rejects.toThrow('first creation failed')

    expect(pluginRegistry.getInstance('ds-late-fail', 'reg-late-fail', {})).toBe(newer)
    expect(calls).toBe(2)
    pluginRegistry.removeInstance('ds-late-fail')
  })

  it('clearInstances disposes created and still-pending instances alike', async () => {
    const disposed: string[] = []
    pluginRegistry.registerDescriptor(
      { type: 'reg-clear', displayName: 'Clear', capabilities: [] },
      async (config) => {
        const { name, delayMs } = config as { name: string; delayMs: number }
        await new Promise((resolve) => setTimeout(resolve, delayMs))
        return plugin('reg-clear', [], { dispose: () => disposed.push(name) })
      },
    )
    await pluginRegistry.getInstance('ds-clear-created', 'reg-clear', {
      name: 'created',
      delayMs: 0,
    })
    const pending = pluginRegistry.getInstance('ds-clear-pending', 'reg-clear', {
      name: 'pending',
      delayMs: 10,
    })

    pluginRegistry.clearInstances()
    await pending
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(disposed.sort()).toEqual(['created', 'pending'])
  })

  it('unregister removes a type and disposes every instance of it, leaving other types alone', async () => {
    const disposed: string[] = []
    const factoryFor =
      (type: string) =>
      async (config: unknown): Promise<DataSourcePlugin> => {
        const { name, delayMs } = config as { name: string; delayMs: number }
        await new Promise((resolve) => setTimeout(resolve, delayMs))
        return plugin(type, [], { dispose: () => disposed.push(name) })
      }
    pluginRegistry.registerDescriptor(
      { type: 'reg-gone', displayName: 'Gone', capabilities: [] },
      factoryFor('reg-gone'),
    )
    pluginRegistry.registerDescriptor(
      { type: 'reg-kept', displayName: 'Kept', capabilities: [] },
      factoryFor('reg-kept'),
    )
    await pluginRegistry.getInstance('ds-gone-created', 'reg-gone', { name: 'gone', delayMs: 0 })
    const pending = pluginRegistry.getInstance('ds-gone-pending', 'reg-gone', {
      name: 'gone-pending',
      delayMs: 10,
    })
    const kept = await pluginRegistry.getInstance('ds-kept', 'reg-kept', {
      name: 'kept',
      delayMs: 0,
    })

    pluginRegistry.unregister('reg-gone')
    await pending
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(disposed.sort()).toEqual(['gone', 'gone-pending'])
    expect(pluginRegistry.has('reg-gone')).toBe(false)
    await expect(pluginRegistry.getInstance('ds-gone-created', 'reg-gone', {})).rejects.toThrow(
      'Unknown plugin type: reg-gone',
    )
    expect(await pluginRegistry.getInstance('ds-kept', 'reg-kept', {})).toBe(kept)
    pluginRegistry.removeInstance('ds-kept')
  })
})

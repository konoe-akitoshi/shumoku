// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import {
  type DataSourcePlugin,
  missingCapabilityMethods,
  type PluginDescriptor,
  type PluginFactory,
  validateAgainstSchema,
} from '@shumoku/core'
import { describe, expect, it } from 'vitest'

/**
 * Proves the external-plugin contract end-to-end using the worked example in
 * examples/sample-plugin: a plugin reaches the host (config rendering +
 * validation + capability dispatch) purely through its descriptor, with ZERO
 * edits to @shumoku/core or the web app. This is the executable counterpart to
 * the C7 host-branch guard.
 */
const here = dirname(fileURLToPath(import.meta.url))
const SAMPLE_DIR = join(here, '..', '..', '..', '..', '..', 'examples', 'sample-plugin')

describe('examples/sample-plugin (external-first contract)', () => {
  it('register() hands the host a descriptor with a configSchema', async () => {
    const mod = await import(pathToFileURL(join(SAMPLE_DIR, 'index.mjs')).href)
    let captured: { descriptor: PluginDescriptor; factory: PluginFactory } | null = null
    mod.register({
      registerDescriptor(descriptor: PluginDescriptor, factory: PluginFactory) {
        captured = { descriptor, factory }
      },
      register() {
        throw new Error('sample should use registerDescriptor')
      },
    })

    expect(captured).not.toBeNull()
    const { descriptor, factory } = captured as unknown as {
      descriptor: PluginDescriptor
      factory: PluginFactory
    }
    expect(descriptor.type).toBe('sample-hosts')
    expect(descriptor.capabilities).toEqual(['hosts'])
    expect(descriptor.configSchema?.properties.label).toBeTruthy()

    // The factory's instance satisfies the capability it advertises (C6).
    const plugin = factory({ label: 'web', hostCount: 2 }) as DataSourcePlugin
    expect(missingCapabilityMethods(plugin)).toEqual([])
    const hosts = await (plugin as DataSourcePlugin & { getHosts(): Promise<unknown[]> }).getHosts()
    expect(hosts).toHaveLength(2)
  })

  it('the manifest configSchema validates config via core (same path as the host)', () => {
    const manifest = JSON.parse(readFileSync(join(SAMPLE_DIR, 'plugin.json'), 'utf-8'))
    expect(manifest.capabilities).toEqual(['hosts'])
    const schema = manifest.configSchema
    expect(validateAgainstSchema(schema, { label: 'web', region: 'osaka' })).toEqual({ ok: true })

    const missing = validateAgainstSchema(schema, { region: 'osaka' })
    expect(missing.ok).toBe(false)
    if (missing.ok) return
    expect(missing.errors.map((e) => e.path)).toContain('label')

    // out-of-range number + bad oneOf are rejected too
    const bad = validateAgainstSchema(schema, { label: 'x', hostCount: 999, region: 'mars' })
    expect(bad.ok).toBe(false)
  })
})

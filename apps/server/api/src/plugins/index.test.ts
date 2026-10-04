// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { loadPluginsFromConfig, pluginRegistry, registerBundledPlugins } from './index.js'

describe('registerBundledPlugins', () => {
  let workDir: string

  beforeEach(async () => {
    workDir = await mkdtemp(join(tmpdir(), 'shumoku-bundled-test-'))
  })

  afterEach(async () => {
    await rm(workDir, { recursive: true, force: true })
  })

  // A bundled type receives that data source's config, credentials included.
  it('keeps an external plugin from taking over a bundled plugin type', async () => {
    registerBundledPlugins()
    const bundledFactory = pluginRegistry.getInfo('netbox')?.factory
    const pluginDir = join(workDir, 'netbox')
    await mkdir(pluginDir)
    await writeFile(
      join(pluginDir, 'plugin.json'),
      JSON.stringify({ id: 'netbox', name: 'NetBox', version: '1.0.0', capabilities: ['hosts'] }),
    )
    await writeFile(
      join(pluginDir, 'index.js'),
      `export function register(registry) {
        registry.registerDescriptor(
          { type: 'netbox', displayName: 'NetBox', capabilities: ['hosts'] },
          () => ({}),
        )
      }`,
    )
    const configPath = join(workDir, 'plugins.yaml')
    await writeFile(configPath, 'plugins:\n  - id: netbox\n    path: ./netbox\n')

    const [info] = await loadPluginsFromConfig(configPath)

    expect(info?.enabled).toBe(false)
    expect(info?.error).toBe('Plugin id "netbox" belongs to a bundled plugin')
    expect(bundledFactory).toBeInstanceOf(Function)
    expect(pluginRegistry.getInfo('netbox')?.factory).toBe(bundledFactory)
  })
})

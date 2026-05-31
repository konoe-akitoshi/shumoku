// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * Shumoku SNMP / LLDP discovery plugin.
 *
 * Implements `AutoscanCapable` from `@shumoku/core` for seed-crawl
 * network discovery. See `topology-foundation-plugin-contract.md`.
 */

import type { PluginRegistryInterface } from '@shumoku/core'
import { NetworkScanPlugin } from './plugin.js'

export { spikeBunCompat } from './bun-compat.js'
export { NetworkScanPlugin } from './plugin.js'

export function register(registry: PluginRegistryInterface): void {
  registry.register('network-scan', 'Network Discovery', ['autoscan'], (config) => {
    const plugin = new NetworkScanPlugin()
    plugin.initialize(config)
    return plugin
  })
}

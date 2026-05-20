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
import { SnmpLldpPlugin } from './plugin.js'

export { spikeBunCompat } from './bun-compat.js'
export { SnmpLldpPlugin } from './plugin.js'

export function register(registry: PluginRegistryInterface): void {
  registry.register('snmp-lldp', 'SNMP / LLDP', ['autoscan', 'topology'], (config) => {
    const plugin = new SnmpLldpPlugin()
    plugin.initialize(config)
    return plugin
  })
}

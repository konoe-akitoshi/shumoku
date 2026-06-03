// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * Shumoku SNMP / LLDP discovery plugin.
 *
 * Implements `AutoscanCapable` from `@shumoku/core` for seed-crawl
 * network discovery. See `topology-foundation-plugin-contract.md`.
 */

import type { PluginConfigSchema, PluginRegistryInterface } from '@shumoku/core'
import { NetworkScanPlugin } from './plugin.js'

export { spikeBunCompat } from './bun-compat.js'
export { NetworkScanPlugin } from './plugin.js'

/**
 * Self-description: the host renders this form and validates config from it.
 * `instanceId` is intentionally absent — it is server-supplied (injected at
 * construction), not user input.
 */
const configSchema: PluginConfigSchema = {
  type: 'object',
  properties: {
    community: {
      type: 'string',
      title: 'SNMP community',
      default: 'public',
      help: 'SNMPv2c community used for every target.',
    },
    targets: {
      type: 'array',
      items: { type: 'string' },
      freeSolo: true,
      title: 'Targets',
      help: 'IPv4, hostname, or CIDR (10.0.0.0/24). CIDR is expanded and liveness-probed.',
    },
    timeoutMs: {
      type: 'number',
      title: 'Per-device timeout (ms)',
      default: 2000,
      minimum: 200,
      maximum: 30000,
      step: 100,
    },
  },
}

export function register(registry: PluginRegistryInterface): void {
  registry.registerDescriptor(
    {
      type: 'network-scan',
      displayName: 'Network Discovery',
      capabilities: ['autoscan'],
      configSchema,
    },
    (config) => {
      const plugin = new NetworkScanPlugin()
      plugin.initialize(config)
      return plugin
    },
  )
}

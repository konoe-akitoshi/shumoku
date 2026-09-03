// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * Shumoku existence-discovery plugin.
 *
 * Implements `AutoscanCapable` from `@shumoku/core` for credential-free network
 * sweeps — which devices exist, each identified by address + MAC. Reading a
 * device in depth (SNMP/LLDP) is the server-side Discovery deep-read, not here.
 */

import type { PluginConfigSchema, PluginRegistryInterface } from '@shumoku/core'
import { NetworkScanPlugin } from './plugin.js'

export { NetworkScanPlugin } from './plugin.js'

/**
 * Self-description: the host renders this form and validates config from it.
 * `instanceId` is intentionally absent — it is server-supplied (injected at
 * construction), not user input.
 */
const configSchema: PluginConfigSchema = {
  type: 'object',
  properties: {
    targets: {
      type: 'array',
      items: { type: 'string' },
      freeSolo: true,
      title: 'Targets',
      help: 'IPv4, hostname, or CIDR (10.0.0.0/24). CIDR is expanded and swept for reachability.',
    },
    includeClients: {
      type: 'boolean',
      title: 'Include client devices',
      default: false,
      help: 'Keep hosts with a randomised MAC (phones/laptops). Off keeps the sweep to infrastructure.',
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

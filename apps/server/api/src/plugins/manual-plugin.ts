// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Manual plugin — a no-op `DataSourcePlugin` whose role is to be a
 * named container for editor-authored snapshots in `topology_observations`.
 *
 * Unlike NetBox / SNMP / Zabbix, Manual has no upstream to talk to:
 * it never fetches, never scans, never polls. The editor writes
 * observations against it directly. We register it as a bundled plugin
 * type so the rest of the system (Sources tab, +Add Source, attach API,
 * resolver) can treat it exactly like any other source — no special-casing.
 *
 * Manual is a fully uniform source: no cardinality or sharing
 * constraints. It can be created on /datasources and attached to one
 * or many topologies, exactly like any other source.
 *
 * Capability list is empty on purpose: there is nothing to dispatch
 * to (no `fetchTopology`, no `scan`). The Sync button in the UI hides
 * itself for capability-less sources.
 */

import type {
  ConnectionResult,
  DataSourceCapability,
  DataSourcePlugin,
  PluginRegistryInterface,
} from '@shumoku/core'

export class ManualPlugin implements DataSourcePlugin {
  readonly type = 'manual'
  readonly displayName = 'Manual'
  readonly capabilities: readonly DataSourceCapability[] = []

  initialize(_config: unknown): void {
    // Nothing to initialise. Config is `{}`.
  }

  async testConnection(): Promise<ConnectionResult> {
    // Always healthy — there 's no upstream to fail.
    return { success: true, message: 'Manual source — no upstream' }
  }
}

export function registerManualPlugin(registry: PluginRegistryInterface): void {
  // No configSchema: Manual has no upstream and no config form.
  registry.registerDescriptor({ type: 'manual', displayName: 'Manual', capabilities: [] }, () => {
    const plugin = new ManualPlugin()
    plugin.initialize({})
    return plugin
  })
}

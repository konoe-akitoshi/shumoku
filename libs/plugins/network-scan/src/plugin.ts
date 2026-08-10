// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * Existence discovery plugin — implements `DataSourcePlugin` + `AutoscanCapable`.
 *
 * Credential-free: it sweeps the configured targets and reports which devices
 * EXIST, each identified by address and MAC so it can merge with what other
 * sources know. Reading a device in depth (SNMP, LLDP, the backbone) is a
 * separate server-side step — the Discovery deep-read — not this plugin's job.
 */

import type {
  AutoscanCapable,
  AutoscanInput,
  ConnectionResult,
  DataSourceCapability,
  DataSourcePlugin,
  Snapshot,
} from '@shumoku/core'
import { expandTargets } from './cidr.js'
import { discover } from './discover.js'
import { probeReachable } from './reachability.js'

export interface NetworkScanConfig {
  /** Plugin instance id, stamped into provenance.source. Supplied by
   *  the server when constructing the plugin. */
  instanceId?: string
  /**
   * Mixed list of scan targets. Each entry is an IPv4 address, a hostname, or a
   * CIDR block (`10.0.0.0/24`). CIDR is expanded to individual host addresses.
   */
  targets?: string[]
  /**
   * Keep reachable hosts whose MAC is locally administered — phones and
   * laptops that randomise their address per network. Off by default: they
   * answer the sweep like anything else, are not part of the topology, and
   * churn on every scan. However many are dropped is always reported in the
   * snapshot warnings, never applied silently.
   */
  includeClients?: boolean
}

export class NetworkScanPlugin implements DataSourcePlugin, AutoscanCapable {
  readonly type = 'network-scan'
  readonly displayName = 'Network Discovery'
  // `autoscan` is the load-bearing capability — the plugin produces a
  // Snapshot via `scan()`. The plugin does NOT implement `fetchTopology()`
  // (that 's `TopologyCapable`); the server 's /sync-from-source dispatches
  // to `scan()` when it sees `autoscan` capability.
  readonly capabilities: readonly DataSourceCapability[] = ['autoscan']

  private config: NetworkScanConfig = {}

  initialize(config: unknown): void {
    this.config = (config as NetworkScanConfig) ?? {}
  }

  /**
   * `testConnection` probes a sample of targets for reachability (TCP) — no
   * credential, since existence discovery needs none.
   *
   * Soft-success policy: if no sample responds we still return `success: true`
   * with a note. Config is saved; a real scan surfaces actual reachability, and
   * a quiet moment on the segment shouldn't read as "misconfigured".
   */
  async testConnection(): Promise<ConnectionResult> {
    const targets = this.config.targets ?? []
    if (targets.length === 0) {
      return { success: false, message: 'No targets configured' }
    }

    let samples: string[] = []
    const firstConcrete = targets.find((t) => !t.includes('/'))
    if (firstConcrete) {
      samples = [firstConcrete]
    } else {
      try {
        samples = expandTargets(targets).slice(0, 3)
      } catch (err) {
        return { success: false, message: err instanceof Error ? err.message : String(err) }
      }
    }

    const reachable = await probeReachable(samples, { timeoutMs: 1000 })
    const hit = [...reachable.keys()][0]
    if (hit) {
      return { success: true, message: `Reached ${hit}` }
    }

    return {
      success: true,
      message: firstConcrete
        ? `No response from ${firstConcrete}. Run a scan to retry.`
        : `Sampled ${samples.length} address(es) from the configured CIDR(s); none responded. Run a scan to verify reachability.`,
      warnings: ['No sample target responded — saved anyway.'],
    }
  }

  /**
   * AutoscanCapable.scan — expand targets (incl. CIDR) and sweep for existence.
   * Produces notice nodes; reading them in depth is the deep-read's job.
   *
   * Seeds and configured targets are unioned: the config is the operator's
   * scope (where to look for devices nobody knows yet), seeds are addresses the
   * topology already knows and wants confirmed. `seedsOnly` restricts to seeds
   * for the ad-hoc path where widening would surprise.
   */
  async scan(input: AutoscanInput): Promise<Snapshot> {
    const capturedAt = Date.now()
    const sourceId = this.config.instanceId ?? 'network-scan'
    const targets = input.seedsOnly
      ? input.seeds
      : [...new Set([...(this.config.targets ?? []), ...input.seeds])]

    if (targets.length === 0) {
      return { status: 'failed', statusMessage: 'No targets configured', capturedAt, graph: null }
    }

    try {
      const result = await discover({
        targets,
        sourceId,
        includeClients: this.config.includeClients,
      })
      return {
        status: result.graph.nodes.length === 0 ? 'empty' : 'ok',
        capturedAt,
        graph: result.graph,
        warnings: result.warnings.length > 0 ? result.warnings : undefined,
      }
    } catch (err) {
      return {
        status: 'failed',
        statusMessage: err instanceof Error ? err.message : String(err),
        capturedAt,
        graph: null,
      }
    }
  }
}

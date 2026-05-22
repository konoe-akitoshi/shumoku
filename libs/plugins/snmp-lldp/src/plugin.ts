// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * SNMP-LLDP plugin — implements `DataSourcePlugin` + `AutoscanCapable`.
 *
 * v1 scope: System-MIB identification, IF-MIB / ifXTable port walk,
 * LLDP-MIB neighbor harvest. Other MIBs (BRIDGE, ENTITY, ROUTING) are
 * out-of-scope for v1; see mvp doc.
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
import { SnmpClient } from './client.js'
import { discover } from './discover.js'
import { SYSTEM_MIB } from './mib.js'

export interface SnmpLldpConfig {
  /** Plugin instance id, stamped into provenance.source. Supplied by
   *  the server when constructing the plugin. */
  instanceId?: string
  /** SNMPv2c community string used for every target. */
  community?: string
  /**
   * Mixed list of scan targets. Each entry is an IPv4 address, a
   * hostname, or a CIDR block (`10.0.0.0/24`). CIDR is expanded to
   * individual host addresses and triaged via a liveness probe before
   * the full SNMP walk runs.
   */
  targets?: string[]
  /** Deep-scan timeout in ms per device (default 2000). */
  timeoutMs?: number
}

export class SnmpLldpPlugin implements DataSourcePlugin, AutoscanCapable {
  readonly type = 'snmp-lldp'
  readonly displayName = 'Network Discovery'
  // `autoscan` is the load-bearing capability — the plugin produces a
  // Snapshot via `scan()`. The plugin does NOT implement `fetchTopology()`
  // (that 's `TopologyCapable`); the server 's /sync-from-source dispatches
  // to `scan()` when it sees `autoscan` capability.
  readonly capabilities: readonly DataSourceCapability[] = ['autoscan']

  private config: SnmpLldpConfig = {}

  initialize(config: unknown): void {
    this.config = (config as SnmpLldpConfig) ?? {}
  }

  /**
   * `testConnection` probes a sample target for System-MIB scalars.
   *
   * Picks the first concrete (non-CIDR) target if one is configured.
   * Otherwise expands the first CIDR and probes a small sample of
   * addresses — CIDR-only configurations are valid (very common in
   * practice) and should not be reported as "disconnected" just because
   * no single host could be picked.
   *
   * Soft-success policy: if no sample responds we still return
   * `success: true` with a note. The credentials are saved; a real scan
   * will surface actual reachability.
   */
  async testConnection(): Promise<ConnectionResult> {
    const targets = this.config.targets ?? []
    if (targets.length === 0) {
      return { success: false, message: 'No targets configured' }
    }

    // Pick up to 3 sample addresses to probe.
    let samples: string[] = []
    const firstConcrete = targets.find((t) => !t.includes('/'))
    if (firstConcrete) {
      samples = [firstConcrete]
    } else {
      // CIDR-only: expand the first one and sample.
      try {
        const expanded = expandTargets(targets)
        samples = expanded.slice(0, 3)
      } catch (err) {
        return {
          success: false,
          message: err instanceof Error ? err.message : String(err),
        }
      }
    }

    const community = this.config.community || 'public'
    const timeoutMs = this.config.timeoutMs ?? 2000

    // Probe samples in parallel. First responder wins.
    const probes = samples.map(async (address) => {
      const client = new SnmpClient({
        address,
        community,
        timeoutMs,
        retries: 0,
      })
      try {
        const vbs = await client.get([
          SYSTEM_MIB.sysName,
          SYSTEM_MIB.sysObjectID,
          SYSTEM_MIB.sysDescr,
        ])
        return {
          address,
          sysName: vbs[0]?.value,
          sysObjectID: vbs[1]?.value,
        }
      } catch {
        return null
      } finally {
        client.close()
      }
    })

    const results = await Promise.all(probes)
    const hit = results.find((r) => r !== null)
    if (hit) {
      return {
        success: true,
        message: `Reached ${hit.address} (sysName=${String(hit.sysName)})`,
        version: typeof hit.sysObjectID === 'string' ? hit.sysObjectID : undefined,
      }
    }

    // No sample responded. Soft success — credentials saved, scan to verify.
    return {
      success: true,
      message: firstConcrete
        ? `No response from ${firstConcrete}. Run a scan to retry.`
        : `Sampled ${samples.length} address(es) from the configured CIDR(s); none responded. Run a scan to verify reachability.`,
      warnings: ['No sample target responded — saved anyway.'],
    }
  }

  /**
   * AutoscanCapable.scan — expand targets (incl. CIDR), liveness probe,
   * then full SNMP walk on responders.
   *
   * `input.seeds` from the caller (if any) overrides the configured
   * targets — useful for ad-hoc scans of a specific subset.
   */
  async scan(input: AutoscanInput): Promise<Snapshot> {
    const capturedAt = Date.now()
    const sourceId = this.config.instanceId ?? 'snmp-lldp'
    const targets = input.seeds.length > 0 ? input.seeds : (this.config.targets ?? [])
    const community = this.config.community || 'public'

    if (targets.length === 0) {
      return {
        status: 'failed',
        statusMessage: 'No targets configured',
        capturedAt,
        graph: null,
      }
    }

    try {
      const result = await discover({
        targets,
        community,
        sourceId,
        timeoutMs: this.config.timeoutMs,
      })
      const status: Snapshot['status'] =
        result.graph.nodes.length === 0 ? 'empty' : result.warnings.length === 0 ? 'ok' : 'partial'
      return {
        status,
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

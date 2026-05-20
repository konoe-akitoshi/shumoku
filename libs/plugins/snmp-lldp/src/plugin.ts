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
import { SnmpClient } from './client.js'
import { discover } from './discover.js'
import { SYSTEM_MIB } from './mib.js'

/**
 * Seed entry as expected on plugin config. UI surfaces these as a
 * repeatable list (address + community).
 */
export interface SnmpLldpSeed {
  address: string
  community: string
}

export interface SnmpLldpConfig {
  /** Plugin instance id, stamped into provenance.source. Supplied by
   *  the server when constructing the plugin. */
  instanceId?: string
  /** Default community used when a seed doesn 't specify one. */
  community?: string
  /** Seed devices to crawl. */
  seeds?: SnmpLldpSeed[]
  /** Per-device SNMP timeout in ms (default 2000). */
  timeoutMs?: number
}

export class SnmpLldpPlugin implements DataSourcePlugin, AutoscanCapable {
  readonly type = 'snmp-lldp'
  readonly displayName = 'Network Discovery'
  readonly capabilities: readonly DataSourceCapability[] = ['autoscan', 'topology']

  private config: SnmpLldpConfig = {}

  initialize(config: unknown): void {
    this.config = (config as SnmpLldpConfig) ?? {}
  }

  /** `testConnection` probes the first seed for System-MIB scalars.
   *  Reports identity-coverage diagnostics back so the UI can advise. */
  async testConnection(): Promise<ConnectionResult> {
    const seed = this.config.seeds?.[0]
    if (!seed) {
      return { success: false, message: 'No seed devices configured' }
    }
    const client = new SnmpClient({
      address: seed.address,
      community: seed.community || this.config.community || 'public',
      timeoutMs: this.config.timeoutMs ?? 2000,
    })
    try {
      const vbs = await client.get([
        SYSTEM_MIB.sysName,
        SYSTEM_MIB.sysObjectID,
        SYSTEM_MIB.sysDescr,
      ])
      const sysName = vbs[0]?.value
      const sysObjectID = vbs[1]?.value
      return {
        success: true,
        message: `Reached ${seed.address} (sysName=${String(sysName)})`,
        version: typeof sysObjectID === 'string' ? sysObjectID : undefined,
      }
    } catch (err) {
      return {
        success: false,
        message: err instanceof Error ? err.message : String(err),
      }
    } finally {
      client.close()
    }
  }

  /**
   * AutoscanCapable.scan — perform the seed-crawl and return a Snapshot.
   * The `input` from the caller can override the configured seeds; if
   * absent we fall back to `this.config.seeds`.
   */
  async scan(input: AutoscanInput): Promise<Snapshot> {
    const capturedAt = Date.now()
    const sourceId = this.config.instanceId ?? 'snmp-lldp'
    const seeds = (
      input.seeds.length > 0 ? input.seeds : (this.config.seeds ?? []).map((s) => s.address)
    ).map((addr) => ({
      address: addr,
      community:
        this.config.seeds?.find((s) => s.address === addr)?.community ??
        this.config.community ??
        'public',
    }))

    if (seeds.length === 0) {
      return {
        status: 'failed',
        statusMessage: 'No seed devices configured',
        capturedAt,
        graph: null,
      }
    }

    try {
      const result = await discover({
        seeds,
        sourceId,
        timeoutMs: this.config.timeoutMs,
      })
      const status: Snapshot['status'] =
        result.graph.nodes.length === 0 ? 'empty' : result.allOk ? 'ok' : 'partial'
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

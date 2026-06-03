// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * Thin promise-based wrapper around `net-snmp`. Only the operations the
 * plugin uses are exposed: `get` (single OIDs) and `walk` (full subtree).
 *
 * net-snmp 's native API is callback-based; this module makes it await-
 * friendly so the discovery flow reads as straight-line logic.
 */

import * as snmp from 'net-snmp'

export interface SnmpTarget {
  address: string
  community: string
  port?: number
  timeoutMs?: number
  retries?: number
  version?: '2c'
}

export interface VarbindLike {
  oid: string
  value: snmp.VarbindValue
}

export class SnmpClient {
  private session: snmp.Session

  constructor(target: SnmpTarget) {
    this.session = snmp.createSession(target.address, target.community, {
      port: target.port ?? 161,
      version: snmp.Version2c,
      timeout: target.timeoutMs ?? 2000,
      retries: target.retries ?? 1,
    })
  }

  close(): void {
    this.session.close()
  }

  /** Fetch a single OID (or a small list). Rejects on transport / SNMP error. */
  get(oids: string[]): Promise<VarbindLike[]> {
    return new Promise((resolve, reject) => {
      this.session.get(oids, (err, vbs) => {
        if (err) return reject(err)
        if (!vbs) return resolve([])
        for (const vb of vbs) {
          if (snmp.isVarbindError(vb)) {
            return reject(new Error(snmp.varbindError(vb)))
          }
        }
        resolve(
          vbs.map((vb) => ({
            oid: vb.oid,
            value: vb.value,
          })),
        )
      })
    })
  }

  /**
   * Walk a subtree (e.g. an IF-MIB column). Returns all varbinds at or
   * below `oid`. v2c bulk repetitions defaulted to 20 (sensible for
   * walking small tables like LLDP-MIB).
   */
  walk(oid: string, maxRepetitions = 20): Promise<VarbindLike[]> {
    return new Promise((resolve, reject) => {
      const out: VarbindLike[] = []
      this.session.subtree(
        oid,
        maxRepetitions,
        (vbs) => {
          for (const vb of vbs) {
            if (!snmp.isVarbindError(vb)) {
              out.push({ oid: vb.oid, value: vb.value })
            }
          }
        },
        (err) => {
          if (err) return reject(err)
          resolve(out)
        },
      )
    })
  }
}

/**
 * Group walk results by row-suffix. Given column OIDs like
 *   1.3.6.1.2.1.2.2.1.2.1 = "Gi1/0/1"
 *   1.3.6.1.2.1.2.2.1.2.2 = "Gi1/0/2"
 * with columnBase "1.3.6.1.2.1.2.2.1.2", returns `{ "1": "...", "2": "..." }`.
 */
export function indexByRow(
  walkResult: VarbindLike[],
  columnBase: string,
): Record<string, snmp.VarbindValue> {
  const out: Record<string, snmp.VarbindValue> = {}
  const prefix = `${columnBase}.`
  for (const vb of walkResult) {
    if (!vb.oid.startsWith(prefix)) continue
    const rowSuffix = vb.oid.slice(prefix.length)
    out[rowSuffix] = vb.value
  }
  return out
}

/**
 * Format a Buffer-typed varbind value (e.g. MAC address) as `aa:bb:...`.
 * Returns the string unchanged if it isn't a Buffer.
 */
export function asMacString(value: snmp.VarbindValue | undefined): string | undefined {
  if (value === undefined) return undefined
  if (Buffer.isBuffer(value)) {
    if (value.length !== 6)
      return value
        .toString('hex')
        .match(/.{1,2}/g)
        ?.join(':')
    return Array.from(value)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join(':')
  }
  return typeof value === 'string' ? value : String(value)
}

/** Coerce a varbind value into a string (UTF-8 best effort). */
export function asString(value: snmp.VarbindValue | undefined): string | undefined {
  if (value === undefined || value === null) return undefined
  if (Buffer.isBuffer(value)) return value.toString('utf8')
  return String(value)
}

/** Coerce a varbind value into a number. */
export function asNumber(value: snmp.VarbindValue | undefined): number | undefined {
  if (typeof value === 'number') return value
  if (typeof value === 'bigint') return Number(value)
  if (typeof value === 'string' && !Number.isNaN(Number(value))) return Number(value)
  return undefined
}

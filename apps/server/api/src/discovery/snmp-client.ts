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
   *
   * Tolerates one real-world SNMP-agent defect: some agents (Maipu's IS230
   * among them, seen live on the LLDP table) return rows whose OIDs are not
   * strictly increasing. A strict walk aborts there with "OID not increasing"
   * and loses the whole table, so the walk resolves with what it collected
   * rather than rejecting. Any other error still rejects.
   *
   * The non-increasing row has to be caught here, in the feed callback,
   * rather than left to `net-snmp` to report. Its loop guard only checks
   * that the walk has not run off the end of the requested subtree; an
   * agent that repeats an OID *inside* the subtree never trips it, and
   * `subtree` then spins forever without ever calling back. Observed on
   * two Huawei-based storage switches repeating a single
   * `lldpRemTable` row: 507,140 varbinds in 300s, all but the first a
   * duplicate of its predecessor, done callback never fired. That wedges
   * the caller permanently and grows `out` without bound, so the walk
   * stops itself the moment an OID fails to increase.
   */
  walk(oid: string, maxRepetitions = 20): Promise<VarbindLike[]> {
    return new Promise((resolve, reject) => {
      const out: VarbindLike[] = []
      let previousOid: string | null = null
      let settled = false
      const settle = (fn: () => void) => {
        if (settled) return
        settled = true
        fn()
      }
      this.session.subtree(
        oid,
        maxRepetitions,
        (vbs) => {
          if (settled) return true
          for (const vb of vbs) {
            if (previousOid !== null && compareOids(vb.oid, previousOid) <= 0) {
              settle(() => resolve(out))
              // net-snmp stops requesting the next batch only when feed returns true.
              return true
            }
            previousOid = vb.oid
            if (!snmp.isVarbindError(vb)) {
              out.push({ oid: vb.oid, value: vb.value })
            }
          }
        },
        (err) => {
          if (err && !/not increasing/i.test(err.message ?? String(err))) {
            return settle(() => reject(err))
          }
          settle(() => resolve(out))
        },
      )
    })
  }
}

/**
 * Compare two dotted OIDs by arc, returning the usual negative / zero /
 * positive. Arcs are numbers, not text: `1.3.6.1.2.1.2.2.1.2.10` sorts
 * after `...2.9`, which a lexicographic compare gets backwards. A prefix
 * sorts before anything that extends it.
 */
export function compareOids(a: string, b: string): number {
  const left = a.split('.')
  const right = b.split('.')
  const shared = Math.min(left.length, right.length)
  for (let i = 0; i < shared; i++) {
    const diff = Number(left[i]) - Number(right[i])
    if (diff !== 0) return diff
  }
  return left.length - right.length
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

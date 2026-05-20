// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import type { Identity } from '../models/types.js'
import type { IdentityQuality } from './types.js'

/**
 * Node / Port identity helpers used by the resolver.
 * See `apps/server/docs/design/topology-foundation-identity.md`.
 *
 * Priority order matters: the resolver tries keys in this order and
 * stops at the first hit. `ifIndex` is intentionally low-priority
 * because many devices renumber it across reboots — `ifName` /
 * `chassisId` are the load-bearing keys.
 */

/** Tagged identity key — kind helps the resolver index multiple
 * sources of the same key value without collision (e.g. a node's
 * sysName "core-rtr-01" must not collide with a vendor id of the
 * same string). */
export interface IdentityKey {
  kind: 'mgmtIp' | 'chassisId' | 'sysName' | 'ifName' | 'ifIndex' | 'mac' | 'vendorId'
  value: string
}

/**
 * Enumerate Node identity keys in priority order. The first match
 * wins during cluster lookup. Caller should also bind *every* key
 * to the resulting cluster after a match so subsequent observations
 * collapse correctly even if they only carry a weaker key.
 */
export function nodeIdentityKeys(identity: Identity | undefined): IdentityKey[] {
  if (!identity) return []
  const keys: IdentityKey[] = []
  // priority 1: mgmtIp (worldwide-meaningful)
  if (identity.mgmtIp) keys.push({ kind: 'mgmtIp', value: identity.mgmtIp })
  // priority 2: chassisId (LLDP gospel)
  if (identity.chassisId) keys.push({ kind: 'chassisId', value: identity.chassisId })
  // priority 3: sysName (fallback)
  if (identity.sysName) keys.push({ kind: 'sysName', value: identity.sysName })
  // priority 4: vendorIds (source-internal, namespace by entry key)
  if (identity.vendorIds) {
    for (const [vendor, value] of Object.entries(identity.vendorIds)) {
      keys.push({ kind: 'vendorId', value: `${vendor}=${value}` })
    }
  }
  return keys
}

/**
 * Enumerate Port identity keys in priority order. Port matching
 * happens *within* a parent node cluster — the same `ifName` on a
 * different chassis is a different port. The caller is responsible
 * for that scoping; this list is just the per-port priority order.
 */
export function portIdentityKeys(identity: Identity | undefined): IdentityKey[] {
  if (!identity) return []
  const keys: IdentityKey[] = []
  // priority 1: ifName (stable across reboots if device honors it)
  if (identity.ifName) keys.push({ kind: 'ifName', value: identity.ifName })
  // priority 2: mac (per-NIC, usually stable)
  if (identity.mac) keys.push({ kind: 'mac', value: identity.mac })
  // priority 3: ifIndex (WEAK — may renumber)
  if (identity.ifIndex !== undefined) {
    keys.push({ kind: 'ifIndex', value: String(identity.ifIndex) })
  }
  if (identity.vendorIds) {
    for (const [vendor, value] of Object.entries(identity.vendorIds)) {
      keys.push({ kind: 'vendorId', value: `${vendor}=${value}` })
    }
  }
  return keys
}

/**
 * Coarse identity quality — surfaced in UI to warn users which
 * elements may detach from their metrics/observations across reboots.
 *
 * Node: `stable` if chassisId + (mgmtIp or sysName), `weak` if any
 * single primary key, `unbound` otherwise.
 *
 * Port: `stable` if ifName + (mac or ifIndex), `weak` if any single
 * key, `unbound` otherwise.
 */
export function nodeIdentityQuality(identity: Identity | undefined): IdentityQuality {
  if (!identity) return 'unbound'
  const hasChassis = Boolean(identity.chassisId)
  const hasMgmt = Boolean(identity.mgmtIp)
  const hasSys = Boolean(identity.sysName)
  if (hasChassis && (hasMgmt || hasSys)) return 'stable'
  if (hasChassis || hasMgmt) return 'weak'
  if (hasSys) return 'weak'
  return 'unbound'
}

export function portIdentityQuality(identity: Identity | undefined): IdentityQuality {
  if (!identity) return 'unbound'
  const hasName = Boolean(identity.ifName)
  const hasMac = Boolean(identity.mac)
  const hasIndex = identity.ifIndex !== undefined
  if (hasName && (hasMac || hasIndex)) return 'stable'
  if (hasName || hasMac) return 'weak'
  if (hasIndex) return 'weak'
  return 'unbound'
}

/** Stable string form of a key for use as a Map key. */
export function keyHash(key: IdentityKey): string {
  return `${key.kind}:${key.value}`
}

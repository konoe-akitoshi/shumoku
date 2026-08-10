// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import type { Identity, Node } from '../models/types.js'

/**
 * Provenance / identity stamping for topology & autoscan plugins.
 *
 * Every node a discovery plugin emits MUST carry `provenance.source` (so the
 * resolver can attribute and the human can override it) and `identity` (so
 * the same device collapses across rescans and sources). netbox shipped
 * nodes without either — a P0 the resolver could not recover from. Routing
 * this through one helper makes the omission structurally hard.
 */

export interface IdentityParts {
  mgmtIp?: string
  chassisId?: string
  sysName?: string
  ifName?: string
  ifIndex?: number
  mac?: string
  /** Source-specific ids, e.g. `{ 'netbox-device-id': '42' }`. Empty values dropped. */
  vendorIds?: Record<string, string | undefined>
}

/**
 * Canonical spelling for a MAC-shaped identity key: lowercase, colon-separated.
 *
 * Sources disagree on how to write the same wire address. Huawei NCE returns
 * `50-04-01-01-D5-50` in its device list and `CC:D8:1F:9F:D4:AB` in its LLDP
 * table; an SNMP walk of the very same switch yields `cc:d8:1f:9f:d4:ab`; Cisco
 * gear writes `ccd8.1f9f.d4ab`. Identity keys are matched as exact strings, so
 * without one canonical spelling a device arrives as two entities that never
 * merge — the failure is silent, which is what makes it worth normalizing here
 * rather than in each plugin.
 *
 * Anything that is not twelve hex digits once separators are stripped is
 * returned untouched: `chassisId` is only sometimes a MAC (LLDP also permits
 * interface names and network addresses) and must survive as written.
 */
export function normalizeMacKey(value: string): string {
  const hex = value.replace(/[\s:.-]/g, '').toLowerCase()
  if (/^[0-9a-f]{12}$/.test(hex)) return (hex.match(/.{2}/g) ?? []).join(':')
  // BSD `arp` prints octets unpadded: `0:d:5d:11:f0:73` names the same address
  // as `00:0d:5d:11:f0:73` but is only ten hex digits long, so the count test
  // above misses it.
  const groups = value.trim().split(/[:-]/)
  if (groups.length === 6 && groups.every((g) => /^[0-9a-f]{1,2}$/i.test(g))) {
    return groups.map((g) => g.toLowerCase().padStart(2, '0')).join(':')
  }
  return value
}

/**
 * Build an `Identity` from raw parts, dropping empty values. Returns
 * `undefined` when nothing identifying was supplied (so callers don't stamp
 * an empty identity object that the resolver would treat as `unbound`).
 */
export function buildIdentity(parts: IdentityParts): Identity | undefined {
  const id: Identity = {}
  if (parts.mgmtIp) id.mgmtIp = parts.mgmtIp
  if (parts.chassisId) id.chassisId = normalizeMacKey(parts.chassisId)
  if (parts.sysName) id.sysName = parts.sysName
  if (parts.ifName) id.ifName = parts.ifName
  if (parts.ifIndex !== undefined) id.ifIndex = parts.ifIndex
  if (parts.mac) id.mac = normalizeMacKey(parts.mac)
  if (parts.vendorIds) {
    const vendorIds: Record<string, string> = {}
    for (const [key, value] of Object.entries(parts.vendorIds)) {
      if (value) vendorIds[key] = value
    }
    if (Object.keys(vendorIds).length > 0) id.vendorIds = vendorIds
  }
  return Object.keys(id).length > 0 ? id : undefined
}

export interface StampObservedOptions {
  /** Source id stamped into `provenance.source` (the plugin instance id). */
  source: string
  /** When the source observed this node (Unix ms). Defaults to now. */
  observedAt?: number
  /** Identity keys; merged over any the node already carries. */
  identity?: Identity
  /** `metadata.syncState` (e.g. `'synced'`). */
  syncState?: string
  /** `metadata.readVia` (e.g. `'snmp'`, `'netbox'`). */
  readVia?: string
}

/**
 * Return a copy of `node` stamped with observation provenance, identity, and
 * sync metadata. Never mutates the input (callers build node lists with
 * `.map(stampObserved…)`). Existing identity/metadata are preserved and only
 * overlaid with the supplied values.
 */
export function stampObserved(node: Node, options: StampObservedOptions): Node {
  const observedAt = options.observedAt ?? Date.now()
  const identity = options.identity ? { ...node.identity, ...options.identity } : node.identity
  const metadata: Record<string, unknown> = { ...node.metadata }
  if (options.syncState !== undefined) metadata['syncState'] = options.syncState
  if (options.readVia !== undefined) metadata['readVia'] = options.readVia
  return {
    ...node,
    provenance: { ...node.provenance, source: options.source, observedAt },
    identity,
    metadata: Object.keys(metadata).length > 0 ? metadata : node.metadata,
  }
}

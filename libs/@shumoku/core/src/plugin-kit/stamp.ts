// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import type * as input from '../input/model.js'
import type { Identity } from '../models/types.js'

/**
 * Device attributes for topology & autoscan plugins.
 *
 * A node a topology plugin emits must carry at least one attribute the device is recognized by
 * (`address`, `chassisId`, `sysName`, `mac` on the node, or the source's own id in its
 * observation's `vendorIds`), so the same device collapses across rescans and sources. netbox
 * once shipped nodes without any — a P0 the resolver could not recover from. Routing attributes
 * through these helpers drops empty values and spells MAC-shaped values one way, so a plugin
 * cannot emit a key that never matches.
 */

/**
 * Canonical spelling for a MAC-shaped key: lowercase, colon-separated.
 *
 * Sources disagree on how to write the same wire address. Huawei NCE returns
 * `50-04-01-01-D5-50` in its device list and `CC:D8:1F:9F:D4:AB` in its LLDP
 * table; an SNMP walk of the very same switch yields `cc:d8:1f:9f:d4:ab`; Cisco
 * gear writes `ccd8.1f9f.d4ab`. Keys are matched as exact strings, so
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

/** The attributes a device is recognized by, as a node of the configuration writes them. */
export type DeviceAttributes = Pick<input.Node, 'address' | 'chassisId' | 'sysName' | 'mac'>

/**
 * A node's device attributes from raw parts: empty values dropped, `chassisId` and `mac` in the
 * canonical MAC spelling where they are MACs. Spread the result onto the node the plugin returns.
 */
export function deviceAttributes(parts: {
  address?: string | null
  chassisId?: string | null
  sysName?: string | null
  mac?: string | null
}): DeviceAttributes {
  return {
    ...(parts.address && { address: parts.address }),
    ...(parts.chassisId && { chassisId: normalizeMacKey(parts.chassisId) }),
    ...(parts.sysName && { sysName: parts.sysName }),
    ...(parts.mac && { mac: normalizeMacKey(parts.mac) }),
  }
}

/** A source's own ids for a node, for its observation's `vendorIds`; empty values dropped. */
export function vendorIdsOf(
  ids: Record<string, string | number | null | undefined>,
): Record<string, string> | undefined {
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(ids)) {
    if (value !== undefined && value !== null && value !== '') out[key] = String(value)
  }
  return Object.keys(out).length > 0 ? out : undefined
}

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
 * Build the `Identity` a hosts or metrics source reports for a host or an interface from raw
 * parts, dropping empty values. Returns `undefined` when nothing identifying was supplied. For
 * a topology node's own attributes use `deviceAttributes`.
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

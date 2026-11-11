// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import type * as input from '../input/model.js'
import type { Identity, NodeObservation, PortObservation } from '../models/types.js'
import type { IdentityQuality } from './types.js'

/**
 * The keys a node and a port are recognized by across sources and re-scans.
 *
 * A device's attributes are configuration: a node's `address`, `chassisId`, `sysName` and `mac`,
 * a port's name and `mac` (see `inputModel.Node` / `Port`). What a source alone knows a node by
 * rides in its observation (`vendorIds`), as does an SNMP agent's `ifIndex` for a port. The merge
 * (`resolveNetwork`) and the Server's entity registry take their keys from here, so both see the
 * same device. See `apps/server/docs/design/topology-foundation-identity.md`.
 */

/**
 * What a node is recognized by: the configuration's attributes, the addresses it has in segments
 * (`Segment.addresses`, where an address goes once its segment is known) and the source's own ids.
 */
export type DeviceKeys = Pick<input.Node, 'address' | 'chassisId' | 'sysName' | 'mac'> &
  Pick<NodeObservation, 'vendorIds'> & { readonly addresses?: readonly string[] }

/** What a port is recognized by: its name and `mac` from the configuration, `ifIndex` observed. */
export type PortKeys = Pick<input.Port, 'name' | 'mac'> & Pick<PortObservation, 'ifIndex'>

/**
 * Tagged identity key — kind keeps values of different kinds apart in one index (a node's
 * sysName "core-rtr-01" must not collide with a vendor id of the same string).
 */
export interface IdentityKey {
  kind: 'address' | 'chassisId' | 'sysName' | 'mac' | 'ifName' | 'ifIndex' | 'vendorId'
  value: string
}

/** An address as a key: its host part, so `10.0.0.1/24` and `10.0.0.1` are one. */
export function addressKey(address: string): string {
  return address.trim().split('/')[0] ?? address
}

/**
 * A node's identity keys in priority order; the first match wins during cluster lookup, and the
 * caller binds every key to the cluster after a match so a later contribution that carries only
 * a weaker key still collapses onto it.
 */
export function nodeIdentityKeys(keys: DeviceKeys | undefined): IdentityKey[] {
  if (!keys) return []
  const out: IdentityKey[] = []
  const addresses = new Set(
    [keys.address, ...(keys.addresses ?? [])].flatMap((a) => (a ? [addressKey(a)] : [])),
  )
  for (const address of addresses) out.push({ kind: 'address', value: address })
  if (keys.chassisId) out.push({ kind: 'chassisId', value: keys.chassisId })
  if (keys.sysName) out.push({ kind: 'sysName', value: keys.sysName })
  if (keys.mac) out.push({ kind: 'mac', value: keys.mac })
  for (const [vendor, value] of Object.entries(keys.vendorIds ?? {})) {
    if (value) out.push({ kind: 'vendorId', value: `${vendor}=${value}` })
  }
  return out
}

/**
 * A port's identity keys in priority order. Ports are matched within one node cluster — the same
 * name on another chassis is another port; the caller scopes the lookup. `ifIndex` is last: many
 * agents renumber it across reboots.
 */
export function portIdentityKeys(keys: PortKeys | undefined): IdentityKey[] {
  if (!keys) return []
  const out: IdentityKey[] = []
  if (keys.name) out.push({ kind: 'ifName', value: keys.name })
  if (keys.mac) out.push({ kind: 'mac', value: keys.mac })
  if (keys.ifIndex !== undefined) out.push({ kind: 'ifIndex', value: String(keys.ifIndex) })
  return out
}

/** The addresses each node holds in a network's segments, by node id (a set's shared address is not a node's). */
export function segmentAddressesOf(network: input.Network): Map<string, string[]> {
  const nodeIds = new Set(network.nodes.map((n) => n.id))
  const out = new Map<string, string[]>()
  for (const segment of network.segments ?? []) {
    for (const [holder, held] of Object.entries(segment.addresses ?? {})) {
      if (!nodeIds.has(holder)) continue
      const list = typeof held === 'string' ? [held] : [...held]
      out.set(holder, [...(out.get(holder) ?? []), ...list])
    }
  }
  return out
}

/** A hosts / metrics source's `Identity` as the keys a node is recognized by. */
export function deviceKeysOfIdentity(identity: Identity | undefined): DeviceKeys {
  return {
    ...(identity?.mgmtIp && { address: identity.mgmtIp }),
    ...(identity?.chassisId && { chassisId: identity.chassisId }),
    ...(identity?.sysName && { sysName: identity.sysName }),
    ...(identity?.mac && { mac: identity.mac }),
    ...(identity?.vendorIds && { vendorIds: identity.vendorIds }),
  }
}

/**
 * Coarse identity quality, shown in the UI to warn which elements may detach from their metrics
 * across reboots.
 *
 * Node: `stable` with a chassisId and an address or sysName, `weak` with any one of them,
 * `unbound` with none. Port: `stable` with a name and a mac or ifIndex, `weak` with one key,
 * `unbound` with none.
 */
export function nodeIdentityQuality(keys: DeviceKeys | undefined): IdentityQuality {
  if (!keys) return 'unbound'
  const hasChassis = Boolean(keys.chassisId)
  const hasAddress = Boolean(keys.address) || (keys.addresses?.length ?? 0) > 0
  const hasSys = Boolean(keys.sysName)
  if (hasChassis && (hasAddress || hasSys)) return 'stable'
  if (hasChassis || hasAddress || hasSys || keys.mac) return 'weak'
  return 'unbound'
}

export function portIdentityQuality(keys: PortKeys | undefined): IdentityQuality {
  if (!keys) return 'unbound'
  const hasName = Boolean(keys.name)
  const hasMac = Boolean(keys.mac)
  const hasIndex = keys.ifIndex !== undefined
  if (hasName && (hasMac || hasIndex)) return 'stable'
  if (hasName || hasMac || hasIndex) return 'weak'
  return 'unbound'
}

/** Stable string form of a key for use as a Map key. */
export function keyHash(key: IdentityKey): string {
  return `${key.kind}:${key.value}`
}

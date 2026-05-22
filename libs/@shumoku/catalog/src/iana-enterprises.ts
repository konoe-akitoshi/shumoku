// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * IANA Private Enterprise Number → vendor name registry.
 *
 * SNMP `sysObjectID` is rooted at `1.3.6.1.4.1.<PEN>` where `<PEN>` is
 * the vendor 's IANA-assigned Private Enterprise Number. Even when we
 * have no specific catalog entry for the exact product, the PEN alone
 * tells us "this is a Cisco / Juniper / Aruba device" — useful for
 * surfacing a recognisable vendor name on the diagram rather than a
 * bare OID.
 *
 * This is intentionally separate from `Catalog`: catalog entries
 * describe *specific products*, while this registry is a flat lookup
 * for the broader vendor namespace. Both work together — a plugin
 * typically tries `catalog.findBySysObjectId(oid)` first (exact /
 * family match) and falls back to `vendorFromOid(oid)` for the wider
 * class of devices the catalog doesn 't yet cover.
 *
 * Authoritative source: IANA enterprise number assignments
 * (https://www.iana.org/assignments/enterprise-numbers/).
 */

/**
 * Mapping is held as an ordered array of [PEN, vendor-name] tuples to
 * preserve the registry 's natural numerical ordering when iterating.
 * Lookups go through a Map built once at module load.
 */
const ENTRIES: ReadonlyArray<readonly [number, string]> = [
  [9, 'Cisco'],
  [11, 'HPE'],
  [171, 'D-Link'],
  [232, 'HPE / Hewlett-Packard'],
  [318, 'APC'],
  [674, 'Dell'],
  [890, 'Zyxel'],
  [1916, 'Extreme Networks'],
  [2011, 'Huawei'],
  [2636, 'Juniper'],
  [4413, 'Brocade'],
  [4526, 'NETGEAR'],
  [5624, 'Dell (Force10)'],
  [6486, 'Alcatel-Lucent'],
  [6527, 'Nokia'],
  [8741, 'Aerohive'],
  [10520, 'Allied Telesis'],
  [12356, 'Fortinet'],
  [14823, 'Aruba Networks'],
  [25506, 'H3C'],
  [29671, 'Meraki'],
  [30065, 'Arista'],
  [41112, 'Ubiquiti'],
]

const BY_PEN = new Map<number, string>(ENTRIES)

/**
 * Extract the IANA Private Enterprise Number from a `sysObjectID`.
 * Returns `null` if the OID doesn 't sit under the standard
 * `1.3.6.1.4.1.<PEN>` prefix.
 */
export function ianaEnterpriseFromOid(oid: string): number | null {
  const normalized = oid.startsWith('.') ? oid.slice(1) : oid
  const prefix = '1.3.6.1.4.1.'
  if (!normalized.startsWith(prefix)) return null
  const rest = normalized.slice(prefix.length)
  const dot = rest.indexOf('.')
  const pen = dot === -1 ? rest : rest.slice(0, dot)
  const n = Number.parseInt(pen, 10)
  return Number.isFinite(n) ? n : null
}

/**
 * Look up a vendor name from a `sysObjectID`. Returns the vendor name
 * if the PEN under the OID is known; `null` otherwise.
 *
 * This is the *fallback* path — call `Catalog.findBySysObjectId` first
 * for an exact product match (which carries far more information).
 */
export function vendorFromOid(oid: string): string | null {
  const pen = ianaEnterpriseFromOid(oid)
  if (pen === null) return null
  return BY_PEN.get(pen) ?? null
}

/**
 * Look up a vendor name by raw IANA enterprise number.
 */
export function vendorFromIanaEnterpriseId(pen: number): string | null {
  return BY_PEN.get(pen) ?? null
}

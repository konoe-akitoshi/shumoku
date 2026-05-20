// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * sysObjectID → vendor / model lookup.
 *
 * `sysObjectID` (RFC 1213, MIB-II) is an OID under each vendor's
 * enterprise-prefix tree (1.3.6.1.4.1.<vendor>.<model-path>) that is
 * world-unique to the device family. When an autoscan plugin pulls the
 * sysObjectID off a device, this helper returns the best-known vendor
 * and (when known) the specific model name without touching the network.
 *
 * v1 ships a small embedded dictionary covering the major network
 * vendors at the enterprise-OID level, plus a curated set of popular
 * specific models. The deeper catalog (per-model `discovery`
 * capabilities) is v2 — see
 * `apps/server/docs/design/topology-foundation.md § 2.4` and
 * `topology-foundation-mvp.md § 2.4`.
 */

export interface SysObjectIdMatch {
  vendor: string
  model?: string
  /** The OID prefix that matched (helps debug "why this vendor?"). */
  matchedPrefix: string
}

/**
 * Lookup table. Entries are checked in order — longer / more specific
 * prefixes must come first so they win over the vendor-level fallback.
 *
 * Format: tuple `[oidPrefix, vendor, model?]`. Empty model means
 * "vendor-only match — no specific product info from the OID alone".
 *
 * Sources: IANA enterprise number assignments + publicly available
 * MIB browsers. Sample size is small but covers the network gear most
 * commonly encountered in office / home-lab deployments.
 */
const ENTRIES: ReadonlyArray<readonly [string, string, string?]> = [
  // --- Cisco specific products ---
  // Catalyst 9300 family
  ['1.3.6.1.4.1.9.1.2030', 'Cisco', 'Catalyst 9300-24T'],
  ['1.3.6.1.4.1.9.1.2031', 'Cisco', 'Catalyst 9300-48T'],
  ['1.3.6.1.4.1.9.1.2032', 'Cisco', 'Catalyst 9300-24P'],
  ['1.3.6.1.4.1.9.1.2033', 'Cisco', 'Catalyst 9300-48P'],
  // Catalyst 2960 family
  ['1.3.6.1.4.1.9.1.716', 'Cisco', 'Catalyst 2960'],
  ['1.3.6.1.4.1.9.1.717', 'Cisco', 'Catalyst 2960-24TT'],
  // ISR 4451
  ['1.3.6.1.4.1.9.1.1681', 'Cisco', 'ISR 4451'],
  ['1.3.6.1.4.1.9.1.1682', 'Cisco', 'ISR 4431'],
  // Meraki (Cisco)
  ['1.3.6.1.4.1.29671', 'Meraki', undefined],

  // --- Juniper specific products ---
  ['1.3.6.1.4.1.2636.1.1.1.2.29', 'Juniper', 'EX2200'],
  ['1.3.6.1.4.1.2636.1.1.1.2.57', 'Juniper', 'EX3300'],
  ['1.3.6.1.4.1.2636.1.1.1.2.78', 'Juniper', 'EX4300'],

  // --- Arista ---
  ['1.3.6.1.4.1.30065.1.3000', 'Arista', '7050 series'],
  ['1.3.6.1.4.1.30065.1.3300', 'Arista', '7280 series'],

  // --- Vendor-only prefixes (fallback) ---
  ['1.3.6.1.4.1.9', 'Cisco'],
  ['1.3.6.1.4.1.11', 'HPE'],
  ['1.3.6.1.4.1.171', 'D-Link'],
  ['1.3.6.1.4.1.232', 'HPE / Hewlett-Packard'],
  ['1.3.6.1.4.1.318', 'APC'],
  ['1.3.6.1.4.1.674', 'Dell'],
  ['1.3.6.1.4.1.890', 'Zyxel'],
  ['1.3.6.1.4.1.1916', 'Extreme Networks'],
  ['1.3.6.1.4.1.2011', 'Huawei'],
  ['1.3.6.1.4.1.2636', 'Juniper'],
  ['1.3.6.1.4.1.4413', 'Brocade'],
  ['1.3.6.1.4.1.4526', 'NETGEAR'],
  ['1.3.6.1.4.1.5624', 'Dell (Force10)'],
  ['1.3.6.1.4.1.6486', 'Alcatel-Lucent'],
  ['1.3.6.1.4.1.6527', 'Nokia'],
  ['1.3.6.1.4.1.8741', 'Aerohive'],
  ['1.3.6.1.4.1.10520', 'Allied Telesis'],
  ['1.3.6.1.4.1.12356', 'Fortinet'],
  ['1.3.6.1.4.1.14823', 'Aruba Networks'],
  ['1.3.6.1.4.1.25506', 'H3C'],
  ['1.3.6.1.4.1.29671', 'Meraki'],
  ['1.3.6.1.4.1.30065', 'Arista'],
  ['1.3.6.1.4.1.41112', 'Ubiquiti'],
]

// Sort once at module load so longer (more specific) prefixes come
// first. `lookupSysObjectID` then short-circuits on the first match.
const SORTED = [...ENTRIES].sort((a, b) => b[0].length - a[0].length)

function isPrefix(haystack: string, prefix: string): boolean {
  if (haystack === prefix) return true
  return haystack.startsWith(`${prefix}.`)
}

/**
 * Look up a sysObjectID. Returns `null` when no entry matches —
 * caller should fall back to surfacing it as an "unknown device" with
 * the raw OID visible in the UI.
 */
export function lookupSysObjectID(oid: string): SysObjectIdMatch | null {
  // Normalize: strip leading dot if present (some SNMP libs emit ".1.3...").
  const normalized = oid.startsWith('.') ? oid.slice(1) : oid
  for (const [prefix, vendor, model] of SORTED) {
    if (isPrefix(normalized, prefix)) {
      return { vendor, model, matchedPrefix: prefix }
    }
  }
  return null
}

/** Convenience: just the vendor name, or null. */
export function vendorFromSysObjectID(oid: string): string | null {
  return lookupSysObjectID(oid)?.vendor ?? null
}

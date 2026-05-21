// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * IPv4 CIDR expansion helpers.
 *
 * v1 supports IPv4 only. IPv6 CIDR expansion is not implemented — single
 * v6 addresses pass through as-is via `isCidr() === false`.
 *
 * Safety: refuse expansions larger than `MAX_HOSTS` (default 65,536 hosts,
 * i.e. /16). A `/8` expands to ~16M addresses and would saturate the
 * scanner — explicit user opt-in would be needed for that.
 */

export const MAX_HOSTS = 65_536

/** Returns true if `s` has CIDR notation `addr/prefix` with an IPv4-shaped addr. */
export function isCidr(s: string): boolean {
  const slash = s.indexOf('/')
  if (slash < 0) return false
  const addr = s.slice(0, slash)
  const prefix = s.slice(slash + 1)
  if (!/^\d+$/.test(prefix)) return false
  return isIPv4(addr)
}

/** Returns true if `s` looks like an IPv4 dotted-quad. */
export function isIPv4(s: string): boolean {
  const parts = s.split('.')
  if (parts.length !== 4) return false
  return parts.every((p) => /^\d+$/.test(p) && Number(p) >= 0 && Number(p) <= 255)
}

/** Parse dotted-quad to a 32-bit unsigned integer. */
function ipToInt(ip: string): number {
  const [a, b, c, d] = ip.split('.').map(Number) as [number, number, number, number]
  return ((a << 24) | (b << 16) | (c << 8) | d) >>> 0
}

/** Format a 32-bit unsigned integer as dotted-quad. */
function intToIp(n: number): string {
  return `${(n >>> 24) & 0xff}.${(n >>> 16) & 0xff}.${(n >>> 8) & 0xff}.${n & 0xff}`
}

/**
 * Expand a CIDR (e.g. `10.0.0.0/24`) to its individual host addresses.
 *
 * - `/32` → `[10.0.0.5]` (single host)
 * - `/31` → both addresses (RFC 3021 point-to-point)
 * - `/24` or larger → excludes network (.0) and broadcast (.255). 254 hosts.
 *
 * Throws if the prefix is invalid or the expansion would exceed `MAX_HOSTS`.
 */
export function expandCidr(cidr: string): string[] {
  if (!isCidr(cidr)) {
    throw new Error(`Not a valid IPv4 CIDR: ${cidr}`)
  }
  const [addr, prefixStr] = cidr.split('/') as [string, string]
  const prefix = Number(prefixStr)
  if (prefix < 0 || prefix > 32) {
    throw new Error(`Invalid CIDR prefix /${prefix} (must be 0–32)`)
  }

  const total = prefix === 32 ? 1 : 2 ** (32 - prefix)
  if (total > MAX_HOSTS) {
    throw new Error(
      `CIDR ${cidr} expands to ${total} addresses — refusing (>${MAX_HOSTS} hosts limit). ` +
        `Split into smaller blocks or list explicit IPs.`,
    )
  }

  const base = ipToInt(addr) & (prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0)
  const out: string[] = []
  // /31 and /32 include every address. /≤30 excludes network + broadcast.
  if (prefix >= 31) {
    for (let i = 0; i < total; i++) out.push(intToIp(base + i))
  } else {
    for (let i = 1; i < total - 1; i++) out.push(intToIp(base + i))
  }
  return out
}

/**
 * Expand a mixed list of targets (single IPs, hostnames, CIDR blocks) into
 * a flat list of addresses to probe. Non-CIDR entries pass through
 * unchanged (the SNMP layer will hostname-resolve as needed).
 *
 * Duplicates are removed while preserving first-occurrence order.
 */
export function expandTargets(targets: readonly string[]): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const raw of targets) {
    const t = raw.trim()
    if (!t) continue
    const expanded = isCidr(t) ? expandCidr(t) : [t]
    for (const a of expanded) {
      if (!seen.has(a)) {
        seen.add(a)
        out.push(a)
      }
    }
  }
  return out
}

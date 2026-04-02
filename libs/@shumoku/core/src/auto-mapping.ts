// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * Auto-mapping utilities for network topology.
 *
 * Provides fuzzy matching for:
 * - Node names ↔ monitoring host names
 * - Interface/port names across different systems (NetBox, Zabbix, SNMP, etc.)
 *
 * Different systems use different naming conventions for the same physical port:
 *   NetBox "GE0/1"  ↔  Zabbix "Gi1/0/1"  ↔  SNMP "GigabitEthernet1/0/1"
 *   NetBox "TE1/1"  ↔  Zabbix "Te1/1/1"
 *   NetBox "GE0/0"  ↔  Zabbix "GigaEthernet0"  (UNIVERGE IX)
 */

// ============================================
// Interface name prefix synonyms
// ============================================

const PREFIX_GROUPS: [string[], string][] = [
  [['hundredgigabitethernet', 'hundredgige', 'hu'], 'hundredge'],
  [['fortygigabitethernet', 'fortygige', 'fo'], 'fortyge'],
  [['twentyfivegigabitethernet', 'twentyfivegige'], 'twentyfivege'],
  [['tengigabitethernet', 'tengigaethernet', 'tenge', 'te', 'xge', 'xe'], 'te'],
  [['gigabitethernet', 'gigaethernet', 'gi', 'ge'], 'ge'],
  [['fastethernet', 'fa', 'fe'], 'fe'],
  [['ethernet', 'ens', 'enp', 'eno', 'eth', 'en'], 'eth'],
  [['port-channel', 'portchannel', 'po', 'ae', 'bond'], 'lag'],
  [['vlan', 'vl', 'irb'], 'vlan'],
  [['loopback', 'lo'], 'lo'],
  [['tunnel', 'tu', 'tun'], 'tun'],
  [['management', 'mgmt', 'me'], 'mgmt'],
  [['wireless', 'wifi', 'wlan'], 'wlan'],
  [['wired'], 'wired'],
  [['serial', 'se'], 'serial'],
  [['bvi'], 'bvi'],
]

// Pre-sort: longest synonym first for greedy matching
const SORTED_PREFIX_GROUPS = PREFIX_GROUPS.map(
  ([synonyms, canonical]) =>
    [synonyms.slice().sort((a, b) => b.length - a.length), canonical] as [string[], string],
)

// ============================================
// Normalization
// ============================================

export interface NormalizedInterface {
  prefix: string
  numbers: number[]
  sub: number | null
  original: string
}

/**
 * Normalize a network interface name into structured form.
 *
 *   "GigabitEthernet1/0/2"  → { prefix: "ge", numbers: [1, 0, 2], sub: null }
 *   "GE0/1"                 → { prefix: "ge", numbers: [0, 1],    sub: null }
 *   "GigaEthernet0.0"       → { prefix: "ge", numbers: [0],       sub: 0    }
 *   "eth0"                  → { prefix: "eth", numbers: [0],      sub: null }
 */
export function normalizeInterfaceName(name: string): NormalizedInterface {
  const lower = name.toLowerCase().trim()

  let prefix = ''
  let prefixLen = 0
  let rest = lower

  // Scan all groups to find the globally longest matching prefix
  for (const [synonyms, canonical] of SORTED_PREFIX_GROUPS) {
    for (const syn of synonyms) {
      if (lower.startsWith(syn) && syn.length > prefixLen) {
        prefix = canonical
        prefixLen = syn.length
        rest = lower.slice(syn.length)
      }
    }
  }

  if (!prefix) {
    const m = lower.match(/^([a-z][a-z-]*)(.*)$/)
    if (m) {
      prefix = m[1]
      rest = m[2]
    } else {
      return { prefix: lower, numbers: [], sub: null, original: name }
    }
  }

  // Strip leading non-digit separators
  rest = rest.replace(/^[^0-9]*/, '')

  const numbers: number[] = []
  let sub: number | null = null

  if (rest) {
    const segments = rest.split('/')
    for (let i = 0; i < segments.length; i++) {
      const dotParts = segments[i].split('.')
      const main = parseInt(dotParts[0], 10)
      if (!isNaN(main)) numbers.push(main)

      // Sub-interface: only on last segment
      if (i === segments.length - 1 && dotParts.length > 1) {
        const s = parseInt(dotParts[1], 10)
        if (!isNaN(s)) sub = s
      }
    }
  }

  return { prefix, numbers, sub, original: name }
}

// ============================================
// Interface matching
// ============================================

/**
 * Score how well two normalized interface names match (0–1).
 *
 * - Prefix must be the same canonical group
 * - Port numbers compared right-to-left (rightmost = most specific)
 * - Sub-interface ignored for scoring
 */
export function interfaceMatchScore(a: NormalizedInterface, b: NormalizedInterface): number {
  if (a.prefix !== b.prefix) return 0

  if (a.numbers.length === 0 && b.numbers.length === 0) return 1.0
  if (a.numbers.length === 0 || b.numbers.length === 0) return 0.3

  // Compare from rightmost (port number is most specific)
  const aRev = [...a.numbers].reverse()
  const bRev = [...b.numbers].reverse()
  const minLen = Math.min(aRev.length, bRev.length)

  let matched = 0
  for (let i = 0; i < minLen; i++) {
    if (aRev[i] === bRev[i]) matched++
    else break
  }

  if (matched === 0) return 0

  const maxLen = Math.max(aRev.length, bRev.length)
  // All segments match → perfect (1.0); partial → range [0.5, 0.9]
  return matched === maxLen ? 1.0 : 0.5 + (matched / maxLen) * 0.4
}

export interface InterfaceMatchOptions {
  /** Minimum score to consider a match (default: 0.5) */
  threshold?: number
  /**
   * If true and there is exactly one candidate, match it regardless of score.
   * Useful for devices like APs that have a single wired port with
   * different names across systems (e.g. NetBox "main" ↔ Zabbix "wired0").
   */
  singleCandidateFallback?: boolean
}

/**
 * Find the best matching interface name from candidates.
 */
export function findBestInterfaceMatch(
  portName: string,
  candidates: string[],
  options: InterfaceMatchOptions | number = 0.5,
): string | null {
  if (candidates.length === 0) return null

  const opts: InterfaceMatchOptions = typeof options === 'number' ? { threshold: options } : options
  const threshold = opts.threshold ?? 0.5

  const norm = normalizeInterfaceName(portName)
  let bestScore = 0
  let bestCandidate: string | null = null

  for (const c of candidates) {
    const score = interfaceMatchScore(norm, normalizeInterfaceName(c))
    if (score > bestScore) {
      bestScore = score
      bestCandidate = c
    }
  }

  if (bestScore >= threshold) return bestCandidate

  // Fallback: single candidate → assume it's the same physical port
  if (opts.singleCandidateFallback && candidates.length === 1) {
    return candidates[0]
  }

  return null
}

/**
 * Rank all candidates by match score.
 */
export function rankInterfaceMatches(
  portName: string,
  candidates: string[],
  threshold = 0.3,
): Array<{ name: string; score: number }> {
  const norm = normalizeInterfaceName(portName)
  return candidates
    .map((name) => ({
      name,
      score: interfaceMatchScore(norm, normalizeInterfaceName(name)),
    }))
    .filter((m) => m.score >= threshold)
    .sort((a, b) => b.score - a.score)
}

// ============================================
// Node name matching
// ============================================

/** Default minimum score for node name auto-mapping */
export const NODE_MATCH_THRESHOLD = 0.7

/**
 * Score how well a topology node name matches a monitoring host name (0–1).
 */
export function nodeNameMatchScore(
  nodeName: string,
  hostName: string,
  hostDisplayName?: string,
): number {
  const n = nodeName.toLowerCase().trim()
  const h = hostName.toLowerCase().trim()
  const d = hostDisplayName?.toLowerCase().trim()

  // Exact
  if (h === n || d === n) return 1.0

  // Without domain suffix
  const nBase = n.split('.')[0]
  const hBase = h.split('.')[0]
  if (hBase === nBase) return 0.9

  // Case-insensitive containment
  if (h.includes(n) || n.includes(h)) return 0.7
  if (d && (d.includes(n) || n.includes(d))) return 0.7

  return 0
}

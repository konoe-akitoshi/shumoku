// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Interface / port name normalization + cross-system matching.
 *
 * Different systems name the same physical port differently:
 *   NetBox "GE0/1" ↔ Zabbix "Gi1/0/1" ↔ SNMP "GigabitEthernet1/0/1"
 *   TTDB speed-codes "hg-0/0/0/8" (100G) ↔ Zabbix "HundredGigE0/0/0/8"
 * and TTDB uses dashes where others use slashes ("hg-0-0-0" ≡ "hg/0/0/0").
 *
 * This is the shared core of what the web "auto-mapping" UI uses; resolve()'s
 * link dedup uses it too, so the same matching governs both metric-binding and
 * cross-source link folding.
 */

const PREFIX_GROUPS: [string[], string][] = [
  [
    ['eighthundredgigabitethernet', 'eighthundredgigabitether', 'eighthundredgige', 'ehg'],
    'eighthundredge',
  ],
  [
    ['fourhundredgigabitethernet', 'fourhundredgigabitether', 'fourhundredgige', 'fhg'],
    'fourhundredge',
  ],
  [['hundredgigabitethernet', 'hundredgigabitether', 'hundredgige', 'hu', 'hg'], 'hundredge'],
  [['fortygigabitethernet', 'fortygigabitether', 'fortygige', 'fo', 'fg'], 'fortyge'],
  [['twentyfivegigabitethernet', 'twentyfivegige'], 'twentyfivege'],
  [
    ['tengigabitethernet', 'tengigabitether', 'tengigaethernet', 'tenge', 'te', 'xge', 'xe', 'xg'],
    'te',
  ],
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

const SORTED_PREFIX_GROUPS = PREFIX_GROUPS.map(
  ([synonyms, canonical]) =>
    [synonyms.slice().sort((a, b) => b.length - a.length), canonical] as [string[], string],
)

export interface NormalizedInterface {
  prefix: string
  numbers: number[]
  sub: number | null
  original: string
}

/**
 * Normalize an interface name to `{ prefix, numbers, sub }`. The numeric part is
 * split on `/`, `-`, or `:` so TTDB's dash form ("hg-0-0-0" → [0,0,0]) lines up
 * with the slash form ("hg/0/0/0" → [0,0,0]).
 */
export function normalizeInterfaceName(name: string): NormalizedInterface {
  const lower = name.toLowerCase().trim()

  let prefix = ''
  let prefixLen = 0
  let rest = lower

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
    if (m?.[1] && m[2]) {
      prefix = m[1]
      rest = m[2]
    } else {
      return { prefix: lower, numbers: [], sub: null, original: name }
    }
  }

  // Strip leading separators/non-digits left over from the prefix.
  rest = rest.replace(/^[^0-9]*/, '')

  const numbers: number[] = []
  let sub: number | null = null

  if (rest) {
    // Split on slash, dash, or colon — all act as segment separators.
    const segments = rest.split(/[/\-:]/)
    for (const [i, seg] of segments.entries()) {
      const dotParts = seg.split('.')
      if (!dotParts[0]) continue
      const main = Number.parseInt(dotParts[0], 10)
      if (!Number.isNaN(main)) numbers.push(main)
      if (i === segments.length - 1 && dotParts.length > 1 && dotParts[1]) {
        const s = Number.parseInt(dotParts[1], 10)
        if (!Number.isNaN(s)) sub = s
      }
    }
  }

  return { prefix, numbers, sub, original: name }
}

/**
 * Score how well two normalized interface names match (0–1): same canonical
 * prefix, then port numbers compared right-to-left (rightmost = most specific).
 */
export function interfaceMatchScore(a: NormalizedInterface, b: NormalizedInterface): number {
  if (a.prefix !== b.prefix) return 0
  if (a.numbers.length === 0 && b.numbers.length === 0) return 1.0
  if (a.numbers.length === 0 || b.numbers.length === 0) return 0.3

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
  return matched === maxLen ? 1.0 : 0.5 + (matched / maxLen) * 0.4
}

/**
 * Whether two interface names denote the same physical port. Same canonical
 * prefix with aligning numbers (score ≥ 0.5), OR — for cross-vocabulary cases
 * like TTDB's speed-code `hg` vs Juniper `et-` where prefixes differ but the
 * port number is identical — the full number sequence matches.
 */
export function interfaceNamesMatch(a: string, b: string): boolean {
  if (!a || !b) return false
  const na = normalizeInterfaceName(a)
  const nb = normalizeInterfaceName(b)
  if (interfaceMatchScore(na, nb) >= 0.5) return true
  if (na.numbers.length > 0 && na.numbers.join('/') === nb.numbers.join('/')) return true
  return false
}

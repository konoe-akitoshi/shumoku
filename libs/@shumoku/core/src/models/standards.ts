// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * Ethernet standard registry.
 *
 * Each entry maps an IEEE / industry standard name (e.g. "10GBASE-SR")
 * to the physical attributes it implies: link speed, the cage required
 * at each port, the cable medium family, and the conventional cable-end
 * connector. Picking a standard cascades down to all of those — the
 * editor surfaces only the standard, and downstream code derives the
 * rest via the helpers below.
 *
 * Vendor-proprietary or yet-to-be-registered standards are accepted as
 * plain strings (`EthernetStandard` is `string`-widening). For unknown
 * names the lookup returns undefined and callers fall back to neutral
 * defaults — line thickness, compatibility checks, etc. all degrade
 * gracefully rather than reject.
 */

import type {
  CableConnector,
  EthernetStandard,
  FiberMode,
  LinkMediumKind,
  PortConnector,
} from './types.js'

export interface StandardSpec {
  /** Bits per second (canonical link rate). */
  speedBps: number
  /** Cage type required at each port for this standard. */
  cage: PortConnector
  /** Cable family — twisted-pair, fiber, dac, aoc. */
  cableKind: LinkMediumKind
  /** Fiber strand type when applicable. */
  fiberMode?: FiberMode
  /** Conventional cable-end connector (LC duplex unless overridden). */
  cableConnector?: CableConnector
  /** Practical maximum reach in meters (typical install). */
  maxReach_m: number
  /** Whether this standard's cage can source/sink PoE (RJ45 only). */
  poeCapable: boolean
}

const _: Record<string, StandardSpec> = {
  // ───────── Twisted-pair (RJ45) ─────────
  '10BASE-T': {
    speedBps: 10_000_000,
    cage: 'rj45',
    cableKind: 'twisted-pair',
    cableConnector: 'rj45',
    maxReach_m: 100,
    poeCapable: true,
  },
  '100BASE-TX': {
    speedBps: 100_000_000,
    cage: 'rj45',
    cableKind: 'twisted-pair',
    cableConnector: 'rj45',
    maxReach_m: 100,
    poeCapable: true,
  },
  '1000BASE-T': {
    speedBps: 1_000_000_000,
    cage: 'rj45',
    cableKind: 'twisted-pair',
    cableConnector: 'rj45',
    maxReach_m: 100,
    poeCapable: true,
  },
  '2.5GBASE-T': {
    speedBps: 2_500_000_000,
    cage: 'rj45',
    cableKind: 'twisted-pair',
    cableConnector: 'rj45',
    maxReach_m: 100,
    poeCapable: true,
  },
  '5GBASE-T': {
    speedBps: 5_000_000_000,
    cage: 'rj45',
    cableKind: 'twisted-pair',
    cableConnector: 'rj45',
    maxReach_m: 100,
    poeCapable: true,
  },
  '10GBASE-T': {
    speedBps: 10_000_000_000,
    cage: 'rj45',
    cableKind: 'twisted-pair',
    cableConnector: 'rj45',
    maxReach_m: 100,
    poeCapable: true,
  },

  // ───────── Fiber multi-mode (short reach) ─────────
  '1000BASE-SX': {
    speedBps: 1_000_000_000,
    cage: 'sfp',
    cableKind: 'fiber',
    fiberMode: 'multimode',
    cableConnector: 'lc',
    maxReach_m: 550,
    poeCapable: false,
  },
  '10GBASE-SR': {
    speedBps: 10_000_000_000,
    cage: 'sfp+',
    cableKind: 'fiber',
    fiberMode: 'multimode',
    cableConnector: 'lc',
    maxReach_m: 400, // OM4 spec; OM3 ~300m
    poeCapable: false,
  },
  '25GBASE-SR': {
    speedBps: 25_000_000_000,
    cage: 'sfp28',
    cableKind: 'fiber',
    fiberMode: 'multimode',
    cableConnector: 'lc',
    maxReach_m: 100,
    poeCapable: false,
  },
  '40GBASE-SR4': {
    speedBps: 40_000_000_000,
    cage: 'qsfp+',
    cableKind: 'fiber',
    fiberMode: 'multimode',
    cableConnector: 'mpo',
    maxReach_m: 150,
    poeCapable: false,
  },
  '100GBASE-SR4': {
    speedBps: 100_000_000_000,
    cage: 'qsfp28',
    cableKind: 'fiber',
    fiberMode: 'multimode',
    cableConnector: 'mpo',
    maxReach_m: 100,
    poeCapable: false,
  },

  // ───────── Fiber single-mode (long reach) ─────────
  '1000BASE-LX': {
    speedBps: 1_000_000_000,
    cage: 'sfp',
    cableKind: 'fiber',
    fiberMode: 'singlemode',
    cableConnector: 'lc',
    maxReach_m: 10_000,
    poeCapable: false,
  },
  '10GBASE-LR': {
    speedBps: 10_000_000_000,
    cage: 'sfp+',
    cableKind: 'fiber',
    fiberMode: 'singlemode',
    cableConnector: 'lc',
    maxReach_m: 10_000,
    poeCapable: false,
  },
  '25GBASE-LR': {
    speedBps: 25_000_000_000,
    cage: 'sfp28',
    cableKind: 'fiber',
    fiberMode: 'singlemode',
    cableConnector: 'lc',
    maxReach_m: 10_000,
    poeCapable: false,
  },
  '40GBASE-LR4': {
    speedBps: 40_000_000_000,
    cage: 'qsfp+',
    cableKind: 'fiber',
    fiberMode: 'singlemode',
    cableConnector: 'lc',
    maxReach_m: 10_000,
    poeCapable: false,
  },
  '100GBASE-LR4': {
    speedBps: 100_000_000_000,
    cage: 'qsfp28',
    cableKind: 'fiber',
    fiberMode: 'singlemode',
    cableConnector: 'lc',
    maxReach_m: 10_000,
    poeCapable: false,
  },

  // ───────── Direct attach copper (passive twinax) ─────────
  '10GBASE-CR': {
    speedBps: 10_000_000_000,
    cage: 'sfp+',
    cableKind: 'dac',
    maxReach_m: 7,
    poeCapable: false,
  },
  '25GBASE-CR': {
    speedBps: 25_000_000_000,
    cage: 'sfp28',
    cableKind: 'dac',
    maxReach_m: 5,
    poeCapable: false,
  },
  '40GBASE-CR4': {
    speedBps: 40_000_000_000,
    cage: 'qsfp+',
    cableKind: 'dac',
    maxReach_m: 7,
    poeCapable: false,
  },
  '100GBASE-CR4': {
    speedBps: 100_000_000_000,
    cage: 'qsfp28',
    cableKind: 'dac',
    maxReach_m: 5,
    poeCapable: false,
  },

  // ───────── Active optical cable (integrated optics) ─────────
  '10G-AOC': {
    speedBps: 10_000_000_000,
    cage: 'sfp+',
    cableKind: 'aoc',
    maxReach_m: 100,
    poeCapable: false,
  },
  '25G-AOC': {
    speedBps: 25_000_000_000,
    cage: 'sfp28',
    cableKind: 'aoc',
    maxReach_m: 100,
    poeCapable: false,
  },
  '40G-AOC': {
    speedBps: 40_000_000_000,
    cage: 'qsfp+',
    cableKind: 'aoc',
    maxReach_m: 100,
    poeCapable: false,
  },
  '100G-AOC': {
    speedBps: 100_000_000_000,
    cage: 'qsfp28',
    cableKind: 'aoc',
    maxReach_m: 100,
    poeCapable: false,
  },
}

export const STANDARD_SPECS: Readonly<Record<string, StandardSpec>> = _

export function getStandardSpec(standard: EthernetStandard | undefined): StandardSpec | undefined {
  if (!standard) return undefined
  return STANDARD_SPECS[standard]
}

/** Ordered list of recognized standard ids — useful for UI dropdowns. */
export const KNOWN_STANDARDS: readonly EthernetStandard[] = Object.keys(
  STANDARD_SPECS,
) as EthernetStandard[]

// ============================================================================
// Cascading-select helpers (UI consumers — connections form / LinkProperties)
// ============================================================================

export type StandardCableGroup = 'twisted-pair' | 'fiber-mm' | 'fiber-sm' | 'dac' | 'aoc' | 'other'

/** Human-friendly group labels for the cascading standard picker. */
export const STANDARD_GROUP_LABELS: Record<StandardCableGroup, string> = {
  'twisted-pair': 'Twisted-pair (RJ45)',
  'fiber-mm': 'Fiber multimode',
  'fiber-sm': 'Fiber single-mode',
  dac: 'DAC (passive twinax)',
  aoc: 'AOC (active optical)',
  other: 'Other',
}

/** Display order for the groups (top → bottom). */
export const STANDARD_GROUP_ORDER: readonly StandardCableGroup[] = [
  'twisted-pair',
  'fiber-mm',
  'fiber-sm',
  'dac',
  'aoc',
  'other',
]

export function classifyStandardGroup(spec: StandardSpec): StandardCableGroup {
  if (spec.cableKind === 'twisted-pair') return 'twisted-pair'
  if (spec.cableKind === 'fiber') {
    return spec.fiberMode === 'singlemode' ? 'fiber-sm' : 'fiber-mm'
  }
  if (spec.cableKind === 'dac') return 'dac'
  if (spec.cableKind === 'aoc') return 'aoc'
  return 'other'
}

/** Format a meters value for UI display (1000+ → km). */
export function formatReachMeters(m: number): string {
  if (m >= 1000) {
    const km = m / 1000
    return `${Number.isInteger(km) ? km : km.toFixed(1)} km`
  }
  return `${m} m`
}

function cageAcceptsRequired(cage: string | undefined, required: string): boolean {
  if (!cage) return true // unknown cage — be permissive
  const c = cage.toLowerCase()
  if (c === required) return true
  if (c === 'combo') return true
  return false
}

export interface StandardOption {
  /** IEEE standard id, e.g. "10GBASE-SR". */
  name: EthernetStandard
  spec: StandardSpec
  /** Pretty label suitable for select options, e.g. "10GBASE-SR — reach 400 m". */
  label: string
  /** Cage required at each port for this standard. */
  cage: string
  /** Cable end connector convention (LC / RJ45 / MPO / …). */
  cableConnector?: string
  /** Cable kind grouping for UI dropdown sections. */
  group: StandardCableGroup
}

/**
 * Standards available given the cages on each port. Used by the editor's
 * cascading "Standard" picker so the dropdown only offers links that
 * physically fit. Unknown cages (`undefined`) are treated permissively —
 * we'd rather show too many than none.
 *
 * Returned as one flat list; group via `option.group` if the UI wants to
 * split into sections.
 */
export function standardsForCages(
  fromCage: string | undefined,
  toCage: string | undefined,
): StandardOption[] {
  const result: StandardOption[] = []
  for (const name of KNOWN_STANDARDS) {
    const spec = STANDARD_SPECS[name]
    if (!spec) continue
    if (!cageAcceptsRequired(fromCage, spec.cage)) continue
    if (!cageAcceptsRequired(toCage, spec.cage)) continue
    result.push({
      name,
      spec,
      label: `${name} — reach ${formatReachMeters(spec.maxReach_m)}`,
      cage: spec.cage,
      cableConnector: spec.cableConnector,
      group: classifyStandardGroup(spec),
    })
  }
  return result
}

/** Group a list of `StandardOption`s by their `group` for sectioned dropdowns. */
export function groupStandards(
  options: readonly StandardOption[],
): Array<{ group: StandardCableGroup; label: string; options: StandardOption[] }> {
  const buckets = new Map<StandardCableGroup, StandardOption[]>()
  for (const opt of options) {
    const list = buckets.get(opt.group) ?? []
    list.push(opt)
    buckets.set(opt.group, list)
  }
  const result: Array<{ group: StandardCableGroup; label: string; options: StandardOption[] }> = []
  for (const group of STANDARD_GROUP_ORDER) {
    const opts = buckets.get(group)
    if (opts && opts.length > 0) {
      result.push({ group, label: STANDARD_GROUP_LABELS[group], options: opts })
    }
  }
  return result
}

// ============================================================================
// Two-step cascade: Plug profile → Cable variant
// ============================================================================

/**
 * A "plug profile" is the cage + speed combination — what the user picks
 * conceptually before deciding cable medium (e.g. "SFP+ 10G", "RJ45 1G").
 * Multiple IEEE standards can share a plug profile when they only differ
 * by cable kind (e.g. SFP+ 10G covers SR / LR / CR / AOC).
 */
export interface PlugProfile {
  /** Stable id, e.g. "sfp+:10000000000". Used as select value. */
  id: string
  cage: PortConnector
  speedBps: number
  /** Display label, e.g. "SFP+ 10G". */
  label: string
}

function speedLabel(bps: number): string {
  if (bps >= 1_000_000_000) {
    const g = bps / 1_000_000_000
    return `${Number.isInteger(g) ? g : g.toFixed(1)}G`
  }
  if (bps >= 1_000_000) return `${bps / 1_000_000}M`
  return `${bps} bps`
}

function makePlugId(cage: PortConnector, speedBps: number): string {
  return `${cage}:${speedBps}`
}

function makePlugProfile(cage: PortConnector, speedBps: number): PlugProfile {
  return {
    id: makePlugId(cage, speedBps),
    cage,
    speedBps,
    label: `${cage.toUpperCase()} ${speedLabel(speedBps)}`,
  }
}

/**
 * Plug profiles compatible with the given port cages. Same permissive
 * behavior as `standardsForCages`: unknown cages → all plugs, `combo`
 * cage → all plugs.
 */
export function plugProfilesForCages(
  fromCage: string | undefined,
  toCage: string | undefined,
): PlugProfile[] {
  const seen = new Map<string, PlugProfile>()
  for (const name of KNOWN_STANDARDS) {
    const spec = STANDARD_SPECS[name]
    if (!spec) continue
    if (!cageAcceptsRequired(fromCage, spec.cage)) continue
    if (!cageAcceptsRequired(toCage, spec.cage)) continue
    const id = makePlugId(spec.cage, spec.speedBps)
    if (!seen.has(id)) seen.set(id, makePlugProfile(spec.cage, spec.speedBps))
  }
  // Sort by speed asc, then cage name for stable ordering.
  return [...seen.values()].sort((a, b) =>
    a.speedBps !== b.speedBps ? a.speedBps - b.speedBps : a.cage.localeCompare(b.cage),
  )
}

/**
 * A cable variant within a plug profile — the actual IEEE standard plus
 * a media-friendly label ("Multimode fiber LC, reach 400 m").
 */
export interface CableVariant {
  standard: EthernetStandard
  spec: StandardSpec
  /** Display label, e.g. "Multimode fiber (LC) — reach 400 m". */
  label: string
  /** Cable kind grouping (for color coding / icons in UI if desired). */
  group: StandardCableGroup
}

function cableMediumLabel(spec: StandardSpec): string {
  if (spec.cableKind === 'twisted-pair') return 'Twisted-pair'
  if (spec.cableKind === 'fiber') {
    const mode = spec.fiberMode === 'singlemode' ? 'single-mode' : 'multimode'
    const conn = spec.cableConnector ? ` (${spec.cableConnector.toUpperCase()})` : ''
    return `Fiber ${mode}${conn}`
  }
  if (spec.cableKind === 'dac') return 'DAC (passive twinax)'
  if (spec.cableKind === 'aoc') return 'AOC (active optical)'
  return spec.cableKind
}

/**
 * Cable variants within a plug profile — i.e. all standards that share
 * the same (cage, speed) but differ by cable medium. The variants are
 * what the user picks at the second step of the cascade.
 */
export function cableVariantsForPlug(plug: PlugProfile): CableVariant[] {
  const result: CableVariant[] = []
  for (const name of KNOWN_STANDARDS) {
    const spec = STANDARD_SPECS[name]
    if (!spec) continue
    if (spec.cage !== plug.cage || spec.speedBps !== plug.speedBps) continue
    result.push({
      standard: name,
      spec,
      label: `${cableMediumLabel(spec)} — ${name}, reach ${formatReachMeters(spec.maxReach_m)}`,
      group: classifyStandardGroup(spec),
    })
  }
  return result
}

/** Resolve a standard to its plug profile (for prefilling the plug select). */
export function plugProfileForStandard(
  standard: EthernetStandard | undefined,
): PlugProfile | undefined {
  const spec = getStandardSpec(standard)
  if (!spec) return undefined
  return makePlugProfile(spec.cage, spec.speedBps)
}

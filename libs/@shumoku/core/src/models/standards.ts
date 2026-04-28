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
  CableGrade,
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
  /**
   * Best-case practical reach in meters. Used when no cable grade is set
   * (or when the grade isn't in `reachByGrade`). Set this to the highest
   * grade's reach so the unannotated UI shows the spec maximum.
   */
  maxReach_m: number
  /**
   * Per-grade reach overrides. Reach actually depends on the installed
   * cable: 10GBASE-T runs 100 m on Cat6a but only 55 m on Cat6, and
   * 10GBASE-SR is 300 m on OM3 vs 400 m on OM4. The grade key matches
   * `Link.cable.category` (lowercase: "cat6a", "om3" …).
   */
  reachByGrade?: Record<string, number>
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
    reachByGrade: {
      cat6: 55, // partial reach — 10G only up to ~55m on Cat6
      cat6a: 100,
      cat7: 100,
      cat8: 100,
    },
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
    maxReach_m: 400,
    reachByGrade: { om3: 300, om4: 400, om5: 400 },
    poeCapable: false,
  },
  '25GBASE-SR': {
    speedBps: 25_000_000_000,
    cage: 'sfp28',
    cableKind: 'fiber',
    fiberMode: 'multimode',
    cableConnector: 'lc',
    maxReach_m: 100,
    reachByGrade: { om3: 70, om4: 100, om5: 100 },
    poeCapable: false,
  },
  '40GBASE-SR4': {
    speedBps: 40_000_000_000,
    cage: 'qsfp+',
    cableKind: 'fiber',
    fiberMode: 'multimode',
    cableConnector: 'mpo',
    maxReach_m: 150,
    reachByGrade: { om3: 100, om4: 150, om5: 150 },
    poeCapable: false,
  },
  '100GBASE-SR4': {
    speedBps: 100_000_000_000,
    cage: 'qsfp28',
    cableKind: 'fiber',
    fiberMode: 'multimode',
    cableConnector: 'mpo',
    maxReach_m: 100,
    reachByGrade: { om3: 70, om4: 100, om5: 100 },
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

/**
 * Effective reach in meters for a link, accounting for the cable grade.
 * Falls back to the standard's `maxReach_m` when the grade isn't set or
 * isn't in the registry's per-grade table.
 */
export function reachForLink(
  standard: EthernetStandard | undefined,
  cableCategory: string | undefined,
): number | undefined {
  const spec = getStandardSpec(standard)
  if (!spec) return undefined
  if (cableCategory) {
    const override = spec.reachByGrade?.[cableCategory.toLowerCase()]
    if (override !== undefined) return override
  }
  return spec.maxReach_m
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
  'twisted-pair': 'Twisted-pair',
  'fiber-mm': 'Multimode fiber',
  'fiber-sm': 'Single-mode fiber',
  dac: 'DAC',
  aoc: 'AOC',
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
 * A "plug profile" is the cage form factor — RJ45 / SFP / SFP+ / etc.
 * It's purely the *shape* the cable plugs into. Speed lives downstream
 * (in the cable choice) because:
 *   - For RJ45, speed is decided by the cable category and link
 *     auto-negotiation; the plug itself doesn't pin it.
 *   - For SFP-family cages, the same physical cage hosts multiple
 *     transceiver speeds (e.g. SFP+ slot accepts SFP+ at 10G but is
 *     backward-compatible with SFP 1G modules).
 */
export interface PlugProfile {
  /** Stable id (= cage value). Used as select value. */
  id: string
  cage: PortConnector
  /** Display label, e.g. "RJ45" or "SFP+". */
  label: string
}

function makePlugProfile(cage: PortConnector): PlugProfile {
  return {
    id: cage,
    cage,
    label: cage.toUpperCase(),
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
  const seen = new Set<string>()
  const out: PlugProfile[] = []
  for (const name of KNOWN_STANDARDS) {
    const spec = STANDARD_SPECS[name]
    if (!spec) continue
    if (!cageAcceptsRequired(fromCage, spec.cage)) continue
    if (!cageAcceptsRequired(toCage, spec.cage)) continue
    if (seen.has(spec.cage)) continue
    seen.add(spec.cage)
    out.push(makePlugProfile(spec.cage))
  }
  return out
}

/**
 * A cable variant — the IEEE standard plus a short label. Speed and
 * medium are already readable from the standard name (10GBASE-SR =
 * SFP+ multimode 10G); the optgroup conveys medium kind. So the label
 * just appends reach as the differentiator.
 */
export interface CableVariant {
  standard: EthernetStandard
  spec: StandardSpec
  /** Display label, e.g. "10GBASE-SR — 400 m". */
  label: string
  /** Cable kind grouping (for sectioned dropdown). */
  group: StandardCableGroup
}

/**
 * Cable variants for a plug — all standards reachable through that
 * cage form factor, ordered by speed. For RJ45 this includes 10M /
 * 100M / 1G / 2.5G / 5G / 10G; for SFP+ it includes SR / LR / CR / AOC.
 */
export function cableVariantsForPlug(plug: PlugProfile): CableVariant[] {
  const result: CableVariant[] = []
  for (const name of KNOWN_STANDARDS) {
    const spec = STANDARD_SPECS[name]
    if (!spec) continue
    if (spec.cage !== plug.cage) continue
    // Standard name encodes speed and medium already; the optgroup
    // groups by cable kind. Reach is shown in StandardImpliedBlock
    // after selection — keep the dropdown label tight.
    result.push({
      standard: name,
      spec,
      label: name,
      group: classifyStandardGroup(spec),
    })
  }
  result.sort((a, b) => a.spec.speedBps - b.spec.speedBps)
  return result
}

/** Group cable variants by `cableKind` for sectioned `<optgroup>` rendering. */
export function groupCableVariants(
  variants: readonly CableVariant[],
): Array<{ group: StandardCableGroup; label: string; variants: CableVariant[] }> {
  const buckets = new Map<StandardCableGroup, CableVariant[]>()
  for (const v of variants) {
    const list = buckets.get(v.group) ?? []
    list.push(v)
    buckets.set(v.group, list)
  }
  const result: Array<{ group: StandardCableGroup; label: string; variants: CableVariant[] }> = []
  for (const group of STANDARD_GROUP_ORDER) {
    const bucket = buckets.get(group)
    if (bucket && bucket.length > 0) {
      result.push({ group, label: STANDARD_GROUP_LABELS[group], variants: bucket })
    }
  }
  return result
}

/** Resolve a standard to its plug profile (for prefilling the plug select). */
export function plugProfileForStandard(
  standard: EthernetStandard | undefined,
): PlugProfile | undefined {
  const spec = getStandardSpec(standard)
  if (!spec) return undefined
  return makePlugProfile(spec.cage)
}

/**
 * Cable grade option — the third step of the cascade. For twisted-pair
 * this is the cable category (Cat5e/6/6a/…), for fiber it's the OM/OS
 * grade. DAC/AOC are passive cable assemblies with no separate grade.
 */
export interface CableGradeOption {
  /** Stored in `Link.cable.category`. */
  value: CableGrade
  /** Display label. */
  label: string
}

/**
 * Cable grades available given the link's standard. Returns an empty
 * array when grade isn't a meaningful axis (DAC / AOC) — the UI hides
 * the third select in that case.
 */
export function cableGradesForStandard(standard: EthernetStandard | undefined): CableGradeOption[] {
  const spec = getStandardSpec(standard)
  if (!spec) return []
  if (spec.cableKind === 'twisted-pair') {
    return [
      { value: 'cat5e', label: 'Cat5e' },
      { value: 'cat6', label: 'Cat6' },
      { value: 'cat6a', label: 'Cat6a' },
      { value: 'cat7', label: 'Cat7' },
      { value: 'cat8', label: 'Cat8' },
    ]
  }
  if (spec.cableKind === 'fiber') {
    if (spec.fiberMode === 'multimode') {
      return [
        { value: 'om3', label: 'OM3' },
        { value: 'om4', label: 'OM4' },
        { value: 'om5', label: 'OM5' },
      ]
    }
    if (spec.fiberMode === 'singlemode') {
      return [
        { value: 'os1', label: 'OS1' },
        { value: 'os2', label: 'OS2' },
      ]
    }
  }
  // DAC / AOC are passive assemblies — no grade axis.
  return []
}

/**
 * Default grade for a freshly-picked standard. Used when the user
 * picks/changes the cable medium and we want the third select to land
 * on a sensible value rather than empty.
 */
export function defaultCableGrade(standard: EthernetStandard | undefined): CableGrade | undefined {
  const spec = getStandardSpec(standard)
  if (!spec) return undefined
  if (spec.cableKind === 'twisted-pair') {
    if (spec.speedBps >= 10_000_000_000) return 'cat6a'
    if (spec.speedBps >= 2_500_000_000) return 'cat6'
    return 'cat5e'
  }
  if (spec.cableKind === 'fiber' && spec.fiberMode === 'multimode') return 'om3'
  if (spec.cableKind === 'fiber' && spec.fiberMode === 'singlemode') return 'os2'
  return undefined
}

/**
 * Derive the cable-end connector from the link's effective standard.
 * The model no longer stores `cable.connector` explicitly — call this
 * from display / validation code that needs the connector value.
 */
export function cableConnectorForStandard(
  standard: EthernetStandard | undefined,
): CableConnector | undefined {
  return getStandardSpec(standard)?.cableConnector
}

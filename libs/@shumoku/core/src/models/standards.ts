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

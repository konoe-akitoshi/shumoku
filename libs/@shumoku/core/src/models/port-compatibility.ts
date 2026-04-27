// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { getStandardSpec } from './standards.js'
import type { EthernetStandard, Link, NodePort, PortConnector } from './types.js'

const PLUGGABLE_CONNECTORS = new Set<PortConnector>(['sfp', 'sfp+', 'sfp28', 'qsfp+', 'qsfp28'])

export type PortCompatibilitySeverity = 'error' | 'warning'

export interface PortCompatibilityIssue {
  severity: PortCompatibilitySeverity
  message: string
}

export function normalizePortConnector(connector: string | undefined): PortConnector | undefined {
  if (!connector) return undefined
  const value = connector.toLowerCase()
  if (value === 'copper') return 'rj45'
  return value as PortConnector
}

export function isPluggableConnector(connector: string | undefined): boolean {
  const normalized = normalizePortConnector(connector)
  return normalized ? PLUGGABLE_CONNECTORS.has(normalized) : false
}

export function isPoeCapableConnector(connector: string | undefined): boolean {
  return normalizePortConnector(connector) === 'rj45'
}

/** "combo" cages accept either copper or fiber pluggables. */
function cageAccepts(cage: PortConnector | undefined, required: PortConnector): boolean {
  const c = normalizePortConnector(cage)
  if (!c) return true // unknown cage — be permissive
  if (c === required) return true
  if (c === 'combo') {
    // Combo ports accept SFP and RJ45 commonly; we treat any common cage as ok.
    return true
  }
  return false
}

/**
 * Validate a link against its endpoint cages and the chosen standard.
 *
 * Most physical attributes (speed, required cage, cable medium, reach)
 * are implied by `link.standard` via `STANDARD_SPECS`. We only need to
 * verify that the actual port cages on each side accept the cage the
 * standard demands, plus a few sanity checks (PoE on RJ45 only,
 * cable length within reach).
 */
export function validateLinkCompatibility(
  fromPort: NodePort | undefined,
  toPort: NodePort | undefined,
  link: Pick<Link, 'standard' | 'cable'>,
): PortCompatibilityIssue[] {
  const issues: PortCompatibilityIssue[] = []
  const spec = getStandardSpec(link.standard)

  // PoE flag sanity — even without a standard, a non-RJ45 cage marked PoE
  // is a misconfiguration we can flag.
  for (const port of [fromPort, toPort]) {
    if (port?.poe && !isPoeCapableConnector(port.cage)) {
      issues.push({
        severity: 'error',
        message: `${port.label || port.id} is marked PoE but ${port.cage ?? 'unknown'} cages cannot source PoE`,
      })
    }
  }

  if (!spec) return issues

  // Cage compatibility — each end must accept the cage the standard requires.
  for (const [side, port] of [
    ['source', fromPort],
    ['target', toPort],
  ] as const) {
    if (!port?.cage) continue // unknown cage — skip
    if (!cageAccepts(port.cage, spec.cage)) {
      issues.push({
        severity: 'error',
        message: `${side} cage ${port.cage} cannot host ${link.standard} (requires ${spec.cage})`,
      })
    }
  }

  // Reach check (informational warning).
  if (link.cable?.length_m && link.cable.length_m > spec.maxReach_m) {
    issues.push({
      severity: 'warning',
      message: `cable length ${link.cable.length_m} m exceeds ${link.standard} max reach ${spec.maxReach_m} m`,
    })
  }

  return issues
}

/** Propose a sensible default standard given the cages on both ends. */
export function defaultStandardForCages(
  fromCage: PortConnector | undefined,
  toCage: PortConnector | undefined,
): EthernetStandard | undefined {
  const a = normalizePortConnector(fromCage)
  const b = normalizePortConnector(toCage)
  if (!a || !b) return undefined
  if (a === 'rj45' && b === 'rj45') return '1000BASE-T'
  if (a === 'sfp+' && b === 'sfp+') return '10GBASE-SR'
  if (a === 'sfp28' && b === 'sfp28') return '25GBASE-SR'
  if (a === 'qsfp+' && b === 'qsfp+') return '40GBASE-SR4'
  if (a === 'qsfp28' && b === 'qsfp28') return '100GBASE-SR4'
  if (a === 'sfp' && b === 'sfp') return '1000BASE-SX'
  return undefined
}

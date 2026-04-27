// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import type { LinkMedium, NodePort, PortConnector } from './types.js'

const PLUGGABLE_CONNECTORS = new Set(['sfp', 'sfp+', 'sfp28', 'qsfp+', 'qsfp28'])

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

export function defaultMediumForPorts(
  a: NodePort | undefined,
  b: NodePort | undefined,
): LinkMedium {
  const aConnector = normalizePortConnector(a?.connector ?? a?.media)
  const bConnector = normalizePortConnector(b?.connector ?? b?.media)
  if (aConnector === 'rj45' && bConnector === 'rj45') return { kind: 'twisted-pair' }
  if (isPluggableConnector(aConnector) && isPluggableConnector(bConnector)) return { kind: 'fiber' }
  return {}
}

export function validatePortMediumCompatibility(
  a: NodePort | undefined,
  b: NodePort | undefined,
  medium: LinkMedium | undefined,
): PortCompatibilityIssue[] {
  const issues: PortCompatibilityIssue[] = []
  const aConnector = normalizePortConnector(a?.connector ?? a?.media)
  const bConnector = normalizePortConnector(b?.connector ?? b?.media)
  const kind = medium?.kind

  for (const port of [a, b]) {
    const connector = normalizePortConnector(port?.connector ?? port?.media)
    if (port?.poe && !isPoeCapableConnector(connector)) {
      issues.push({
        severity: 'error',
        message: `${port.label} is marked PoE but ${connector ?? 'unknown'} ports cannot source PoE`,
      })
    }
  }

  if (!aConnector || !bConnector || !kind) return issues

  if (aConnector === 'rj45' && bConnector === 'rj45') {
    if (kind !== 'twisted-pair') {
      issues.push({
        severity: 'error',
        message: 'RJ45-to-RJ45 links should use twisted-pair cabling',
      })
    }
    return issues
  }

  if (isPluggableConnector(aConnector) && isPluggableConnector(bConnector)) {
    if (!['fiber', 'dac', 'aoc'].includes(kind)) {
      issues.push({
        severity: 'error',
        message: 'SFP/QSFP links should use fiber, DAC, or AOC media',
      })
    }
    return issues
  }

  if (
    (aConnector === 'rj45' && isPluggableConnector(bConnector)) ||
    (bConnector === 'rj45' && isPluggableConnector(aConnector))
  ) {
    issues.push({
      severity: 'warning',
      message:
        'RJ45-to-SFP links require an RJ45 transceiver on the pluggable side and normally do not carry PoE',
    })
  }

  return issues
}

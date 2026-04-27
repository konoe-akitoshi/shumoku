// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import type { LinkMedium, NodePort, PlugSpec, PortConnector } from './types.js'

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

/**
 * The "effective connector" we use for a connection point. Prefer the plug
 * (it's the cable end actually carrying signal) and fall back to the port's
 * cage when the plug is unspecified — typical for just-drawn links where
 * we know the receptacle but the user has not picked a transceiver yet.
 */
function effectiveConnector(
  port: NodePort | undefined,
  plug: PlugSpec | undefined,
): PortConnector | undefined {
  return normalizePortConnector(plug?.connector ?? port?.cage)
}

export function defaultMediumForLink(
  fromPort: NodePort | undefined,
  toPort: NodePort | undefined,
  fromPlug: PlugSpec | undefined,
  toPlug: PlugSpec | undefined,
): LinkMedium {
  const a = effectiveConnector(fromPort, fromPlug)
  const b = effectiveConnector(toPort, toPlug)
  if (a === 'rj45' && b === 'rj45') return { kind: 'twisted-pair' }
  if (isPluggableConnector(a) && isPluggableConnector(b)) return { kind: 'fiber' }
  return {}
}

export function validateLinkCompatibility(
  fromPort: NodePort | undefined,
  toPort: NodePort | undefined,
  fromPlug: PlugSpec | undefined,
  toPlug: PlugSpec | undefined,
  medium: LinkMedium | undefined,
): PortCompatibilityIssue[] {
  const issues: PortCompatibilityIssue[] = []
  const a = effectiveConnector(fromPort, fromPlug)
  const b = effectiveConnector(toPort, toPlug)
  const kind = medium?.kind

  for (const [port, plug] of [
    [fromPort, fromPlug],
    [toPort, toPlug],
  ] as const) {
    const connector = effectiveConnector(port, plug)
    if (port?.poe && !isPoeCapableConnector(connector)) {
      issues.push({
        severity: 'error',
        message: `${port.label || port.id} is marked PoE but ${connector ?? 'unknown'} cages cannot source PoE`,
      })
    }
  }

  // Plug/cage mismatch — a 10G SFP+ transceiver doesn't fit an RJ45 receptacle.
  for (const [port, plug, side] of [
    [fromPort, fromPlug, 'source'],
    [toPort, toPlug, 'target'],
  ] as const) {
    const cage = normalizePortConnector(port?.cage)
    const plugConnector = normalizePortConnector(plug?.connector)
    if (cage && plugConnector && cage !== plugConnector && cage !== 'combo') {
      issues.push({
        severity: 'warning',
        message: `${side} plug ${plugConnector} does not match cage ${cage}; a transceiver/adapter is required`,
      })
    }
  }

  if (!a || !b || !kind) return issues

  if (a === 'rj45' && b === 'rj45') {
    if (kind !== 'twisted-pair') {
      issues.push({
        severity: 'error',
        message: 'RJ45-to-RJ45 links should use twisted-pair cabling',
      })
    }
    return issues
  }

  if (isPluggableConnector(a) && isPluggableConnector(b)) {
    if (!['fiber', 'dac', 'aoc'].includes(kind)) {
      issues.push({
        severity: 'error',
        message: 'SFP/QSFP links should use fiber, DAC, or AOC media',
      })
    }
    return issues
  }

  if ((a === 'rj45' && isPluggableConnector(b)) || (b === 'rj45' && isPluggableConnector(a))) {
    issues.push({
      severity: 'warning',
      message:
        'RJ45-to-SFP links require an RJ45 transceiver on the pluggable side and normally do not carry PoE',
    })
  }

  return issues
}

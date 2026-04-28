// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { getStandardSpec, reachForLink } from './standards.js'
import type {
  EthernetStandard,
  Link,
  LinkEndpoint,
  LinkModule,
  LinkPlug,
  NodePort,
  PortConnector,
} from './types.js'

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
  if (c === 'combo') return true
  return false
}

/**
 * Pick a representative standard for a link — typically both endpoints
 * agree, in which case either works. If they disagree (BiDi pair, copper-
 * fiber adapter), return whichever is set.
 */
export function effectiveLinkStandard(
  link: Pick<Link, 'from' | 'to'>,
): EthernetStandard | undefined {
  return endpointStandard(link.from) ?? endpointStandard(link.to)
}

/**
 * Build a plug from a chosen module standard. The plug's `cage` is
 * derived from `STANDARD_SPECS[standard].cage`; the module is set on
 * the plug. Returns `undefined` if the standard is unknown.
 */
export function plugFromStandard(standard: EthernetStandard, sku?: string): LinkPlug | undefined {
  const spec = getStandardSpec(standard)
  if (!spec) return undefined
  const module: LinkModule = sku ? { standard, sku } : { standard }
  return { cage: spec.cage as PortConnector, module }
}

/**
 * Validate a link against its endpoint cages and the per-end module
 * standards. Most attributes (cage requirement, cable medium, reach)
 * are implied by `endpoint.module.standard` via `STANDARD_SPECS`.
 *
 * Per-endpoint is the source of truth: from.module and to.module are
 * checked against from.port and to.port respectively. We also flag
 * when the two endpoints' standards disagree (asymmetric link) — most
 * links should be symmetric, asymmetry is intentional only for BiDi /
 * adapter cases.
 */
export function validateLinkCompatibility(
  fromPort: NodePort | undefined,
  toPort: NodePort | undefined,
  link: Pick<Link, 'from' | 'to' | 'cable'>,
): PortCompatibilityIssue[] {
  const issues: PortCompatibilityIssue[] = []
  const fromStd = endpointStandard(link.from)
  const toStd = endpointStandard(link.to)
  const fromSpec = getStandardSpec(fromStd)
  const toSpec = getStandardSpec(toStd)

  // Plug.cage / module.standard consistency: when both are set, the
  // module's required cage must match the plug's declared cage.
  for (const [side, ep] of [
    ['source', link.from],
    ['target', link.to],
  ] as const) {
    const plug = ep.plug
    const std = plug?.module?.standard
    const stdCage = getStandardSpec(std)?.cage
    if (plug?.cage && stdCage && plug.cage !== stdCage) {
      issues.push({
        severity: 'error',
        message: `${side} plug.cage ${plug.cage} disagrees with module ${std} (requires ${stdCage})`,
      })
    }
  }

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

  // Per-endpoint cage compatibility.
  for (const [side, port, spec, std] of [
    ['source', fromPort, fromSpec, fromStd],
    ['target', toPort, toSpec, toStd],
  ] as const) {
    if (!spec || !port?.cage) continue
    if (!cageAccepts(port.cage, spec.cage)) {
      issues.push({
        severity: 'error',
        message: `${side} cage ${port.cage} cannot host ${std} (requires ${spec.cage})`,
      })
    }
  }

  // Asymmetric link — both sides set, different standards. Common only
  // for BiDi pairs (e.g. 10GBASE-BX10-D ↔ 10GBASE-BX10-U); flag as a
  // soft warning so the user notices accidental mismatches.
  if (fromStd && toStd && fromStd !== toStd) {
    issues.push({
      severity: 'warning',
      message: `endpoints have different standards (${fromStd} ↔ ${toStd}); intentional only for BiDi or media-converter links`,
    })
  }

  // Reach check (informational warning) — uses the grade-adjusted reach.
  // We pick whichever endpoint has a standard set; if both, prefer
  // matching one. For asymmetric links, take the worst-reach end.
  const referenceStd = fromStd ?? toStd
  if (referenceStd && link.cable?.length_m) {
    const referenceSpec = getStandardSpec(referenceStd)
    if (referenceSpec) {
      const effectiveReach =
        reachForLink(referenceStd, link.cable.category) ?? referenceSpec.maxReach_m
      if (link.cable.length_m > effectiveReach) {
        issues.push({
          severity: 'warning',
          message: `cable length ${link.cable.length_m} m exceeds ${referenceStd}${
            link.cable.category ? ` over ${link.cable.category}` : ''
          } max reach ${effectiveReach} m`,
        })
      }
    }
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

/**
 * Produce a symmetric plug spec for a link — both endpoints get the
 * same plug+module. Used by editor flows that default to symmetric
 * links (the 99% case).
 */
export function symmetricPlug(standard: EthernetStandard): LinkPlug | undefined {
  return plugFromStandard(standard)
}

/** Convenience: type-narrowed accessor for the endpoint module. */
export function endpointModule(ep: LinkEndpoint): LinkModule | undefined {
  return ep.plug?.module
}

/** Convenience: type-narrowed accessor for endpoint module standard. */
export function endpointStandard(ep: LinkEndpoint): EthernetStandard | undefined {
  return ep.plug?.module?.standard
}

/** Convenience: type-narrowed accessor for the endpoint plug cage. */
export function endpointPlugCage(ep: LinkEndpoint): PortConnector | undefined {
  return ep.plug?.cage
}

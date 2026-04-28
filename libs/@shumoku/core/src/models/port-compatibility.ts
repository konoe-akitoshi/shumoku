// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { getStandardSpec, mediumFromGrade, reachForLink } from './standards.js'
import type {
  EthernetStandard,
  Link,
  LinkCable,
  LinkEndpoint,
  LinkModule,
  LinkPlug,
  NodePort,
  PortConnector,
} from './types.js'

const PLUGGABLE_CONNECTORS = new Set<PortConnector>(['sfp', 'sfp+', 'sfp28', 'qsfp+', 'qsfp28'])

// ============================================================================
// Issue model — diagnostic-style records inspired by VS Code's Diagnostics.
// Each issue carries a stable `code` (rule id) and a `target` pointing at the
// offending field, so UI can attach inline markers and filter by location.
// ============================================================================

export type IssueSeverity = 'error' | 'warning' | 'info'

/** Field paths within an endpoint's editable surface. */
export type EndpointField = 'port' | 'plug.cage' | 'plug.module' | 'ip'

/** Field paths within the link-level cable record. */
export type CableField = 'medium' | 'category' | 'length_m'

/** Field paths within a node port (catalog/instance level). */
export type PortField = 'cage' | 'poe'

/**
 * Where the issue lives. UI uses this to attach inline markers next to
 * the right control, and to filter "issues for this field".
 */
export type IssueTarget =
  | { kind: 'endpoint'; side: 'source' | 'target'; field: EndpointField }
  | { kind: 'cable'; field: CableField }
  | { kind: 'port'; side: 'source' | 'target'; field: PortField }
  | { kind: 'link' }

export interface ValidationIssue {
  /** Stable rule id, e.g. `plug-cage-module-mismatch`. */
  code: string
  severity: IssueSeverity
  message: string
  target: IssueTarget
}

/** Filter issues whose target points at a specific field. Used by the UI. */
export function issuesForTarget(
  issues: readonly ValidationIssue[],
  target: IssueTarget,
): ValidationIssue[] {
  return issues.filter((issue) => targetEquals(issue.target, target))
}

function targetEquals(a: IssueTarget, b: IssueTarget): boolean {
  if (a.kind !== b.kind) return false
  switch (a.kind) {
    case 'link':
      return true
    case 'cable':
      return b.kind === 'cable' && a.field === b.field
    case 'endpoint':
      return b.kind === 'endpoint' && a.side === b.side && a.field === b.field
    case 'port':
      return b.kind === 'port' && a.side === b.side && a.field === b.field
  }
}

// ============================================================================
// Connector / cage helpers (used by checks below).
// ============================================================================

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

// ============================================================================
// Endpoint accessors / plug constructors.
// ============================================================================

export function effectiveLinkStandard(
  link: Pick<Link, 'from' | 'to'>,
): EthernetStandard | undefined {
  return endpointStandard(link.from) ?? endpointStandard(link.to)
}

/**
 * Build a plug from a chosen module standard. The plug carries only the
 * `module` — `cage` is intentionally omitted because it's derivable from
 * `module.standard` via `STANDARD_SPECS[std].cage`. Returns `undefined`
 * if the standard is unknown.
 */
export function plugFromStandard(standard: EthernetStandard, sku?: string): LinkPlug | undefined {
  const spec = getStandardSpec(standard)
  if (!spec) return undefined
  const module: LinkModule = sku ? { standard, sku } : { standard }
  return { module }
}

/** Build a cage-only plug — the user picked a form factor without a module yet. */
export function plugFromCage(cage: PortConnector): LinkPlug {
  return { cage }
}

export function endpointModule(ep: LinkEndpoint): LinkModule | undefined {
  return ep.plug?.module
}

export function endpointStandard(ep: LinkEndpoint): EthernetStandard | undefined {
  return ep.plug?.module?.standard
}

export function endpointPlugCage(ep: LinkEndpoint): PortConnector | undefined {
  return ep.plug?.cage
}

/**
 * Resolve the effective plug cage for an endpoint with the canonical priority:
 * explicit `plug.cage` > module's required cage > port.cage. Returns
 * undefined when none are known.
 */
export function effectivePlugCage(ep: LinkEndpoint, port?: NodePort): PortConnector | undefined {
  if (ep.plug?.cage) return ep.plug.cage
  const stdCage = getStandardSpec(ep.plug?.module?.standard)?.cage as PortConnector | undefined
  if (stdCage) return stdCage
  return port?.cage
}

// ============================================================================
// Validation framework — small named checks + registries. Each check is a
// pure function returning `ValidationIssue | undefined`. Adding a new check
// means writing a function and appending it to the right registry.
// ============================================================================

interface EndpointCtx {
  side: 'source' | 'target'
  endpoint: LinkEndpoint
  port: NodePort | undefined
  cable: LinkCable | undefined
}

interface LinkCtx {
  link: Pick<Link, 'from' | 'to' | 'cable'>
  fromPort: NodePort | undefined
  toPort: NodePort | undefined
}

type EndpointCheck = (ctx: EndpointCtx) => ValidationIssue | undefined
type LinkCheck = (ctx: LinkCtx) => ValidationIssue | undefined

// --- Endpoint checks --------------------------------------------------------

/** plug.cage and module.standard's required cage must agree when both set. */
const checkPlugMatchesModuleStandard: EndpointCheck = ({ side, endpoint }) => {
  const plug = endpoint.plug
  const std = plug?.module?.standard
  const required = getStandardSpec(std)?.cage
  if (plug?.cage && required && plug.cage !== required) {
    return {
      code: 'plug-cage-module-mismatch',
      severity: 'error',
      message: `plug.cage ${plug.cage} disagrees with module ${std} (requires ${required})`,
      target: { kind: 'endpoint', side, field: 'plug.cage' },
    }
  }
  return undefined
}

/** plug.cage and port.cage must agree (combo accepts either). */
const checkPlugMatchesPortCage: EndpointCheck = ({ side, endpoint, port }) => {
  const plug = endpoint.plug
  if (plug?.cage && port?.cage && plug.cage !== port.cage && port.cage !== 'combo') {
    return {
      code: 'plug-cage-port-mismatch',
      severity: 'error',
      message: `plug.cage ${plug.cage} disagrees with port.cage ${port.cage}`,
      target: { kind: 'endpoint', side, field: 'plug.cage' },
    }
  }
  return undefined
}

/** Port cage must accept the module's required cage. */
const checkPortCageHostsStandard: EndpointCheck = ({ side, endpoint, port }) => {
  const std = endpoint.plug?.module?.standard
  const spec = getStandardSpec(std)
  if (!spec || !port?.cage) return undefined
  if (!cageAccepts(port.cage, spec.cage)) {
    return {
      code: 'port-cage-cannot-host-module',
      severity: 'error',
      message: `cage ${port.cage} cannot host ${std} (requires ${spec.cage})`,
      target: { kind: 'endpoint', side, field: 'plug.module' },
    }
  }
  return undefined
}

/** PoE flag is only meaningful on RJ45 cages. */
const checkPoeFlagFitsCage: EndpointCheck = ({ side, port }) => {
  if (!port?.poe) return undefined
  if (isPoeCapableConnector(port.cage)) return undefined
  return {
    code: 'poe-flag-on-non-rj45',
    severity: 'error',
    message: `${port.label || port.id} is marked PoE but ${port.cage ?? 'unknown'} cages cannot source PoE`,
    target: { kind: 'port', side, field: 'poe' },
  }
}

const ENDPOINT_CHECKS: readonly EndpointCheck[] = [
  checkPlugMatchesModuleStandard,
  checkPlugMatchesPortCage,
  checkPortCageHostsStandard,
  checkPoeFlagFitsCage,
]

// --- Link-level checks ------------------------------------------------------

/** cable.medium and the medium implied by cable.category must agree. */
const checkCableMediumCategory: LinkCheck = ({ link }) => {
  const medium = link.cable?.medium
  const category = link.cable?.category
  if (!medium || !category) return undefined
  const expected = mediumFromGrade(category)
  if (expected && expected !== medium) {
    return {
      code: 'cable-medium-category-mismatch',
      severity: 'error',
      message: `cable.medium ${medium} disagrees with category ${category} (implies ${expected})`,
      target: { kind: 'cable', field: 'medium' },
    }
  }
  return undefined
}

/**
 * Both endpoints have a standard set but they differ. Common only for BiDi
 * pairs (10GBASE-BX10-D ↔ 10GBASE-BX10-U) and media-converter links —
 * surfaced as a soft warning so accidental mismatches stay visible.
 */
const checkAsymmetricStandards: LinkCheck = ({ link }) => {
  const fromStd = endpointStandard(link.from)
  const toStd = endpointStandard(link.to)
  if (fromStd && toStd && fromStd !== toStd) {
    return {
      code: 'endpoints-standards-asymmetric',
      severity: 'warning',
      message: `endpoints have different standards (${fromStd} ↔ ${toStd}); intentional only for BiDi or media-converter links`,
      target: { kind: 'link' },
    }
  }
  return undefined
}

/** Cable length exceeds the standard's grade-adjusted reach. */
const checkCableLengthReach: LinkCheck = ({ link }) => {
  const referenceStd = endpointStandard(link.from) ?? endpointStandard(link.to)
  const length = link.cable?.length_m
  if (!referenceStd || length == null) return undefined
  const referenceSpec = getStandardSpec(referenceStd)
  if (!referenceSpec) return undefined
  const effectiveReach =
    reachForLink(referenceStd, link.cable?.category) ?? referenceSpec.maxReach_m
  if (length <= effectiveReach) return undefined
  const gradeNote = link.cable?.category ? ` over ${link.cable.category}` : ''
  return {
    code: 'cable-length-exceeds-reach',
    severity: 'warning',
    message: `cable length ${length} m exceeds ${referenceStd}${gradeNote} max reach ${effectiveReach} m`,
    target: { kind: 'cable', field: 'length_m' },
  }
}

const LINK_CHECKS: readonly LinkCheck[] = [
  checkCableMediumCategory,
  checkAsymmetricStandards,
  checkCableLengthReach,
]

// --- Public entry point -----------------------------------------------------

/**
 * Validate a link against its endpoints, ports, and cable. Runs every
 * registered endpoint-level and link-level check; collects all issues
 * the UI / consumers can route to inline markers via `issuesForTarget`.
 */
export function validateLinkCompatibility(
  fromPort: NodePort | undefined,
  toPort: NodePort | undefined,
  link: Pick<Link, 'from' | 'to' | 'cable'>,
): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const cable = link.cable
  const endpoints: EndpointCtx[] = [
    { side: 'source', endpoint: link.from, port: fromPort, cable },
    { side: 'target', endpoint: link.to, port: toPort, cable },
  ]
  for (const ctx of endpoints) {
    for (const check of ENDPOINT_CHECKS) {
      const issue = check(ctx)
      if (issue) issues.push(issue)
    }
  }
  const linkCtx: LinkCtx = { link, fromPort, toPort }
  for (const check of LINK_CHECKS) {
    const issue = check(linkCtx)
    if (issue) issues.push(issue)
  }
  return issues
}

// ============================================================================
// Misc helpers / defaults.
// ============================================================================

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
 * Produce a symmetric plug spec for a link — both endpoints get the same
 * plug+module. Used by editor flows that default to symmetric links.
 */
export function symmetricPlug(standard: EthernetStandard): LinkPlug | undefined {
  return plugFromStandard(standard)
}

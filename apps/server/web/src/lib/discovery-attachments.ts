// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * Helpers for the discovery node-detail panel's Access section.
 *
 * The model has NO observed/authored layers: a node is one thing and every
 * source (the human included, at top priority) overwrites field-by-field.
 * So Access shows ONE editable row per protocol — the effective value —
 * and `provenance` is just an annotation of where that value currently
 * comes from, NOT a read-only gate. Editing = a top-priority override;
 * clearing = drop the override (fall back to the observed value / default).
 *
 * Pure so it can be unit-tested without mounting the Svelte component.
 */

import type { Attachment } from './api'

type AccessAttachment = Extract<Attachment, { kind: 'access' }>

/**
 * The operator owns this attachment (its value is theirs) when resolve
 * tagged it `authored`, or when it has no provenance yet — a freshly-added
 * local attachment before its next round-trip. Anything else is the value a
 * source currently supplies (shown, editable, annotated with its origin).
 */
export function isAuthoredAttachment(a: Attachment): boolean {
  return a.provenance === undefined || a.provenance.source === 'authored'
}

/** Drop the resolve-stamped provenance so the value can be edited / PATCHed
 *  as a plain authored attachment. */
export function stripProvenance(a: Attachment): Attachment {
  const { provenance: _provenance, ...rest } = a
  return rest as Attachment
}

/** One unified Access row: the protocol plus, where present, the operator's
 *  override and/or the value a source observed. The row's effective value is
 *  `authored ?? observed`; `authored` also means "the operator has overridden
 *  this protocol" (so a revert/remove affordance applies). */
export interface UnifiedAccessRow {
  protocol: AccessAttachment['protocol']
  /** The operator's override for this protocol, if any (from `working`). */
  authored?: AccessAttachment
  /** The value a source observed for this protocol, if any. */
  observed?: AccessAttachment
}

/**
 * Collapse the operator's (authored) access and the observed access into ONE
 * row per protocol — no two-tier split. Each row carries whichever sides
 * exist; the UI shows a single editable field (effective = authored ??
 * observed) with a provenance caption. Protocol order: authored first, then
 * any observed-only protocols, each kept once.
 */
export function unifyAccessRows(
  authored: Attachment[],
  observed: Attachment[],
): UnifiedAccessRow[] {
  const isAccess = (a: Attachment): a is AccessAttachment => a.kind === 'access'
  const au = authored.filter(isAccess)
  const ob = observed.filter(isAccess)
  const protocols: AccessAttachment['protocol'][] = []
  for (const a of [...au, ...ob]) {
    if (!protocols.includes(a.protocol)) protocols.push(a.protocol)
  }
  return protocols.map((protocol) => ({
    protocol,
    authored: au.find((a) => a.protocol === protocol),
    observed: ob.find((a) => a.protocol === protocol),
  }))
}

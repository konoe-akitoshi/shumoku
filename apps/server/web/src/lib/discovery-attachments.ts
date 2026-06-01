// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * Split a node's resolved attachments into the operator's editable set and
 * the observed read-only set, by provenance. This is the data behind the
 * discovery detail panel's "human rows are editable / removable, observed
 * rows are read-only" rule (design decision 5): resolve() stamps each
 * attachment with the source that won it, and the human contribution is
 * tagged `authored`.
 *
 * Pure so it can be unit-tested without mounting the Svelte component.
 */

import type { Attachment } from './api'

type AccessAttachment = Extract<Attachment, { kind: 'access' }>

/**
 * The operator owns this attachment (editable / removable) when resolve
 * tagged it `authored`, or when it has no provenance yet — a freshly-added
 * local attachment before its next round-trip. Anything else came from an
 * observing source and is shown read-only.
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

/**
 * Partition resolved attachments into:
 *   - `authored`: the operator's attachments (provenance kept) — what the
 *     panel edits and PATCHes back.
 *   - `observedAccess`: observed-derived access rows shown read-only, with
 *     any protocol the operator has overridden removed (an authored access
 *     supersedes the observed one of the same protocol — resolve would dedup
 *     to the authored one anyway).
 */
export function partitionAttachments(attachments: Attachment[]): {
  authored: Attachment[]
  observedAccess: AccessAttachment[]
} {
  const authored = attachments.filter(isAuthoredAttachment)
  const authoredAccessProtocols = new Set(
    authored.filter((a): a is AccessAttachment => a.kind === 'access').map((a) => a.protocol),
  )
  const observedAccess = attachments.filter(
    (a): a is AccessAttachment =>
      a.kind === 'access' && !isAuthoredAttachment(a) && !authoredAccessProtocols.has(a.protocol),
  )
  return { authored, observedAccess }
}

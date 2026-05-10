// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Pure preview of what `resyncProductFromCatalog` would do, without
 * mutating any state. Drives the Resync confirmation dialog so users
 * can see which ports get added / removed / changed before the merge
 * cascades into every bound node.
 */

import type { NodePort } from '@shumoku/core'

export interface ResyncPortChange {
  /** Stable identity for display — interface name when present, else label. */
  identity: string
  /** Original port (what's currently on the Product). */
  before: NodePort
  /** Template port (what the catalog snapshot now defines). */
  after: NodePort
  /** Field-level differences worth showing to the user. */
  diffs: ResyncFieldDiff[]
}

export interface ResyncFieldDiff {
  field: 'label' | 'faceplateLabel' | 'interfaceName' | 'speed' | 'connectors' | 'poe' | 'role'
  before: string
  after: string
}

export interface ResyncPreview {
  /** Template ports not currently on the Product. */
  added: NodePort[]
  /** Current Product ports the new template no longer mentions. */
  removed: NodePort[]
  /** Current ports that match a template port but with at least one diff. */
  changed: ResyncPortChange[]
  /** True when properties (PoE, switching, etc.) differ from the snapshot. */
  propertiesChanged: boolean
  /** Number of bound nodes that will receive the new template. */
  affectedNodeCount: number
}

function joinConnectors(c: readonly string[] | undefined): string {
  if (!c || c.length === 0) return '—'
  return c.join('/')
}

function fieldDiffs(before: NodePort, after: NodePort): ResyncFieldDiff[] {
  const out: ResyncFieldDiff[] = []
  if ((before.label ?? '') !== (after.label ?? '')) {
    out.push({ field: 'label', before: before.label ?? '', after: after.label ?? '' })
  }
  if ((before.faceplateLabel ?? '') !== (after.faceplateLabel ?? '')) {
    out.push({
      field: 'faceplateLabel',
      before: before.faceplateLabel ?? '',
      after: after.faceplateLabel ?? '',
    })
  }
  if ((before.interfaceName ?? '') !== (after.interfaceName ?? '')) {
    out.push({
      field: 'interfaceName',
      before: before.interfaceName ?? '',
      after: after.interfaceName ?? '',
    })
  }
  if ((before.speed ?? '') !== (after.speed ?? '')) {
    out.push({ field: 'speed', before: before.speed ?? '', after: after.speed ?? '' })
  }
  const cBefore = joinConnectors(before.connectors)
  const cAfter = joinConnectors(after.connectors)
  if (cBefore !== cAfter) {
    out.push({ field: 'connectors', before: cBefore, after: cAfter })
  }
  if (!!before.poe !== !!after.poe) {
    out.push({ field: 'poe', before: before.poe ? 'yes' : 'no', after: after.poe ? 'yes' : 'no' })
  }
  if ((before.role ?? '') !== (after.role ?? '')) {
    out.push({ field: 'role', before: before.role ?? '', after: after.role ?? '' })
  }
  return out
}

function identityOf(p: NodePort): string {
  return p.interfaceName || p.label || p.faceplateLabel || p.id
}

/**
 * Compute the diff between a Product's current `ports` and a freshly
 * snapshotted template. Pure — neither input is mutated.
 *
 * Match strategy mirrors `mergeProductPortsIntoExisting`: by
 * interfaceName first, then by exact label match. Each existing port
 * can claim at most one template port (no double-matching).
 */
export function computeResyncPortDiff(
  current: readonly NodePort[],
  template: readonly NodePort[],
): { added: NodePort[]; removed: NodePort[]; changed: ResyncPortChange[] } {
  const consumedExisting = new Set<string>()
  const matched: ResyncPortChange[] = []
  const added: NodePort[] = []

  for (const t of template) {
    const match = current.find((c) => {
      if (consumedExisting.has(c.id)) return false
      if (t.interfaceName && c.interfaceName === t.interfaceName) return true
      if (c.label && t.label && c.label === t.label) return true
      return false
    })
    if (match) {
      consumedExisting.add(match.id)
      const diffs = fieldDiffs(match, t)
      if (diffs.length > 0) {
        matched.push({ identity: identityOf(t), before: match, after: t, diffs })
      }
    } else {
      added.push(t)
    }
  }

  const removed = current.filter((c) => !consumedExisting.has(c.id))

  return { added, removed, changed: matched }
}

// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

// =========================================================================
// BOM (bill of materials) row builders.
//
// `buildAssignmentRows` derives one row per requirement (a node's
// device spec, a link endpoint's module, a link's cable). EPS-split
// wires emit one cable row per visible segment so the count reflects
// what an installer actually orders.
// =========================================================================

import type { Link, Node } from '@shumoku/core'
import { cableLengthMeters, cableSegmentLengths, formatMeters } from '../scene/cable-length'
import type { AssignmentRow, Scene } from '../types'
import { nodeDisplayLabel } from '../utils/labels'

function formatLength(m: number): string {
  return `${formatMeters(m)}m`
}

function endpointRequirementKey(link: Link, side: 'from' | 'to'): string | undefined {
  return link[side].plug?.module?.sku ?? link[side].plug?.module?.standard
}

/**
 * Cable requirements for a link, one entry per physical cable. EPS-
 * split wires produce N entries (one per visible segment), since an
 * installer buys each side of the chase as a separate cable. Wires
 * with no scene split fall back to a single entry using either the
 * scene total or the stored `cable.length_m`.
 *
 * Returned shape: `{ key, lengthM }` per segment. The key is the
 * BOM grouping identifier (cable kind + length); lengthM is the
 * raw meters for tooltips / details.
 */
export function cableRequirementKeys(
  link: Link,
  scenes: Scene[],
  nodes: Map<string, Node>,
): Array<{ key: string; lengthM: number | null }> {
  const cable = link.cable
  const segs = cableSegmentLengths(link, scenes, nodes)
  const baseParts = [cable?.category, cable?.medium].filter(Boolean) as string[]

  if (segs.length > 1) {
    return segs.map((s) => ({
      key: [...baseParts, formatLength(s.meters)].join(' / '),
      lengthM: s.meters,
    }))
  }

  const eff = cableLengthMeters(link, scenes, nodes)
  if (!cable && !eff) return []
  const lengthLabel = eff
    ? formatLength(eff.meters)
    : cable?.length_m
      ? `${cable.length_m}m`
      : undefined
  const parts = [...baseParts, lengthLabel].filter(Boolean) as string[]
  if (parts.length === 0) return []
  return [{ key: parts.join(' / '), lengthM: eff?.meters ?? cable?.length_m ?? null }]
}

export function buildAssignmentRows(args: {
  nodes: Map<string, Node>
  links: Link[]
  scenes: Scene[]
}): AssignmentRow[] {
  const { nodes, links, scenes } = args
  const rows: AssignmentRow[] = []

  for (const [nodeId, node] of nodes) {
    rows.push({
      id: `node:${nodeId}`,
      target: { kind: 'node', nodeId },
      label: nodeDisplayLabel(node),
      source: 'Diagram node',
      productId: node.productId,
      requirementKey: node.spec
        ? 'model' in node.spec
          ? node.spec.model
          : 'service' in node.spec
            ? node.spec.service
            : node.spec.kind
        : undefined,
      status: node.productId ? 'resolved' : node.spec ? 'generic' : 'incomplete',
    })
  }

  for (const link of links) {
    if (!link.id) continue
    for (const side of ['from', 'to'] as const) {
      const endpoint = link[side]
      const key = endpointRequirementKey(link, side)
      if (!key) continue
      rows.push({
        id: `module:${link.id}:${side}`,
        target: { kind: 'link-module', linkId: link.id, side },
        label: `${link.id} ${side} module`,
        source: `${endpoint.node}:${endpoint.port}`,
        productId: endpoint.plug?.module?.productId,
        requirementKey: key,
        status: endpoint.plug?.module?.productId ? 'resolved' : 'generic',
      })
    }
    const cableReqs = cableRequirementKeys(link, scenes, nodes)
    for (const [i, req] of cableReqs.entries()) {
      // Multi-segment wires get a "1/2" / "2/2" suffix on the row id
      // and label so the BOM can show which side of the chase each
      // entry belongs to. Single-segment wires keep the stable
      // `cable:${linkId}` id (no migration churn for assignments).
      const isMulti = cableReqs.length > 1
      rows.push({
        id: isMulti ? `cable:${link.id}:${i}` : `cable:${link.id}`,
        target: { kind: 'link-cable', linkId: link.id },
        label: isMulti ? `${link.id} cable ${i + 1}/${cableReqs.length}` : `${link.id} cable`,
        source: 'Connections cable',
        productId: link.cable?.productId,
        requirementKey: req.key,
        status: link.cable?.productId ? 'resolved' : 'generic',
      })
    }
  }

  return rows
}

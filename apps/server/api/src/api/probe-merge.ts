// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * Probe merge — a write-time helper, NOT a source-to-source merge.
 *
 * A "probe" re-scans just a handful of seed devices, so its graph contains
 * only those nodes. To keep a source's snapshot complete we fold the probe
 * back into the source's previous full snapshot: keep every base node the
 * probe did NOT re-read, then append the probe's fresh nodes. This is a
 * single source updating its own snapshot — read-time cross-source merging
 * is the resolver's job (`@shumoku/core` resolve()), see
 * `apps/server/docs/design/topology-source-priority-merge.md §5`.
 *
 * Pure (only type-only imports) so it can be unit-tested without the
 * bun:sqlite-bound service layer.
 */

import type { Identity, Link, NetworkGraph, Node } from '@shumoku/core'

/**
 * Same physical device? Matches the resolver's identity clustering: any
 * shared non-empty key (mgmtIp / chassisId / sysName) means same device.
 * When either node lacks a usable identity we fall back to the display id —
 * preserving the old id-only behavior for identity-less nodes.
 *
 * Identity match (not id match) is the point: a re-scan can re-number the
 * ephemeral node id, so matching on id alone would leave the stale base
 * node behind as a duplicate. Identity survives the renumber.
 */
function sameDevice(a: Node, b: Node): boolean {
  const ai: Identity | undefined = a.identity
  const bi: Identity | undefined = b.identity
  const aHasKey = !!(ai && (ai.mgmtIp || ai.chassisId || ai.sysName))
  const bHasKey = !!(bi && (bi.mgmtIp || bi.chassisId || bi.sysName))
  if (aHasKey && bHasKey && ai && bi) {
    return (
      (!!ai.mgmtIp && ai.mgmtIp === bi.mgmtIp) ||
      (!!ai.chassisId && ai.chassisId === bi.chassisId) ||
      (!!ai.sysName && ai.sysName === bi.sysName)
    )
  }
  // At least one node has no usable identity — fall back to display id.
  return a.id === b.id
}

/**
 * Merge a probe's narrow snapshot into the source's previous full snapshot.
 *
 * Keep every base node the probe did NOT re-read (matched by identity, so a
 * re-numbered id doesn't leave a stale duplicate), then append the probe's
 * nodes. Base links incident to a re-probed device are dropped (the probe's
 * own links replace them), then any link whose endpoints aren't present in
 * the merged node set is dropped.
 *
 * When there's no usable base (first probe, or base had no graph), fall back
 * to the probe graph as-is — nothing to preserve.
 */
export function mergeProbeIntoSnapshot(
  baseGraph: NetworkGraph | null,
  probeGraph: NetworkGraph | null,
  seeds: readonly string[],
): NetworkGraph | null {
  if (!probeGraph) return baseGraph
  if (!baseGraph || baseGraph.nodes.length === 0) return probeGraph

  const probeNodes = probeGraph.nodes
  // Base node ids the probe re-read — by identity, falling back to id.
  const reprobedBaseIds = new Set(
    baseGraph.nodes.filter((b) => probeNodes.some((p) => sameDevice(b, p))).map((n) => n.id),
  )
  const mergedNodes = [...baseGraph.nodes.filter((n) => !reprobedBaseIds.has(n.id)), ...probeNodes]
  const nodeIds = new Set(mergedNodes.map((n) => n.id))

  // A Link's endpoints are structured: `from.node` / `to.node` are node ids.
  const linkTouchesReprobed = (l: Link): boolean =>
    reprobedBaseIds.has(l.from.node) || reprobedBaseIds.has(l.to.node)
  const linkResolvable = (l: Link): boolean => nodeIds.has(l.from.node) && nodeIds.has(l.to.node)

  const baseLinks = (baseGraph.links ?? []).filter((l) => !linkTouchesReprobed(l))
  const mergedLinks = [...baseLinks, ...(probeGraph.links ?? [])].filter(linkResolvable)

  // `seeds` is informational here (the probe graph already reflects them);
  // referenced to keep the signature honest for future per-seed handling.
  void seeds

  return {
    ...baseGraph,
    nodes: mergedNodes,
    links: mergedLinks,
  }
}

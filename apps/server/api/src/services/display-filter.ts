// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Post-resolve display filters.
 *
 * These run on the FULLY-RESOLVED graph (after `resolve()` has folded every
 * source + the project overlay) — never on a single source's contribution.
 * Degree is only defined on the merged graph: a node link-less in one source
 * may be linked by another, so a per-source evaluation would wrongly drop it.
 */

import type { Identity, NetworkGraph } from '@shumoku/core'

/**
 * Node identity → `key=value` strings, MIRRORING the registry's storage format
 * (`gatherNodeKeys` + `normalizeKeyValue` in entity-registry.ts: sysName/mgmtIp
 * lowercased, vendor namespaced as `vendor:<ns>`). Deliberately re-derived here
 * instead of importing the registry: this runs inside the derive Worker, which
 * must stay a pure-compute module with no DB import chain. If the registry's
 * key format changes, change this with it.
 */
export function nodeIdentityKeyStrings(identity: Identity | undefined): string[] {
  if (!identity) return []
  const out: string[] = []
  if (identity.chassisId) out.push(`chassisId=${identity.chassisId.trim()}`)
  for (const [ns, v] of Object.entries(identity.vendorIds ?? {})) {
    out.push(`vendor:${ns}=${v.trim()}`)
  }
  if (identity.mgmtIp) out.push(`mgmtIp=${identity.mgmtIp.trim().toLowerCase()}`)
  if (identity.sysName) out.push(`sysName=${identity.sysName.trim().toLowerCase()}`)
  return out
}

/**
 * Drop every node that has no incident link (degree 0).
 *
 * Flat by design: degree is the only criterion. We deliberately do NOT branch on
 * `provenance.state` (discovered-only / confirmed / intrinsic-only) — that would
 * re-introduce an "operator-placed nodes are special" authored layer, which the
 * all-sources-equal model rejects. `provenance.state` is a derived annotation
 * (how many sources saw it), not a privilege. "Hide disconnected" means hide
 * disconnected; an operator who wants to keep a standalone planned node just
 * leaves the toggle off.
 *
 * The one exception is `keepIdentityKeys`: nodes with a metrics binding.
 * Binding a node to a metrics source is an explicit operator act of "watch
 * this device", so its health must stay visible. Without it a monitored AP
 * that goes DOWN loses its uplink (a dead device's LLDP edge is suppressed as
 * stale), drops to degree 0, and vanishes from the map at exactly the moment
 * its red status matters — hide-disconnected would erase the outage instead of
 * showing it. The exemption matches by IDENTITY keys (not node ids): this
 * filter runs pre-flip inside the Worker, where node ids are resolver-minted
 * (`discovered:N`…) and relate to neither entity ids nor per-source local ids.
 *
 * Pure: returns a new graph; never mutates the input. A degree-0 node has no
 * links by definition, so no link pruning is needed.
 */
export function filterDisconnected(
  graph: NetworkGraph,
  keepIdentityKeys?: ReadonlySet<string>,
): NetworkGraph {
  const degree = new Map<string, number>()
  for (const link of graph.links) {
    const from = link.from?.node
    const to = link.to?.node
    if (from) degree.set(from, (degree.get(from) ?? 0) + 1)
    if (to) degree.set(to, (degree.get(to) ?? 0) + 1)
  }

  const isMapped = (identity: Identity | undefined): boolean => {
    if (!keepIdentityKeys || keepIdentityKeys.size === 0) return false
    return nodeIdentityKeyStrings(identity).some((k) => keepIdentityKeys.has(k))
  }

  const nodes = graph.nodes.filter((n) => (degree.get(n.id) ?? 0) > 0 || isMapped(n.identity))

  if (nodes.length === graph.nodes.length) return graph
  return { ...graph, nodes }
}

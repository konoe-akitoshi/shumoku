// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import type { ScopeMode } from '../types.js'

/**
 * Resolve the topology's scope policy to the set of SOURCE ids whose regions
 * close the world:
 *   - 'open'   → none (pure union)
 *   - 'closed' → just `scopeSourceId`
 *   - 'auto'   → the highest-priority topology-purpose source(s) that hold regions
 * A source with no regions draws no boundary, so it is no candidate for 'auto': were it, the
 * device read (SNMP), attached at a priority above every other source and holding no regions,
 * would take the boundary and open the world the moment it was attached.
 * This is the scope POLICY; resolve() is pure mechanism (honors the `scope:'closed'`
 * marks this drives). Empty set → no scoping.
 */
export function computeScopeSources(
  scopeMode: ScopeMode,
  scopeSourceId: string | undefined,
  topologySources: { dataSourceId: string; purpose: string; priority: number }[],
  holdsRegions: (sourceId: string) => boolean,
): Set<string> {
  if (scopeMode === 'open') return new Set()
  if (scopeMode === 'closed') return new Set(scopeSourceId ? [scopeSourceId] : [])
  const topo = topologySources.filter(
    (s) => s.purpose === 'topology' && holdsRegions(s.dataSourceId),
  )
  if (topo.length === 0) return new Set()
  const maxPriority = topo.reduce((m, s) => Math.max(m, s.priority), Number.NEGATIVE_INFINITY)
  return new Set(topo.filter((s) => s.priority === maxPriority).map((s) => s.dataSourceId))
}

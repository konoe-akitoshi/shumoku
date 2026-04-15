// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

import type { Catalog, CatalogEntry, HardwareProperties } from '@shumoku/catalog'
import type { NodeSpec, ResolvedNode } from '@shumoku/core'

/** Fingerprint for grouping nodes by spec identity */
export function specFingerprint(spec: NodeSpec | undefined): string | null {
  if (!spec) return null
  if (spec.kind === 'hardware') {
    return `hw:${spec.vendor ?? ''}:${spec.model ?? ''}:${spec.type ?? ''}`
  }
  if (spec.kind === 'compute') {
    return `vm:${spec.vendor ?? ''}:${spec.platform ?? ''}:${spec.type ?? ''}`
  }
  if (spec.kind === 'service') {
    return `svc:${spec.vendor ?? ''}:${spec.service}:${spec.resource ?? ''}`
  }
  return null
}

export interface DerivedSpec {
  fingerprint: string
  spec: NodeSpec
  nodeIds: string[]
  count: number
  catalogEntry: CatalogEntry | null
  label: string
}

/** Derive a grouped spec list from nodes */
export function deriveSpecsFromNodes(
  nodes: Map<string, ResolvedNode>,
  catalog: Catalog,
): DerivedSpec[] {
  const groups = new Map<string, { spec: NodeSpec; nodeIds: string[] }>()

  for (const [id, rn] of nodes) {
    const fp = specFingerprint(rn.node.spec)
    if (!fp) continue
    const existing = groups.get(fp)
    if (existing) {
      existing.nodeIds.push(id)
    } else {
      groups.set(fp, { spec: rn.node.spec as NodeSpec, nodeIds: [id] })
    }
  }

  return [...groups.values()].map(({ spec, nodeIds }) => {
    const catalogEntry = lookupSpec(spec, catalog)
    const label =
      catalogEntry?.label ??
      ('model' in spec && spec.model
        ? spec.model
        : 'service' in spec && spec.service
          ? spec.service
          : spec.kind)
    return {
      fingerprint: specFingerprint(spec) ?? '',
      spec,
      nodeIds,
      count: nodeIds.length,
      catalogEntry,
      label,
    }
  })
}

function lookupSpec(spec: NodeSpec, catalog: Catalog): CatalogEntry | null {
  if ((spec.kind === 'hardware' || spec.kind === 'compute') && spec.vendor) {
    const model = 'model' in spec ? spec.model : 'platform' in spec ? spec.platform : undefined
    if (model) {
      return catalog.lookup(`${spec.vendor}/${model}`) ?? null
    }
  }
  return null
}

/** Get total power draw for a spec from catalog */
export function getSpecPower(entry: CatalogEntry | null): { maxDraw?: number; poeBudget?: number } {
  if (!entry || entry.spec.kind !== 'hardware') return {}
  const hw = entry.properties as HardwareProperties
  return {
    maxDraw: hw.power?.max_draw_w,
    poeBudget: hw.power?.poe_out?.budget_w,
  }
}

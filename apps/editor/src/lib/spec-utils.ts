// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

import type { Catalog, CatalogEntry, HardwareProperties } from '@shumoku/catalog'
import type { Node, NodeSpec } from '@shumoku/core'
import type { SpecPaletteEntry } from './types'

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

// =========================================================================
// BOM — Palette-based aggregation
// =========================================================================

/** A BOM line item: palette entry + matched nodes */
export interface BomEntry {
  paletteEntry: SpecPaletteEntry
  fingerprint: string
  nodeIds: string[]
  count: number
  power: { maxDraw?: number; poeBudget?: number }
}

/** An orphan node — exists in diagram but not in palette */
export interface OrphanNode {
  nodeId: string
  spec: NodeSpec | undefined
  fingerprint: string | null
}

/** BOM result — palette matches + orphans */
export interface BomResult {
  entries: BomEntry[]
  orphans: OrphanNode[]
  totalCount: number
  totalPower: number
  totalPoeBudget: number
}

/** Build BOM from explicit node→palette bindings */
export function buildBom(
  palette: SpecPaletteEntry[],
  nodes: Map<string, Node>,
  bindings: Map<string, string>,
): BomResult {
  const paletteById = new Map<string, SpecPaletteEntry>()
  for (const entry of palette) paletteById.set(entry.id, entry)

  // Group nodes by palette ID via bindings
  const boundNodes = new Map<string, string[]>() // paletteId → nodeIds
  const orphans: OrphanNode[] = []

  for (const [nodeId] of nodes) {
    const paletteId = bindings.get(nodeId)
    if (!paletteId || !paletteById.has(paletteId)) {
      const node = nodes.get(nodeId)
      orphans.push({ nodeId, spec: node?.spec, fingerprint: specFingerprint(node?.spec) })
      continue
    }
    const existing = boundNodes.get(paletteId)
    if (existing) {
      existing.push(nodeId)
    } else {
      boundNodes.set(paletteId, [nodeId])
    }
  }

  // Build BOM entries (one per palette entry)
  const entries: BomEntry[] = palette.map((entry) => {
    const nodeIds = boundNodes.get(entry.id) ?? []
    const power = getPaletteEntryPower(entry)
    return {
      paletteEntry: entry,
      fingerprint: specFingerprint(entry.spec) ?? '',
      nodeIds,
      count: nodeIds.length,
      power,
    }
  })

  const totalCount = entries.reduce((s, e) => s + e.count, 0)
  const totalPower = entries.reduce((s, e) => s + (e.power.maxDraw ?? 0) * e.count, 0)
  const totalPoeBudget = entries.reduce((s, e) => s + (e.power.poeBudget ?? 0) * e.count, 0)

  return { entries, orphans, totalCount, totalPower, totalPoeBudget }
}

/** Get power from palette entry properties */
export function getPaletteEntryPower(entry: SpecPaletteEntry): {
  maxDraw?: number
  poeBudget?: number
} {
  if (!entry.properties || entry.spec.kind !== 'hardware') return {}
  const hw = entry.properties as HardwareProperties
  return {
    maxDraw: hw.power?.max_draw_w,
    poeBudget: hw.power?.poe_out?.budget_w,
  }
}

// =========================================================================
// Legacy — node-based derivation (kept for backward compat)
// =========================================================================

export interface DerivedSpec {
  fingerprint: string
  spec: NodeSpec
  nodeIds: string[]
  count: number
  catalogEntry: CatalogEntry | null
  label: string
}

export function deriveSpecsFromNodes(nodes: Map<string, Node>, catalog: Catalog): DerivedSpec[] {
  const groups = new Map<string, { spec: NodeSpec; nodeIds: string[] }>()

  for (const [id, node] of nodes) {
    const fp = specFingerprint(node.spec)
    if (!fp) continue
    const existing = groups.get(fp)
    if (existing) {
      existing.nodeIds.push(id)
    } else {
      groups.set(fp, { spec: node.spec as NodeSpec, nodeIds: [id] })
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

export function getSpecPower(entry: CatalogEntry | null): { maxDraw?: number; poeBudget?: number } {
  if (!entry || entry.spec.kind !== 'hardware') return {}
  const hw = entry.properties as HardwareProperties
  return {
    maxDraw: hw.power?.max_draw_w,
    poeBudget: hw.power?.poe_out?.budget_w,
  }
}

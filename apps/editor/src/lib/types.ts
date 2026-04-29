// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

import type { ComputeProperties, HardwareProperties, ServiceProperties } from '@shumoku/catalog'
import type { NetworkGraph, NodeSpec } from '@shumoku/core'

// =========================================================================
// Materials / Library — product definitions
// =========================================================================

/** Product — a project-local material definition available for use in this design */
export interface Product {
  /** Stable unique ID (nanoid) */
  id: string
  /** Source: catalog (unmodified), modified (catalog + local edits), custom (manual) */
  source: 'catalog' | 'modified' | 'custom'
  /** Catalog entry ID if from catalog */
  catalogId?: string
  /** The NodeSpec (kind, type, vendor, model...) */
  spec: NodeSpec
  /** Resolved properties from catalog or custom input */
  properties?: HardwareProperties | ComputeProperties | ServiceProperties
  /** User notes */
  notes?: string
}

/** @deprecated Use Product. Kept while old routes/components are migrated. */
export type SpecPaletteEntry = Product

// =========================================================================
// Materials / Assignments — design element to Product binding view
// =========================================================================

export type AssignmentTarget =
  | { kind: 'node'; nodeId: string }
  | { kind: 'link-module'; linkId: string; side: 'from' | 'to' }
  | { kind: 'link-cable'; linkId: string }

export interface AssignmentRow {
  id: string
  target: AssignmentTarget
  label: string
  source: string
  productId?: string
  requirementKey?: string
  status: 'resolved' | 'generic' | 'incomplete'
}

// =========================================================================
// Legacy BOM — previous device-instance binding rows
// =========================================================================

/** A BOM row = one device instance in the project */
export interface BomItem {
  /** Stable unique ID (nanoid) */
  id: string
  /** Reference to Spec Palette entry (undefined = not yet assigned) */
  paletteId?: string
  /** Bound diagram node ID (undefined = not yet placed) */
  nodeId?: string
  /** User notes for this specific instance */
  notes?: string
}

// =========================================================================
// Project file — .neted.json
// =========================================================================

/** neted project file format */
export interface NetedProject {
  /** Format version */
  version: 1
  /** Project name */
  name: string
  /** Project settings */
  settings?: Record<string, unknown>
  /** Spec Palette — product definitions */
  palette: SpecPaletteEntry[]
  /** Future project-local product field. When present it supersedes palette. */
  products?: Product[]
  /** BOM — device instances with node bindings */
  bom: BomItem[]
  /** Diagram — NetworkGraph (nodes with positions, links, subgraphs) */
  diagram: NetworkGraph
}

/** File extension for neted projects */
export const NETED_FILE_EXTENSION = '.neted.json'

// =========================================================================
// Display helpers
// =========================================================================

/** Display label for a palette entry */
export function productLabel(entry: Product): string {
  const s = entry.spec
  if (s.kind === 'hardware' || s.kind === 'compute') {
    const model = 'model' in s ? s.model : 'platform' in s ? s.platform : undefined
    return [s.vendor, model].filter(Boolean).join(' / ') || s.kind
  }
  if (s.kind === 'service') {
    return [s.vendor, s.service, s.resource].filter(Boolean).join(' / ')
  }
  return 'unknown'
}

/** @deprecated Use productLabel. */
export const paletteEntryLabel = productLabel

/** Get the identity column value (model, platform, or service depending on kind) */
export function specIdentifier(spec: NodeSpec): string {
  if (spec.kind === 'hardware' && 'model' in spec) return spec.model ?? '—'
  if (spec.kind === 'compute' && 'platform' in spec) return spec.platform ?? '—'
  if (spec.kind === 'service') return spec.service
  return '—'
}

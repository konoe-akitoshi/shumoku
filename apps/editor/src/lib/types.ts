// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

import type { ComputeProperties, HardwareProperties, ServiceProperties } from '@shumoku/catalog'
import type { NodeSpec } from '@shumoku/core'

// =========================================================================
// Spec Palette — product definitions
// =========================================================================

/** Spec Palette entry — a product available for use in this project */
export interface SpecPaletteEntry {
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

// =========================================================================
// BOM — device instances (master for quantity management)
// =========================================================================

/** A BOM row = one device instance in the project */
export interface BomItem {
  /** Stable unique ID (nanoid) */
  id: string
  /** Reference to Spec Palette entry */
  paletteId: string
  /** Bound diagram node ID (undefined = not yet placed) */
  nodeId?: string
  /** User notes for this specific instance */
  notes?: string
}

// =========================================================================
// Display helpers
// =========================================================================

/** Display label for a palette entry */
export function paletteEntryLabel(entry: SpecPaletteEntry): string {
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

/** Get the identity column value (model, platform, or service depending on kind) */
export function specIdentifier(spec: NodeSpec): string {
  if (spec.kind === 'hardware' && 'model' in spec) return spec.model ?? '—'
  if (spec.kind === 'compute' && 'platform' in spec) return spec.platform ?? '—'
  if (spec.kind === 'service') return spec.service
  return '—'
}

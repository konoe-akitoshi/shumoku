// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

import type { ComputeProperties, HardwareProperties, ServiceProperties } from '@shumoku/catalog'
import type { NodeSpec } from '@shumoku/core'

/** Spec Palette entry — a product available for use in this project */
export interface SpecPaletteEntry {
  /** Stable unique ID */
  id: string
  /** User-defined name */
  name: string
  /** Source: catalog or custom */
  source: 'catalog' | 'custom'
  /** Catalog entry ID if from catalog */
  catalogId?: string
  /** The NodeSpec (kind, type, vendor, model...) */
  spec: NodeSpec
  /** Resolved properties from catalog or custom input */
  properties?: HardwareProperties | ComputeProperties | ServiceProperties
  /** User notes */
  notes?: string
}

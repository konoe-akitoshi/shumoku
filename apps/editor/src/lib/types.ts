// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

import type { ComputeProperties, HardwareProperties, ServiceProperties } from '@shumoku/catalog'
import type {
  CableConnector,
  CableGrade,
  CableMedium,
  EthernetStandard,
  NetworkGraph,
  NodeSpec,
  PortConnector,
} from '@shumoku/core'

// =========================================================================
// Product — project-local material definitions
// =========================================================================

/**
 * A Product is a project-local material definition. It can describe a
 * device (hardware/compute/service node), an optical/copper module, or
 * a cable run. Diagram elements (`Node` / `LinkModule` / `LinkCable`)
 * reference a Product by id and snapshot enough of its spec to remain
 * usable even if the Product is later removed.
 */
export type Product = DeviceProduct | ModuleProduct | CableProduct

interface ProductBase {
  /** Stable unique ID (nanoid) */
  id: string
  /** Source: catalog (unmodified), modified (catalog + local edits), custom (manual) */
  source: 'catalog' | 'modified' | 'custom'
  /** Catalog entry ID if from catalog */
  catalogId?: string
  /** User notes */
  notes?: string
}

export interface DeviceProduct extends ProductBase {
  kind: 'device'
  /** Node spec — hardware / compute / service */
  spec: NodeSpec
  /** Resolved properties from catalog or custom input */
  properties?: HardwareProperties | ComputeProperties | ServiceProperties
}

export interface ModuleSpec {
  vendor?: string
  /** Manufacturer part number, e.g. "SFP-10G-SR-S" */
  mpn?: string
  /** IEEE / industry standard the module implements */
  standard: EthernetStandard
  /** Form factor cage */
  formFactor?: PortConnector
  /** Reach in meters (informational) */
  reach_m?: number
  /** Wavelength in nm (optical only) */
  wavelength_nm?: number
}

export interface ModuleProduct extends ProductBase {
  kind: 'module'
  spec: ModuleSpec
}

export interface CableSpec {
  vendor?: string
  /** Manufacturer part number */
  mpn?: string
  /** Cable medium kind */
  medium: CableMedium
  /** Installed grade within the medium */
  category?: CableGrade
  /** Run length in meters */
  length_m?: number
  /** End connectors, [from, to] */
  connectors?: [CableConnector, CableConnector]
}

export interface CableProduct extends ProductBase {
  kind: 'cable'
  spec: CableSpec
}

// =========================================================================
// Inventory — unplaced stock pool
// =========================================================================

/**
 * One physical unit ordered/owned but not yet placed in the diagram.
 * Placed units are tracked on the diagram side (`Node.productId` /
 * `LinkModule.productId` / `LinkCable.productId`); InventoryItem holds
 * only the in-stock pool.
 */
export interface InventoryItem {
  /** Stable unique ID (nanoid) */
  id: string
  /** Product this unit is an instance of */
  productId: string
  /** User notes for this specific unit */
  notes?: string
}

// =========================================================================
// Materials assignments — design element to Product binding view
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
// Project file — .neted.json
// =========================================================================

/** neted project file format */
export interface NetedProject {
  /** Format version */
  version: 2
  /** Project name */
  name: string
  /** Project settings */
  settings?: Record<string, unknown>
  /** Project-local Products (devices / modules / cables) */
  products: Product[]
  /** In-stock unplaced units */
  inventory: InventoryItem[]
  /** Diagram — NetworkGraph (nodes with positions, links, subgraphs) */
  diagram: NetworkGraph
}

/** File extension for neted projects */
export const NETED_FILE_EXTENSION = '.neted.json'

// =========================================================================
// Display helpers
// =========================================================================

/** Display label for any Product */
export function productLabel(product: Product): string {
  if (product.kind === 'device') {
    const s = product.spec
    if (s.kind === 'hardware' || s.kind === 'compute') {
      const model = 'model' in s ? s.model : 'platform' in s ? s.platform : undefined
      return [s.vendor, model].filter(Boolean).join(' / ') || s.kind
    }
    if (s.kind === 'service') {
      return [s.vendor, s.service, s.resource].filter(Boolean).join(' / ')
    }
    return 'unknown'
  }
  if (product.kind === 'module') {
    const m = product.spec
    return [m.vendor, m.mpn, m.standard].filter(Boolean).join(' / ') || 'module'
  }
  // cable
  const c = product.spec
  const length = c.length_m ? `${c.length_m}m` : undefined
  return [c.vendor, c.mpn, c.category ?? c.medium, length].filter(Boolean).join(' / ') || 'cable'
}

/** Get the identity column value for a device product spec */
export function specIdentifier(spec: NodeSpec): string {
  if (spec.kind === 'hardware' && 'model' in spec) return spec.model ?? '—'
  if (spec.kind === 'compute' && 'platform' in spec) return spec.platform ?? '—'
  if (spec.kind === 'service') return spec.service
  return '—'
}

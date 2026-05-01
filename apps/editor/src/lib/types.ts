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
  /** Catalog entry ID if linked to an external catalog. Absence = manually authored. */
  catalogId?: string
  /**
   * Procurement target. When set, BOM shows the gap against `placedCount`.
   * Undefined means "track placed count" — no separate target.
   */
  requiredQty?: number
  /**
   * Display icon. Inline SVG path string (rendered inside `viewBox="0 0 24 24"`)
   * or a URL. Initialized from a catalog entry on import; can be overridden
   * by uploading a custom icon. Snapshotted onto bound nodes' `Node.spec.icon`
   * so diagrams stay self-contained even if the Product is later removed.
   */
  icon?: string
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
// Scenes — physical-placement view (Meraki / Miro style)
// =========================================================================

/**
 * A scene is a free-form, image-backed view of (a subset of) the
 * project's NetworkGraph. The graph stays the source of truth for
 * topology; a scene only carries presentation metadata: which nodes
 * are placed where on this floor plan, and how wires for selected
 * links are routed.
 *
 * Multiple scenes can show the same node at different positions —
 * useful when a switch belongs to a logical layout AND a physical
 * floor plan, or when a campus has multiple buildings.
 */
export interface Scene {
  /** Stable unique ID (newId('scene')) */
  id: string
  /** Display name (e.g. 'Floor 1', 'Server Room') */
  name: string
  /** Optional background image (floor plan / blueprint / photo). */
  background?: SceneBackground
  /**
   * Position overrides. Sparse — every diagram node renders in this
   * scene at its `Node.position` unless an entry here overrides it.
   */
  nodePlacements: NodePlacement[]
  /**
   * Wire routing overrides. Sparse — every diagram link renders in
   * this scene with a default orthogonal route unless an entry here
   * overrides it.
   */
  wireRoutes: WireRoute[]
  /** Node ids explicitly hidden from this scene. */
  hiddenNodeIds?: string[]
  /** Link ids explicitly hidden from this scene. */
  hiddenLinkIds?: string[]
}

export interface SceneBackground {
  /** Inline data URL or external URL. */
  src: string
  /** Image natural dimensions in px. Scene coordinates match these pixels. */
  width: number
  height: number
}

export interface NodePlacement {
  /** Reference to NetworkGraph.nodes[].id */
  nodeId: string
  /** Center position in scene (image-pixel) coordinates. */
  position: { x: number; y: number }
  /** Rotation in degrees (default 0). */
  rotation?: number
  /** Uniform scale (default 1). */
  scale?: number
}

export type WirePathStyle = 'straight' | 'orthogonal' | 'free'

export interface WireRoute {
  /** Reference to NetworkGraph.links[].id */
  linkId: string
  /** Path style; default 'orthogonal'. */
  pathStyle: WirePathStyle
  /** Optional waypoints between endpoints; renderer connects them in order. */
  controlPoints?: { x: number; y: number }[]
}

// =========================================================================
// Project file — .neted.json
// =========================================================================

/** neted project file format */
export interface NetedProject {
  /** Format version */
  version: 3
  /** Project name */
  name: string
  /** Project settings */
  settings?: Record<string, unknown>
  /** Project-local Products (devices / modules / cables) */
  products: Product[]
  /** Diagram — NetworkGraph (nodes with positions, links, subgraphs) */
  diagram: NetworkGraph
  /** Physical-placement views (floor plans / image-backed canvases). */
  scenes?: Scene[]
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

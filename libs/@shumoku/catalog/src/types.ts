// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import type { NodeSpec } from '@shumoku/core'

// ============================================
// Properties — grouped by concern
// ============================================

/** PoE consumer (Powered Device) */
export interface PoEIn {
  /** PoE standard: "802.3af", "802.3at", "802.3bt" */
  standard?: string
  /** PoE class (0–8) */
  class?: number
  /** Max power draw via PoE (watts) */
  max_draw_w?: number
}

/** PoE source (Power Sourcing Equipment) */
export interface PoEOut {
  /** PoE standard */
  standard?: string
  /** Total PoE power budget (watts) */
  budget_w?: number
  /** Max PoE per port (watts) */
  max_per_port_w?: number
  /** Number of PoE-capable ports */
  ports?: number
}

export interface PowerProperties {
  /** Maximum device power consumption (watts, including PoE delivery) */
  max_draw_w?: number
  /** Idle power consumption (watts) */
  idle_draw_w?: number
  /** PoE consumer capabilities */
  poe_in?: PoEIn
  /** PoE source capabilities */
  poe_out?: PoEOut
}

export interface PortGroup {
  count: number
  /** Port speed: "100m", "1g", "2.5g", "5g", "10g", "25g", "40g", "100g" */
  speed: string
  /** Media type: "copper", "sfp", "sfp+", "qsfp+", "qsfp28" */
  media: string
  /** Whether these ports support PoE */
  poe?: boolean
}

export interface PortProperties {
  downlink?: PortGroup[]
  uplink?: PortGroup[]
}

export interface SwitchingProperties {
  /** Switching capacity (Gbps) */
  capacity_gbps?: number
  /** Forwarding rate (Mpps) */
  forwarding_rate_mpps?: number
  /** MAC address table size */
  mac_table_size?: number
  /** Number of VLANs supported */
  vlan_count?: number
  /** Maximum jumbo frame size (bytes) */
  jumbo_frame_bytes?: number
  /** Packet buffer memory (MB) */
  buffer_mb?: number
}

export interface WirelessProperties {
  /** WiFi standard: "wifi-4", "wifi-5", "wifi-6", "wifi-6e", "wifi-7" */
  standard?: string
  /** Number of radios */
  radios?: number
  /** MIMO configuration: "2x2", "4x4", "8x8" */
  mimo?: string
  /** Supported frequency bands */
  bands?: string[]
  /** Maximum concurrent clients */
  max_clients?: number
  /** Antenna type: "internal", "external" */
  antenna_type?: string
  /** Maximum data rate (Mbps) */
  max_data_rate_mbps?: number
}

export interface PhysicalProperties {
  /** Form factor: "desktop", "1U", "2U", "wall-mount", "ceiling", "compact" */
  form_factor?: string
  /** Dimensions in mm */
  dimensions_mm?: { w: number; d: number; h: number }
  /** Weight in grams */
  weight_g?: number
  /** Fanless operation */
  fanless?: boolean
  /** Operating temperature range (Celsius) */
  operating_temp_c?: { min: number; max: number }
  /** Supported mounting options */
  mounting?: string[]
  /** IP rating (e.g., "IP41") */
  ip_rating?: string
}

export interface ManagementProperties {
  /** Network layer: 2 or 3 */
  layer?: number
  /** Stacking support */
  stackable?: boolean
  /** Maximum stack members */
  stack_members_max?: number
  /** Management protocols */
  protocols?: string[]
  /** Software image / license tier */
  image?: string
  /** DRAM (MB) */
  dram_mb?: number
  /** Flash storage (MB) */
  flash_mb?: number
}

// ============================================
// Hardware Properties (aggregate)
// ============================================

export interface HardwareProperties {
  power?: PowerProperties
  ports?: PortProperties
  switching?: SwitchingProperties
  wireless?: WirelessProperties
  physical?: PhysicalProperties
  management?: ManagementProperties
}

// ============================================
// Compute Properties
// ============================================

export interface ComputeProperties {
  vcpu?: number
  memory_gb?: number
  storage_gb?: number
  network_gbps?: number
  os?: string
  hypervisor?: string
}

// ============================================
// Service Properties
// ============================================

export interface ServiceProperties {
  pricing_model?: string
  region?: string
  max_memory_mb?: number
  max_timeout_s?: number
}

// ============================================
// Kind → Properties type mapping
// ============================================

export type PropertiesFor<K extends NodeSpec['kind']> = K extends 'hardware'
  ? HardwareProperties
  : K extends 'compute'
    ? ComputeProperties
    : K extends 'service'
      ? ServiceProperties
      : never

// ============================================
// Catalog Entry
// ============================================

export interface CatalogEntry<K extends NodeSpec['kind'] = NodeSpec['kind']> {
  /** Unique ID: "vendor/series/model" or "vendor/model" */
  id: string
  /** Human-readable label */
  label: string
  /** Node specification (identity) */
  spec: Extract<NodeSpec, { kind: K }>
  /** Parent entry ID for property inheritance */
  extends?: string
  /** Tags for search and filtering */
  tags: string[]
  /** Detailed properties (type-safe per kind) */
  properties: PropertiesFor<K>
}

/** Type-narrowed entry for hardware */
export type HardwareCatalogEntry = CatalogEntry<'hardware'>
/** Type-narrowed entry for compute */
export type ComputeCatalogEntry = CatalogEntry<'compute'>
/** Type-narrowed entry for service */
export type ServiceCatalogEntry = CatalogEntry<'service'>

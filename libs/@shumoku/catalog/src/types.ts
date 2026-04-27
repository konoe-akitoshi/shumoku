// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import type { NodeSpec, PortConnector, PortRole } from '@shumoku/core'

// ============================================
// Properties — grouped by concern
// ============================================

/** Per-class profile for a multi-class PD (e.g. AP that runs degraded on lower classes). */
export interface PoEInClassProfile {
  /** PoE standard at this class ("802.3af" | "802.3at" | "802.3bt") */
  standard?: string
  /** Actual device power consumption when operating at this class (watts) */
  max_draw_w?: number
  /** Human-readable note (e.g. "1x1 radio, no USB/LLDP") */
  note?: string
}

/** PoE consumer (Powered Device) */
export interface PoEIn {
  /** Highest PoE standard supported ("802.3af" | "802.3at" | "802.3bt") */
  standard?: string
  /** Highest PoE class the device can negotiate (0–8) */
  class?: number
  /**
   * Minimum PoE class required to boot. If omitted, the device is assumed to
   * gracefully degrade on any lower class it negotiates.
   */
  min_class?: number
  /** Max power draw via PoE at the highest class (watts, informational) */
  max_draw_w?: number
  /**
   * Per-class capability matrix for multi-class devices. Optional.
   * Keyed by class number. Used when a device draws materially different power
   * and exposes different features at each class it supports.
   */
  by_class?: Record<number, PoEInClassProfile>
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
  count?: number
  /** Explicit canonical port IDs. Takes precedence over count/name_pattern. */
  names?: string[]
  /** Physical faceplate labels aligned by index with names/count. */
  faceplate_labels?: string[]
  /** Full OS/API interface names aligned by index with names/count. */
  interface_names?: string[]
  /** Alternative names aligned by index with names/count. */
  aliases?: string[][]
  /** Name template for counted ports. Supports {n}, {n0}, and {role}. */
  name_pattern?: string
  /** camelCase alias for programmatic catalog construction. */
  namePattern?: string
  /** Faceplate-label template. Supports {n}, {n0}, {role}, and {name}. */
  faceplate_label_pattern?: string
  /** OS/API interface-name template. Supports {n}, {n0}, {role}, and {name}. */
  interface_name_pattern?: string
  /** Logical role for the ports in this group. */
  role?: PortRole | (string & {})
  /** Port speed: "100m", "1g", "2.5g", "5g", "10g", "25g", "40g", "100g" */
  speed: string
  /** Physical port/cage type: "rj45", "sfp", "sfp+", "qsfp+", "qsfp28", "combo" */
  connector: PortConnector
  /** Deprecated: use connector. */
  media?: string
  /** Whether these ports support PoE */
  poe?: boolean
}

export interface PortProperties {
  groups?: PortGroup[]
  downlink?: PortGroup[]
  uplink?: PortGroup[]
  wan?: PortGroup[]
  lan?: PortGroup[]
  management?: PortGroup[]
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

export interface CatalogEntry {
  /** Unique ID: "vendor/series/model" or "vendor/model" */
  id: string
  /** Human-readable label */
  label: string
  /** Node specification (identity) */
  spec: NodeSpec
  /** Parent entry ID for property inheritance */
  extends?: string
  /** Tags for search and filtering */
  tags: string[]
  /** Detailed properties — use kind to narrow */
  properties: HardwareProperties | ComputeProperties | ServiceProperties
}

/** Type-narrowed entry for hardware */
export type HardwareCatalogEntry = CatalogEntry & {
  spec: Extract<NodeSpec, { kind: 'hardware' }>
  properties: HardwareProperties
}
/** Type-narrowed entry for compute */
export type ComputeCatalogEntry = CatalogEntry & {
  spec: Extract<NodeSpec, { kind: 'compute' }>
  properties: ComputeProperties
}
/** Type-narrowed entry for service */
export type ServiceCatalogEntry = CatalogEntry & {
  spec: Extract<NodeSpec, { kind: 'service' }>
  properties: ServiceProperties
}

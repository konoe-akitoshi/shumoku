// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * Built-in catalog entries for common network devices.
 * These serve as the initial dataset — community contributions welcome.
 */

import { DeviceType } from '@shumoku/core'
import type { HardwareCatalogEntry } from './types.js'

// ============================================
// Cisco Catalyst 3560-CX Series
// ============================================

const catalyst3560cx: HardwareCatalogEntry = {
  id: 'cisco/catalyst-3560cx',
  label: 'Catalyst 3560-CX Series',
  spec: { kind: 'hardware', type: DeviceType.L3Switch, vendor: 'cisco' },
  tags: ['l3-switch', 'compact', 'fanless', 'campus'],
  properties: {
    switching: {
      mac_table_size: 16000,
      vlan_count: 1023,
      jumbo_frame_bytes: 9198,
    },
    physical: {
      form_factor: 'compact',
      fanless: true,
      operating_temp_c: { min: 0, max: 45 },
      mounting: ['desk', 'wall', 'rack'],
    },
    management: {
      stackable: false,
      protocols: ['snmp-v1', 'snmp-v2c', 'snmp-v3', 'ssh', 'cli', 'web'],
      dram_mb: 512,
      flash_mb: 256,
    },
  },
}

const c3560cx8tcS: HardwareCatalogEntry = {
  id: 'cisco/catalyst-3560cx/ws-c3560cx-8tc-s',
  label: 'WS-C3560CX-8TC-S',
  extends: 'cisco/catalyst-3560cx',
  spec: { kind: 'hardware', type: DeviceType.L3Switch, vendor: 'cisco', model: 'ws-c3560cx-8tc-s' },
  tags: [],
  properties: {
    power: { max_draw_w: 24 },
    switching: { capacity_gbps: 22, forwarding_rate_mpps: 16.07 },
    ports: {
      downlink: [{ count: 8, speed: '1g', media: 'copper' }],
      uplink: [
        { count: 2, speed: '1g', media: 'sfp' },
        { count: 2, speed: '1g', media: 'copper' },
      ],
    },
    management: { layer: 2, image: 'lan-base' },
  },
}

const c3560cx8pcS: HardwareCatalogEntry = {
  id: 'cisco/catalyst-3560cx/ws-c3560cx-8pc-s',
  label: 'WS-C3560CX-8PC-S',
  extends: 'cisco/catalyst-3560cx',
  spec: { kind: 'hardware', type: DeviceType.L3Switch, vendor: 'cisco', model: 'ws-c3560cx-8pc-s' },
  tags: ['poe-source'],
  properties: {
    power: {
      max_draw_w: 300,
      poe_out: { standard: '802.3at', budget_w: 240, max_per_port_w: 30, ports: 8 },
    },
    switching: { capacity_gbps: 22, forwarding_rate_mpps: 16.07 },
    ports: {
      downlink: [{ count: 8, speed: '1g', media: 'copper', poe: true }],
      uplink: [
        { count: 2, speed: '1g', media: 'sfp' },
        { count: 2, speed: '1g', media: 'copper' },
      ],
    },
    management: { layer: 2, image: 'lan-base' },
  },
}

const c3560cx12pcS: HardwareCatalogEntry = {
  id: 'cisco/catalyst-3560cx/ws-c3560cx-12pc-s',
  label: 'WS-C3560CX-12PC-S',
  extends: 'cisco/catalyst-3560cx',
  spec: {
    kind: 'hardware',
    type: DeviceType.L3Switch,
    vendor: 'cisco',
    model: 'ws-c3560cx-12pc-s',
  },
  tags: ['poe-source'],
  properties: {
    power: {
      max_draw_w: 310,
      poe_out: { standard: '802.3at', budget_w: 240, max_per_port_w: 30, ports: 12 },
    },
    switching: { capacity_gbps: 28, forwarding_rate_mpps: 20.83 },
    ports: {
      downlink: [{ count: 12, speed: '1g', media: 'copper', poe: true }],
      uplink: [
        { count: 2, speed: '1g', media: 'sfp' },
        { count: 2, speed: '1g', media: 'copper' },
      ],
    },
    management: { layer: 2, image: 'lan-base' },
  },
}

// ============================================
// HPE Aruba AP-505
// ============================================

const arubaAp505: HardwareCatalogEntry = {
  id: 'hpe/aruba-ap-505',
  label: 'Aruba AP-505',
  spec: { kind: 'hardware', type: DeviceType.AccessPoint, vendor: 'hpe', model: 'aruba-ap-505' },
  tags: ['wifi-6', 'indoor', 'ceiling-mount', 'poe-consumer'],
  properties: {
    power: {
      max_draw_w: 11,
      poe_in: { standard: '802.3af', class: 3, max_draw_w: 16.5 },
    },
    wireless: {
      standard: 'wifi-6',
      radios: 2,
      mimo: '2x2',
      bands: ['2.4ghz', '5ghz'],
      antenna_type: 'internal',
    },
    physical: {
      form_factor: 'ceiling',
      dimensions_mm: { w: 160, d: 161, h: 37 },
      weight_g: 500,
      mounting: ['ceiling', 'wall'],
    },
  },
}

// ============================================
// Aruba Instant On AP11D
// ============================================

const arubaInstantOnAp11d: HardwareCatalogEntry = {
  id: 'hpe/aruba-instant-on-ap11d',
  label: 'Aruba Instant On AP11D',
  spec: {
    kind: 'hardware',
    type: DeviceType.AccessPoint,
    vendor: 'hpe',
    model: 'aruba-instant-on-ap11d',
  },
  tags: ['wifi-5', 'desk', 'poe-consumer', 'poe-passthrough'],
  properties: {
    power: {
      max_draw_w: 12,
      poe_in: { standard: '802.3af', class: 3 },
      poe_out: { standard: '802.3af', budget_w: 15.4, max_per_port_w: 15.4, ports: 1 },
    },
    wireless: {
      standard: 'wifi-5',
      radios: 2,
      mimo: '2x2',
      bands: ['2.4ghz', '5ghz'],
      antenna_type: 'internal',
    },
    ports: {
      downlink: [{ count: 3, speed: '1g', media: 'copper' }],
      uplink: [{ count: 1, speed: '1g', media: 'copper' }],
    },
    physical: {
      form_factor: 'desktop',
      dimensions_mm: { w: 86, d: 150, h: 40 },
      weight_g: 313,
      mounting: ['desk', 'wall'],
    },
  },
}

// ============================================
// Panasonic Switch-M8ePWR (PN27089K)
// ============================================

const switchM8ePwr: HardwareCatalogEntry = {
  id: 'panasonic/switch-m8epwr',
  label: 'Switch-M8ePWR (PN27089K)',
  spec: {
    kind: 'hardware',
    type: DeviceType.L2Switch,
    vendor: 'panasonic',
    model: 'switch-m8epwr',
  },
  tags: ['poe-source', 'l2-switch', 'managed'],
  properties: {
    power: {
      max_draw_w: 161,
      idle_draw_w: 10.6,
      poe_out: { standard: '802.3af', budget_w: 124, max_per_port_w: 15.4, ports: 8 },
    },
    switching: {
      capacity_gbps: 5.6,
      forwarding_rate_mpps: 4.1,
      mac_table_size: 16000,
      buffer_mb: 1.5,
    },
    ports: {
      downlink: [{ count: 8, speed: '100m', media: 'copper', poe: true }],
      uplink: [
        { count: 2, speed: '1g', media: 'copper' },
        { count: 2, speed: '1g', media: 'sfp' },
      ],
    },
    physical: {
      form_factor: '1U',
      dimensions_mm: { w: 210, d: 280, h: 44 },
      weight_g: 2300,
      mounting: ['rack'],
    },
    management: {
      layer: 2,
      protocols: ['snmp-v1', 'snmp-v2c', 'ssh', 'cli', 'web'],
    },
  },
}

// ============================================
// Panasonic Switch-M8eGPWR+ (PN28089K)
// ============================================

const switchM8eGpwrPlus: HardwareCatalogEntry = {
  id: 'panasonic/switch-m8egpwr-plus',
  label: 'Switch-M8eGPWR+ (PN28089K)',
  spec: {
    kind: 'hardware',
    type: DeviceType.L2Switch,
    vendor: 'panasonic',
    model: 'switch-m8egpwr-plus',
  },
  tags: ['poe-source', 'l2-switch', 'managed', 'poe-plus'],
  properties: {
    power: {
      max_draw_w: 310,
      idle_draw_w: 17,
      poe_out: { standard: '802.3at', budget_w: 240, max_per_port_w: 30, ports: 8 },
    },
    switching: {
      capacity_gbps: 20,
      forwarding_rate_mpps: 14.8,
      mac_table_size: 8000,
    },
    ports: {
      downlink: [{ count: 8, speed: '1g', media: 'copper', poe: true }],
      uplink: [{ count: 2, speed: '1g', media: 'sfp' }],
    },
    physical: {
      form_factor: '1U',
      dimensions_mm: { w: 330, d: 250, h: 44 },
      weight_g: 3000,
      mounting: ['rack'],
    },
    management: {
      layer: 2,
      protocols: ['snmp-v1', 'snmp-v2c', 'ssh', 'cli', 'web'],
    },
  },
}

// ============================================
// Export all built-in entries
// ============================================

export const builtinEntries: HardwareCatalogEntry[] = [
  catalyst3560cx,
  c3560cx8tcS,
  c3560cx8pcS,
  c3560cx12pcS,
  arubaAp505,
  arubaInstantOnAp11d,
  switchM8ePwr,
  switchM8eGpwrPlus,
]

// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Sample project template — provides initial Palette + diagram data.
 * Every spec used in the sample diagram MUST be defined here.
 * Will be replaced by a proper template system when DB is introduced.
 */

import type { HardwareProperties } from '@shumoku/catalog'
import { DeviceType } from '@shumoku/core'
import type { SpecPaletteEntry } from './types'

export const samplePalette: SpecPaletteEntry[] = [
  // ========== Cloud ==========
  {
    id: 'pal-aws-ec2',
    source: 'custom',
    spec: { kind: 'service', vendor: 'aws', service: 'ec2', resource: 'instances' },
  },
  {
    id: 'pal-aws-vpn-gw',
    source: 'custom',
    spec: { kind: 'service', vendor: 'aws', service: 'vpc', resource: 'vpn-gateway' },
  },

  // ========== Perimeter ==========
  {
    id: 'pal-internet',
    source: 'custom',
    spec: { kind: 'hardware', type: DeviceType.Internet, vendor: undefined },
  },
  {
    id: 'pal-yamaha-rtx3510',
    source: 'custom',
    spec: { kind: 'hardware', type: DeviceType.Router, vendor: 'yamaha', model: 'rtx3510' },
  },
  {
    id: 'pal-juniper-srx4100',
    source: 'custom',
    spec: { kind: 'hardware', type: DeviceType.Firewall, vendor: 'juniper', model: 'SRX4100' },
  },

  // ========== DMZ ==========
  {
    id: 'pal-generic-l2-switch',
    source: 'custom',
    spec: { kind: 'hardware', type: DeviceType.L2Switch },
  },
  {
    id: 'pal-generic-server',
    source: 'custom',
    spec: { kind: 'hardware', type: DeviceType.Server },
  },

  // ========== NOC ==========
  {
    id: 'pal-juniper-qfx5120',
    source: 'custom',
    spec: {
      kind: 'hardware',
      type: DeviceType.L3Switch,
      vendor: 'juniper',
      model: 'QFX5120-48T',
    },
  },
  {
    id: 'pal-juniper-ex4400',
    source: 'custom',
    spec: {
      kind: 'hardware',
      type: DeviceType.L3Switch,
      vendor: 'juniper',
      model: 'EX4400-48T',
    },
  },

  // ========== Building A (Cisco + Aruba) ==========
  {
    id: 'pal-cisco-3560cx-8pc',
    source: 'catalog',
    catalogId: 'cisco/catalyst-3560cx/ws-c3560cx-8pc-s',
    spec: {
      kind: 'hardware',
      type: DeviceType.L3Switch,
      vendor: 'cisco',
      model: 'ws-c3560cx-8pc-s',
    },
    properties: {
      power: {
        max_draw_w: 300,
        poe_out: { standard: '802.3at', budget_w: 240, max_per_port_w: 30, ports: 8 },
      },
      switching: { capacity_gbps: 22 },
    } satisfies HardwareProperties,
  },
  {
    id: 'pal-aruba-ap505',
    source: 'catalog',
    catalogId: 'hpe/aruba-ap-505',
    spec: {
      kind: 'hardware',
      type: DeviceType.AccessPoint,
      vendor: 'hpe',
      model: 'aruba-ap-505',
    },
    properties: {
      power: { max_draw_w: 11, poe_in: { standard: '802.3af', class: 3, max_draw_w: 16.5 } },
      wireless: { standard: 'wifi-6', radios: 2, mimo: '2x2', bands: ['2.4ghz', '5ghz'] },
    } satisfies HardwareProperties,
  },

  // ========== Building B (Panasonic + AP11D + IP Phone) ==========
  {
    id: 'pal-panasonic-m8egpwr-plus',
    source: 'catalog',
    catalogId: 'panasonic/switch-m8egpwr-plus',
    spec: {
      kind: 'hardware',
      type: DeviceType.L2Switch,
      vendor: 'panasonic',
      model: 'switch-m8egpwr-plus',
    },
    properties: {
      power: {
        max_draw_w: 310,
        poe_out: { standard: '802.3at', budget_w: 240, max_per_port_w: 30, ports: 8 },
      },
      switching: { capacity_gbps: 20 },
    } satisfies HardwareProperties,
  },
  {
    id: 'pal-aruba-ap11d',
    source: 'catalog',
    catalogId: 'hpe/aruba-instant-on-ap11d',
    spec: {
      kind: 'hardware',
      type: DeviceType.AccessPoint,
      vendor: 'hpe',
      model: 'aruba-instant-on-ap11d',
    },
    properties: {
      power: {
        max_draw_w: 12,
        poe_in: { standard: '802.3af', class: 3 },
        poe_out: { standard: '802.3af', budget_w: 15.4, max_per_port_w: 15.4, ports: 1 },
      },
      wireless: { standard: 'wifi-5', radios: 2, mimo: '2x2', bands: ['2.4ghz', '5ghz'] },
    } satisfies HardwareProperties,
  },
  {
    id: 'pal-generic-ip-phone',
    source: 'catalog',
    catalogId: 'generic/ip-phone',
    spec: { kind: 'hardware', type: DeviceType.CPE, vendor: 'generic', model: 'ip-phone' },
    properties: {
      power: { max_draw_w: 5, poe_in: { standard: '802.3af', class: 1, max_draw_w: 5 } },
    } satisfies HardwareProperties,
  },
]

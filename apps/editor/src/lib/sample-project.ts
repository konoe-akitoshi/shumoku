// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Sample project template — provides initial Products + diagram data.
 * Will be replaced by a proper template system when DB is introduced.
 */

import type { HardwareProperties } from '@shumoku/catalog'
import { DeviceType, type NetworkGraph } from '@shumoku/core'
import { sampleDiagram } from './sample-diagram'
import type { DeviceProduct, NetedProject } from './types'

export const sampleProducts: DeviceProduct[] = [
  // ========== Cloud ==========
  {
    id: 'product-aws-ec2',
    kind: 'device',
    spec: { kind: 'service', vendor: 'aws', service: 'ec2', resource: 'instances' },
  },
  {
    id: 'product-aws-vpn-gw',
    kind: 'device',
    spec: { kind: 'service', vendor: 'aws', service: 'vpc', resource: 'vpn-gateway' },
  },

  // ========== Perimeter ==========
  {
    id: 'product-internet',
    kind: 'device',
    spec: { kind: 'hardware', type: DeviceType.Internet, vendor: undefined },
  },
  {
    id: 'product-yamaha-rtx3510',
    kind: 'device',
    spec: { kind: 'hardware', type: DeviceType.Router, vendor: 'yamaha', model: 'rtx3510' },
  },
  {
    id: 'product-juniper-srx4100',
    kind: 'device',
    spec: { kind: 'hardware', type: DeviceType.Firewall, vendor: 'juniper', model: 'SRX4100' },
  },

  // ========== DMZ ==========
  {
    id: 'product-generic-l2-switch',
    kind: 'device',
    spec: { kind: 'hardware', type: DeviceType.L2Switch },
  },
  {
    id: 'product-generic-server',
    kind: 'device',
    spec: { kind: 'hardware', type: DeviceType.Server },
  },

  // ========== NOC ==========
  {
    id: 'product-juniper-qfx5120',
    kind: 'device',
    spec: {
      kind: 'hardware',
      type: DeviceType.L3Switch,
      vendor: 'juniper',
      model: 'QFX5120-48T',
    },
  },
  {
    id: 'product-juniper-ex4400',
    kind: 'device',
    spec: {
      kind: 'hardware',
      type: DeviceType.L3Switch,
      vendor: 'juniper',
      model: 'EX4400-48T',
    },
  },

  // ========== Building A (Cisco + Aruba) ==========
  {
    id: 'product-cisco-3560cx-8pc',
    kind: 'device',
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
    id: 'product-aruba-ap505',
    kind: 'device',
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
    id: 'product-panasonic-m8egpwr-plus',
    kind: 'device',
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
    id: 'product-aruba-ap11d',
    kind: 'device',
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
    id: 'product-generic-ip-phone',
    kind: 'device',
    catalogId: 'generic/ip-phone',
    spec: { kind: 'hardware', type: DeviceType.CPE, vendor: 'generic', model: 'ip-phone' },
    properties: {
      power: { max_draw_w: 5, poe_in: { standard: '802.3af', class: 1, max_draw_w: 5 } },
    } satisfies HardwareProperties,
  },
]

/** Map of nodeId → productId for the bundled sample diagram. */
const sampleNodeProduct: Record<string, string> = {
  'cloud-services': 'product-aws-ec2',
  vgw: 'product-aws-vpn-gw',
  isp1: 'product-internet',
  isp2: 'product-internet',
  rt1: 'product-yamaha-rtx3510',
  rt2: 'product-yamaha-rtx3510',
  fw1: 'product-juniper-srx4100',
  fw2: 'product-juniper-srx4100',
  'dmz-sw': 'product-generic-l2-switch',
  'web-srv': 'product-generic-server',
  'mail-srv': 'product-generic-server',
  'core-sw': 'product-juniper-qfx5120',
  'dist-sw': 'product-juniper-ex4400',
  'sw-a1': 'product-cisco-3560cx-8pc',
  'ap-a1': 'product-aruba-ap505',
  'ap-a2': 'product-aruba-ap505',
  'sw-b1': 'product-panasonic-m8egpwr-plus',
  'ap-b1': 'product-aruba-ap505',
  'ap-b2': 'product-aruba-ap11d',
  'ip-phone': 'product-generic-ip-phone',
}

/** sample diagram with productId stamped onto each node */
const sampleDiagramWithBindings: NetworkGraph = {
  ...(sampleDiagram as NetworkGraph),
  nodes: (sampleDiagram as NetworkGraph).nodes.map((node) => {
    const productId = sampleNodeProduct[node.id]
    return productId ? { ...node, productId } : node
  }),
}

/** Sample project — bundled products and positioned diagram. */
export const sampleProject: NetedProject = {
  version: 2,
  name: 'Sample Network',
  products: sampleProducts,
  diagram: sampleDiagramWithBindings,
}

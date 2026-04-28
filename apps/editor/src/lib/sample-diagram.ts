// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Editor-owned sample diagram. This is the canonical source for the
 * "Open sample" feature — hand-edit this file directly to evolve the
 * demo. It is intentionally NOT derived from `@shumoku/core`'s YAML
 * fixture: the YAML side is for parser testing and is allowed to use
 * terse forms that this editor sample wouldn't.
 *
 * Cast via `as unknown as NetworkGraph`: DeviceType is a string enum and
 * the JSON-shaped literal carries raw string values where the type wants
 * enum references. Runtime values match — the cast only papers over the
 * nominal type check.
 */

import type { NetworkGraph } from '@shumoku/core'

export const sampleDiagram = {
  version: '2.0.0',
  name: 'Sample Network',
  description: 'Sample network with HA routers, firewall, DMZ and campus',
  settings: {
    theme: 'light',
  },
  nodes: [
    {
      id: 'cloud-services',
      label: 'Services VPC',
      shape: 'rounded',
      parent: 'cloud',
      spec: {
        kind: 'service',
        vendor: 'aws',
        service: 'ec2',
        resource: 'instances',
      },
      ports: [
        {
          id: 'eth0',
          label: 'eth0',
          source: 'custom',
        },
      ],
      position: {
        x: 570,
        y: 78,
      },
    },
    {
      id: 'vgw',
      label: 'VPN Gateway',
      shape: 'rounded',
      parent: 'cloud',
      spec: {
        kind: 'service',
        vendor: 'aws',
        service: 'vpc',
        resource: 'vpn-gateway',
      },
      ports: [
        {
          id: 'vpc',
          label: 'vpc',
          source: 'custom',
        },
        {
          id: 'tun0',
          label: 'tun0',
          source: 'custom',
        },
        {
          id: 'tun1',
          label: 'tun1',
          source: 'custom',
        },
      ],
      position: {
        x: 570,
        y: 248,
      },
    },
    {
      id: 'isp1',
      label: 'ISP Line #1 (Primary)',
      shape: 'rounded',
      parent: 'perimeter/edge',
      spec: {
        kind: 'hardware',
        type: 'internet',
      },
      ports: [
        {
          id: 'eth0',
          label: 'eth0',
          source: 'custom',
        },
      ],
      position: {
        x: 458.5,
        y: 544,
      },
    },
    {
      id: 'isp2',
      label: 'ISP Line #2 (Secondary)',
      shape: 'rounded',
      parent: 'perimeter/edge',
      spec: {
        kind: 'hardware',
        type: 'internet',
      },
      ports: [
        {
          id: 'eth0',
          label: 'eth0',
          source: 'custom',
        },
      ],
      position: {
        x: 675,
        y: 544,
      },
    },
    {
      id: 'rt1',
      label: 'Edge-RT-1 (Master)',
      shape: 'rounded',
      parent: 'perimeter/edge',
      spec: {
        kind: 'hardware',
        type: 'router',
        vendor: 'yamaha',
        model: 'rtx3510',
      },
      ports: [
        {
          id: 'wan1',
          label: 'wan1',
          source: 'custom',
        },
        {
          id: 'ha0',
          label: 'ha0',
          source: 'custom',
        },
        {
          id: 'lan1',
          label: 'lan1',
          source: 'custom',
        },
        {
          id: 'tun1',
          label: 'tun1',
          source: 'custom',
        },
      ],
      position: {
        x: 458.5,
        y: 744,
      },
    },
    {
      id: 'rt2',
      label: 'Edge-RT-2 (Backup)',
      shape: 'rounded',
      parent: 'perimeter/edge',
      spec: {
        kind: 'hardware',
        type: 'router',
        vendor: 'yamaha',
        model: 'rtx3510',
      },
      ports: [
        {
          id: 'wan1',
          label: 'wan1',
          source: 'custom',
        },
        {
          id: 'ha0',
          label: 'ha0',
          source: 'custom',
        },
        {
          id: 'lan1',
          label: 'lan1',
          source: 'custom',
        },
        {
          id: 'tun1',
          label: 'tun1',
          source: 'custom',
        },
      ],
      position: {
        x: 675,
        y: 744,
      },
    },
    {
      id: 'fw1',
      label: 'FW-1 (Active)',
      shape: 'rounded',
      parent: 'perimeter/security',
      spec: {
        kind: 'hardware',
        type: 'firewall',
        vendor: 'juniper',
        model: 'srx4100',
      },
      ports: [
        {
          id: 'outside',
          label: 'outside',
          source: 'custom',
        },
        {
          id: 'ha',
          label: 'ha',
          source: 'custom',
        },
        {
          id: 'dmz',
          label: 'dmz',
          source: 'custom',
        },
        {
          id: 'inside',
          label: 'inside',
          source: 'custom',
        },
      ],
      position: {
        x: 465,
        y: 1052,
      },
    },
    {
      id: 'fw2',
      label: 'FW-2 (Standby)',
      shape: 'rounded',
      parent: 'perimeter/security',
      spec: {
        kind: 'hardware',
        type: 'firewall',
        vendor: 'juniper',
        model: 'srx4100',
      },
      ports: [
        {
          id: 'outside',
          label: 'outside',
          source: 'custom',
        },
        {
          id: 'ha',
          label: 'ha',
          source: 'custom',
        },
        {
          id: 'inside',
          label: 'inside',
          source: 'custom',
        },
      ],
      position: {
        x: 675,
        y: 1052,
      },
    },
    {
      id: 'dmz-sw',
      label: 'DMZ-SW',
      shape: 'rounded',
      parent: 'dmz',
      spec: {
        kind: 'hardware',
        type: 'l2-switch',
      },
      ports: [
        {
          id: 'eth1',
          label: 'eth1',
          source: 'custom',
        },
        {
          id: 'eth2',
          label: 'eth2',
          source: 'custom',
        },
        {
          id: 'uplink',
          label: 'uplink',
          source: 'custom',
        },
      ],
      position: {
        x: 215,
        y: 1708,
      },
    },
    {
      id: 'web-srv',
      label: 'Web Server',
      shape: 'rounded',
      parent: 'dmz',
      spec: {
        kind: 'hardware',
        type: 'server',
      },
      ports: [
        {
          id: 'eth0',
          label: 'eth0',
          source: 'custom',
        },
      ],
      position: {
        x: 110,
        y: 1888,
      },
    },
    {
      id: 'mail-srv',
      label: 'Mail Server',
      shape: 'rounded',
      parent: 'dmz',
      spec: {
        kind: 'hardware',
        type: 'server',
      },
      ports: [
        {
          id: 'eth0',
          label: 'eth0',
          source: 'custom',
        },
      ],
      position: {
        x: 320,
        y: 1888,
      },
    },
    {
      id: 'core-sw',
      label: 'Core-SW',
      shape: 'rounded',
      parent: 'campus/noc',
      spec: {
        kind: 'hardware',
        type: 'l3-switch',
        vendor: 'juniper',
        model: 'qfx5120-48t',
      },
      ports: [
        {
          id: 'ae0',
          label: 'ae0',
          source: 'custom',
        },
        {
          id: 'eth1',
          label: 'eth1',
          source: 'custom',
        },
        {
          id: 'eth2',
          label: 'eth2',
          source: 'custom',
        },
      ],
      position: {
        x: 925,
        y: 1408,
      },
    },
    {
      id: 'dist-sw',
      label: 'Distribution-SW',
      shape: 'rounded',
      parent: 'campus/noc',
      spec: {
        kind: 'hardware',
        type: 'l3-switch',
        vendor: 'juniper',
        model: 'ex4400-48t',
      },
      ports: [
        {
          id: 'ae0',
          label: 'ae0',
          source: 'custom',
        },
        {
          id: 'eth10',
          label: 'eth10',
          source: 'custom',
        },
        {
          id: 'eth20',
          label: 'eth20',
          source: 'custom',
        },
      ],
      position: {
        x: 925,
        y: 1608,
      },
    },
    {
      id: 'sw-a1',
      label: 'SW-A1 (Floor 1)',
      shape: 'rounded',
      parent: 'campus/building-a',
      spec: {
        kind: 'hardware',
        type: 'l3-switch',
        vendor: 'cisco',
        model: 'ws-c3560cx-8pc-s',
      },
      ports: [
        {
          id: 'uplink',
          label: 'uplink',
          source: 'custom',
        },
        {
          id: 'eth1',
          label: 'eth1',
          source: 'custom',
        },
        {
          id: 'eth2',
          label: 'eth2',
          source: 'custom',
        },
      ],
      position: {
        x: 695,
        y: 1956,
      },
    },
    {
      id: 'ap-a1',
      label: 'AP-A1',
      shape: 'rounded',
      parent: 'campus/building-a',
      spec: {
        kind: 'hardware',
        type: 'access-point',
        vendor: 'hpe',
        model: 'aruba-ap-505',
      },
      ports: [
        {
          id: 'eth0',
          label: 'eth0',
          source: 'custom',
        },
      ],
      position: {
        x: 590,
        y: 2136,
      },
    },
    {
      id: 'ap-a2',
      label: 'AP-A2',
      shape: 'rounded',
      parent: 'campus/building-a',
      spec: {
        kind: 'hardware',
        type: 'access-point',
        vendor: 'hpe',
        model: 'aruba-ap-505',
      },
      ports: [
        {
          id: 'eth0',
          label: 'eth0',
          source: 'custom',
        },
      ],
      position: {
        x: 800,
        y: 2136,
      },
    },
    {
      id: 'sw-b1',
      label: 'SW-B1',
      shape: 'rounded',
      parent: 'campus/building-b',
      spec: {
        kind: 'hardware',
        type: 'l2-switch',
        vendor: 'panasonic',
        model: 'switch-m8egpwr-plus',
      },
      ports: [
        {
          id: 'uplink',
          label: 'uplink',
          source: 'custom',
        },
        {
          id: 'eth1',
          label: 'eth1',
          source: 'custom',
        },
        {
          id: 'eth2',
          label: 'eth2',
          source: 'custom',
        },
      ],
      position: {
        x: 1155,
        y: 1876,
      },
    },
    {
      id: 'ap-b1',
      label: 'AP-B1',
      shape: 'rounded',
      parent: 'campus/building-b',
      spec: {
        kind: 'hardware',
        type: 'access-point',
        vendor: 'hpe',
        model: 'aruba-ap-505',
      },
      ports: [
        {
          id: 'eth0',
          label: 'eth0',
          source: 'custom',
        },
      ],
      position: {
        x: 1050,
        y: 2056,
      },
    },
    {
      id: 'ap-b2',
      label: 'AP-B2 (Desk)',
      shape: 'rounded',
      parent: 'campus/building-b',
      spec: {
        kind: 'hardware',
        type: 'access-point',
        vendor: 'hpe',
        model: 'aruba-instant-on-ap11d',
      },
      ports: [
        {
          id: 'e0',
          label: 'e0',
          source: 'custom',
        },
        {
          id: 'e3',
          label: 'e3',
          source: 'custom',
        },
      ],
      position: {
        x: 1260,
        y: 2056,
      },
    },
    {
      id: 'ip-phone',
      label: 'IP Phone',
      shape: 'rounded',
      parent: 'campus/building-b',
      spec: {
        kind: 'hardware',
        type: 'cpe',
        vendor: 'generic',
        model: 'ip-phone',
      },
      ports: [
        {
          id: 'eth0',
          label: 'eth0',
          source: 'custom',
        },
      ],
      position: {
        x: 1260,
        y: 2216,
      },
    },
  ],
  links: [
    {
      id: 'link-0',
      from: {
        node: 'vgw',
        port: 'tun0',
        ip: '169.254.100.1/30',
        module: { standard: '10GBASE-SR' },
      },

      to: {
        node: 'rt1',
        port: 'tun1',
        ip: '169.254.100.2/30',
        module: { standard: '10GBASE-SR' },
      },
      label: 'IPsec VPN',
      type: 'dashed',
    },
    {
      id: 'link-1',
      from: {
        node: 'vgw',
        port: 'tun1',
        ip: '169.254.101.1/30',
      },

      to: {
        node: 'rt2',
        port: 'tun1',
        ip: '169.254.101.2/30',
      },
      label: 'IPsec VPN',
      type: 'dashed',
    },
    {
      id: 'link-2',
      from: {
        node: 'fw1',
        port: 'dmz',
        ip: '10.100.0.2/24',
        module: { standard: '10GBASE-SR' },
      },

      to: {
        node: 'dmz-sw',
        port: 'uplink',
        ip: '10.100.0.1/24',
        module: { standard: '10GBASE-SR' },
      },
      label: 'DMZ',
      type: 'solid',
      vlan: [100],
    },
    {
      id: 'link-3',
      from: {
        node: 'fw1',
        port: 'inside',
        ip: '10.0.2.1/30',
        module: { standard: '10GBASE-SR' },
      },

      to: {
        node: 'core-sw',
        port: 'eth1',
        ip: '10.0.2.2/30',
        module: { standard: '10GBASE-SR' },
      },
      label: 'Active',
      type: 'solid',
    },
    {
      id: 'link-4',
      from: {
        node: 'fw2',
        port: 'inside',
        ip: '10.0.2.5/30',
        module: { standard: '10GBASE-SR' },
      },

      to: {
        node: 'core-sw',
        port: 'eth2',
        ip: '10.0.2.6/30',
        module: { standard: '10GBASE-SR' },
      },
      label: 'Standby',
      type: 'solid',
    },
    {
      id: 'cloud/link-0',
      from: {
        node: 'cloud-services',
        port: 'eth0',
      },
      to: {
        node: 'vgw',
        port: 'vpc',
      },
      label: 'Internal',
      type: 'solid',
    },
    {
      id: 'perimeter/link-0',
      from: {
        node: 'isp1',
        port: 'eth0',
        ip: '203.0.113.2/30',
      },
      to: {
        node: 'rt1',
        port: 'wan1',
        ip: '203.0.113.1/30',
      },
      type: 'solid',
    },
    {
      id: 'perimeter/link-1',
      from: {
        node: 'isp2',
        port: 'eth0',
        ip: '198.51.100.2/30',
        module: { standard: '10GBASE-SR' },
      },
      to: {
        node: 'rt2',
        port: 'wan1',
        ip: '198.51.100.1/30',
        module: { standard: '10GBASE-SR' },
      },
      type: 'solid',
    },
    {
      id: 'perimeter/link-2',
      from: {
        node: 'rt1',
        port: 'ha0',
        ip: '10.255.0.1/30',
      },
      to: {
        node: 'rt2',
        port: 'ha0',
        ip: '10.255.0.2/30',
      },
      label: 'Keepalive',
      type: 'solid',
      redundancy: 'ha',
      style: {
        minLength: 300,
      },
    },
    {
      id: 'perimeter/link-3',
      from: {
        node: 'rt1',
        port: 'lan1',
        ip: '10.0.1.1/30',
        module: { standard: '10GBASE-SR' },
      },
      to: {
        node: 'fw1',
        port: 'outside',
        ip: '10.0.1.2/30',
        module: { standard: '10GBASE-SR' },
      },
      type: 'solid',
    },
    {
      id: 'perimeter/link-4',
      from: {
        node: 'rt2',
        port: 'lan1',
        ip: '10.0.1.5/30',
        module: { standard: '10GBASE-SR' },
      },
      to: {
        node: 'fw2',
        port: 'outside',
        ip: '10.0.1.6/30',
        module: { standard: '10GBASE-SR' },
      },
      type: 'solid',
    },
    {
      id: 'perimeter/link-5',
      from: {
        node: 'fw1',
        port: 'ha',
      },
      to: {
        node: 'fw2',
        port: 'ha',
      },
      label: 'HA Sync',
      type: 'solid',
      redundancy: 'ha',
      style: {
        minLength: 300,
      },
    },
    {
      id: 'dmz/link-0',
      from: {
        node: 'dmz-sw',
        port: 'eth1',
        module: { standard: '1000BASE-T' },
      },
      to: {
        node: 'web-srv',
        port: 'eth0',
        module: { standard: '1000BASE-T' },
      },
      type: 'solid',
      vlan: [100],
    },
    {
      id: 'dmz/link-1',
      from: {
        node: 'dmz-sw',
        port: 'eth2',
        module: { standard: '1000BASE-T' },
      },
      to: {
        node: 'mail-srv',
        port: 'eth0',
        module: { standard: '1000BASE-T' },
      },
      type: 'solid',
      vlan: [100],
    },
    {
      id: 'campus/link-0',
      from: {
        node: 'core-sw',
        port: 'ae0',
        ip: '10.0.3.1/30',
        module: { standard: '40GBASE-SR4' },
      },
      to: {
        node: 'dist-sw',
        port: 'ae0',
        ip: '10.0.3.2/30',
        module: { standard: '40GBASE-SR4' },
      },
      label: '40G LACP',
      type: 'solid',
    },
    {
      id: 'campus/link-1',
      from: {
        node: 'dist-sw',
        port: 'eth10',
        ip: '10.10.0.254/24',
        module: { standard: '10GBASE-SR' },
      },
      to: {
        node: 'sw-a1',
        port: 'uplink',
        ip: '10.10.0.1/24',
        module: { standard: '10GBASE-SR' },
      },
      label: 'Trunk',
      type: 'solid',
      vlan: [10, 20],
    },
    {
      id: 'campus/link-2',
      from: {
        node: 'dist-sw',
        port: 'eth20',
        ip: '10.20.0.254/24',
        module: { standard: '10GBASE-SR' },
      },
      to: {
        node: 'sw-b1',
        port: 'uplink',
        ip: '10.20.0.1/24',
        module: { standard: '10GBASE-SR' },
      },
      label: 'Trunk',
      type: 'solid',
      vlan: [10, 30],
    },
    {
      id: 'campus/link-3',
      from: {
        node: 'sw-a1',
        port: 'eth1',
        module: { standard: '1000BASE-T' },
      },
      to: {
        node: 'ap-a1',
        port: 'eth0',
        module: { standard: '1000BASE-T' },
      },
      type: 'solid',
      vlan: [20],
    },
    {
      id: 'campus/link-4',
      from: {
        node: 'sw-a1',
        port: 'eth2',
        module: { standard: '1000BASE-T' },
      },
      to: {
        node: 'ap-a2',
        port: 'eth0',
        module: { standard: '1000BASE-T' },
      },
      type: 'solid',
      vlan: [20],
    },
    {
      id: 'campus/link-5',
      from: {
        node: 'sw-b1',
        port: 'eth1',
        module: { standard: '1000BASE-T' },
      },
      to: {
        node: 'ap-b1',
        port: 'eth0',
        module: { standard: '1000BASE-T' },
      },
      type: 'solid',
      vlan: [30],
    },
    {
      id: 'campus/link-6',
      from: {
        node: 'sw-b1',
        port: 'eth2',
        module: { standard: '1000BASE-T' },
      },
      to: {
        node: 'ap-b2',
        port: 'e0',
        module: { standard: '1000BASE-T' },
      },
      type: 'solid',
      vlan: [30],
    },
    {
      id: 'campus/link-7',
      from: {
        node: 'ap-b2',
        port: 'e3',
        module: { standard: '1000BASE-T' },
      },
      to: {
        node: 'ip-phone',
        port: 'eth0',
        module: { standard: '1000BASE-T' },
      },
      type: 'solid',
    },
  ],
  subgraphs: [
    {
      id: 'cloud',
      label: 'Cloud Services',
      children: [],
      style: {
        fill: 'accent-blue',
        strokeDasharray: '5 5',
      },
      spec: {
        kind: 'service',
        vendor: 'aws',
        service: 'vpc',
        resource: 'virtual-private-cloud-vpc',
      },
      file: './cloud.yaml',
      bounds: {
        x: 460,
        y: 0,
        width: 220,
        height: 328,
      },
    },
    {
      id: 'perimeter',
      label: 'Perimeter (Edge + Security)',
      children: [],
      style: {
        fill: 'accent-red',
      },
      file: './perimeter.yaml',
      bounds: {
        x: 328.5,
        y: 408,
        width: 483,
        height: 764,
      },
    },
    {
      id: 'dmz',
      label: 'DMZ',
      children: [],
      style: {
        fill: 'accent-amber',
      },
      file: './dmz.yaml',
      bounds: {
        x: 0,
        y: 1600,
        width: 430,
        height: 348,
      },
    },
    {
      id: 'campus',
      label: 'Campus',
      children: [],
      style: {
        fill: 'surface-2',
      },
      file: './campus.yaml',
      bounds: {
        x: 460,
        y: 1252,
        width: 930,
        height: 1044,
      },
    },
    {
      id: 'perimeter/edge',
      label: 'Edge (HA Routers)',
      children: [],
      parent: 'perimeter',
      style: {
        fill: 'surface-2',
      },
      bounds: {
        x: 348.5,
        y: 456,
        width: 443,
        height: 388,
      },
    },
    {
      id: 'perimeter/security',
      label: 'Security',
      children: [],
      parent: 'perimeter',
      style: {
        fill: 'accent-red',
      },
      bounds: {
        x: 355,
        y: 924,
        width: 430,
        height: 228,
      },
    },
    {
      id: 'campus/noc',
      label: 'NOC',
      children: [],
      parent: 'campus',
      style: {
        fill: 'accent-blue',
      },
      bounds: {
        x: 815,
        y: 1300,
        width: 220,
        height: 388,
      },
    },
    {
      id: 'campus/building-a',
      label: 'Building A',
      children: [],
      parent: 'campus',
      direction: 'TB',
      style: {
        fill: 'accent-green',
      },
      bounds: {
        x: 480,
        y: 1848,
        width: 430,
        height: 348,
      },
    },
    {
      id: 'campus/building-b',
      label: 'Building B',
      children: [],
      parent: 'campus',
      direction: 'TB',
      style: {
        fill: 'accent-amber',
      },
      bounds: {
        x: 940,
        y: 1768,
        width: 430,
        height: 508,
      },
    },
  ],
} as unknown as NetworkGraph

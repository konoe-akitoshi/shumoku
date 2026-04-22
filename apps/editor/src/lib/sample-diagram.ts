// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Positioned NetworkGraph for the sample project.
 * Generated from sampleNetwork YAML by scripts/generate-sample-diagram.ts —
 * run that script to regenerate after editing the YAML fixtures.
 *
 * Cast via `as unknown as NetworkGraph`: DeviceType is a string enum and
 * the serialized JSON has raw string literals where the type wants enum
 * references. The runtime values match — the cast only papers over the
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
      position: {
        x: 695,
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
      position: {
        x: 695,
        y: 278,
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
      position: {
        x: 575,
        y: 574,
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
      position: {
        x: 575,
        y: 794,
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
      position: {
        x: 815,
        y: 574,
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
      position: {
        x: 815,
        y: 794,
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
      position: {
        x: 566.75,
        y: 1098.5,
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
      position: {
        x: 823.25,
        y: 1098.5,
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
      position: {
        x: 215,
        y: 1434,
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
      position: {
        x: 110,
        y: 1665,
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
      position: {
        x: 320,
        y: 1665,
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
      position: {
        x: 925,
        y: 1471,
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
      position: {
        x: 925,
        y: 1696.5,
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
      position: {
        x: 695,
        y: 2001,
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
      position: {
        x: 590,
        y: 2232,
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
      position: {
        x: 800,
        y: 2232,
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
      position: {
        x: 1155,
        y: 2001,
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
      position: {
        x: 1050,
        y: 2232,
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
      position: {
        x: 1260,
        y: 2221,
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
      position: {
        x: 1260,
        y: 2430,
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
      },
      to: {
        node: 'rt1',
        port: 'tun1',
        ip: '169.254.100.2/30',
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
      },
      to: {
        node: 'dmz-sw',
        port: 'uplink',
        ip: '10.100.0.1/24',
      },
      label: 'DMZ',
      type: 'solid',
      bandwidth: '10G',
      vlan: [100],
    },
    {
      id: 'link-3',
      from: {
        node: 'fw1',
        port: 'inside',
        ip: '10.0.2.1/30',
      },
      to: {
        node: 'core-sw',
        port: 'eth1',
        ip: '10.0.2.2/30',
      },
      label: 'Active',
      type: 'solid',
      bandwidth: '10G',
    },
    {
      id: 'link-4',
      from: {
        node: 'fw2',
        port: 'inside',
        ip: '10.0.2.5/30',
      },
      to: {
        node: 'core-sw',
        port: 'eth2',
        ip: '10.0.2.6/30',
      },
      label: 'Standby',
      type: 'solid',
      bandwidth: '10G',
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
      bandwidth: '10G',
    },
    {
      id: 'perimeter/link-1',
      from: {
        node: 'isp2',
        port: 'eth0',
        ip: '198.51.100.2/30',
      },
      to: {
        node: 'rt2',
        port: 'wan1',
        ip: '198.51.100.1/30',
      },
      type: 'solid',
      bandwidth: '10G',
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
      },
      to: {
        node: 'fw1',
        port: 'outside',
        ip: '10.0.1.2/30',
      },
      type: 'solid',
      bandwidth: '10G',
    },
    {
      id: 'perimeter/link-4',
      from: {
        node: 'rt2',
        port: 'lan1',
        ip: '10.0.1.5/30',
      },
      to: {
        node: 'fw2',
        port: 'outside',
        ip: '10.0.1.6/30',
      },
      type: 'solid',
      bandwidth: '10G',
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
      },
      to: {
        node: 'web-srv',
        port: 'eth0',
      },
      type: 'solid',
      bandwidth: '1G',
      vlan: [100],
    },
    {
      id: 'dmz/link-1',
      from: {
        node: 'dmz-sw',
        port: 'eth2',
      },
      to: {
        node: 'mail-srv',
        port: 'eth0',
      },
      type: 'solid',
      bandwidth: '1G',
      vlan: [100],
    },
    {
      id: 'campus/link-0',
      from: {
        node: 'core-sw',
        port: 'ae0',
        ip: '10.0.3.1/30',
      },
      to: {
        node: 'dist-sw',
        port: 'ae0',
        ip: '10.0.3.2/30',
      },
      label: '40G LACP',
      type: 'solid',
      bandwidth: '40G',
    },
    {
      id: 'campus/link-1',
      from: {
        node: 'dist-sw',
        port: 'eth10',
        ip: '10.10.0.254/24',
      },
      to: {
        node: 'sw-a1',
        port: 'uplink',
        ip: '10.10.0.1/24',
      },
      label: 'Trunk',
      type: 'solid',
      bandwidth: '10G',
      vlan: [10, 20],
    },
    {
      id: 'campus/link-2',
      from: {
        node: 'dist-sw',
        port: 'eth20',
        ip: '10.20.0.254/24',
      },
      to: {
        node: 'sw-b1',
        port: 'uplink',
        ip: '10.20.0.1/24',
      },
      label: 'Trunk',
      type: 'solid',
      bandwidth: '10G',
      vlan: [10, 30],
    },
    {
      id: 'campus/link-3',
      from: {
        node: 'sw-a1',
        port: 'eth1',
      },
      to: {
        node: 'ap-a1',
        port: 'eth0',
      },
      type: 'solid',
      bandwidth: '1G',
      vlan: [20],
    },
    {
      id: 'campus/link-4',
      from: {
        node: 'sw-a1',
        port: 'eth2',
      },
      to: {
        node: 'ap-a2',
        port: 'eth0',
      },
      type: 'solid',
      bandwidth: '1G',
      vlan: [20],
    },
    {
      id: 'campus/link-5',
      from: {
        node: 'sw-b1',
        port: 'eth1',
      },
      to: {
        node: 'ap-b1',
        port: 'eth0',
      },
      type: 'solid',
      bandwidth: '1G',
      vlan: [30],
    },
    {
      id: 'campus/link-6',
      from: {
        node: 'sw-b1',
        port: 'eth2',
      },
      to: {
        node: 'ap-b2',
        port: 'e0',
      },
      type: 'solid',
      bandwidth: '1G',
      vlan: [30],
    },
    {
      id: 'campus/link-7',
      from: {
        node: 'ap-b2',
        port: 'e3',
      },
      to: {
        node: 'ip-phone',
        port: 'eth0',
      },
      type: 'solid',
      bandwidth: '1G',
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
        x: 585,
        y: 0,
        width: 220,
        height: 358,
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
        x: 413.5,
        y: 438,
        width: 563,
        height: 787,
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
        x: 450,
        y: 486,
        width: 490,
        height: 398,
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
        x: 433.5,
        y: 964,
        width: 523,
        height: 241,
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
        y: 1305,
        width: 430,
        height: 420,
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
        y: 1305,
        width: 930,
        height: 1205,
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
        y: 1353,
        width: 220,
        height: 439,
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
        y: 1872,
        width: 430,
        height: 420,
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
        y: 1872,
        width: 430,
        height: 618,
      },
    },
  ],
} as unknown as NetworkGraph

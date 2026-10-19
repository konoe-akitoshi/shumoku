// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * Sample network fixtures for testing and playground
 */

import type { DrawingLayer, NetworkModel } from '../models/network-model.js'
import { readNetworkModel } from '../models/network-model-graph.js'

/**
 * Sample network as people write it: HA routers, firewalls, a VPN to the cloud, a DMZ and a
 * campus with two buildings.
 */
export const sampleNetworkYaml = `name: Sample Network
description: Sample network with HA routers, firewall, DMZ and campus
groups:
  - id: cloud
    label: Cloud Services
  - id: perimeter
    label: Perimeter (Edge + Security)
    groups:
      - id: edge
        label: Edge (HA Routers)
      - id: security
        label: Security
  - id: dmz
    label: DMZ
  - id: campus
    label: Campus
    groups:
      - id: noc
        label: NOC
      - id: building-a
        label: Building A
      - id: building-b
        label: Building B
segments:
  - id: dmz
    vlan: 100
  - id: mgmt
    vlan: 10
  - id: users-a
    vlan: 20
  - id: users-b
    vlan: 30
redundancy:
  - id: rt1-rt2
    nodes:
      - rt1
      - rt2
  - id: fw1-fw2
    nodes:
      - fw1
      - fw2
nodes:
  - id: cloud-services
    label: Services VPC
    product: aws
    group: cloud
  - id: vgw
    label: VPN Gateway
    product: aws
    group: cloud
  - id: isp1
    label: 'ISP Line #1 (Primary)'
    type: internet
    group: edge
  - id: isp2
    label: 'ISP Line #2 (Secondary)'
    type: internet
    group: edge
  - id: rt1
    label: Edge-RT-1 (Master)
    type: router
    product: yamaha/rtx3510
    group: edge
  - id: rt2
    label: Edge-RT-2 (Backup)
    type: router
    product: yamaha/rtx3510
    group: edge
  - id: fw1
    label: FW-1 (Active)
    type: firewall
    product: juniper/srx4100
    group: security
  - id: fw2
    label: FW-2 (Standby)
    type: firewall
    product: juniper/srx4100
    group: security
  - id: dmz-sw
    label: DMZ-SW
    type: l2-switch
    group: dmz
  - id: web-srv
    label: Web Server
    type: server
    group: dmz
  - id: mail-srv
    label: Mail Server
    type: server
    group: dmz
  - id: core-sw
    label: Core-SW
    type: l3-switch
    product: juniper/qfx5120-48t
    group: noc
  - id: dist-sw
    label: Distribution-SW
    type: l3-switch
    product: juniper/ex4400-48t
    group: noc
  - id: sw-a1
    label: SW-A1 (Floor 1)
    type: l3-switch
    product: cisco/ws-c3560cx-8pc-s
    group: building-a
  - id: ap-a1
    label: AP-A1
    type: access-point
    product: hpe/aruba-ap-505
    group: building-a
  - id: ap-a2
    label: AP-A2
    type: access-point
    product: hpe/aruba-ap-505
    group: building-a
  - id: sw-b1
    label: SW-B1
    type: l2-switch
    product: panasonic/switch-m8egpwr-plus
    group: building-b
  - id: ap-b1
    label: AP-B1
    type: access-point
    product: hpe/aruba-ap-505
    group: building-b
  - id: ap-b2
    label: AP-B2 (Desk)
    type: access-point
    product: hpe/aruba-instant-on-ap11d
    group: building-b
  - id: ip-phone
    label: IP Phone
    type: cpe
    product: generic/ip-phone
    group: building-b
links:
  - id: vpn-1
    endpoints:
      - node: vgw
        port: tun0
      - node: rt1
        port: tun1
    virtual: true
  - id: vpn-2
    endpoints:
      - node: vgw
        port: tun1
      - node: rt2
        port: tun1
    virtual: true
  - id: dmz-uplink
    endpoints:
      - node: fw1
        port: dmz
      - node: dmz-sw
        port: uplink
    segments:
      - dmz
    speed: 10G
  - id: fw1-core
    endpoints:
      - node: fw1
        port: inside
      - node: core-sw
        port: eth1
    speed: 10G
  - id: fw2-core
    endpoints:
      - node: fw2
        port: inside
      - node: core-sw
        port: eth2
    speed: 10G
  - id: vpc-attach
    endpoints:
      - node: cloud-services
        port: eth0
      - node: vgw
        port: vpc
  - endpoints:
      - node: isp1
        port: eth0
      - node: rt1
        port: wan1
    speed: 10G
  - endpoints:
      - node: isp2
        port: eth0
      - node: rt2
        port: wan1
    speed: 10G
  - id: rt-ha
    endpoints:
      - node: rt1
        port: ha0
      - node: rt2
        port: ha0
  - endpoints:
      - node: rt1
        port: lan1
      - node: fw1
        port: outside
    speed: 10G
  - endpoints:
      - node: rt2
        port: lan1
      - node: fw2
        port: outside
    speed: 10G
  - id: fw-ha
    endpoints:
      - node: fw1
        port: ha
      - node: fw2
        port: ha
  - endpoints:
      - node: dmz-sw
        port: eth1
      - node: web-srv
        port: eth0
    segments:
      - dmz
    speed: 1G
  - endpoints:
      - node: dmz-sw
        port: eth2
      - node: mail-srv
        port: eth0
    segments:
      - dmz
    speed: 1G
  - id: core-dist
    endpoints:
      - node: core-sw
        port: ae0
      - node: dist-sw
        port: ae0
    speed: 40G
  - id: dist-a
    endpoints:
      - node: dist-sw
        port: eth10
      - node: sw-a1
        port: uplink
    segments:
      - mgmt
      - users-a
    speed: 10G
  - id: dist-b
    endpoints:
      - node: dist-sw
        port: eth20
      - node: sw-b1
        port: uplink
    segments:
      - mgmt
      - users-b
    speed: 10G
  - endpoints:
      - node: sw-a1
        port: eth1
      - node: ap-a1
        port: eth0
    segments:
      - users-a
    speed: 1G
  - endpoints:
      - node: sw-a1
        port: eth2
      - node: ap-a2
        port: eth0
    segments:
      - users-a
    speed: 1G
  - endpoints:
      - node: sw-b1
        port: eth1
      - node: ap-b1
        port: eth0
    segments:
      - users-b
    speed: 1G
  - endpoints:
      - node: sw-b1
        port: eth2
      - node: ap-b2
        port: e0
    segments:
      - users-b
    speed: 1G
  - endpoints:
      - node: ap-b2
        port: e3
      - node: ip-phone
        port: eth0
    speed: 1G
`

/** How the sample is drawn: group colours, link labels and the cloud group's icon. */
export const sampleNetworkDrawing: DrawingLayer = {
  links: {
    'vpn-1': {
      label: 'IPsec VPN',
    },
    'vpn-2': {
      label: 'IPsec VPN',
    },
    'dmz-uplink': {
      label: 'DMZ',
    },
    'fw1-core': {
      label: 'Active',
    },
    'fw2-core': {
      label: 'Standby',
    },
    'vpc-attach': {
      label: 'Internal',
    },
    'rt-ha': {
      label: 'Keepalive',
      style: {
        minLength: 300,
      },
    },
    'fw-ha': {
      label: 'HA Sync',
      style: {
        minLength: 300,
      },
    },
    'core-dist': {
      label: '40G LACP',
    },
    'dist-a': {
      label: 'Trunk',
    },
    'dist-b': {
      label: 'Trunk',
    },
  },
  groups: {
    cloud: {
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
    },
    perimeter: {
      style: {
        fill: 'accent-red',
      },
    },
    dmz: {
      style: {
        fill: 'accent-amber',
      },
    },
    campus: {
      style: {
        fill: 'surface-2',
      },
    },
    edge: {
      style: {
        fill: 'surface-2',
      },
    },
    security: {
      style: {
        fill: 'accent-red',
      },
    },
    noc: {
      style: {
        fill: 'accent-blue',
      },
    },
    'building-a': {
      direction: 'TB',
      style: {
        fill: 'accent-green',
      },
    },
    'building-b': {
      direction: 'TB',
      style: {
        fill: 'accent-amber',
      },
    },
  },
  settings: {
    theme: 'light',
  },
}

/** The sample with its drawing layer. */
export function sampleNetworkModel(): NetworkModel {
  return { ...readNetworkModel(sampleNetworkYaml), drawing: sampleNetworkDrawing }
}

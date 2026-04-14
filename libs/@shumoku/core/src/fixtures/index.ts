// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * Sample network fixtures for testing and playground
 */

export interface SampleFile {
  name: string
  content: string
}

/**
 * Sample Network - Multi-file hierarchical structure
 * Comprehensive example covering: HA routers, firewalls, VPN, DMZ, campus with multiple buildings
 */
export const sampleNetwork: SampleFile[] = [
  {
    name: 'main.yaml',
    content: `name: "Sample Network"
description: "Sample network with HA routers, firewall, DMZ and campus"

settings:
  theme: light

subgraphs:
  - id: cloud
    label: "Cloud Services"
    file: "./cloud.yaml"
    vendor: aws
    service: vpc
    resource: virtual-private-cloud-vpc
    style:
      fill: "accent-blue"
      strokeDasharray: "5 5"

  - id: perimeter
    label: "Perimeter (Edge + Security)"
    file: "./perimeter.yaml"
    style:
      fill: "accent-red"

  - id: dmz
    label: "DMZ"
    file: "./dmz.yaml"
    style:
      fill: "accent-amber"

  - id: campus
    label: "Campus"
    file: "./campus.yaml"
    style:
      fill: "surface-2"

links:
  # Cloud to Perimeter (VPN)
  - from:
      node: vgw
      port: tun0
      ip: 169.254.100.1/30
    to:
      node: rt1
      port: tun1
      ip: 169.254.100.2/30
    label: "IPsec VPN"
    type: dashed

  - from:
      node: vgw
      port: tun1
      ip: 169.254.101.1/30
    to:
      node: rt2
      port: tun1
      ip: 169.254.101.2/30
    label: "IPsec VPN"
    type: dashed

  # Perimeter to DMZ
  - from:
      node: fw1
      port: dmz
      ip: 10.100.0.2/24
    to:
      node: dmz-sw
      port: uplink
      ip: 10.100.0.1/24
    label: "DMZ"
    vlan: 100
    bandwidth: 10G

  # Perimeter to Campus
  - from:
      node: fw1
      port: inside
      ip: 10.0.2.1/30
    to:
      node: core-sw
      port: eth1
      ip: 10.0.2.2/30
    label: "Active"
    bandwidth: 10G

  - from:
      node: fw2
      port: inside
      ip: 10.0.2.5/30
    to:
      node: core-sw
      port: eth2
      ip: 10.0.2.6/30
    label: "Standby"
    bandwidth: 10G
`,
  },
  {
    name: 'cloud.yaml',
    content: `name: "Cloud Services"

nodes:
  - id: cloud-services
    label: "Services VPC"
    type: server
    vendor: aws
    service: ec2
    resource: instances

  - id: vgw
    label: "VPN Gateway"
    type: vpn
    vendor: aws
    service: vpc
    resource: vpn-gateway

links:
  - from:
      node: cloud-services
      port: eth0
    to:
      node: vgw
      port: vpc
    label: "Internal"
`,
  },
  {
    name: 'perimeter.yaml',
    content: `name: "Perimeter Network"
description: "Edge routers and firewalls"

subgraphs:
  - id: edge
    label: "Edge (HA Routers)"
    style:
      fill: "surface-2"

  - id: security
    label: "Security"
    style:
      fill: "accent-red"

nodes:
  # ========== Edge Layer ==========
  - id: isp1
    label: "ISP Line #1 (Primary)"
    type: internet
    parent: edge

  - id: isp2
    label: "ISP Line #2 (Secondary)"
    type: internet
    parent: edge

  - id: rt1
    label: "Edge-RT-1 (Master)"
    type: router
    vendor: yamaha
    model: rtx3510
    parent: edge

  - id: rt2
    label: "Edge-RT-2 (Backup)"
    type: router
    vendor: yamaha
    model: rtx3510
    parent: edge

  # ========== Security Layer ==========
  - id: fw1
    label: "FW-1 (Active)"
    type: firewall
    vendor: juniper
    model: SRX4100
    parent: security

  - id: fw2
    label: "FW-2 (Standby)"
    type: firewall
    vendor: juniper
    model: SRX4100
    parent: security

links:
  # ISP to Routers
  - from:
      node: isp1
      port: eth0
      ip: 203.0.113.2/30
    to:
      node: rt1
      port: wan1
      ip: 203.0.113.1/30
    bandwidth: 10G

  - from:
      node: isp2
      port: eth0
      ip: 198.51.100.2/30
    to:
      node: rt2
      port: wan1
      ip: 198.51.100.1/30
    bandwidth: 10G

  # Router HA Keepalive
  - from:
      node: rt1
      port: ha0
      ip: 10.255.0.1/30
    to:
      node: rt2
      port: ha0
      ip: 10.255.0.2/30
    label: "Keepalive"
    redundancy: ha
    style:
      minLength: 300

  # Router to Firewall
  - from:
      node: rt1
      port: lan1
      ip: 10.0.1.1/30
    to:
      node: fw1
      port: outside
      ip: 10.0.1.2/30
    bandwidth: 10G

  - from:
      node: rt2
      port: lan1
      ip: 10.0.1.5/30
    to:
      node: fw2
      port: outside
      ip: 10.0.1.6/30
    bandwidth: 10G

  # Firewall HA
  - from:
      node: fw1
      port: ha
    to:
      node: fw2
      port: ha
    label: "HA Sync"
    redundancy: ha
    style:
      minLength: 300
`,
  },
  {
    name: 'dmz.yaml',
    content: `name: "DMZ"
description: "Demilitarized zone with public-facing servers"

nodes:
  - id: dmz-sw
    label: "DMZ-SW"
    type: l2-switch

  - id: web-srv
    label: "Web Server"
    type: server

  - id: mail-srv
    label: "Mail Server"
    type: server

links:
  - from:
      node: dmz-sw
      port: eth1
    to:
      node: web-srv
      port: eth0
    vlan: 100
    bandwidth: 1G

  - from:
      node: dmz-sw
      port: eth2
    to:
      node: mail-srv
      port: eth0
    vlan: 100
    bandwidth: 1G
`,
  },
  {
    name: 'campus.yaml',
    content: `name: "Campus Network"
description: "Internal campus network with NOC and buildings"

subgraphs:
  - id: noc
    label: "NOC"
    style:
      fill: "accent-blue"

  - id: building-a
    label: "Building A"
    direction: TB
    style:
      fill: "accent-green"

  - id: building-b
    label: "Building B"
    direction: TB
    style:
      fill: "accent-amber"

nodes:
  # ========== NOC ==========
  - id: core-sw
    label: "Core-SW"
    type: l3-switch
    vendor: juniper
    model: QFX5120-48T
    parent: noc

  - id: dist-sw
    label: "Distribution-SW"
    type: l3-switch
    vendor: juniper
    model: EX4400-48T
    parent: noc

  # ========== Building A (Cisco PoE switch + Aruba APs) ==========
  - id: sw-a1
    label: "SW-A1 (Floor 1)"
    type: l3-switch
    vendor: cisco
    model: ws-c3560cx-8pc-s
    parent: building-a

  - id: ap-a1
    label: "AP-A1"
    type: access-point
    vendor: hpe
    model: aruba-ap-505
    parent: building-a

  - id: ap-a2
    label: "AP-A2"
    type: access-point
    vendor: hpe
    model: aruba-ap-505
    parent: building-a

  # ========== Building B (Panasonic PoE switch + AP11D passthrough) ==========
  - id: sw-b1
    label: "SW-B1"
    type: l2-switch
    vendor: panasonic
    model: switch-m8egpwr-plus
    parent: building-b

  - id: ap-b1
    label: "AP-B1"
    type: access-point
    vendor: hpe
    model: aruba-ap-505
    parent: building-b

  - id: ap-b2
    label: "AP-B2 (Desk)"
    type: access-point
    vendor: hpe
    model: aruba-instant-on-ap11d
    parent: building-b

  - id: ip-phone
    label: "IP Phone"
    type: cpe
    parent: building-b

links:
  # Core to Distribution
  - from:
      node: core-sw
      port: ae0
      ip: 10.0.3.1/30
    to:
      node: dist-sw
      port: ae0
      ip: 10.0.3.2/30
    label: "40G LACP"
    bandwidth: 40G

  # Distribution to Buildings
  - from:
      node: dist-sw
      port: eth10
      ip: 10.10.0.254/24
    to:
      node: sw-a1
      port: uplink
      ip: 10.10.0.1/24
    label: "Trunk"
    vlan: [10, 20]
    bandwidth: 10G

  - from:
      node: dist-sw
      port: eth20
      ip: 10.20.0.254/24
    to:
      node: sw-b1
      port: uplink
      ip: 10.20.0.1/24
    label: "Trunk"
    vlan: [10, 30]
    bandwidth: 10G

  # Building A: PoE switch → APs
  - from:
      node: sw-a1
      port: eth1
    to:
      node: ap-a1
      port: eth0
    vlan: 20
    bandwidth: 1G

  - from:
      node: sw-a1
      port: eth2
    to:
      node: ap-a2
      port: eth0
    vlan: 20
    bandwidth: 1G

  # Building B: PoE switch → AP + AP11D passthrough → IP Phone
  - from:
      node: sw-b1
      port: eth1
    to:
      node: ap-b1
      port: eth0
    vlan: 30
    bandwidth: 1G

  - from:
      node: sw-b1
      port: eth2
    to:
      node: ap-b2
      port: e0
    vlan: 30
    bandwidth: 1G

  - from:
      node: ap-b2
      port: e3
    to:
      node: ip-phone
      port: eth0
    bandwidth: 1G
`,
  },
]

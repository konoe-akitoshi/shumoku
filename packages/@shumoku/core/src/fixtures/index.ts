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
      fill: "#f0f8ff"
      stroke: "#0072bc"
      strokeDasharray: "5 5"

  - id: perimeter
    label: "Perimeter (Edge + Security)"
    file: "./perimeter.yaml"
    style:
      fill: "#fff5f5"
      stroke: "#d4a017"
      strokeWidth: 2

  - id: dmz
    label: "DMZ"
    file: "./dmz.yaml"
    style:
      fill: "#fefce8"
      stroke: "#ca8a04"

  - id: campus
    label: "Campus"
    file: "./campus.yaml"
    style:
      fill: "#fffbf0"
      stroke: "#d4a017"

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
    label:
      - "<b>Services VPC</b>"
      - "CIDR: 172.16.0.0/16"
      - "---"
      - "DNS / DHCP / Monitoring"
    type: server
    vendor: aws
    service: ec2
    resource: instances

  - id: vgw
    label:
      - "<b>VPN Gateway</b>"
      - "Peer: 169.254.x.x"
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
      fill: "#fff5f5"
      stroke: "#d4a017"
      strokeWidth: 2

  - id: security
    label: "Security"
    style:
      fill: "#fef2f2"
      stroke: "#dc2626"
      strokeWidth: 2

nodes:
  # ========== Edge Layer ==========
  - id: isp1
    label:
      - "<b>ISP Line #1</b>"
      - "(Primary)"
    type: internet
    parent: edge

  - id: isp2
    label:
      - "<b>ISP Line #2</b>"
      - "(Secondary)"
    type: internet
    parent: edge

  - id: rt1
    label:
      - "<b>Edge-RT-1 (Master)</b>"
      - "Mgmt: 10.0.0.1"
      - "VRRP VIP: 10.0.0.254"
    type: router
    vendor: yamaha
    model: rtx3510
    parent: edge

  - id: rt2
    label:
      - "<b>Edge-RT-2 (Backup)</b>"
      - "Mgmt: 10.0.0.2"
      - "VRRP VIP: 10.0.0.254"
    type: router
    vendor: yamaha
    model: rtx3510
    parent: edge

  # ========== Security Layer ==========
  - id: fw1
    label:
      - "<b>FW-1 (Active)</b>"
      - "Mgmt: 10.0.100.1"
    type: firewall
    vendor: juniper
    model: SRX4100
    parent: security

  - id: fw2
    label:
      - "<b>FW-2 (Standby)</b>"
      - "Mgmt: 10.0.100.2"
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
    label:
      - "<b>DMZ-SW</b>"
      - "Mgmt: 10.100.0.1"
    type: l2-switch

  - id: web-srv
    label:
      - "<b>Web Server</b>"
      - "10.100.10.10"
    type: server

  - id: mail-srv
    label:
      - "<b>Mail Server</b>"
      - "10.100.10.20"
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
      fill: "#e6f7ff"
      stroke: "#0055a6"
      strokeWidth: 2

  - id: building-a
    label: "Building A"
    direction: TB
    style:
      fill: "#f0fdf4"
      stroke: "#22c55e"

  - id: building-b
    label: "Building B"
    direction: TB
    style:
      fill: "#fef3c7"
      stroke: "#f59e0b"

nodes:
  # ========== NOC ==========
  - id: core-sw
    label:
      - "<b>Core-SW</b>"
      - "Mgmt: 10.1.0.1"
      - "Inter-VLAN Routing"
    type: l3-switch
    vendor: juniper
    model: QFX5120-48T
    parent: noc

  - id: dist-sw
    label:
      - "<b>Distribution-SW</b>"
      - "Mgmt: 10.1.0.2"
      - "Uplink: 40G"
    type: l3-switch
    vendor: juniper
    model: EX4400-48T
    parent: noc

  # ========== Building A ==========
  - id: sw-a1
    label:
      - "<b>SW-A1 (Floor 1)</b>"
      - "Mgmt: 10.10.0.1"
    type: l2-switch
    vendor: juniper
    model: EX2300-24P
    parent: building-a

  - id: sw-a2
    label:
      - "<b>SW-A2 (Floor 2)</b>"
      - "Mgmt: 10.10.0.2"
    type: l2-switch
    vendor: juniper
    model: EX2300-24P
    parent: building-a

  - id: ap-a1
    label: "AP-A1"
    type: access-point
    vendor: aruba
    model: ap500-series
    parent: building-a

  - id: ap-a2
    label: "AP-A2"
    type: access-point
    vendor: aruba
    model: ap500-series
    parent: building-a

  # ========== Building B ==========
  - id: sw-b1
    label:
      - "<b>SW-B1 (Floor 1)</b>"
      - "Mgmt: 10.20.0.1"
    type: l2-switch
    vendor: yamaha
    model: swx2310_28gt
    parent: building-b

  - id: sw-b2
    label:
      - "<b>SW-B2 (Floor 2)</b>"
      - "Mgmt: 10.20.0.2"
    type: l2-switch
    vendor: yamaha
    model: swx2310_28gt
    parent: building-b

  - id: ap-b1
    label: "AP-B1"
    type: access-point
    vendor: aruba
    model: ap500-series
    parent: building-b

  - id: ap-b2
    label: "AP-B2"
    type: access-point
    vendor: aruba
    model: ap500-series
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

  # Building A cascade
  - from:
      node: sw-a1
      port: eth24
      ip: 10.10.1.1/30
    to:
      node: sw-a2
      port: uplink
      ip: 10.10.1.2/30
    label: "Cascade"
    vlan: [10, 20]
    bandwidth: 10G

  - from:
      node: sw-a1
      port: eth1
    to:
      node: ap-a1
      port: eth0
    vlan: 20
    bandwidth: 1G

  - from:
      node: sw-a2
      port: eth1
    to:
      node: ap-a2
      port: eth0
    vlan: 20
    bandwidth: 1G

  # Building B cascade
  - from:
      node: sw-b1
      port: eth24
      ip: 10.20.1.1/30
    to:
      node: sw-b2
      port: uplink
      ip: 10.20.1.2/30
    label: "Cascade"
    vlan: [10, 30]
    bandwidth: 10G

  - from:
      node: sw-b1
      port: eth1
    to:
      node: ap-b1
      port: eth0
    vlan: 30
    bandwidth: 1G

  - from:
      node: sw-b2
      port: eth1
    to:
      node: ap-b2
      port: eth0
    vlan: 30
    bandwidth: 1G
`,
  },
]

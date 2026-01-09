/**
 * Sample network definitions
 */

export const enterpriseNetwork = `
name: "Enterprise Network"
version: "2.0.0"
description: "Enterprise network with HA edge routers and campus access"

settings:
  theme: modern

subgraphs:
  # Cloud Layer
  - id: cloud
    label: "Cloud Services"
    vendor: aws
    service: vpc
    resource: virtual-private-cloud-vpc
    style:
      fill: "#f0f8ff"
      stroke: "#0072bc"
      strokeDasharray: "5 5"

  # Edge Layer
  - id: edge
    label: "Edge (HA Routers)"
    style:
      fill: "#fff5f5"
      stroke: "#d4a017"
      strokeWidth: 2

  # Campus Layer
  - id: campus
    label: "Campus"
    style:
      fill: "#fffbf0"
      stroke: "#d4a017"

  # NOC (nested in campus)
  - id: noc
    label: "NOC"
    parent: campus
    style:
      fill: "#e6f7ff"
      stroke: "#0055a6"
      strokeWidth: 2

  # Building A (nested in campus)
  - id: building-a
    label: "Building A"
    parent: campus
    direction: TB
    style:
      fill: "#f0fdf4"
      stroke: "#22c55e"

  # Building B (nested in campus)
  - id: building-b
    label: "Building B"
    parent: campus
    direction: TB
    style:
      fill: "#fef3c7"
      stroke: "#f59e0b"

nodes:
  # ========== Cloud Layer ==========
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
    parent: cloud

  - id: vgw
    label:
      - "<b>VPN Gateway</b>"
      - "Peer: 169.254.x.x"
    type: vpn
    vendor: aws
    service: vpc
    resource: vpn-gateway
    parent: cloud

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
    parent: edge

  - id: rt2
    label:
      - "<b>Edge-RT-2 (Backup)</b>"
      - "Mgmt: 10.0.0.2"
      - "VRRP VIP: 10.0.0.254"
    type: router
    parent: edge

  # ========== NOC ==========
  - id: core-sw
    label:
      - "<b>Core-SW</b>"
      - "Mgmt: 10.1.0.1"
      - "Inter-VLAN Routing"
    type: l3-switch
    parent: noc

  - id: dist-sw
    label:
      - "<b>Distribution-SW</b>"
      - "Mgmt: 10.1.0.2"
      - "Uplink: 40G"
    type: l3-switch
    parent: noc

  # ========== Building A ==========
  - id: sw-a1
    label:
      - "<b>SW-A1 (Floor 1)</b>"
      - "Mgmt: 10.10.0.1"
    type: l2-switch
    parent: building-a

  - id: sw-a2
    label:
      - "<b>SW-A2 (Floor 2)</b>"
      - "Mgmt: 10.10.0.2"
    type: l2-switch
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
    parent: building-b

  - id: sw-b2
    label:
      - "<b>SW-B2 (Floor 2)</b>"
      - "Mgmt: 10.20.0.2"
    type: l2-switch
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

  # VPN Tunnels
  - from:
      node: vgw
      port: tun0
      ip: 169.254.100.1/30
    to:
      node: rt1
      port: tun1
      ip: 169.254.100.2/30
    label: "IPsec VPN"

  - from:
      node: vgw
      port: tun1
      ip: 169.254.101.1/30
    to:
      node: rt2
      port: tun1
      ip: 169.254.101.2/30
    label: "IPsec VPN"

  # HA Keepalive
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

  # Router to Core
  - from:
      node: rt1
      port: lan1
      ip: 10.0.1.1/24
    to:
      node: core-sw
      port: eth1
      ip: 10.0.1.10/24
    label: "Active"
    bandwidth: 10G

  - from:
      node: rt2
      port: lan1
      ip: 10.0.1.2/24
    to:
      node: core-sw
      port: eth2
      ip: 10.0.1.11/24
    label: "Standby"
    bandwidth: 10G

  # Core to Distribution
  - from:
      node: core-sw
      port: ae0
      ip: 10.0.2.1/30
    to:
      node: dist-sw
      port: ae0
      ip: 10.0.2.2/30
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
    vlan: [10, 20, 100]
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
    vlan: [10, 30, 100]
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
`

export const simpleNetwork = `
name: "Simple Network"
version: "2.0.0"

settings:
  direction: TB

subgraphs:
  - id: core
    label: "Core"
    style:
      fill: "#f0f4f8"
      stroke: "#4a5568"

  - id: servers
    label: "Servers"
    style:
      fill: "#fff5f5"
      stroke: "#c53030"

nodes:
  - id: router
    label: "Router"
    type: router
    parent: core

  - id: switch
    label: "Switch"
    type: l2-switch
    parent: core

  - id: server1
    label: "Server 1"
    type: server
    parent: servers

  - id: server2
    label: "Server 2"
    type: server
    parent: servers

links:
  - from: router
    to: switch
    label: "10G"
    bandwidth: 10G

  - from: switch
    to: server1
    bandwidth: 1G

  - from: switch
    to: server2
    bandwidth: 1G
`

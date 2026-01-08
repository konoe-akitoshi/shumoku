/**
 * Sample network definitions for v2 (Mermaid-like)
 */

export const sreNextNetwork = `
name: "SRE NEXT Network Diagram"
version: "2.0.0"
description: "Enterprise network with HA edge routers and venue access"

settings:
  direction: TB
  theme: modern

subgraphs:
  # Cloud Layer
  - id: cloud
    label: "AWS Cloud (Services)"
    vendor: aws
    service: vpc
    resource: virtual-private-cloud-vpc
    style:
      fill: "#f0f8ff"
      stroke: "#0072bc"
      strokeDasharray: "5 5"

  # Edge Layer
  - id: edge
    label: "Sakura DC Edge (RTX3510 HA)"
    style:
      fill: "#fff5f5"
      stroke: "#d4a017"
      strokeWidth: 2

  # Venue Layer
  - id: venue
    label: "Venue: SRE NEXT (TOC Ariake)"
    style:
      fill: "#fffbf0"
      stroke: "#d4a017"

  # NOC (nested in venue) - Core equipment location
  - id: noc
    label: "NOC (Network Operations Center)"
    parent: venue
    style:
      fill: "#e6f7ff"
      stroke: "#0055a6"
      strokeWidth: 2

  # East Wing (nested in venue)
  - id: zone-east
    label: "East Wing"
    parent: venue
    direction: TB
    style:
      fill: "#f0fdf4"
      stroke: "#22c55e"

  # West Wing (nested in venue)
  - id: zone-west
    label: "West Wing (Daisy Chain)"
    parent: venue
    direction: TB
    style:
      fill: "#fef3c7"
      stroke: "#f59e0b"

nodes:
  # ========== Cloud Layer ==========
  - id: aws-services
    label:
      - "<b>Shared Services VPC</b>"
      - "CIDR: 172.16.0.0/16"
      - "---"
      - "DNS: 172.16.0.53"
      - "DHCP: 172.16.0.67"
      - "Zabbix: 172.16.0.100"
    type: server
    vendor: aws
    service: ec2
    resource: instances
    parent: cloud

  - id: vgw
    label:
      - "<b>AWS VGW</b>"
      - "Peer: 169.254.x.x"
    type: vpn
    vendor: aws
    service: vpc
    resource: vpn-gateway
    parent: cloud

  # ========== Edge Layer ==========
  - id: ocx1
    label:
      - "<b>OCX Line #1</b>"
      - "(Primary)"
    type: internet
    parent: edge

  - id: ocx2
    label:
      - "<b>OCX Line #2</b>"
      - "(Secondary)"
    type: internet
    parent: edge

  # rt1 and rt2 will be auto-detected as HA pair (connected via Keepalive link)
  - id: rt1
    label:
      - "<b>RTX3510-1 (Master)</b>"
      - "Mgmt: 10.241.0.21"
      - "VRRP VIP: 10.57.0.1"
    type: router
    vendor: yamaha
    model: rtx3510
    parent: edge

  - id: rt2
    label:
      - "<b>RTX3510-2 (Backup)</b>"
      - "Mgmt: 10.241.0.22"
      - "VRRP VIP: 10.57.0.1"
    type: router
    vendor: yamaha
    model: rtx3510
    parent: edge

  # ========== NOC (Core + Aggregation) ==========
  - id: ex-vc
    label:
      - "<b>Core-SW (VC)</b>"
      - "Mgmt: 10.241.0.10"
      - "DHCP Relay / Inter-VLAN"
    type: l3-switch
    parent: noc

  - id: venue-agg
    label:
      - "<b>Venue-Agg (EX4400)</b>"
      - "Mgmt: 10.241.0.11"
      - "Uplink: ae0 (10G)"
    type: l3-switch
    parent: noc

  # ========== East Wing ==========
  - id: sw02
    label:
      - "<b>sw02 (Foyer)</b>"
      - "Mgmt: 10.241.0.12"
      - "Model: C1000"
    type: l2-switch
    parent: zone-east

  - id: sw08
    label:
      - "<b>sw08 (Track A)</b>"
      - "Mgmt: 10.241.0.18"
      - "Model: C1000"
    type: l2-switch
    parent: zone-east

  - id: ap-foyer-01
    label: "AP-Foyer-01"
    type: access-point
    parent: zone-east

  - id: ap-track-a
    label: "AP-TrackA"
    type: access-point
    parent: zone-east

  # ========== West Wing ==========
  - id: sw03
    label:
      - "<b>sw03 (Sponsor)</b>"
      - "Mgmt: 10.241.0.13"
    type: l2-switch
    parent: zone-west

  - id: sw04
    label:
      - "<b>sw04 (Sponsor)</b>"
      - "Mgmt: 10.241.0.14"
    type: l2-switch
    parent: zone-west

  - id: sw05
    label:
      - "<b>sw05 (Sub)</b>"
      - "Mgmt: 10.241.0.15"
    type: l2-switch
    parent: zone-west

  - id: sw06
    label:
      - "<b>sw06 (Track B)</b>"
      - "Mgmt: 10.241.0.16"
    type: l2-switch
    parent: zone-west

  - id: sw07
    label:
      - "<b>sw07 (Track C)</b>"
      - "Mgmt: 10.241.0.17"
    type: l2-switch
    parent: zone-west

  - id: ap-spon-01
    label: "AP-Spon-01"
    type: access-point
    parent: zone-west

  - id: ap-spon-02
    label: "AP-Spon-02"
    type: access-point
    parent: zone-west

  - id: ap-track-b
    label: "AP-TrkB-01"
    type: access-point
    parent: zone-west

  - id: ap-track-c
    label: "AP-TrkC-01"
    type: access-point
    parent: zone-west

links:
  # OCX to Routers (10G WAN)
  - from:
      node: ocx1
      port: eth0
    to:
      node: rt1
      port: lan2
      ip: 169.254.1.1/30
    bandwidth: 10G

  - from:
      node: ocx2
      port: eth0
    to:
      node: rt2
      port: lan2
      ip: 169.254.2.1/30
    bandwidth: 10G

  # VPN Tunnels
  - from:
      node: vgw
      ip: 169.254.100.1/30
    to:
      node: rt1
      port: tun1
      ip: 169.254.100.2/30
    label: "IPsec VPN"

  - from:
      node: vgw
      ip: 169.254.101.1/30
    to:
      node: rt2
      port: tun1
      ip: 169.254.101.2/30
    label: "IPsec VPN"

  # HA Keepalive
  - from:
      node: rt1
      port: lan3
      ip: 10.57.0.1/30
    to:
      node: rt2
      port: lan3
      ip: 10.57.0.2/30
    label: "Keepalive"
    redundancy: ha
    style:
      minLength: 300

  # Router to Core (10G)
  - from:
      node: rt1
      port: lan4
      ip: 10.241.0.1/24
    to:
      node: ex-vc
      port: ge-0/0/0
      ip: 10.241.0.10/24
    label: "Active"
    bandwidth: 10G

  - from:
      node: rt2
      port: lan4
      ip: 10.241.0.2/24
    to:
      node: ex-vc
      port: ge-0/0/1
      ip: 10.241.0.10/24
    label: "Standby"
    bandwidth: 10G

  # Core to Venue Agg (40G LACP)
  - from:
      node: ex-vc
      port: ae0
    to:
      node: venue-agg
      port: ae0
    label: "LACP Trunk"
    bandwidth: 40G

  # Venue Agg to Wings (1G)
  - from:
      node: venue-agg
      port: ge-0/0/48
      vlan_id: 100
    to:
      node: sw02
      port: Gi1/0/48
      vlan_id: 100
    label: "Trunk"
    bandwidth: 1G

  - from:
      node: venue-agg
      port: ge-0/0/47
      vlan_id: 100
    to:
      node: sw03
      port: Gi1/0/48
      vlan_id: 100
    label: "Trunk"
    bandwidth: 1G

  # East Wing cascade (1G)
  - from:
      node: sw02
      port: Gi1/0/24
    to:
      node: sw08
      port: Gi1/0/48
    label: "Cascade"
    bandwidth: 1G

  - from:
      node: sw02
      port: Gi1/0/1
    to:
      node: ap-foyer-01
      port: eth0
    bandwidth: 1G

  - from:
      node: sw08
      port: Gi1/0/1
    to:
      node: ap-track-a
      port: eth0
    bandwidth: 1G

  # West Wing cascade (1G)
  - from:
      node: sw03
      port: Gi1/0/24
    to:
      node: sw04
      port: Gi1/0/48
    label: "Cascade"
    bandwidth: 1G

  - from:
      node: sw03
      port: Gi1/0/23
    to:
      node: sw05
      port: Gi1/0/48
    label: "Branch"
    bandwidth: 1G

  - from:
      node: sw04
      port: Gi1/0/24
    to:
      node: sw06
      port: Gi1/0/48
    label: "Cascade"
    bandwidth: 1G

  - from:
      node: sw06
      port: Gi1/0/24
    to:
      node: sw07
      port: Gi1/0/48
    label: "Cascade"
    bandwidth: 1G

  # APs (1G)
  - from:
      node: sw03
      port: Gi1/0/1
    to:
      node: ap-spon-01
      port: eth0
    bandwidth: 1G

  - from:
      node: sw04
      port: Gi1/0/1
    to:
      node: ap-spon-02
      port: eth0
    bandwidth: 1G

  - from:
      node: sw06
      port: Gi1/0/1
    to:
      node: ap-track-b
      port: eth0
    bandwidth: 1G

  - from:
      node: sw07
      port: Gi1/0/1
    to:
      node: ap-track-c
      port: eth0
    bandwidth: 1G
`

export const simpleTestV2 = `
name: "Simple Test v2"
version: "2.0.0"

settings:
  direction: TB

subgraphs:
  - id: layer1
    label: "Layer 1"
    style:
      fill: "#f0f4f8"
      stroke: "#4a5568"

  - id: layer2
    label: "Layer 2"
    style:
      fill: "#fff5f5"
      stroke: "#c53030"

nodes:
  - id: node1
    label: "Router 1"
    type: router
    parent: layer1

  - id: node2
    label: "Switch 1"
    type: l2-switch
    parent: layer1

  - id: node3
    label: "Server 1"
    type: server
    parent: layer2

  - id: node4
    label: "Server 2"
    type: server
    parent: layer2

links:
  - from: node1
    to: node2
    label: "10G"
    bandwidth: 10G

  - from: node2
    to: node3
    bandwidth: 1G

  - from: node2
    to: node4
    bandwidth: 1G
`

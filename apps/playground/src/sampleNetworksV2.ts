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
  nodeSpacing: 50
  rankSpacing: 100
  subgraphPadding: 40

subgraphs:
  # Cloud Layer
  - id: cloud
    label: "AWS Cloud (Services)"
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

  # Core Layer
  - id: core
    label: "Core Layer (EX4000-VC)"
    style:
      fill: "#e6f7ff"
      stroke: "#0055a6"
      strokeWidth: 2

  # Venue Layer
  - id: venue
    label: "Venue: SRE NEXT (TOC Ariake)"
    style:
      fill: "#fffbf0"
      stroke: "#d4a017"

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
    shape: rect
    parent: cloud
    style:
      fill: "#dbeafe"
      stroke: "#3b82f6"

  - id: vgw
    label:
      - "<b>AWS VGW</b>"
      - "Peer: 169.254.x.x"
    shape: rect
    parent: cloud
    style:
      fill: "#dbeafe"
      stroke: "#3b82f6"

  # ========== Edge Layer ==========
  - id: ocx1
    label:
      - "<b>OCX Line #1</b>"
      - "(Primary)"
    shape: rect
    parent: edge
    style:
      fill: "#fef3c7"
      stroke: "#f59e0b"

  - id: ocx2
    label:
      - "<b>OCX Line #2</b>"
      - "(Secondary)"
    shape: rect
    parent: edge
    style:
      fill: "#fef3c7"
      stroke: "#f59e0b"

  - id: rt1
    label:
      - "<b>RTX3510-1 (Master)</b>"
      - "Mgmt: 10.241.0.21"
      - "VRRP VIP: 10.57.0.1"
    shape: rounded
    type: router
    parent: edge
    style:
      fill: "#fecaca"
      stroke: "#dc2626"
      strokeWidth: 2

  - id: rt2
    label:
      - "<b>RTX3510-2 (Backup)</b>"
      - "Mgmt: 10.241.0.22"
      - "VRRP VIP: 10.57.0.1"
    shape: rounded
    type: router
    parent: edge
    style:
      fill: "#fecaca"
      stroke: "#dc2626"
      strokeWidth: 2

  # ========== Core Layer ==========
  - id: ex-vc
    label:
      - "<b>Core-SW (VC)</b>"
      - "Mgmt: 10.241.0.10"
      - "DHCP Relay / Inter-VLAN"
    shape: trapezoid
    type: l3-switch
    parent: core
    style:
      fill: "#bfdbfe"
      stroke: "#2563eb"
      strokeWidth: 2

  # ========== Venue Layer ==========
  - id: venue-agg
    label:
      - "<b>Venue-Agg (EX4400)</b>"
      - "Mgmt: 10.241.0.11"
      - "Uplink: ae0 (10G)"
    shape: trapezoid
    type: l3-switch
    parent: venue
    style:
      fill: "#ddd6fe"
      stroke: "#7c3aed"

  # ========== East Wing ==========
  - id: sw02
    label:
      - "<b>sw02 (Foyer)</b>"
      - "Mgmt: 10.241.0.12"
      - "Model: C1000"
    shape: rounded
    type: l2-switch
    parent: zone-east
    style:
      fill: "#d1fae5"
      stroke: "#10b981"

  - id: sw08
    label:
      - "<b>sw08 (Track A)</b>"
      - "Mgmt: 10.241.0.18"
      - "Model: C1000"
    shape: rounded
    type: l2-switch
    parent: zone-east
    style:
      fill: "#d1fae5"
      stroke: "#10b981"

  - id: ap-foyer-01
    label: "AP-Foyer-01"
    shape: circle
    type: access-point
    parent: zone-east
    style:
      fill: "#bbf7d0"
      stroke: "#22c55e"
      strokeDasharray: "4 2"

  - id: ap-track-a
    label: "AP-TrackA"
    shape: circle
    type: access-point
    parent: zone-east
    style:
      fill: "#bbf7d0"
      stroke: "#22c55e"
      strokeDasharray: "4 2"

  # ========== West Wing ==========
  - id: sw03
    label:
      - "<b>sw03 (Sponsor)</b>"
      - "Mgmt: 10.241.0.13"
    shape: rounded
    type: l2-switch
    parent: zone-west
    style:
      fill: "#fef3c7"
      stroke: "#f59e0b"

  - id: sw04
    label:
      - "<b>sw04 (Sponsor)</b>"
      - "Mgmt: 10.241.0.14"
    shape: rounded
    type: l2-switch
    parent: zone-west
    style:
      fill: "#fef3c7"
      stroke: "#f59e0b"

  - id: sw05
    label:
      - "<b>sw05 (Sub)</b>"
      - "Mgmt: 10.241.0.15"
    shape: rounded
    type: l2-switch
    parent: zone-west
    style:
      fill: "#fef3c7"
      stroke: "#f59e0b"

  - id: sw06
    label:
      - "<b>sw06 (Track B)</b>"
      - "Mgmt: 10.241.0.16"
    shape: rounded
    type: l2-switch
    parent: zone-west
    style:
      fill: "#fef3c7"
      stroke: "#f59e0b"

  - id: sw07
    label:
      - "<b>sw07 (Track C)</b>"
      - "Mgmt: 10.241.0.17"
    shape: rounded
    type: l2-switch
    parent: zone-west
    style:
      fill: "#fef3c7"
      stroke: "#f59e0b"

  - id: ap-spon-01
    label: "AP-Spon-01"
    shape: circle
    type: access-point
    parent: zone-west
    style:
      fill: "#fef9c3"
      stroke: "#eab308"
      strokeDasharray: "4 2"

  - id: ap-spon-02
    label: "AP-Spon-02"
    shape: circle
    type: access-point
    parent: zone-west
    style:
      fill: "#fef9c3"
      stroke: "#eab308"
      strokeDasharray: "4 2"

  - id: ap-track-b
    label: "AP-TrkB-01"
    shape: circle
    type: access-point
    parent: zone-west
    style:
      fill: "#fef9c3"
      stroke: "#eab308"
      strokeDasharray: "4 2"

  - id: ap-track-c
    label: "AP-TrkC-01"
    shape: circle
    type: access-point
    parent: zone-west
    style:
      fill: "#fef9c3"
      stroke: "#eab308"
      strokeDasharray: "4 2"

links:
  # OCX to Routers
  - from: ocx1
    to: rt1
    label: "lan2"
    type: solid

  - from: ocx2
    to: rt2
    label: "lan2"
    type: solid

  # VPN Tunnels
  - from: vgw
    to: rt1
    label: "IPsec VPN / tun1"
    type: dashed

  - from: vgw
    to: rt2
    label: "IPsec VPN / tun1"
    type: dashed

  # HA Keepalive
  - from: rt1
    to: rt2
    label: "lan3: Keepalive"
    type: double
    arrow: none

  # Router to Core
  - from: rt1
    to: ex-vc
    label: "lan4: Active"
    type: solid

  - from: rt2
    to: ex-vc
    label: "lan4: Standby"
    type: dashed

  # Core to Venue Agg
  - from: ex-vc
    to: venue-agg
    label: "ae0: LACP Trunk"
    type: thick

  # Venue Agg to Wings
  - from: venue-agg
    to: sw02
    label: "Trunk Gi1/0/48"
    type: solid

  - from: venue-agg
    to: sw03
    label: "Trunk Gi1/0/47"
    type: solid

  # East Wing cascade
  - from: sw02
    to: sw08
    label: "Cascade"
    type: solid

  - from: sw02
    to: ap-foyer-01
    type: solid
    arrow: none

  - from: sw08
    to: ap-track-a
    type: solid
    arrow: none

  # West Wing cascade
  - from: sw03
    to: sw04
    label: "Cascade"
    type: solid

  - from: sw03
    to: sw05
    label: "Branch"
    type: solid

  - from: sw04
    to: sw06
    label: "Cascade"
    type: solid

  - from: sw06
    to: sw07
    label: "Cascade"
    type: solid

  # APs
  - from: sw03
    to: ap-spon-01
    type: solid
    arrow: none

  - from: sw04
    to: ap-spon-02
    type: solid
    arrow: none

  - from: sw06
    to: ap-track-b
    type: solid
    arrow: none

  - from: sw07
    to: ap-track-c
    type: solid
    arrow: none
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
    shape: rounded
    parent: layer1
    style:
      fill: "#bee3f8"
      stroke: "#2b6cb0"

  - id: node2
    label: "Switch 1"
    shape: rounded
    parent: layer1
    style:
      fill: "#bee3f8"
      stroke: "#2b6cb0"

  - id: node3
    label: "Server 1"
    shape: rect
    parent: layer2
    style:
      fill: "#fed7d7"
      stroke: "#c53030"

  - id: node4
    label: "Server 2"
    shape: rect
    parent: layer2
    style:
      fill: "#fed7d7"
      stroke: "#c53030"

links:
  - from: node1
    to: node2
    label: "10G"
    type: solid

  - from: node2
    to: node3
    type: solid

  - from: node2
    to: node4
    type: solid
`

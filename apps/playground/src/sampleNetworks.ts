// Sample network definitions for location-based layout

export const locationBasedSample = `name: "Enterprise Data Center Network"
version: "1.0.0"
description: "Realistic enterprise network - each location has aggregation switch, trunk lines between rooms"

settings:
  theme: modern

devices:
  # ========================================
  # MDF (Main Distribution Frame) - Core
  # ========================================
  - id: core-sw-1
    name: "Core-SW-1"
    type: l3-switch
    role: core
    metadata:
      model: "Cisco Nexus 9500"
      ip: "10.0.0.1"
      locationId: "mdf"

  - id: core-sw-2
    name: "Core-SW-2"
    type: l3-switch
    role: core
    metadata:
      model: "Cisco Nexus 9500"
      ip: "10.0.0.2"
      locationId: "mdf"

  - id: fw-1
    name: "FW-1"
    type: firewall
    role: core
    metadata:
      model: "Palo Alto PA-5450"
      locationId: "mdf"

  # ========================================
  # Server Room - Aggregation + Servers
  # ========================================
  - id: srv-agg-sw
    name: "SRV-Agg-SW"
    type: l3-switch
    role: distribution
    metadata:
      model: "Cisco Catalyst 9500"
      locationId: "server-room"

  - id: web-server
    name: "Web-Server"
    type: server
    metadata:
      locationId: "server-room"

  - id: db-server
    name: "DB-Server"
    type: server
    metadata:
      locationId: "server-room"

  - id: storage
    name: "Storage"
    type: server
    metadata:
      locationId: "server-room"

  # ========================================
  # Floor 2 IDF - Aggregation + Access
  # ========================================
  - id: f2-agg-sw
    name: "F2-Agg-SW"
    type: l3-switch
    role: distribution
    metadata:
      model: "Cisco Catalyst 9300"
      locationId: "floor-2"

  - id: f2-access-sw-1
    name: "F2-Access-1"
    type: l2-switch
    role: access
    metadata:
      locationId: "floor-2"

  - id: f2-access-sw-2
    name: "F2-Access-2"
    type: l2-switch
    role: access
    metadata:
      locationId: "floor-2"

  - id: f2-ap
    name: "F2-WiFi"
    type: access-point
    metadata:
      locationId: "floor-2"

  # ========================================
  # Floor 3 IDF - Aggregation + Access
  # ========================================
  - id: f3-agg-sw
    name: "F3-Agg-SW"
    type: l3-switch
    role: distribution
    metadata:
      model: "Cisco Catalyst 9300"
      locationId: "floor-3"

  - id: f3-access-sw-1
    name: "F3-Access-1"
    type: l2-switch
    role: access
    metadata:
      locationId: "floor-3"

  - id: f3-ap
    name: "F3-WiFi"
    type: access-point
    metadata:
      locationId: "floor-3"

locations:
  - id: mdf
    name: "MDF (Core)"
    type: room
    style:
      backgroundColor: "#e6f2ff"
      borderColor: "#0066cc"
      borderWidth: 3

  - id: server-room
    name: "Server Room"
    type: room
    style:
      backgroundColor: "#fff0e6"
      borderColor: "#cc6600"
      borderWidth: 3

  - id: floor-2
    name: "Floor 2 IDF"
    type: room
    style:
      backgroundColor: "#f0f8e6"
      borderColor: "#339900"
      borderWidth: 2

  - id: floor-3
    name: "Floor 3 IDF"
    type: room
    style:
      backgroundColor: "#f5f0ff"
      borderColor: "#6633cc"
      borderWidth: 2

links:
  # === MDF Internal (Core interconnections) ===
  - from: core-sw-1
    to: core-sw-2
    bandwidth: "100G"

  - from: core-sw-1
    to: fw-1
    bandwidth: "40G"

  - from: core-sw-2
    to: fw-1
    bandwidth: "40G"

  # === Trunk: MDF <-> Server Room (1 line, redundant) ===
  - from: core-sw-1
    to: srv-agg-sw
    bandwidth: "40G"

  # === Trunk: MDF <-> Floor 2 (1 line) ===
  - from: core-sw-1
    to: f2-agg-sw
    bandwidth: "10G"

  # === Trunk: MDF <-> Floor 3 (1 line) ===
  - from: core-sw-2
    to: f3-agg-sw
    bandwidth: "10G"

  # === Server Room Internal ===
  - from: srv-agg-sw
    to: web-server
    bandwidth: "10G"

  - from: srv-agg-sw
    to: db-server
    bandwidth: "10G"

  - from: srv-agg-sw
    to: storage
    bandwidth: "25G"

  # === Floor 2 Internal ===
  - from: f2-agg-sw
    to: f2-access-sw-1
    bandwidth: "10G"

  - from: f2-agg-sw
    to: f2-access-sw-2
    bandwidth: "10G"

  - from: f2-access-sw-1
    to: f2-ap
    bandwidth: "1G"

  # === Floor 3 Internal ===
  - from: f3-agg-sw
    to: f3-access-sw-1
    bandwidth: "10G"

  - from: f3-access-sw-1
    to: f3-ap
    bandwidth: "1G"
`

export const simpleLocationTest = `name: "Simple Location Test"
version: "1.0.0"
description: "Simple test for location-based layout"

devices:
  - id: sw1
    name: "Switch 1"
    type: l2-switch
    metadata:
      locationId: "room-a"
      
  - id: sw2
    name: "Switch 2" 
    type: l2-switch
    metadata:
      locationId: "room-a"
      
  - id: sw3
    name: "Switch 3"
    type: l2-switch
    metadata:
      locationId: "room-b"
      
  - id: server1
    name: "Server 1"
    type: server
    metadata:
      locationId: "room-b"

locations:
  - id: room-a
    name: "Room A"
    type: room
    style:
      backgroundColor: "#e6f2ff"
      borderColor: "#0066cc"
      borderWidth: 2

  - id: room-b
    name: "Room B"
    type: room
    style:
      backgroundColor: "#f0f8e6"
      borderColor: "#339900"
      borderWidth: 2

links:
  - from: sw1
    to: sw2
    bandwidth: "10G"
    
  - from: sw2
    to: sw3
    bandwidth: "10G"
    
  - from: sw3
    to: server1
    bandwidth: "10G"
`

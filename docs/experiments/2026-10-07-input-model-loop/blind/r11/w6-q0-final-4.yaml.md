```yaml
name: Company network

groups:
  - id: head-office
    label: Head office
  - id: server-room
    label: Server room
    parent: head-office
  - id: branch
    label: Branch
  - id: branch-2nd-floor
    label: 2nd floor
    parent: branch

segments:
  - id: vlan-10
    label: Staff
    vlan: 10
    prefix: 192.168.1.0/24
    addresses:
      fw-1: 192.168.1.2
      fw-2: 192.168.1.3
      ha-firewalls: 192.168.1.1
      web-1: 192.168.1.20
  - id: vlan-20
    label: Voice
    vlan: 20

redundancy:
  - id: ha-firewalls
    label: Firewall HA pair
    nodes: [fw-1, fw-2]

nodes:
  - id: fw-1
    label: fw-1
    product: palo-alto/pa-3220
    group: server-room
  - id: fw-2
    label: fw-2
    product: palo-alto/pa-3220
    group: server-room
  - id: core
    label: Core switch
    group: server-room
    address: 10.99.0.2
    members: [sw-a, sw-b]
  - id: esx-1
    label: esx-1
    type: virtualization-host
    group: server-room
  - id: web-1
    label: web-1
    type: virtual-machine
    group: server-room
    host: esx-1
  - id: br-rt
    label: Branch router
    group: branch
  - id: ap-1
    label: Access point
    group: branch-2nd-floor
    assumed: true

links:
  - endpoints:
      - node: fw-1
        port: ethernet1/1
      - node: core
    speed: 10G
    segments: [vlan-10, vlan-20]
  - endpoints:
      - node: fw-2
      - node: core
    assumed: true
  - endpoints:
      - node: esx-1
      - node: core
    speed: 25G
    segments: [vlan-10]
  - endpoints:
      - node: br-rt
        port: tun0
      - node: fw-1
        port: tun0
    virtual: true
```

1. The description does not say which network the core’s management address is on, so it is recorded as a node address rather than in a segment. The vSwitch attachment is expressed as the VM’s presence in VLAN 10; the format has no separate virtual-switch entity or adapter.
2. I used IDs `vlan-10`, `vlan-20`, `ha-firewalls`, and `ap-1`, and assigned the tunnel endpoint on the firewall to `fw-1` as stated. I treated the fw-2 cable as assumed because the connection is known but its ports and carried VLANs are unknown; `assumed` may imply uncertainty about the connection itself.
3. It is unclear whether `assumed` applies to a known connection with unknown details, or only to uncertainty that the connection exists. The description confirms fw-2’s connection, so the format has no direct way to mark only its ports and VLANs as unknown.
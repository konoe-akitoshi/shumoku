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

networks:
  - id: staff-network
    prefix: 192.168.1.0/24

segments:
  - id: vlan-10
    label: Staff
    vlan: 10
    prefix: 192.168.1.0/24
    network: staff-network
    group: server-room
    addresses:
      fw-1: 192.168.1.2
      fw-2: 192.168.1.3
      firewall-ha: 192.168.1.1
      web-1: 192.168.1.20
  - id: vlan-20
    label: Voice
    vlan: 20

redundancy:
  - id: firewall-ha
    label: Firewall HA pair
    nodes:
      - fw-1
      - fw-2

nodes:
  - id: fw-1
    label: fw-1
    type: firewall
    product: palo-alto/pa-3220
    group: server-room
  - id: fw-2
    label: fw-2
    type: firewall
    product: palo-alto/pa-3220
    group: server-room
  - id: core
    type: switch
    group: server-room
    address: 10.99.0.2
    members:
      - sw-a
      - sw-b
  - id: esx-1
    type: virtualization-host
    group: server-room
  - id: vSwitch0
    type: virtual-switch
    host: esx-1
  - id: web-1
    type: virtual-machine
    host: esx-1
    group: server-room
  - id: br-rt
    type: router
    group: branch
  - id: ap-2nd-floor
    type: access-point
    group: branch-2nd-floor
    assumed: true

links:
  - endpoints:
      - node: fw-1
        port: ethernet1/1
      - node: core
    speed: 10G
    segments:
      - vlan-10
      - vlan-20
  - endpoints:
      - node: fw-2
      - node: core
    assumed: true
  - endpoints:
      - node: esx-1
      - node: core
    speed: 25G
    segments:
      - vlan-10
  - endpoints:
      - node: br-rt
        port: tun0
      - node: fw-1
        port: tun0
    virtual: true
```

1. The VM’s attachment to `vSwitch0` on VLAN 10 is not directly expressible: the format says a VM’s adapter is not a link and should be represented by placing the VM in the segment, but it has no field to identify the virtual switch or adapter. I included `web-1`’s VLAN 10 address there.
2. I added IDs and types where the description gave none: network, segment, group, and redundancy IDs; node types; and the label for the assumed access point. I treated the unspecified tunnel endpoint on `br-rt` as port `tun0`, interpreting “tun0 on both sides” to apply to both ends. I left the unknown core address network unspecified.
3. It is unclear whether `assumed` on the fw-2 cable should be set: the connection is stated to exist, but its ports and VLANs are unknown. I left it unset. It is also unclear whether `vSwitch0` should be a node at all, since the format has no explicit virtual-switch attachment relation.
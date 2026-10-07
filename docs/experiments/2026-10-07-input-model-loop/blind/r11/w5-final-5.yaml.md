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
  - id: second-floor
    label: 2nd floor
    parent: branch

networks:
  - id: head-office-lan
  - id: branch-lan

segments:
  - id: vlan-10
    label: Staff
    vlan: 10
    prefix: 192.168.1.0/24
    network: head-office-lan
    group: server-room
    addresses:
      fw-1: 192.168.1.2
      fw-2: 192.168.1.3
      fw-ha: 192.168.1.1
      web-1: 192.168.1.20
  - id: vlan-20
    label: Voice
    vlan: 20
    network: head-office-lan
    group: server-room

redundancy:
  - id: fw-ha
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
    label: core
    type: switch
    group: server-room
    address: 10.99.0.2
    members:
      - sw-a
      - sw-b
  - id: esx-1
    label: esx-1
    type: virtualization-host
    group: server-room
  - id: web-1
    label: web-1
    type: virtual-machine
    host: esx-1
    group: server-room
  - id: vSwitch0
    label: vSwitch0
    type: virtual-switch
    host: esx-1
    group: server-room
  - id: br-rt
    label: br-rt
    type: router
    group: branch
  - id: ap
    label: Access point
    type: access-point
    group: second-floor
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

1. The description does not specify how `web-1` connects through `vSwitch0` to VLAN 10. The format has no explicit virtual network adapter or switch-port model, and the description says a VM adapter is not a link. The VM is therefore listed in VLAN 10 by its address, while `vSwitch0` is represented as a node.
2. I added IDs for the unnamed networks, groups, HA set, and access point. I treated the branch LAN as a routed network despite no branch prefix being given, and assigned the tunnel link’s `tun0` port on fw-1 based on “tun0 on both sides, to fw-1.” The node types and the core’s switch type are inferred from their descriptions.
3. It is unclear whether a network should be listed when it has no stated prefix or other details, and whether a node can be named directly as an address owner in `Segment.addresses` when that node belongs to a redundancy set.
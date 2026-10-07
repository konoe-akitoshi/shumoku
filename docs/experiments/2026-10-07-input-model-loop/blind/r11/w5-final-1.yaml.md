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
      fw-ha: 192.168.1.1
      fw-1: 192.168.1.2
      fw-2: 192.168.1.3
      web-1: 192.168.1.20
  - id: vlan-20
    label: Voice
    vlan: 20
    network: head-office-lan
    group: server-room

redundancy:
  - id: fw-ha
    label: Firewall HA pair
    nodes: [fw-1, fw-2]

nodes:
  - id: fw-1
    label: fw-1
    type: firewall
    product: palo-alto/pa-3220
    group: server-room
    address: 192.168.1.2
  - id: fw-2
    label: fw-2
    type: firewall
    product: palo-alto/pa-3220
    group: server-room
    address: 192.168.1.3
  - id: core
    label: core
    type: switch
    product: switch
    group: server-room
    address: 10.99.0.2
    members: [sw-a, sw-b]
  - id: esx-1
    label: esx-1
    type: server
    software: VMware ESXi
    group: server-room
  - id: web-1
    label: web-1
    type: virtual-machine
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
    segments: [vlan-10, vlan-20]
  - endpoints:
      - node: fw-2
      - node: core
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

1. The VM’s attachment to `vSwitch0` is not expressible as stated: the format has no representation for a virtual switch or a VM adapter. Its presence in VLAN 10 is represented through the segment address instead.
2. I added network IDs to group the head office LAN and branch LAN; the description does not name routed networks. I also assigned VLAN 20 to the head-office network and server-room group based on its being carried on the head-office firewall link. I used generic node types for devices and software, and used `palo-alto/pa-3220` as the product path. The AP’s ID is `ap`.
3. It is unclear whether an address should appear both in `Segment.addresses` and `Node.address`; I included the firewall addresses in both. The HA virtual address is recorded under the redundancy set ID as specified. The format also does not say whether a stack’s member names should be IDs of separate nodes; I recorded them as member strings without separate nodes.
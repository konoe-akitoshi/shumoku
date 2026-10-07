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
    label: Staff
    prefix: 192.168.1.0/24

segments:
  - id: vlan-10
    label: Staff
    vlan: 10
    prefix: 192.168.1.0/24
    addresses:
      fw-ha: 192.168.1.1
      fw-1: 192.168.1.2
      fw-2: 192.168.1.3
      web-1: 192.168.1.20
  - id: vlan-20
    label: Voice
    vlan: 20

redundancy:
  - id: fw-ha
    label: Firewall HA pair
    nodes: [fw-1, fw-2]

nodes:
  - id: fw-1
    label: fw-1
    type: firewall
    product: paloalto/pa-3220
    group: server-room
  - id: fw-2
    label: fw-2
    type: firewall
    product: paloalto/pa-3220
    group: server-room
  - id: core
    label: core
    type: switch
    group: server-room
    address: 10.99.0.2
    members: [sw-a, sw-b]
  - id: esx-1
    label: esx-1
    type: virtualization-host
    group: server-room
  - id: vSwitch0
    label: vSwitch0
    type: virtual-switch
    host: esx-1
  - id: web-1
    label: web-1
    type: vm
    host: esx-1
  - id: br-rt
    label: br-rt
    type: router
    group: branch
  - id: ap
    label: Access point
    type: access-point
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

1. The description does not say which routed network contains VLAN 10, or identify a routed network at all, so I left `network` unset. The VLAN 20 prefix and addresses are also unspecified.
2. I represented the shared firewall address under redundancy set `fw-ha`, inferred `fw-ha` as the set ID, and chose IDs for the VLANs, groups, virtual switch, and access point. I treated the VM as attached to VLAN 10 directly; the format describes segment membership but has no field for its virtual switch attachment. I used descriptive node types for the firewall, virtualization host, virtual switch, VM, router, and access point.
3. The format does not make clear whether a virtual switch should be a node or how to express a VM’s attachment to that switch. It also does not say how to represent an address such as `10.99.0.2` when its network is unknown; I used `node.address`.
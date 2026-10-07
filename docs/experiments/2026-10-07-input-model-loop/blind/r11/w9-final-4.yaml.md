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
  - id: staff-network
    label: Staff
    prefix: 192.168.1.0/24

segments:
  - id: vlan-10
    label: Staff
    vlan: 10
    prefix: 192.168.1.0/24
    network: staff-network
    group: head-office
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
    segments: [vlan-10, vlan-20]
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

connections:
  - id: ipsec
    label: IPsec tunnel

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
      - node: fw-1
        port: tun0
      - node: br-rt
        port: tun0
    connection: ipsec
    virtual: true
```

1. The VM’s attachment to `vSwitch0` cannot be expressed directly: this format has no virtual-switch or adapter model. VLAN 10 membership and the VM address are represented on the segment instead.
2. I inferred generic node types, “VMware ESXi” software, and the `palo-alto/pa-3220` product path. I treated the tunnel as one virtual link and gave the connection the ID `ipsec`. I also assigned the head-office VLANs to the server room’s parent group because the description did not specify a more precise location.
3. The format does not clarify whether `RoutedNetwork.prefix` duplicates or replaces a segment prefix; I included the prefix on both. It also does not say how to record a node’s address when its segment is unknown, beyond using `Node.address`; the core address is written that way.
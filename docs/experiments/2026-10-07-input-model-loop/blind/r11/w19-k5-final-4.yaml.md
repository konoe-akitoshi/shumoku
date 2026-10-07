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

segments:
  - id: vlan-10
    label: Staff
    vlan: 10
    prefix: 192.168.1.0/24
    group: server-room
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
    label: Core switch
    type: switch
    group: server-room
    members: [sw-a, sw-b]
    address: 10.99.0.2
  - id: esx-1
    label: esx-1
    type: server
    group: server-room
  - id: web-1
    label: web-1
    type: vm
    group: server-room
    host: esx-1
  - id: br-rt
    label: br-rt
    type: router
    group: branch
  - id: access-point
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
      - node: web-1
      - segment: vlan-10
    virtual: true
  - endpoints:
      - node: br-rt
        port: tun0
      - node: fw-1
        port: tun0
    description: IPsec tunnel
    connection: branch-ipsec
    virtual: true

connections:
  - id: branch-ipsec
    label: Branch IPsec tunnel
```

1. The format cannot say which physical firewall port the tunnel uses at the head office, or explicitly encode that the two `tun0` ports form one tunnel beyond the link itself.
2. I inferred the node types, the access point ID, and the product path `palo-alto/pa-3220`. I treated `vSwitch0` as an unnamed adapter/attachment because the format has no field for a VM’s virtual switch name. I also represented the shared HA address under the redundancy set ID.
3. It is unclear whether `addresses` may use a redundancy ID as a key even though its description says “by node,” and whether a link from a node directly to a segment is the intended way to represent the VM’s VLAN attachment.
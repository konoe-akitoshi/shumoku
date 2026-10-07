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
    addresses:
      firewall-ha: 192.168.1.1
      fw-1: 192.168.1.2
      fw-2: 192.168.1.3
      web-1: 192.168.1.20
  - id: vlan-20
    label: Voice
    vlan: 20
  - id: vswitch0
    label: vSwitch0
    addresses:
      web-1: 192.168.1.20

redundancy:
  - id: firewall-ha
    label: Firewall HA pair
    nodes: [fw-1, fw-2]

connections:
  - id: ipsec
    label: IPsec tunnel

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
    label: core
    group: server-room
    address: 10.99.0.2
    members: [sw-a, sw-b]
  - id: esx-1
    label: esx-1
    group: server-room
  - id: web-1
    label: web-1
    group: server-room
    host: esx-1
  - id: br-rt
    label: br-rt
    group: branch
  - id: ap
    label: Access point
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
      - segment: vswitch0
    segments: [vlan-10]
    virtual: true

  - endpoints:
      - node: br-rt
      - node: fw-1
        port: tun0
    connection: ipsec
    virtual: true
```

1. The description does not say what VLAN 20’s prefix or addresses are, or which VLANs fw-2’s cable carries. The AP’s links and network attachment are also unspecified.
2. I added IDs for the HA set, IPsec connection, and vSwitch segment, and an `ap` node ID. I treated the web VM’s attachment to vSwitch0 as a virtual link and represented the shared firewall address under the redundancy set’s ID. The description says `tun0` is on both sides, so I recorded it on fw-1 but could not encode a port on br-rt without inventing one.
3. The format describes addresses under segments as belonging to a node’s presence in that segment, but it does not clearly explain whether an address assigned to a redundancy set should be listed alongside member-node addresses in the same map. Also, it is unclear how to represent both ends’ port names on a link: `Endpoint` allows a port, but the two endpoints are unordered.
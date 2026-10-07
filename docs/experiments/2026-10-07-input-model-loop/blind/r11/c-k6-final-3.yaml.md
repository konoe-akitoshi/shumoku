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
    group: server-room
  - id: vswitch0
    label: vSwitch0
    group: server-room

redundancy:
  - id: fw-ha
    label: Firewall HA pair
    nodes:
      - fw-1
      - fw-2
    assumed: true

connections:
  - id: ipsec-tunnel
    label: IPsec tunnel

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
    members:
      - sw-a
      - sw-b
    address: 10.99.0.2
    group: server-room
  - id: esx-1
    label: esx-1
    type: virtualization-host
    host: core
    group: server-room
  - id: web-1
    label: web-1
    type: virtual-machine
    host: esx-1
    group: server-room
  - id: br-rt
    label: Branch router
    type: router
    group: branch
  - id: ap
    label: Access point
    type: access-point
    assumed: true
    group: second-floor

links:
  - endpoints:
      - node: fw-1
        port: ethernet1/1
      - node: core
    speed: 10G
    segments:
      - vlan-10
      - vlan-20
    description: Cable
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
      - node: web-1
      - segment: vswitch0
    virtual: true
    segments:
      - vlan-10
  - endpoints:
      - node: br-rt
      - node: fw-1
    connection: ipsec-tunnel
    description: tun0 on both sides
    virtual: true
```

1. The tunnel’s far-end location or network details, the AP’s connectivity, and the voice VLAN’s prefix or addresses are not specified. The format also has no explicit field for a port on each tunnel endpoint, so `tun0` is kept in the description.
2. I represented the shared HA address under redundancy set `fw-ha`, inferred the AP node ID as `ap`, and used `vswitch0` as a segment to express the VM’s attachment to that virtual switch. I treated the IPsec tunnel as one virtual link and the AP’s unconfirmed existence as `assumed: true`.
3. The format says an `assumed` link has an unconfirmed connection, while the AP’s existence is unconfirmed; I used `assumed` on the node for that case. It is unclear whether a “cable” needs an explicit representation beyond an ordinary link, and whether the virtual switch should be represented as a segment or some other kind of entity.
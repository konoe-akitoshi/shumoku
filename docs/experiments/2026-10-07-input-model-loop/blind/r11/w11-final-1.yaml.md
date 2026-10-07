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
    group: server-room
    addresses:
      firewall-ha: 192.168.1.1
      fw-1: 192.168.1.2
      fw-2: 192.168.1.3
      web-1: 192.168.1.20
  - id: vlan-20
    label: Voice
    vlan: 20

redundancy:
  - id: firewall-ha
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
    label: br-rt
    type: router
    group: branch
  - id: ap-2nd-floor
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
    speed: 10G
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
    connection: ipsec-tunnel
    virtual: true

connections:
  - id: ipsec-tunnel
    label: IPsec tunnel
```

1. **Could not express:** The description says the VM is attached to `vSwitch0` on VLAN 10, but the format has no way to represent a virtual switch or a VM’s adapter/port. Its presence and address in VLAN 10 are represented.
2. **Guesses or additions:** I treated the access point as a node in the 2nd-floor group. I marked the unknown fw-2 cable as assumed and assigned it 10G; the description confirms the connection but gives neither its speed nor its VLANs, so those details should not be inferred. The format has no explicit “unknown” marker for those link properties. The IPsec tunnel is represented as one virtual link and one connection.
3. **Unclear:** Whether `Node.address` can represent an address with an unknown segment even when the node is known to be in another segment. I used it for the core’s management address because its network is unknown. Also unclear whether `assumed` applies to the access point’s existence only or to its placement on the 2nd floor as well.
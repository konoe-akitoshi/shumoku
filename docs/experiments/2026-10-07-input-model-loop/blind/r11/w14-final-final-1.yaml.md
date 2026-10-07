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

connections:
  - id: ipsec
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
      - node: fw-1
        port: tun0
    connection: ipsec
    virtual: true
```

1. **Could not express:** `vSwitch0` is named, but this format has no field for a VM’s virtual switch or adapter name. The AP’s exact device identity is also unknown.
2. **Guesses or additions:** I used generic node types, inferred that the firewall’s shared address belongs to the redundancy set, and represented the tunnel as a virtual link in an IPsec connection. The tunnel endpoint port `tun0` is given for both sides, so I recorded it on the firewall endpoint; the format does not let a link endpoint have multiple port names. I treated the AP’s existence as assumed and placed it on the 2nd floor. I placed VLAN 10 in the server room based on the surrounding description; VLAN 20’s location was not specified, so I left it ungrouped.
3. **Unclear in the format:** Whether a virtual address should be keyed by the redundancy set ID in `Segment.addresses` is described, but the type permits only string keys and does not formally distinguish node IDs from set IDs. Also, link endpoints can each have only one optional port, while the tunnel description names `tun0` on both sides.
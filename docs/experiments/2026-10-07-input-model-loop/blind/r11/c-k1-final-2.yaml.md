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
      fw-ha: 192.168.1.1
      web-1: 192.168.1.20
  - id: vlan-20
    label: Voice
    vlan: 20

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
    label: Core switch
    type: switch
    group: server-room
    members:
      - sw-a
      - sw-b
    address: 10.99.0.2
  - id: esx-1
    label: esx-1
    type: virtualization host
    group: server-room
  - id: web-1
    label: web-1
    type: virtual machine
    host: esx-1
    group: server-room
  - id: br-rt
    label: Branch router
    type: router
    group: branch
  - id: ap-1
    label: Access point
    type: access point
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
    segments:
      - vlan-10
      - vlan-20
  - endpoints:
      - node: fw-2
      - node: core
    segments: []
  - endpoints:
      - node: esx-1
      - node: core
    speed: 25G
    segments:
      - vlan-10
  - endpoints:
      - node: web-1
        port: vSwitch0
      - segment: vlan-10
    virtual: true
  - endpoints:
      - node: br-rt
        port: tun0
      - node: fw-1
        port: tun0
    connection: ipsec
    virtual: true
```

1. The format cannot express that fw-1 and fw-2 share the virtual address `192.168.1.1` while also listing each firewall’s own address in VLAN 10: `addresses` assigns addresses by node or redundancy-set ID, and the redundancy-set ID is used for the shared address, as represented above.
2. I added IDs and labels where needed, inferred `fw-ha` as the redundancy-set ID, and used `ap-1` for the unconfirmed access point because the description gives no identifier. I treated the IPsec tunnel as one connection and modeled `tun0` at both ends as a virtual link. I left fw-2’s segments explicitly empty to represent that its cable carries no known VLANs.
3. The format says that a link listing `segments` carries those and no others, but it does not clearly distinguish an unknown segment list from a known empty list. So `segments: []` on fw-2 may imply that it carries no VLANs, although the description only says that its VLANs are unknown.
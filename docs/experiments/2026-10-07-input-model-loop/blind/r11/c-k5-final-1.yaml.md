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
  - id: vswitch0-vlan-10
    label: vSwitch0 VLAN 10
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
    product: palo-alto/pa-3220
    group: server-room
  - id: fw-2
    label: fw-2
    product: palo-alto/pa-3220
    group: server-room
  - id: core
    label: core
    members:
      - sw-a
      - sw-b
    address: 10.99.0.2
    group: server-room
  - id: esx-1
    label: esx-1
    group: server-room
  - id: web-1
    label: web-1
    host: esx-1
    group: server-room
  - id: br-rt
    label: br-rt
    group: branch
  - id: ap
    label: Access point
    assumed: true
    group: second-floor

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
  - endpoints:
      - node: esx-1
      - node: core
    speed: 25G
    segments:
      - vlan-10
  - endpoints:
      - node: web-1
      - segment: vswitch0-vlan-10
    virtual: true
  - endpoints:
      - node: br-rt
      - node: fw-1
        port: tun0
    connection: ipsec
    virtual: true
  - endpoints:
      - node: br-rt
      - node: fw-1
        port: tun0
    connection: ipsec
    virtual: true
```

1. The tunnel’s opposite endpoint port is described as `tun0` too, but the format has no way to distinguish endpoint-specific port names on a link. I used `tun0` on fw-1 and left br-rt’s port unspecified. The description also does not say what VLAN 20’s prefix or addresses are.
2. I added IDs for groups, segments, the redundancy set, and the connection. I treated the VM’s vSwitch0 VLAN 10 as a separate segment because it is named as an attachment, but its VLAN ID and prefix are not explicitly stated. I interpreted the AP’s unconfirmed existence as `assumed: true`.
3. The format says a VPN can be represented by multiple links in one connection, but does not say how to encode a single tunnel versus two tunnel links. I represented the IPsec tunnel with two identical links.
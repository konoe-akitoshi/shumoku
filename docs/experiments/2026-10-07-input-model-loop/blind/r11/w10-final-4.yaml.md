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
        port: tun0
      - node: fw-1
        port: tun0
    virtual: true
    assumed: true
```

1. **Could not express:** The VM’s attachment specifically to a virtual switch named `vSwitch0`; the format says a VM’s network adapter is not a link, but provides no field for a virtual switch. The IPsec tunnel’s protocol is also not representable beyond marking the link virtual.

2. **Guesses or additions:** I used IDs for the VLANs, network, groups, HA set, and access point because the format requires IDs or references. I modeled the staff VLAN as belonging to a routed network with the same prefix, and placed it in the server room based on the description’s context. I treated the IPsec tunnel as virtual. I marked it assumed because the description says “over an IPsec tunnel” but doesn’t explicitly say whether that tunnel is confirmed. The core’s type, node types, labels, and group assignments are descriptive choices.

3. **Unclear in the format:** The description says the two firewall addresses are on VLAN 10 and the HA address is shared, but `addresses` is keyed by node or redundancy ID; I used the redundancy ID for the shared address. It is unclear whether `RoutedNetwork.prefix` and `Segment.prefix` should both be set when they describe the same subnet.
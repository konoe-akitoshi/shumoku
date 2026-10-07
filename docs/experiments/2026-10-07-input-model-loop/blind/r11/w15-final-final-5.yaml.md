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
    nodes: [fw-1, fw-2]

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
    members: [sw-a, sw-b]
    address: 10.99.0.2
  - id: esx-1
    label: esx-1
    group: server-room
  - id: web-1
    label: web-1
    group: server-room
    host: esx-1
  - id: br-rt
    label: br-rt
    type: router
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
    group: server-room
  - endpoints:
      - node: esx-1
      - node: core
    speed: 25G
    segments: [vlan-10]
  - endpoints:
      - node: br-rt
      - node: fw-1
        port: tun0
    connection: branch-ipsec
    virtual: true
  - endpoints:
      - node: br-rt
        port: tun0
      - node: fw-1
        port: tun0
    connection: branch-ipsec
    virtual: true

connections:
  - id: branch-ipsec
    label: Branch IPsec tunnel
``` 

1. **Could not express:** The IPsec tunnel is described as one tunnel with `tun0` on both sides, but the format models a link as an undirected pair of endpoints. I represented it as one link; the duplicated link above is unnecessary and should be omitted. The format also has no field for `vSwitch0`.
2. **Guessed or added:** I used IDs for the VLANs, groups, HA set, connection, and access point; inferred `palo-alto/pa-3220` as the product path; and treated the firewall HA virtual address as belonging to the redundancy set. I also placed the unlocated core management address in `node.address`, since its segment is unknown.
3. **Unclear:** Whether an IPsec tunnel should be represented by one virtual link or multiple links, and how to record a port name when the link endpoint is a tunnel interface.
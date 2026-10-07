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
    nodes:
      - fw-1
      - fw-2

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
    members:
      - sw-a
      - sw-b
    address: 10.99.0.2
    group: server-room
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
  - id: ap-1
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
    connection: ipsec
    virtual: true
```

1. **Could not express:** The description says `web-1` is attached to `vSwitch0` on VLAN 10, but the format has no field for a VM’s virtual-switch attachment or adapter port. Its membership in VLAN 10 and its host are represented.
2. **Guesses or additions:** I used `Company network` as a name, inferred group IDs, and chose IDs for the VLANs, HA set, and IPsec connection. `ap-1` is an invented ID because none was given. Product, type, and connection labels are normalized from the description.
3. **Unclear:** `members` is described as device names, but it is not explicit whether those names should also be node IDs. I treated `sw-a` and `sw-b` as member names only. The format also does not specify how to encode the tunnel’s relationship specifically to `fw-1` beyond its endpoint, or the fact that the branch router connects to the head office firewalls over that tunnel.
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

connections:
  - id: ipsec
    label: IPsec tunnel

segments:
  - id: staff
    label: Staff
    vlan: 10
    prefix: 192.168.1.0/24
    addresses:
      fw-pair: 192.168.1.1
      fw-1: 192.168.1.2
      fw-2: 192.168.1.3
      web-1: 192.168.1.20
  - id: voice
    label: Voice
    vlan: 20

redundancy:
  - id: fw-pair
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
    address: 10.99.0.2
    group: server-room
    members:
      - sw-a
      - sw-b
  - id: esx-1
    label: esx-1
    type: server
    software: VMware ESXi
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
      - staff
      - voice
  - endpoints:
      - node: fw-2
      - node: core
  - endpoints:
      - node: esx-1
      - node: core
    speed: 25G
    segments:
      - staff
  - endpoints:
      - node: br-rt
        port: tun0
      - node: fw-1
        port: tun0
    connection: ipsec
    virtual: true
```

1. **Could not express:** The VM’s attachment specifically to `vSwitch0` is not represented by these types. The tunnel’s IPsec configuration is also not expressible beyond marking it as a virtual link in a connection.
2. **Guessed or added:** I used IDs for the staff/voice segments, groups, connection, and firewall redundancy set. I treated the firewall shared address as belonging to the redundancy set and added generic node types. I named the unconfirmed access point `ap-1`; the description gives no device name. I interpreted “to fw-1” as a tunnel endpoint on fw-1.
3. **Unclear:** The format says a redundancy-set ID may be used as an address owner, but does not explicitly define whether a shared virtual address should be recorded that way. Also, it is unclear whether `members` are identifiers or descriptive names; I used `sw-a` and `sw-b` as member names.
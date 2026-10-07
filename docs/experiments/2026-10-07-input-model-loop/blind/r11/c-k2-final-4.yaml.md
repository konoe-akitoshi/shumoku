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
  - id: vswitch0-vlan10
    label: vSwitch0 VLAN 10

redundancy:
  - id: fw-pair
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
    group: server-room
    members:
      - sw-a
      - sw-b
    address: 10.99.0.2
  - id: esx-1
    label: esx-1
    software: VMware ESXi
    group: server-room
  - id: web-1
    label: web-1
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
    assumed: false
  - endpoints:
      - node: esx-1
      - node: core
    speed: 25G
    segments:
      - staff
  - endpoints:
      - node: web-1
      - segment: vswitch0-vlan10
    virtual: true
  - endpoints:
      - node: br-rt
        port: tun0
      - node: fw-1
        port: tun0
    connection: ipsec
    virtual: true
```

1. **Could not express:** The description does not say which network contains the core switch’s management address, so it is recorded as an unscoped node address. The VM’s attachment is said to be on VLAN 10, but the format does not directly represent a virtual switch or say that this VLAN is the same as the staff segment; I represented it as a separate segment. The tunnel’s far-end port on `fw-1` is specified, but the router’s tunnel endpoint address and any IPsec details are not given.

2. **Guesses or additions:** I used `fw-pair` as the redundancy-set ID and address key for the shared HA address, and `ipsec` as the connection ID. I named the unconfirmed access point `ap-1`. I interpreted the vSwitch attachment as a virtual link to a separate VLAN 10 segment. `VMware ESXi`, the product path `palo-alto/pa-3220`, and the node types for the router and access point make the described software/product/device kinds explicit in the format. The description does not say the `fw-2` cable’s existence is uncertain, so its link is not marked assumed.

3. **Unclear in the format:** `assumed` only permits `true`, so there is no valid way to explicitly state “not assumed”; I omitted it for the confirmed links. The format also does not specify a controlled vocabulary or exact syntax for `product`, `software`, `type`, or segment IDs.
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
      fw-1: 192.168.1.2
      fw-2: 192.168.1.3
      fw-ha: 192.168.1.1
      web-1: 192.168.1.20
      fw-ha: 192.168.1.1
    nodes:
      - esx-1
  - id: vlan-20
    label: Voice
    vlan: 20
  - id: vswitch0-vlan-10
    label: vSwitch0 VLAN 10

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
    type: switch
    group: server-room
    members:
      - sw-a
      - sw-b
    address: 10.99.0.2
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
    virtual: true
```

1. The format cannot express that `vSwitch0` is specifically the virtual switch/adapter through which `web-1` connects to VLAN 10. The VM’s presence in a VLAN can be recorded, but the virtual switch name has no corresponding field. The unspecified network for `core`’s management address is represented by `node.address`.

2. I added IDs and labels for groups, segments, the firewall redundancy set, and the access point. I treated the AP as a single assumed node and placed it on the 2nd floor. I also inferred `type` values for the switch, virtualization host, VM, router, and AP. The VLAN 10 segment’s `nodes` list records `esx-1` as present because its link carries that segment.

3. A link’s `segments` field means it carries exactly the listed segments, while omitting `segments` leaves them unknown. The format does not say whether a segment’s `nodes` list should include nodes already implied by links; I used it only for `esx-1`, whose presence is known but has no direct link specified for its VLAN 10 presence.
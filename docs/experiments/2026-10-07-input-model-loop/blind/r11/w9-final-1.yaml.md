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
  - id: staff-net
    label: Staff
    prefix: 192.168.1.0/24

segments:
  - id: vlan-10
    label: Staff
    vlan: 10
    prefix: 192.168.1.0/24
    addresses:
      fw-pair: 192.168.1.1
      fw-1: 192.168.1.2
      fw-2: 192.168.1.3
      web-1: 192.168.1.20
  - id: vlan-20
    label: Voice
    vlan: 20

redundancy:
  - id: fw-pair
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
    label: Core switch
    group: server-room
    address: 10.99.0.2
    members: [sw-a, sw-b]
  - id: esx-1
    label: esx-1
    type: virtualization-host
    group: server-room
  - id: web-1
    label: web-1
    host: esx-1
    group: server-room
  - id: br-rt
    label: Branch router
    group: branch
  - id: ap-1
    label: Access point
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
    segments: [vlan-10, vlan-20]
  - endpoints:
      - node: fw-2
      - node: core
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
    connection: ipsec
    virtual: true
    assumed: true
```

1. The VM's attachment to `vSwitch0` cannot be represented directly: the format says a VM adapter is not a link, but has no field for the virtual switch name. I represented the VM as a member of VLAN 10 and recorded its address there.
2. The description does not give an access point ID, so I used `ap-1`. It also does not say whether the IPsec tunnel is confirmed; `assumed: true` is therefore a guess and should be removed if the tunnel is known to exist. I treated the tunnel as one connection with a single link, since only one tunnel is described.
3. It is unclear whether `RoutedNetwork` and `Segment` are both intended to describe VLAN 10's network, so I used `staff-net` for the routed network and `vlan-10` for the segment but left the segment's `network` unset. The format also does not define how to record the tunnel's far endpoint when the peer is not identified; I used `fw-1` as described.
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

routingDomains: []

connections:
  - id: ipsec
    label: IPsec tunnel

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

redundancy:
  - id: fw-ha
    label: Firewall HA pair
    nodes: [fw-1, fw-2]

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
    members: [sw-a, sw-b]
  - id: esx-1
    label: esx-1
    type: server
    software: VMware ESXi
    group: server-room
  - id: web-1
    label: web-1
    type: vm
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
    segments: [vlan-10, vlan-20]
  - endpoints:
      - node: fw-2
      - node: core
    segments: []
  - endpoints:
      - node: esx-1
      - node: core
    speed: 25G
    segments: [vlan-10]
  - endpoints:
      - node: web-1
      - segment: vlan-10
    virtual: true
    description: Attached to vSwitch0
  - endpoints:
      - node: br-rt
      - node: fw-1
    connection: ipsec
    assumed: true
    virtual: true
    description: tun0 on both sides
```

1. The description does not specify the tunnel’s speed, segments, or whether it is confirmed, so those details are not represented as known. The AP’s existence is represented as assumed.
2. I used an empty `routingDomains` list to make explicit that none are known; the format permits omitting it. I treated the IPsec tunnel as one logical connection with one link, and interpreted the tunnel as virtual. I used conventional device type and software labels, and inferred that the firewall pair’s shared address belongs to the redundancy set.
3. The format says an omitted `segments` list does not mean a link carries no segments, but it does not define how to express that a link is known to carry none. I used `segments: []` for fw-2’s cable because its VLANs are unknown; that may be ambiguous under the stated rule. The tunnel description names `tun0` on each side, but endpoints have no link-level port field, so I kept that detail in the description.
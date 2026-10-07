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
    group: head-office
    addresses:
      fw-1: 192.168.1.2
      fw-2: 192.168.1.3
      ha-firewalls: 192.168.1.1
      web-1: 192.168.1.20
  - id: vlan-20
    label: Voice
    vlan: 20
    group: head-office
  - id: vswitch0
    label: vSwitch0
    group: server-room

redundancy:
  - id: ha-firewalls
    label: Firewall HA pair
    nodes: [fw-1, fw-2]

connections:
  - id: ipsec-tunnel
    label: IPsec tunnel

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
    address: 10.99.0.2
    members: [sw-a, sw-b]
  - id: esx-1
    label: esx-1
    type: server
    group: server-room
  - id: web-1
    label: web-1
    type: virtual-machine
    group: server-room
    host: esx-1
  - id: br-rt
    label: br-rt
    type: router
    group: branch
  - id: ap-2f
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
    assumed: true
  - endpoints:
      - node: esx-1
      - node: core
    speed: 25G
    segments: [vlan-10]
  - endpoints:
      - node: web-1
      - segment: vswitch0
    segments: [vlan-10]
    virtual: true
  - endpoints:
      - node: br-rt
      - node: fw-1
        port: tun0
    connection: ipsec-tunnel
    virtual: true
```

1. The model cannot express that `tun0` is also the router’s tunnel interface; the endpoint has one optional port field, so I assigned it to fw-1, which the description names as the tunnel peer. It also cannot say that fw-1 and fw-2 share the virtual IP `192.168.1.1` except by recording that address under the redundancy set.
2. I treated VLAN 10 and VLAN 20 as shared segments and placed both at the head office. I represented `vSwitch0` as a segment because the format describes a VM adapter attached to a port group as a node-to-segment link. The description does not specify VLAN 20’s prefix or any address there, so I left them out. I used conventional node types and a lowercase product path.
3. The format says a segment address can be stored under a redundancy set’s ID, but does not explicitly say whether that set must be declared in `redundancy`; this YAML declares it. It is also unclear whether a virtual switch/port group should be represented as a segment or as some other entity.
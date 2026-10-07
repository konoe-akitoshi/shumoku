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
  - id: branch-ipsec
    label: IPsec tunnel

segments:
  - id: staff
    label: Staff
    vlan: 10
    prefix: 192.168.1.0/24
    addresses:
      fw-ha: 192.168.1.1
      fw-1: 192.168.1.2
      fw-2: 192.168.1.3
      web-1: 192.168.1.20
  - id: voice
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
    segments: [staff, voice]
  - endpoints:
      - node: fw-2
      - node: core
  - endpoints:
      - node: esx-1
      - node: core
    speed: 25G
    segments: [staff]
  - endpoints:
      - node: web-1
      - node: esx-1
        port: vSwitch0
    virtual: true
    segments: [staff]
  - endpoints:
      - node: br-rt
        port: tun0
      - node: fw-1
        port: tun0
    connection: branch-ipsec
    virtual: true
```

1. The format has no way to say that `10.99.0.2` is a management address whose network is unknown, while distinguishing it from a general node address. I used `address` for it.
2. I added IDs for the groups, segments, connection, and access point because the format requires IDs for those objects or the description does not provide one. I treated the tunnel as virtual and named its connection `branch-ipsec`; I used `fw-ha` for the shared address key because the schema says shared virtual addresses go under the redundancy set’s ID. The description does not give the access point’s name, so I used `ap-1`.
3. It is unclear whether a link endpoint’s `port` can represent a virtual switch (`vSwitch0`) as well as a physical port. Also, the schema says a shared address belongs under a redundancy set’s ID but types segment addresses as node-keyed; I assumed the set ID can be used as a key.
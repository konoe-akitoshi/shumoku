```yaml
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
    label: staff
    vlan: 10
    prefix: 192.168.1.0/24
    addresses:
      firewall-ha: 192.168.1.1
      fw-1: 192.168.1.2
      fw-2: 192.168.1.3
      web-1: 192.168.1.20
  - id: voice
    label: voice
    vlan: 20

redundancy:
  - id: firewall-ha
    label: Firewall HA pair
    nodes: [fw-1, fw-2]

nodes:
  - id: fw-1
    product: palo-alto/pa-3220
    group: server-room
  - id: fw-2
    product: palo-alto/pa-3220
    group: server-room
  - id: core
    type: switch
    members: [sw-a, sw-b]
    address: 10.99.0.2
    group: server-room
  - id: esx-1
    type: virtualization host
    group: server-room
  - id: vSwitch0
    type: virtual switch
    host: esx-1
    group: server-room
  - id: web-1
    type: VM
    host: esx-1
    group: server-room
  - id: br-rt
    type: router
    group: second-floor
  - id: branch-ap
    type: access point
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
      - node: vSwitch0
    segments: [staff]
    virtual: true
  - endpoints:
      - node: br-rt
        port: tun0
      - node: fw-1
        port: tun0
    description: IPsec tunnel
    virtual: true
```

1. Nothing was inexpressible; IPsec and HA are recorded as descriptive text.
2. Added identifiers for places, segments, the HA pair, and the unnamed access point. Used `palo-alto/pa-3220` as the product path. No additional connectivity was assumed.
3. The format does not specify canonical product spellings or node types; I used descriptive values.
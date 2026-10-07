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
    nodes: [fw-1, fw-2]

nodes:
  - id: fw-1
    type: firewall
    product: paloalto/pa-3220
    group: server-room
  - id: fw-2
    type: firewall
    product: paloalto/pa-3220
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
    type: virtual machine
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

1. Nothing in the description was inexpressible.
2. Added identifiers for unnamed entities, including `branch-ap` and `firewall-ha`. Normalized Palo Alto PA-3220 to `paloalto/pa-3220`; no additional connections or addresses were guessed.
3. The format does not specify canonical vocabulary for `type` or maker names in `product`. Otherwise, it was clear.
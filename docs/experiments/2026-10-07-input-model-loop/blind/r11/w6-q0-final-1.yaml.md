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
  - id: staff-network
    label: Staff
    prefix: 192.168.1.0/24

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
    members:
      - sw-a
      - sw-b
  - id: esx-1
    label: esx-1
    type: virtualization-host
    group: server-room
  - id: web-1
    label: web-1
    type: virtual-machine
    host: esx-1
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
      - node: fw-1
        port: tun0
    virtual: true
    description: IPsec tunnel; tunnel port tun0 is on both devices.
  - endpoints:
      - node: br-rt
        port: tun0
      - node: fw-1
        port: tun0
    virtual: true
    description: IPsec tunnel; tunnel port tun0 is on both devices.
```

1. The format cannot express that the IPsec tunnel endpoint on **both** devices is named `tun0` in a single link: each endpoint has its own port, so that is representable; however the YAML above duplicates the tunnel link because the first entry omits the router port. The second entry is the intended representation. The first tunnel entry should be omitted.
2. I added IDs and labels for unnamed entities (the groups, networks, segments, redundancy set, and assumed access point), plus generic node types and labels. I treated VLAN 10 as belonging to a routed network. The description does not explicitly say which network owns that VLAN, though its prefix suggests the staff network.
3. It is unclear whether the shared HA address should be recorded under the redundancy set ID in `addresses`; I used `fw-ha` for it. The description says the tunnel has `tun0` on both sides, which the endpoint model can represent.
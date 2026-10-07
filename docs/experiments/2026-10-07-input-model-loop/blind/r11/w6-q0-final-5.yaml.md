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
    label: Staff network
    prefix: 192.168.1.0/24

segments:
  - id: vlan-10
    label: Staff
    vlan: 10
    prefix: 192.168.1.0/24
    addresses:
      fw-1: 192.168.1.2
      fw-2: 192.168.1.3
      firewall-ha: 192.168.1.1
      web-1: 192.168.1.20
    nodes:
      - esx-1
    network: staff-network
  - id: vlan-20
    label: Voice
    vlan: 20

redundancy:
  - id: firewall-ha
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
    group: server-room
    address: 10.99.0.2
    members:
      - sw-a
      - sw-b
  - id: esx-1
    label: esx-1
    group: server-room
  - id: web-1
    label: web-1
    host: esx-1
  - id: br-rt
    label: br-rt
    group: branch
  - id: ap
    label: Access point
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

1. The format has no way to express that `web-1` is attached to `vSwitch0`; it can express its host and segment presence, but not its virtual switch attachment.
2. I added IDs for the staff network, VLAN segments, HA redundancy set, and access point because the format requires identifiers or the description did not provide them. I treated the IPsec tunnel as a virtual link and assigned the access point the ID `ap`.
3. It is unclear whether `addresses` can include a redundancy set ID as a key, since its type says keys are node IDs but the comment says shared virtual addresses are written under the set ID.
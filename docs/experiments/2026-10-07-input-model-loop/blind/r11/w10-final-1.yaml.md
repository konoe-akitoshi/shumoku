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
  - id: head-office-staff
    label: Staff network

connections:
  - id: head-office-ipsec
    label: Head office IPsec tunnel

segments:
  - id: vlan-10
    label: Staff
    vlan: 10
    prefix: 192.168.1.0/24
    network: head-office-staff
    group: server-room
    addresses:
      fw-ha: 192.168.1.1
      fw-1: 192.168.1.2
      fw-2: 192.168.1.3
      web-1: 192.168.1.20
  - id: vlan-20
    label: Voice
    vlan: 20
    group: server-room

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
    type: virtualization-host
    group: server-room
  - id: web-1
    label: web-1
    type: virtual-machine
    host: esx-1
    group: server-room
    segments: [vlan-10]
  - id: br-rt
    label: br-rt
    type: router
    group: branch
  - id: ap-2nd-floor
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
    connection: head-office-ipsec
    virtual: true
```

1. The format cannot express that the VM is attached specifically to `vSwitch0`; it can record its host and segment, but not its virtual adapter or switch.
2. I added IDs for the company, groups, VLANs, routed network, IPsec connection, HA set, and unconfirmed AP because the format requires identifiers for those entities. I treated the firewall pair’s shared address as belonging to the redundancy set, and inferred the AP’s group from its stated location.
3. It is unclear whether `Segment.addresses` allows a redundancy-set ID as a key for a single string address, since its comment describes shared virtual addresses but its type permits that shape. It is also unclear how a link’s segments interact with partial knowledge: I listed only the known VLANs for fw-1 and left fw-2’s segments absent, as the format’s opening note directs.
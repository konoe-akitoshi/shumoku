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
  - id: vlan-10-network
    label: VLAN 10 network
    prefix: 192.168.1.0/24

segments:
  - id: vlan-10
    label: Staff
    vlan: 10
    prefix: 192.168.1.0/24
    network: vlan-10-network
    group: server-room
    addresses:
      fw-1: 192.168.1.2
      fw-2: 192.168.1.3
      ha-firewalls: 192.168.1.1
      web-1: 192.168.1.20
    nodes:
      - esx-1
  - id: vlan-20
    label: Voice
    vlan: 20
    group: server-room

redundancy:
  - id: ha-firewalls
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
    label: Core switch
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
    group: server-room
    host: esx-1
  - id: br-rt
    label: Branch router
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
    description: IPsec tunnel
```

1. The description does not specify whether the branch router’s tunnel also connects to fw-2; it says the tunnel is to fw-1, so only that link is recorded.
2. I added IDs and labels for the network, VLAN 10, VLAN 20, HA pair, groups, and access point because the format needs references for them. I treated the stated VLAN 10 prefix as both the segment prefix and its routed network prefix. The VM’s vSwitch0 is not represented because the format has no virtual-switch field; I recorded the VM’s VLAN membership in the segment. The access point is represented as assumed.
3. It is unclear whether the `network` for VLAN 10 should be a separate routed-network object when the description gives only the VLAN and prefix, and whether a node that is listed in a segment’s `nodes` should also be listed in `addresses` when it has no known address there.
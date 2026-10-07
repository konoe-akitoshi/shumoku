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
    label: Head office staff
    prefix: 192.168.1.0/24
  - id: head-office-voice
    label: Head office voice

connections:
  - id: ipsec
    label: IPsec tunnel

segments:
  - id: vlan-10
    label: Staff
    vlan: 10
    prefix: 192.168.1.0/24
    network: head-office-staff
    group: server-room
    addresses:
      fw-1: 192.168.1.2
      fw-2: 192.168.1.3
      ha-firewalls: 192.168.1.1
      web-1: 192.168.1.20
  - id: vlan-20
    label: Voice
    vlan: 20
    network: head-office-voice
    group: server-room

redundancy:
  - id: ha-firewalls
    label: Head office firewalls
    nodes:
      - fw-1
      - fw-2

nodes:
  - id: fw-1
    label: Firewall 1
    type: firewall
    product: palo-alto/pa-3220
    group: server-room
  - id: fw-2
    label: Firewall 2
    type: firewall
    product: palo-alto/pa-3220
    group: server-room
  - id: core
    label: Core switch
    type: switch
    members:
      - sw-a
      - sw-b
    group: server-room
  - id: esx-1
    label: ESXi host
    type: server
    group: server-room
  - id: web-1
    label: Web VM
    type: virtual-machine
    host: esx-1
    group: server-room
  - id: br-rt
    label: Branch router
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
    segments:
      - vlan-10
      - vlan-20
  - endpoints:
      - node: fw-2
      - node: core
    # Segments and ports are unknown.
  - endpoints:
      - node: esx-1
      - node: core
    speed: 25G
    segments:
      - vlan-10
  - endpoints:
      - node: web-1
        port: vSwitch0
      - node: esx-1
    virtual: true
    segments:
      - vlan-10
  - endpoints:
      - node: br-rt
        port: tun0
      - node: fw-1
        port: tun0
    connection: ipsec
    virtual: true
```

1. The core switch’s management address, `10.99.0.2`, has no known segment. The format has no way to associate a node address with an unknown segment: `Node.address` permits only one address and says to use segment addresses when the segment is known. I left that address out.
2. The description does not give IDs for the staff/voice networks, connection, groups, or access point, so I supplied them. I treated the staff network and VLAN 10 as the same routed network, and assigned both head-office links and the VM to the server room. I used `vSwitch0` as the VM link’s port; the description names it as the virtual switch but does not explicitly call it a port.
3. It is unclear how a redundancy set’s shared virtual address is represented in `Segment.addresses`: I used the redundancy ID as the key, as the format describes. The VM’s attachment to `vSwitch0` is also unclear because the format models links between nodes, while `vSwitch0` is described as a virtual switch but not as a separate node.
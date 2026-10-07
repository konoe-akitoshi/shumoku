```yaml
name: company network
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
  - id: ipsec
    label: IPsec tunnel

segments:
  - id: vlan-10
    label: Staff
    vlan: 10
    prefix: 192.168.1.0/24
    group: server-room
    addresses:
      fw-1: 192.168.1.2
      fw-2: 192.168.1.3
      fw-ha: 192.168.1.1
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
    type: virtualization-host
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
    assumed: true
  - endpoints:
      - node: esx-1
      - node: core
    speed: 25G
    segments: [vlan-10]
  - endpoints:
      - node: web-1
      - segment: vlan-10
    virtual: true
  - endpoints:
      - node: br-rt
      - node: fw-1
        port: tun0
    connection: ipsec
    virtual: true
```

1. The description does not specify the IPsec tunnel’s segments, addresses, speed, or the router-side port name, so those are omitted. The format cannot represent `tun0` at both ends of one link: an endpoint can name only its node and optional port, so I recorded it on the firewall end.
2. I used IDs `vlan-10`, `vlan-20`, `fw-ha`, and `ipsec`, and added generic node types and labels to make the entities identifiable. I treated the VM’s attachment to `vSwitch0` as a virtual link from the VM to VLAN 10; the format has no field for the virtual switch name. I treated the access point’s existence as assumed.
3. It is unclear whether `members` should contain actual node IDs for the stack units even though those units are not otherwise described as nodes. It is also unclear how to represent an address shared by a redundancy set alongside each member’s own address; I used the set ID as the address-map key, as the format suggests.
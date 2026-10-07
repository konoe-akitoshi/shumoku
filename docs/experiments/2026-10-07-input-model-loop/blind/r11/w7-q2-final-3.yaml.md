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
    network: staff-network
    group: server-room
    addresses:
      fw-1: 192.168.1.2
      fw-2: 192.168.1.3
      fw-ha: 192.168.1.1
      web-1: 192.168.1.20
  - id: vlan-20
    label: Voice
    vlan: 20
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
    type: virtualization host
    group: server-room
  - id: web-1
    label: web-1
    type: virtual machine
    host: esx-1
  - id: vSwitch0
    label: vSwitch0
    type: virtual switch
    host: esx-1
  - id: br-rt
    label: br-rt
    type: router
    group: branch
  - id: ap
    label: Access point
    type: access point
    group: second-floor
    assumed: true
redundancy:
  - id: fw-ha
    label: Firewall HA pair
    nodes: [fw-1, fw-2]
connections:
  - id: ipsec
    label: IPsec tunnel
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
    connection: ipsec
    virtual: true
```

1. The description does not say which network the core’s management address belongs to, so it remains an unscoped node address. The IPsec tunnel’s routing or carried segments are also unspecified.
2. I used IDs for VLANs, the HA set, and the IPsec connection; assigned the access point the ID `ap`; and used descriptive `type` values for devices. I placed VLAN 10 in the server room because that is where the described devices and link are; the description does not explicitly state its full scope.
3. The format does not have a distinct field for a virtual switch attachment or an adapter port. I represented `vSwitch0` as a node hosted by `esx-1`, while the VLAN 10 segment and address indicate `web-1`’s attachment. It is unclear whether an unlisted link’s `segments` should be interpreted as unknown or absent; per the format note, I left VLANs off the `fw-2` link.
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

connections:
  - id: ipsec-fw1-br-rt
    label: IPsec tunnel to fw-1

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
    members: [sw-a, sw-b]
    address: 10.99.0.2
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
    label: br-rt
    type: router
    group: branch
  - id: access-point
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
    assumed: false
  - endpoints:
      - node: esx-1
      - node: core
    speed: 25G
    segments: [vlan-10]
  - endpoints:
      - node: web-1
        port: vSwitch0
      - node: vlan-10
    virtual: true
  - endpoints:
      - node: br-rt
        port: tun0
      - node: fw-1
        port: tun0
    connection: ipsec-fw1-br-rt
    virtual: true
```

1. The format cannot state that the tunnel is specifically IPsec; the connection label records that detail. It also cannot directly express that fw-2’s link is known to exist while its VLANs and ports are unknown.
2. I treated the VM’s attachment to VLAN 10 as a virtual link from the VM to the segment and used `vSwitch0` as its port. I left the fw-2 link’s segments and ports unspecified. The AP’s assumed status is represented as true.
3. It is unclear whether `virtual` applies to the tunnel link, since it is not a cable but the type comment gives a VPN tunnel as an example. It is also unclear how to represent a link known to exist when its attributes are unknown: omitting `assumed` seems to leave existence unspecified, while `assumed: false` is outside the type (`assumed?: true`).
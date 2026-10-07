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

routingDomains:
  - id: head-office-lan
    label: Head office LAN

connections:
  - id: ipsec
    label: IPsec tunnel

segments:
  - id: vlan-10
    label: Staff
    vlan: 10
    prefix: 192.168.1.0/24
    routingDomain: head-office-lan
    group: server-room
    addresses:
      fw-ha: 192.168.1.1
      fw-1: 192.168.1.2
      fw-2: 192.168.1.3
      web-1: 192.168.1.20
  - id: vlan-20
    label: Voice
    vlan: 20
    routingDomain: head-office-lan
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
    segments: [vlan-20]
  - id: fw-2
    label: fw-2
    type: firewall
    product: palo-alto/pa-3220
    group: server-room
    segments: [vlan-20]
  - id: core
    label: core
    type: switch
    members: [sw-a, sw-b]
    address: 10.99.0.2
    group: server-room
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
      - node: web-1
        port: vSwitch0
      - node: esx-1
    segments: [vlan-10]
  - endpoints:
      - node: br-rt
      - node: fw-1
        port: tun0
    connection: ipsec
    virtual: true
    assumed: true
  - endpoints:
      - node: br-rt
        port: tun0
      - node: fw-1
        port: tun0
    connection: ipsec
    virtual: true
    assumed: true
```

1. The description does not specify how the branch router reaches the head-office firewalls physically or over the public network, or whether the branch router’s tunnel connects to fw-1 alone or to both firewalls as a pair. The AP’s own identifier is also unspecified.
2. I treated VLAN 10 as belonging to a single head-office routing domain, inferred from the shared subnet. I used `fw-ha` as the key for the shared virtual address. I added `vlan-20` to each firewall’s known segments because the fw-1 cable carries it and the fw-2 cable’s VLANs are unknown. I represented the tunnel as a single link to fw-1; the duplicate link above is accidental and should be disregarded. 
3. The format describes a connection as a logical grouping of links but does not say how to represent a tunnel known as one end-to-end connection when only one tunnel endpoint’s port is specified. `assumed` on a link is documented as uncertainty about the connection’s existence, so it is unclear whether it can express uncertainty about the link’s details instead.
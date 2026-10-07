```yaml
name: Company Network
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
  - id: staff-domain
    label: Staff routing domain

connections:
  - id: ipsec
    label: IPsec tunnel

segments:
  - id: vlan10
    label: Staff
    vlan: 10
    prefix: 192.168.1.0/24
    routingDomain: staff-domain
    group: server-room
    addresses:
      fw-ha: 192.168.1.1
      fw-1: 192.168.1.2
      fw-2: 192.168.1.3
      web-1: 192.168.1.20
  - id: vlan20
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
    type: switch
    group: server-room
    address: 10.99.0.2
    members: [sw-a, sw-b]
  - id: esx-1
    type: virtualization-host
    group: server-room
  - id: web-1
    type: virtual-machine
    host: esx-1
    group: server-room
  - id: br-rt
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
    segments: [vlan10, vlan20]
  - endpoints:
      - node: fw-2
      - node: core
  - endpoints:
      - node: esx-1
      - node: core
    speed: 25G
    segments: [vlan10]
  - endpoints:
      - node: br-rt
        port: tun0
      - node: fw-1
        port: tun0
    connection: ipsec
    virtual: true
```

1. The description does not say how the branch router’s tunnel relates to VLANs or other segments, so that relationship is not expressed. It also does not specify a segment for the core’s management address; the address is recorded on the node.

2. I added IDs for the groups, routing domain, segments, connection, and the access point, and used descriptive `type` values. I treated the staff VLAN as belonging to a routing domain because it has an IP subnet, and placed both VLANs in the server room. The description does not explicitly say the firewall HA pair is assumed, so I left it unmarked. I represented the VM’s attachment through VLAN 10 without a separate link, as the format describes.

3. It is unclear whether the IPsec tunnel should be represented as one virtual link or as two links for its two endpoints; the description mentions `tun0` on both sides and says the connection can comprise multiple links. The format also does not define a standard vocabulary for `type` or `product`.
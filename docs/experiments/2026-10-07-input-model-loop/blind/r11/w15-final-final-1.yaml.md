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

connections:
  - id: ipsec
    label: IPsec tunnel

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
    software: vSwitch0
    host: esx-1
    group: server-room
  - id: br-rt
    label: br-rt
    type: router
    group: branch
  - id: ap-1
    label: Access point
    type: access-point
    assumed: true
    group: second-floor

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
    description: VLANs carried are unknown
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
    assumed: true
```

1. The description doesn’t say which routing domain the VLANs belong to, so none is declared. It also doesn’t specify a segment or port for the core’s management address; the format permits that address to be written on the node.
2. I assigned the assumed access point the ID `ap-1`, and used `vSwitch0` as the VM’s `software` value because the format has no field for the VM’s virtual switch attachment. The tunnel’s `assumed: true` reflects that the router’s tunnel connects to the firewalls, but the description names only fw-1 as its peer.
3. The format says a logical connection can consist of several links, but it is unclear whether `connection` should be used for a single tunnel link. It is also unclear how to represent a VM’s attachment to a virtual switch on a VLAN without inventing a link or treating the switch as a node.
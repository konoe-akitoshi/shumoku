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
    product: palo-alto/pa-3220
    group: server-room
  - id: fw-2
    label: fw-2
    product: palo-alto/pa-3220
    group: server-room
  - id: core
    label: core
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
  - id: ap
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
  - endpoints:
      - node: esx-1
      - node: core
    speed: 25G
    segments: [vlan-10]
  - endpoints:
      - node: esx-1
        port: vSwitch0
      - node: web-1
    segments: [vlan-10]
    virtual: true
  - endpoints:
      - node: br-rt
        port: tun0
      - node: fw-1
        port: tun0
    connection: branch-ipsec
    virtual: true

connections:
  - id: branch-ipsec
    label: Branch IPsec tunnel
```


1. The description does not specify the branch tunnel’s routing domain, addressing, or which segments it carries, so those are omitted. It also does not specify a link from the access point, so none is included.

2. I added generic `type` values for the virtualization host, VM, router, and access point, and labels for some objects. I treated the IPsec tunnel as a virtual link and represented the two firewall nodes’ shared address under their redundancy set ID.

3. The format does not say whether a connection’s `id` should identify the tunnel or a broader logical connection; I used `branch-ipsec` for the tunnel. It also does not define how to represent that the VM is attached through `vSwitch0` while on the same VLAN, so I modeled that as a virtual link.
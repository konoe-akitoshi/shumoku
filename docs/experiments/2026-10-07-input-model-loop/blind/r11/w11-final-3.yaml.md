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
    group: server-room
    addresses:
      firewall-ha: 192.168.1.1
      fw-1: 192.168.1.2
      fw-2: 192.168.1.3
      web-1: 192.168.1.20
  - id: vlan-20
    label: Voice
    vlan: 20

redundancy:
  - id: firewall-ha
    label: Firewall HA pair
    nodes: [fw-1, fw-2]

nodes:
  - id: fw-1
    label: fw-1
    type: firewall
    product: paloalto/pa-3220
    group: server-room
    members: []
  - id: fw-2
    label: fw-2
    type: firewall
    product: paloalto/pa-3220
    group: server-room
  - id: core
    label: core
    type: switch
    group: server-room
    address: 10.99.0.2
    members: [sw-a, sw-b]
  - id: esx-1
    label: esx-1
    type: server
    software: ESXi
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
      - node: br-rt
      - node: fw-1
        port: tun0
    connection: ipsec
    virtual: true
    assumed: true
```

1. The VM’s `vSwitch0` attachment is not directly expressible: the format says a VM is listed in its segment and explicitly says not to model a VM’s network adapter as a link.
2. I used identifiers `vlan-10`, `vlan-20`, `firewall-ha`, `ipsec`, and `ap`; inferred generic node types; and set the tunnel link `assumed: true` because its ports are described but the branch router’s tunnel endpoint is not explicitly stated. I left `fw-2`’s link without `segments` to preserve the unknown VLAN membership.
3. The description says the tunnel uses `tun0` “on both sides, to fw-1,” but `Endpoint` has only a node and optional port, so the two `tun0` ports cannot both be recorded unambiguously alongside the destination detail. Also, `members` appears to list device names, so I omitted it for the core rather than adding an empty list for fw-1.
```yaml
name: company

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
    product: paloalto/pa-3220
    group: server-room
  - id: fw-2
    label: fw-2
    type: firewall
    product: paloalto/pa-3220
    group: server-room
  - id: core
    label: core
    type: switch
    group: server-room
    members: [sw-a, sw-b]
    address: 10.99.0.2
  - id: esx-1
    label: esx-1
    type: server
    software: VMware ESXi
    group: server-room
  - id: web-1
    label: web-1
    type: vm
    host: esx-1
    group: server-room
  - id: br-rt
    label: br-rt
    type: router
    group: branch
  - id: ap
    label: access point
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
      - segment: vlan-10
    virtual: true
  - endpoints:
      - node: br-rt
        port: tun0
      - node: fw-1
        port: tun0
    virtual: true
    connection: ipsec
    description: IPsec tunnel
```

1. The address `10.99.0.2` is expressible as a node address, but its network/segment is unknown, so it cannot be placed in a segment. The AP’s existence is unconfirmed; its location is expressed as the 2nd floor.
2. I used conventional node types, the software label `VMware ESXi`, product path `paloalto/pa-3220`, and identifier `ipsec` for the tunnel connection. I treated `vSwitch0` as the VM’s virtual attachment to VLAN 10; the format has no field for naming that virtual switch. I left the branch firewall-side tunnel endpoint unspecified because the description says the tunnel connects to the head-office firewalls but specifically says it is “to fw-1”; the link records fw-1.
3. The format does not say whether `members` should be used for stack unit names when those names are known, or how to represent a VM adapter attached to a named virtual switch. It also does not specify a dedicated field for tunnel names such as `tun0` when one interface name applies to both ends.
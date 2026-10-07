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
  - id: staff
    label: Staff
    vlan: 10
    prefix: 192.168.1.0/24
    addresses:
      fw-1: 192.168.1.2
      fw-2: 192.168.1.3
      ha-firewalls: 192.168.1.1
      web-1: 192.168.1.20
  - id: voice
    label: Voice
    vlan: 20
  - id: vSwitch0-vlan-10
    label: vSwitch0 VLAN 10
    vlan: 10

redundancy:
  - id: ha-firewalls
    label: Firewall HA pair
    nodes: [fw-1, fw-2]

connections:
  - id: ipsec
    label: IPsec tunnel

nodes:
  - id: fw-1
    label: fw-1
    product: paloalto/pa-3220
    group: server-room
  - id: fw-2
    label: fw-2
    product: paloalto/pa-3220
    group: server-room
  - id: core
    label: core
    members: [sw-a, sw-b]
    address: 10.99.0.2
    group: server-room
  - id: esx-1
    label: esx-1
    software: vmware-esxi
    group: server-room
  - id: web-1
    label: web-1
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
    segments: [staff, voice]
  - endpoints:
      - node: fw-2
      - node: core
    # Segments and ports are unknown.
  - endpoints:
      - node: esx-1
      - node: core
    speed: 25G
    segments: [staff]
  - endpoints:
      - node: web-1
      - segment: vSwitch0-vlan-10
    virtual: true
    segments: [staff]
  - endpoints:
      - node: br-rt
      - node: fw-1
    connection: ipsec
    virtual: true
    assumed: true
    description: IPsec tunnel; tun0 on both sides
```

1. The format cannot represent the IPsec tunnel’s interface name (`tun0`) separately for each endpoint. It also cannot say which physical port on the core the cables use, or explicitly model the virtual switch as a distinct device/interface.
2. I treated `vSwitch0 VLAN 10` as a segment distinct from staff VLAN 10, because the description identifies the VM’s attachment there but does not explicitly say whether that virtual network is the same segment as the physical staff VLAN. I connected the VM to it and also listed its address in staff, as stated. I marked the IPsec tunnel assumed because the endpoint wording does not explicitly say whether it is confirmed; the AP is explicitly assumed.
3. It is unclear whether `Link.assumed` applies to the whole IPsec connection or whether it should be omitted when the tunnel is stated as existing. It is also unclear how to represent a link’s unknown segment membership in YAML: I omitted `segments` on fw-2’s link, consistent with the note that absence means unknown.
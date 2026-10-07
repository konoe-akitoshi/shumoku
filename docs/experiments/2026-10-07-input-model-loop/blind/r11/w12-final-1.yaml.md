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
      ha-firewalls: 192.168.1.1
      web-1: 192.168.1.20
  - id: vlan-20
    label: Voice
    vlan: 20

redundancy:
  - id: ha-firewalls
    label: Firewall HA pair
    nodes: [fw-1, fw-2]

connections:
  - id: ipsec-tunnel
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
  - id: access-point
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
      - node: fw-1
        port: tun0
      - node: br-rt
        port: tun0
    connection: ipsec-tunnel
    virtual: true
```

1. The format cannot express that `vSwitch0` is the VM’s virtual switch or that the VM’s VLAN 10 attachment is through it; it records the VM’s segment membership and host.
2. I used the id `ha-firewalls` for the shared address key and set the product path to `paloalto/pa-3220`. The description doesn’t specify IDs or product-path spelling.
3. It is unclear whether the tunnel’s `connection` should represent the whole IPsec tunnel or an aggregate of separate tunnel links. The description gives one tunnel and names `tun0` at each end, so I represented it as one virtual link.
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
    nodes:
      - fw-1
      - fw-2
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
    address: 10.99.0.2
    members:
      - sw-a
      - sw-b
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
    segments:
      - vlan-10
      - vlan-20
  - endpoints:
      - node: fw-2
      - node: core
  - endpoints:
      - node: esx-1
      - node: core
    speed: 25G
    segments:
      - vlan-10
  - endpoints:
      - node: web-1
        port: vSwitch0
      - node: esx-1
    virtual: true
    segments:
      - vlan-10
  - endpoints:
      - node: br-rt
        port: tun0
      - node: fw-1
        port: tun0
    connection: ipsec-tunnel
    virtual: true
connections:
  - id: ipsec-tunnel
    label: IPsec tunnel
```

1. The format cannot express that the firewalls share the virtual address specifically on VLAN 10 while also listing it under the redundancy set; addresses under a segment are keyed by node or redundancy-set ID, so this is represented under `firewall-ha` in VLAN 10.
2. I used conventional type names (`firewall`, `switch`, `server`, `vm`, `router`, `access-point`), a product path `paloalto/pa-3220`, and `VMware ESXi` as software. I named the IPsec connection `ipsec-tunnel`. I treated the named vSwitch as the VM link’s endpoint port.
3. It is unclear whether the `virtual` link flag is intended for the IPsec tunnel, since it says a link is virtual when it is not a cable and gives VPN tunnels as an example.
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
    nodes:
      - fw-1
      - fw-2

connections:
  - id: ipsec
    label: IPsec tunnel to head office

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
    members:
      - sw-a
      - sw-b
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
      - segment: vlan-10
    virtual: true
  - endpoints:
      - node: br-rt
        port: tun0
      - node: fw-1
        port: tun0
    connection: ipsec
    virtual: true
```

1. The core’s stack members are represented by names, but their individual identities or links cannot be described separately from the core. The web VM’s attachment to `vSwitch0` is not expressible as a port group or virtual switch because the format has no such entity. The AP’s location is represented, but no more specific floor/building hierarchy is given.

2. I used conventional product and type identifiers (`paloalto/pa-3220`, `firewall`, `virtualization-host`, `virtual-machine`, `access-point`) because the format leaves these as free-form strings. I named the HA set `fw-ha`, the VLAN segments `vlan-10` and `vlan-20`, and the tunnel connection `ipsec`. I treated the tunnel as a virtual link and used `tun0` as the port at both ends. I placed `web-1` in the server room based on its host being there.

3. The format does not define how to encode a shared redundancy address in `Segment.addresses`; I used the redundancy ID as the address-map key. It is also unclear whether a member of a redundancy set should be allowed to be a link endpoint, so I connected the tunnel directly to `fw-1` as specified.
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
      fw-ha: 192.168.1.1
      fw-1: 192.168.1.2
      fw-2: 192.168.1.3
      web-1: 192.168.1.20
  - id: vlan-20
    label: Voice
    vlan: 20

connections:
  - id: ipsec
    label: IPsec tunnel

redundancy:
  - id: fw-ha
    label: Firewall HA pair
    nodes:
      - fw-1
      - fw-2

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
    group: server-room
    address: 10.99.0.2
    members:
      - sw-a
      - sw-b
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
      - node: esx-1
    segments:
      - vlan-10
      - vSwitch0
  - endpoints:
      - node: br-rt
      - node: fw-1
        port: tun0
    virtual: true
    connection: ipsec
    assumed: true
  - endpoints:
      - node: br-rt
        port: tun0
      - node: fw-1
        port: tun0
    virtual: true
    connection: ipsec
```

1. The format cannot express the VM’s attachment to the named virtual switch `vSwitch0` directly. I represented it as a segment, though the description only says it is a virtual switch on VLAN 10.
2. I added the network name, node types, labels, and group assignments to make the YAML usable. I treated `10.99.0.2` as an address whose segment is unknown. I also added an IPsec connection and marked it virtual. The AP’s existence is unconfirmed, so it is marked assumed.
3. The tunnel wording says the router connects to the firewalls over an IPsec tunnel, with `tun0` on both sides, “to fw-1.” It is unclear whether there is one tunnel to fw-1 or a tunnel to each firewall. I modeled one link to fw-1; the first tunnel link is an accidental duplicate and should be disregarded.
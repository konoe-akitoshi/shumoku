```yaml
name: company network
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
      fw-1: 192.168.1.2
      fw-2: 192.168.1.3
      firewall-ha: 192.168.1.1
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
    product: palo-alto/pa-3220
    group: server-room
  - id: fw-2
    label: fw-2
    type: firewall
    product: palo-alto/pa-3220
    group: server-room
  - id: core
    label: Core switch
    type: switch
    group: server-room
    members:
      - sw-a
      - sw-b
    address: 10.99.0.2
  - id: esx-1
    label: esx-1
    type: hypervisor
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
  - id: ap-1
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
    assumed: true
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
      - node: fw-1
    connection: branch-ipsec
    virtual: true
    description: IPsec tunnel; tun0 on both sides
  - endpoints:
      - node: fw-1
        port: tun0
      - node: br-rt
        port: tun0
    connection: branch-ipsec
    virtual: true
```

1. The format has no field to say that `vSwitch0` is the virtual switch the VM is attached to; the VM’s segment attachment is expressible.
2. I added IDs for the two VLAN segments, the firewall redundancy set, the VPN connection, and the access point because the description did not provide IDs for those entities. I treated the IPsec tunnel as a virtual link. The second firewall cable is marked assumed because its existence is stated but its details are unknown.
3. It is unclear whether an IPsec tunnel should be one link with endpoint ports `tun0`, or whether the named interface is enough to represent the tunnel. The YAML includes both a portless link and a `tun0` link, which may duplicate the connection.
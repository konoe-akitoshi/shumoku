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

networks:
  - id: staff-net
    label: Staff network
    prefix: 192.168.1.0/24

segments:
  - id: vlan-10
    label: Staff
    vlan: 10
    prefix: 192.168.1.0/24
    network: staff-net
    group: server-room
    addresses:
      fw-ha: 192.168.1.1
      fw-1: 192.168.1.2
      fw-2: 192.168.1.3
      web-1: 192.168.1.20

  - id: vlan-20
    label: Voice
    vlan: 20
    group: server-room

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
    label: Core switch
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
    label: Branch router
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
      - node: br-rt
        port: tun0
      - node: fw-1
        port: tun0
    virtual: true
    assumed: true
```

1. The description does not specify the branch router’s group more precisely than “Branch,” or any branch network/subnet details. It also does not specify a link or segment for the access point.
2. I represented the unnamed shared firewall address using the redundancy set ID `fw-ha`, as the format allows. I treated the IPsec tunnel as a virtual link and marked it assumed because the format has no separate confirmation field for a link; the description says the router connects over the tunnel but does not explicitly state whether it is confirmed. I used descriptive `type` values for the devices where the format leaves `type` open-ended.
3. The description says the VM is attached to `vSwitch0` on VLAN 10, but the format has no way to represent a virtual switch adapter or its port. I represented the VM’s presence in VLAN 10 with its address and host instead. The format does not clarify whether a link’s `assumed` flag applies to the link itself or the connection it belongs to, nor how to record tunnel endpoints when the tunnel name is only known at each end.
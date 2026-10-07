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
nodes:
  - id: fw-1
    label: fw-1
    type: firewall
    product: palo-alto/pa-3220
    software: PAN-OS
    group: server-room
  - id: fw-2
    label: fw-2
    type: firewall
    product: palo-alto/pa-3220
    software: PAN-OS
    group: server-room
  - id: fw-ha
    label: Firewall HA virtual address
    type: virtual-address
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
    type: server
    software: VMware ESXi
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
redundancy:
  - id: fw-ha
    label: Firewall HA pair
    nodes:
      - fw-1
      - fw-2
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
      - node: segment
        segment: vlan-10
    virtual: true
  - endpoints:
      - node: br-rt
        port: tun0
      - node: fw-1
        port: tun0
    connection: branch-vpn
    virtual: true
connections:
  - id: branch-vpn
    label: IPsec tunnel
```


1. The format cannot express that the HA virtual address is shared specifically by fw-1 and fw-2: `addresses` allows a redundancy set’s ID, but the redundancy set here is named `fw-ha` while also used as the virtual-address node ID. It also cannot clearly express that the branch tunnel terminates at fw-1 as one side of an IPsec tunnel when the other endpoint details are unknown.
2. I guessed `PAN-OS`, VMware ESXi, device types, group IDs, the AP ID, the HA virtual-address node, and that `vSwitch0` is the VM’s endpoint port. I modeled the tunnel as one virtual link and the HA address as a separate node.
3. The format says a virtual address may be written under the redundancy set’s ID, but does not say whether that ID must also identify a node. The `NodeEnd.port` description says “port,” while the VM description names a virtual switch attachment; it is unclear whether `vSwitch0` belongs there.
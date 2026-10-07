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
    group: server-room
    addresses:
      fw-1: 192.168.1.2
      fw-2: 192.168.1.3
      fw-ha: 192.168.1.1
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
    address: 10.99.0.2
    group: server-room
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
    host: esx-1
    group: server-room
  - id: br-rt
    label: br-rt
    type: router
    group: branch
  - id: ap-1
    label: Access point
    type: access-point
    group: second-floor
    assumed: true

connections:
  - id: ipsec
    label: IPsec tunnel

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

1. The format cannot say which firewall is active, or record that the shared HA address is used by the pair beyond associating it with the redundancy set.
2. I represented the unconfirmed access point as `ap-1`, since the format requires an ID. I used conventional node types and product path spelling (`palo-alto/pa-3220`), and treated the IPsec tunnel as a virtual connection. The web VM’s adapter attachment is represented as a virtual link to VLAN 10.
3. It is unclear whether `members` should list actual node IDs or merely device names; I used the unit names as given. The format also does not make explicit that an endpoint-to-segment link means the node is attached to the segment through an adapter.
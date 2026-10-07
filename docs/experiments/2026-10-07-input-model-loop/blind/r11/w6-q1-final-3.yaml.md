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

networks:
  - id: head-office-lan
  - id: branch-lan

connections:
  - id: ipsec
    label: IPsec tunnel

segments:
  - id: vlan-10
    label: Staff
    vlan: 10
    prefix: 192.168.1.0/24
    network: head-office-lan
    group: server-room
    addresses:
      firewall-ha: 192.168.1.1
      fw-1: 192.168.1.2
      fw-2: 192.168.1.3
      web-1: 192.168.1.20
  - id: vlan-20
    label: Voice
    vlan: 20
    network: head-office-lan
    group: server-room

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
    group: server-room
    host: esx-1
  - id: br-rt
    label: br-rt
    type: router
    network: branch-lan
    group: branch
  - id: ap
    label: Access point
    type: access-point
    group: second-floor
    assumed: true

redundancy:
  - id: firewall-ha
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
      - node: esx-1
    segments:
      - vlan-10
    virtual: true
  - endpoints:
      - node: br-rt
        port: tun0
      - node: fw-1
        port: tun0
    connection: ipsec
    virtual: true
```

1. The core switch’s management address network is unknown, so it is represented as a node-level address with no segment.
2. I introduced IDs and labels for the routed networks, segments, connection, redundancy set, and access point. I also assigned `head-office-lan` to the head-office VLANs and `branch-lan` to the branch router; the description does not specify those network IDs or the branch LAN’s details.
3. The description says the firewalls share `192.168.1.1`, but the format does not specify how to represent a shared virtual address. I used the redundancy set ID as the address key, as the format describes. The description also doesn’t say whether `vSwitch0` is the VM’s port or the virtual switch’s name; I used it as the VM endpoint port.
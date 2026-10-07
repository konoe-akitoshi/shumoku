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

networks:
  - id: staff-network
    prefix: 192.168.1.0/24

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

nodes:
  - id: fw-1
    label: fw-1
    product: palo-alto/pa-3220
    group: server-room
    network: staff-network

  - id: fw-2
    label: fw-2
    product: palo-alto/pa-3220
    group: server-room
    network: staff-network

  - id: fw-ha
    label: Firewall HA pair
    network: staff-network

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
    group: server-room

  - id: web-1
    label: web-1
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
      - node: br-rt
        port: tun0
      - node: fw-1
        port: tun0
    virtual: true
```

1. The description does not say which VLANs, if any, the fw-2 cable carries, so its link has no `segments`.
2. I added identifiers and labels for the HA pair, VLANs, networks, groups, and access point. I treated “2nd floor” as a place within the branch and assigned the firewall pair to the staff routed network based on their staff-network addresses. I left the core’s address segment and routed network unspecified.
3. The format does not clearly say how to represent the connection from a VM to its virtual switch; I represented the VM’s VLAN membership through `vlan-10` and its host through `host: esx-1`. The format also has no explicit way to say the firewalls share the HA virtual address other than using the redundancy set ID as the address key, which I used.
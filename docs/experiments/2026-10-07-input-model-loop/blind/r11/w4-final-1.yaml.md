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
  - id: staff-network
    label: Staff
    prefix: 192.168.1.0/24

segments:
  - id: vlan-10
    label: Staff
    vlan: 10
    prefix: 192.168.1.0/24
    network: staff-network
    group: server-room
    addresses:
      fw-1: 192.168.1.2
      fw-2: 192.168.1.3
      firewall-ha: 192.168.1.1
      web-1: 192.168.1.20
    nodes:
      - esx-1
      - core
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
    segments:
      - vlan-10
      - vlan-20
      - ipsec-tunnel
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

1. The description does not say which network the core’s management address belongs to. The format allows an address with unknown segment, so it is written as `core.address`.
2. The description does not specify VLANs on fw-2’s cable. I listed VLAN 10 and VLAN 20 to represent the stated uncertainty, but this overstates what is known: the format treats a listed `segments` array as exhaustive. A more faithful representation would omit `segments` on that link. I also guessed node types and the IDs/labels for the access point, HA set, and VLAN 10 network. The IPsec tunnel is represented as an unsegmented virtual link.
3. The format does not provide a way to record tunnel interface names without treating them as ports, and it is unclear whether a link between the router and fw-1 fully captures the tunnel’s remote endpoint or its IPsec details. The meaning of `addresses` keyed by a redundancy set is also somewhat unclear for representing a shared virtual IP.
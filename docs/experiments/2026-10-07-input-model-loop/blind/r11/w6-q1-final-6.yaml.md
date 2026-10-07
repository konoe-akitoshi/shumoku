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
  - id: head-office-lan

connections:
  - id: ipsec
    label: IPsec tunnel

segments:
  - id: staff
    label: Staff
    vlan: 10
    prefix: 192.168.1.0/24
    network: head-office-lan
    group: server-room
    addresses:
      fw-1: 192.168.1.2
      fw-2: 192.168.1.3
      ha-firewalls: 192.168.1.1
      web-1: 192.168.1.20
  - id: voice
    label: Voice
    vlan: 20
    network: head-office-lan
    group: server-room

redundancy:
  - id: ha-firewalls
    label: Firewall HA pair
    nodes: [fw-1, fw-2]

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
    members: [sw-a, sw-b]
  - id: esx-1
    label: esx-1
    type: server
    software: VMware ESXi
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

links:
  - endpoints:
      - node: fw-1
        port: ethernet1/1
      - node: core
    speed: 10G
    segments: [staff, voice]
    assumed: true
  - endpoints:
      - node: fw-2
      - node: core
    assumed: true
  - endpoints:
      - node: esx-1
      - node: core
    speed: 25G
    segments: [staff]
  - endpoints:
      - node: web-1
        port: vSwitch0
      - node: esx-1
    segments: [staff]
    virtual: true
  - endpoints:
      - node: br-rt
        port: tun0
      - node: fw-1
        port: tun0
    connection: ipsec
    virtual: true
```

1. **Could not express:** The IPsec tunnel’s far-end details, such as tunnel addressing or remote networks, are not given. The description also does not say which interface on `fw-1` faces the tunnel beyond calling both tunnel interfaces `tun0`.
2. **Guesses or additions:** I used `head-office-lan` as the routed network for the staff and voice segments, inferred `VMware ESXi` as the host software, and supplied IDs/types for the access point and organizational groups. I marked the fw-1 cable as assumed because the format has no separate way to mark only the VLAN membership as uncertain; `assumed` applies to the link itself. The fw-2 link is marked assumed because its VLANs and ports are unknown, although the description says the connection exists.
3. **Unclear in the format:** It says `assumed` marks a connection believed to exist but unconfirmed, but it is unclear how to represent a confirmed link whose properties (such as carried segments) are unknown. The distinction between a `Connection` and an individual virtual `Link` is also not fully specified for a single IPsec tunnel.
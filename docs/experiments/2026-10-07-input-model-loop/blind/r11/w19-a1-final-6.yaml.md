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
      ha-firewalls: 192.168.1.1
      web-1: 192.168.1.20

  - id: vlan-20
    label: Voice
    vlan: 20

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
    label: access point
    type: access-point
    group: second-floor
    assumed: true

redundancy:
  - id: ha-firewalls
    label: Firewall HA pair
    nodes:
      - fw-1
      - fw-2

connections:
  - id: ipsec-fw1-tun0-br-rt-tun0
    label: IPsec tunnel to branch

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
        port: tun0
      - node: fw-1
        port: tun0
    connection: ipsec-fw1-tun0-br-rt-tun0
    virtual: true
```

1. **Could not express:** The IPsec tunnel’s remote endpoint details, other than the stated `tun0` ports and that it connects `br-rt` to `fw-1`.
2. **Guesses/additions:** I used `company network` as the name; chose IDs and labels for VLANs, places, the HA set, and the tunnel; assigned broad node types; and used `ap-1` as an ID for the unconfirmed access point. The second firewall link is marked assumed because its existence is stated but its VLANs and ports are unknown.
3. **Unclear:** Whether `members` should list the names `sw-a` and `sw-b` as written or distinct node IDs; whether the virtual switch `vSwitch0` should be represented as a node; and whether a confirmed link with unknown VLANs should omit `segments` (as done here) or use another convention.
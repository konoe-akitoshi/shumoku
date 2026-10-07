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
      fw-pair: 192.168.1.1
      fw-1: 192.168.1.2
      fw-2: 192.168.1.3
      web-1: 192.168.1.20
  - id: vlan-20
    label: Voice
    vlan: 20
    group: server-room

redundancy:
  - id: fw-pair
    label: Firewall HA pair
    nodes: [fw-1, fw-2]

connections:
  - id: ipsec
    label: IPsec tunnel

nodes:
  - id: fw-1
    label: fw-1
    product: palo-alto/pa-3220
    group: server-room
  - id: fw-2
    label: fw-2
    product: palo-alto/pa-3220
    group: server-room
  - id: core
    label: core
    members: [sw-a, sw-b]
    address: 10.99.0.2
    group: server-room
  - id: esx-1
    label: esx-1
    group: server-room
  - id: web-1
    label: web-1
    host: esx-1
    group: server-room
  - id: br-rt
    label: br-rt
    group: branch
  - id: ap
    label: Access point
    assumed: true
    group: second-floor

links:
  - endpoints:
      - node: fw-1
        port: ethernet1/1
      - node: core
    speed: 10G
    segments: [vlan-10, vlan-20]
  - endpoints:
      - node: fw-2
      - node: core
  - endpoints:
      - node: esx-1
      - node: core
    speed: 25G
    segments: [vlan-10]
  - endpoints:
      - node: br-rt
        port: tun0
      - node: fw-1
        port: tun0
    connection: ipsec
    virtual: true
```

1. **Could not express:** `vSwitch0` is not represented directly. The VM’s VLAN 10 attachment is captured by placing `web-1` in that segment. The description does not give a connection from the branch router to fw-2, so none is included.
2. **Guessed or added:** I used `Company network` as the network name, `ap` as an ID for the access point, and IDs such as `vlan-10`, `vlan-20`, and `ipsec`. I treated the firewall pair’s shared address as belonging to the redundancy set, as the format describes. I placed the VLANs in the server room based on the surrounding description.
3. **Unclear:** The format says a node’s `address` is for an address whose segment is unknown, but does not specify how to represent its address when the segment is known and the node has no link into that segment. I used `segments` for the access point’s existence only through `assumed`; no network attachment was stated.
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
  - id: staff
    label: Staff
    vlan: 10
    prefix: 192.168.1.0/24
    addresses:
      firewall-ha: 192.168.1.1
      fw-1: 192.168.1.2
      fw-2: 192.168.1.3
      web-1: 192.168.1.20
  - id: voice
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
    product: palo-alto/pa-3220
    group: server-room
  - id: fw-2
    label: fw-2
    product: palo-alto/pa-3220
    group: server-room
  - id: core
    label: Core switch
    group: server-room
    members:
      - sw-a
      - sw-b
    address: 10.99.0.2
  - id: esx-1
    label: esx-1
    group: server-room
  - id: web-1
    label: web-1
    host: esx-1
    group: server-room
  - id: br-rt
    label: Branch router
    group: branch
  - id: ap-1
    label: Access point
    group: second-floor
    assumed: true

links:
  - endpoints:
      - node: fw-1
        port: ethernet1/1
      - node: core
    speed: 10G
    segments:
      - staff
      - voice
  - endpoints:
      - node: fw-2
      - node: core
    assumed: true
  - endpoints:
      - node: esx-1
      - node: core
    speed: 25G
    segments:
      - staff
  - endpoints:
      - node: web-1
      - segment: staff
    virtual: true
    description: Attached to vSwitch0
  - endpoints:
      - node: br-rt
      - node: fw-1
        port: tun0
    connection: head-office-ipsec
    virtual: true
    description: IPsec tunnel; br-rt uses tun0
connections:
  - id: head-office-ipsec
    label: Head office IPsec tunnel
```

1. The format cannot express that the firewall pair shares the virtual address `192.168.1.1` while also assigning individual addresses to both firewalls. The address entry under the redundancy set records the shared address, but the format does not specify that it is virtual beyond the redundancy relationship.
2. I added the name `Company network`, the IDs `firewall-ha`, `head-office-ipsec`, and `ap-1`, and labels for clarity. I treated the branch router’s tunnel endpoint as `tun0` and the firewall endpoint as `tun0`, following “tun0 on both sides.” I represented the VM’s VLAN attachment as a virtual link from the VM to the segment; the description does not specify a port or a direct physical cable for that attachment.
3. It is unclear how to represent a shared virtual address alongside per-node addresses: `addresses` allows a redundancy-set ID as a key, but does not explicitly state how that address relates to the set. Also, `virtual` is described as applying to a connection, while it appears on `Link`; it is unclear whether it marks the individual link or the logical connection.
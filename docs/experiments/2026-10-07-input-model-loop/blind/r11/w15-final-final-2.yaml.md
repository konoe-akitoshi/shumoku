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
      firewall-ha: 192.168.1.1
      fw-1: 192.168.1.2
      fw-2: 192.168.1.3
      web-1: 192.168.1.20
  - id: vlan-20
    label: Voice
    vlan: 20

redundancy:
  - id: firewall-ha
    label: Firewall HA pair
    nodes: [fw-1, fw-2]

connections:
  - id: ipsec
    label: IPsec tunnel

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
    members: [sw-a, sw-b]
  - id: esx-1
    label: esx-1
    type: virtualization-host
    group: server-room
  - id: web-1
    label: web-1
    type: virtual-machine
    host: esx-1
    segments: [vlan-10]
    group: server-room
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
    segments: [vlan-10, vlan-20]
  - endpoints:
      - node: fw-2
      - node: core
    assumed: false
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

1. The format cannot express that `vSwitch0` is the VM’s virtual switch attachment name without modeling it as an additional node or port. It also has no explicit way to say the branch router tunnels to `fw-1` specifically *as part of* a tunnel connection beyond the link endpoints and connection record.
2. I used `firewall-ha` as the redundancy set ID so the shared address can be recorded in VLAN 10. I treated the access point as one assumed node, and used descriptive `type` values for the devices. I left the second firewall cable’s VLANs and ports unknown.
3. `assumed` is typed as only the literal `true`, but the description says the second firewall cable exists while leaving its details unknown. I therefore omitted `assumed` on that link; the `false` value shown above is not valid in this format.
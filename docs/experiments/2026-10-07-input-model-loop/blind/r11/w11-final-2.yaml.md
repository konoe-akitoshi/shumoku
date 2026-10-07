```yaml
name: Company network

routingDomains:
  - id: head-office
    label: Head office
  - id: branch
    label: Branch

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
    routingDomain: head-office
    group: server-room
    addresses:
      fw-ha: 192.168.1.1
      fw-1: 192.168.1.2
      fw-2: 192.168.1.3
      web-1: 192.168.1.20
  - id: vlan-20
    label: Voice
    vlan: 20
    routingDomain: head-office
    group: server-room

nodes:
  - id: fw-1
    label: fw-1
    type: firewall
    product: palo-alto/pa-3220
    group: server-room
    routingDomain: head-office
  - id: fw-2
    label: fw-2
    type: firewall
    product: palo-alto/pa-3220
    group: server-room
    routingDomain: head-office
  - id: core
    label: core
    type: switch
    group: server-room
    routingDomain: head-office
    address: 10.99.0.2
    members:
      - sw-a
      - sw-b
  - id: esx-1
    label: esx-1
    type: server
    software: VMware ESXi
    group: server-room
    routingDomain: head-office
  - id: web-1
    label: web-1
    type: virtual-machine
    host: esx-1
    group: server-room
    routingDomain: head-office
  - id: br-rt
    label: br-rt
    type: router
    group: branch
    routingDomain: branch
  - id: ap-1
    label: Access point
    type: access-point
    group: second-floor
    routingDomain: branch
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
    routingDomain: head-office
  - endpoints:
      - node: fw-2
      - node: core
    routingDomain: head-office
  - endpoints:
      - node: esx-1
      - node: core
    speed: 25G
    segments:
      - vlan-10
    routingDomain: head-office
  - endpoints:
      - node: br-rt
        port: tun0
      - node: fw-1
        port: tun0
    virtual: true
    connection: ipsec-head-office
    routingDomain: branch
  - endpoints:
      - node: fw-1
      - node: fw-2
    segments:
      - vlan-10
    routingDomain: head-office

connections:
  - id: ipsec-head-office
    label: IPsec tunnel
``` 

1. The format has no explicit way to say that `vSwitch0` is the VM’s virtual switch or adapter; I represented the VM’s VLAN membership through the segment address, as the description says a VM adapter is not a link. The tunnel’s remote endpoint/address details are also not given, so they cannot be recorded.
2. I added routing domains for head office and branch, placed the tunnel in the branch domain, and inferred a firewall-to-firewall VLAN 10 link to represent the shared HA address on that segment. The format does not define a `routingDomain` field on `Link`, so those link fields are guesses that do not conform to the supplied types. I also assigned general node types and `VMware ESXi` software, and named the assumed access point `ap-1`.
3. It is unclear how to represent an HA virtual address in `Segment.addresses`: the type says a redundancy set ID can be used as the key, so I used `fw-ha`. It is also unclear whether a link must explicitly list VLANs when its segment membership is unknown; I left the fw-2 link’s list absent to preserve that uncertainty.
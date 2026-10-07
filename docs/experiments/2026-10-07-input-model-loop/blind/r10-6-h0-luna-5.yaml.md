```yaml
name: Company network
nodes:
  - id: rt-1
    label: rt-1
    product: yamaha/rtx3510
    group: server-room
  - id: hv-1
    label: hv-1
    product: dell/poweredge/r750
    software: vmware-esxi
    group: server-room
  - id: hv-2
    label: hv-2
    product: dell/poweredge/r750
    software: vmware-esxi
    group: server-room
  - id: prod
    label: prod
    type: redundancy-set
  - id: fw-v
    label: fw-v
    product: palo-alto-networks/vm-series
    host: hv-1
    group: server-room
  - id: app-1
    label: app-1
    software: ubuntu
    host: prod
    group: server-room
  - id: main
    label: main
    type: vpc
    prefix: 10.0.0.0/16
  - id: igw-1
    label: igw-1
    type: internet-gateway
  - id: tgw-1
    label: tgw-1
    type: transit-gateway
  - id: vpn-1
    label: Site-to-Site VPN
    type: vpn
  - id: web-c
    label: web-c
    product: aws/ec2/t3.medium
    software: amazon-linux
  - id: db-c
    label: db-c
    product: aws/rds/mysql
groups:
  - id: server-room
    label: Server room
  - id: ap-northeast-1a
    label: ap-northeast-1a
  - id: ap-northeast-1c
    label: ap-northeast-1c
redundancy:
  - id: prod
    label: prod
    nodes:
      - hv-1
      - hv-2
segments:
  - id: vlan-10
    label: VLAN 10
    vlan: 10
    prefix: 192.168.10.0/24
    group: server-room
    addresses:
      fw-v:
        - 192.168.10.2
      app-1:
        - 192.168.10.20
  - id: sub-a
    label: sub-a
    prefix: 10.0.1.0/24
    group: ap-northeast-1a
    addresses:
      web-c:
        - 10.0.1.10
      main:
        - []
  - id: sub-c
    label: sub-c
    prefix: 10.0.2.0/24
    group: ap-northeast-1c
    addresses:
      db-c:
        - 10.0.2.20
      main:
        - []
links:
  - endpoints:
      - node: hv-1
      - node: rt-1
    speed: 10G
    segments:
      - vlan-10
  - endpoints:
      - node: hv-2
      - node: rt-1
    speed: 10G
    segments:
      - vlan-10
  - endpoints:
      - node: igw-1
      - node: main
  - endpoints:
      - node: tgw-1
      - node: main
  - endpoints:
      - node: rt-1
      - node: vpn-1
    virtual: true
    description: IPsec tunnel 1
  - endpoints:
      - node: vpn-1
      - node: tgw-1
    virtual: true
    description: IPsec tunnel 1
  - endpoints:
      - node: rt-1
      - node: vpn-1
    virtual: true
    description: IPsec tunnel 2
  - endpoints:
      - node: vpn-1
      - node: tgw-1
    virtual: true
    description: IPsec tunnel 2
```

1. **Could not express:** The Transit Gateway attachment specifically uses both sub-a and sub-c. The format has no field for attachment membership. It also cannot represent that each subnet is in the VPC as a containment relationship; I used the VPC as a node with an address entry in each subnet to indicate its routing presence.
2. **Guessed or added:** I used `server-room` as a group ID, and represented the unnamed Site-to-Site VPN connection as a `vpn-1` node. I treated each IPsec tunnel as two virtual links through that node because the format models links between nodes. I used conventional product/software path strings and node type labels where the description gave product names but the format does not define a vocabulary.
3. **Unclear:** The format says a VPC or virtual network that routes between cloud subnets is written as a node in each subnet, but does not specify how to distinguish that presence from an address assignment. The meaning of `segments` on a link is also unclear for VPN tunnels: it is not stated whether tunnels should name the networks they connect or carry.
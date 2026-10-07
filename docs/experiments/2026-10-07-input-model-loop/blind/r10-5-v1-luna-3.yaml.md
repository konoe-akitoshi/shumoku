```yaml
name: Company network
groups:
  - id: server-room
    label: Server room
  - id: ap-northeast-1a
    label: ap-northeast-1a
  - id: ap-northeast-1c
    label: ap-northeast-1c

segments:
  - id: vlan-10
    label: VLAN 10
    vlan: 10
    prefix: 192.168.10.0/24
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
  - id: sub-c
    label: sub-c
    prefix: 10.0.2.0/24
    group: ap-northeast-1c
    addresses:
      db-c:
        - 10.0.2.20

redundancy:
  - id: prod
    label: prod
    nodes:
      - hv-1
      - hv-2

nodes:
  - id: rt-1
    label: rt-1
    type: router
    product: yamaha/rtx3510
    group: server-room
  - id: hv-1
    label: hv-1
    type: server
    product: dell/poweredge/r750
    software: VMware ESXi
    group: server-room
  - id: hv-2
    label: hv-2
    type: server
    product: dell/poweredge/r750
    software: VMware ESXi
    group: server-room
  - id: fw-v
    label: fw-v
    type: firewall
    product: palo-alto-networks/vm-series
    host: hv-1
    group: server-room
  - id: app-1
    label: app-1
    type: virtual-machine
    software: Ubuntu
    host: prod
    group: server-room
  - id: main
    label: main
    type: vpc
    prefix: 10.0.0.0/16
  - id: web-c
    label: web-c
    type: ec2-instance
    product: aws/ec2/t3.medium
    software: Amazon Linux
    host: main
  - id: db-c
    label: db-c
    type: rds-database
    product: aws/rds/mysql
    host: main
  - id: igw-1
    label: igw-1
    type: internet-gateway
  - id: tgw-1
    label: tgw-1
    type: transit-gateway
  - id: vpn-1
    label: Site-to-Site VPN
    type: vpn-connection
    virtual: true

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
    virtual: true
  - endpoints:
      - node: tgw-1
      - node: main
    segments:
      - sub-a
      - sub-c
  - endpoints:
      - node: rt-1
      - node: tgw-1
    virtual: true
    description: Site-to-Site VPN IPsec tunnel 1
  - endpoints:
      - node: rt-1
      - node: tgw-1
    virtual: true
    description: Site-to-Site VPN IPsec tunnel 2
```

1. The format cannot explicitly represent that the VPN tunnels are made of IPsec, beyond describing them in text. The VPC’s routing relationships and subnet-to-VPC membership are also not explicit in the types; the subnet links to the VPC are used to convey membership.
2. The description does not give identifiers for the two VPN tunnels, so I represented them as parallel links with descriptions. I used conventional product paths and generic node types for products and services. I treated the internet gateway attachment and Transit Gateway attachment as virtual links; the format does not explicitly define attachment semantics.
3. It is unclear whether a VPC should be linked to its subnets, and whether cloud gateway attachments should be represented as virtual links, segment membership, or both. The address list supports node addresses, but it is unclear whether it is intended to list only explicitly known addresses or all addresses on a segment.
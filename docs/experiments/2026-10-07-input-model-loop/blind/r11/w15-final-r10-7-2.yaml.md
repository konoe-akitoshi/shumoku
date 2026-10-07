```yaml
name: Company network
groups:
  - id: server-room
    label: Server room
  - id: ap-northeast-1a
    label: ap-northeast-1a
  - id: ap-northeast-1c
    label: ap-northeast-1c

routingDomains:
  - id: guest
    label: guest
  - id: main
    label: main
  - id: vpc-main
    label: VPC main
    prefix: 10.0.0.0/16

connections:
  - id: site-to-site-vpn
    label: Site-to-Site VPN

segments:
  - id: vlan-20
    label: VLAN 20
    vlan: 20
    prefix: 192.168.20.0/24
    routingDomain: guest
    group: server-room
    addresses:
      ap-1: 192.168.20.5
  - id: vlan-10
    label: VLAN 10
    vlan: 10
    prefix: 192.168.10.0/24
    group: server-room
    addresses:
      fw-v: 192.168.10.2
      app-1: 192.168.10.20
  - id: sub-a
    label: sub-a
    prefix: 10.0.1.0/24
    routingDomain: vpc-main
    group: ap-northeast-1a
    addresses:
      web-c: 10.0.1.10
  - id: sub-c
    label: sub-c
    prefix: 10.0.2.0/24
    routingDomain: vpc-main
    group: ap-northeast-1c
    addresses:
      db-c: 10.0.2.20

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
  - id: ap-1
    label: ap-1
    type: access-point
    group: server-room
    segments:
      - vlan-20
  - id: hv-1
    label: hv-1
    type: server
    product: dell/poweredge/r750
    software: vmware/esxi
    group: server-room
  - id: hv-2
    label: hv-2
    type: server
    product: dell/poweredge/r750
    software: vmware/esxi
    group: server-room
  - id: fw-v
    label: fw-v
    type: firewall
    product: palo-alto-networks/vm-series
    host: hv-1
    group: server-room
  - id: app-1
    label: app-1
    type: vm
    software: ubuntu
    host: prod
    group: server-room
  - id: web-c
    label: web-c
    type: ec2
    product: aws/ec2/t3.medium
    software: amazon-linux
    routingDomain: vpc-main
    group: ap-northeast-1a
  - id: db-c
    label: db-c
    type: database
    product: aws/rds/mysql
    routingDomain: vpc-main
    group: ap-northeast-1c
  - id: igw-1
    label: igw-1
    type: internet-gateway
    routingDomain: vpc-main
  - id: tgw-1
    label: tgw-1
    type: transit-gateway
    routingDomain: vpc-main

links:
  - endpoints:
      - node: ap-1
      - node: rt-1
        port: lan2
    segments:
      - vlan-20
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
      - node: web-c
  - endpoints:
      - node: tgw-1
      - node: web-c
  - endpoints:
      - node: tgw-1
      - node: db-c
  - endpoints:
      - node: rt-1
      - node: tgw-1
    connection: site-to-site-vpn
    virtual: true
    assumed: true
  - endpoints:
      - node: rt-1
      - node: tgw-1
    connection: site-to-site-vpn
    virtual: true
    assumed: true
```

1. The format has no direct way to express that the VPC attachment uses specifically sub-a and sub-c, or to distinguish the VPC attachment links from other links between those nodes. The VPN's two IPsec tunnels are represented as two links, but their individual tunnel details are not described.

2. I treated the server room and availability zones as groups. I guessed `assumed: true` for the VPN tunnel links because the format has no way to show two distinct links with the same endpoints as a known connection while preserving the stated “two tunnels” detail without implying separate tunnel endpoints. I also modeled AWS subnet connectivity as links from the Transit Gateway to the instances and the Internet Gateway to web-c; those links were not stated. The VPC attachment and routing relationships do not map cleanly to physical links in this format.

3. It is unclear how to represent cloud routing and attachment relationships that are not ordinary links, and whether product paths such as `aws/ec2/t3.medium` should use provider names as makers.
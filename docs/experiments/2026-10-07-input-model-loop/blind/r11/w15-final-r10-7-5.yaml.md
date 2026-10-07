```yaml
name: Company network
description: On-premises server room and AWS in the Tokyo region

routingDomains:
  - id: guest
    label: Guest VRF

groups:
  - id: server-room
    label: Server room
  - id: prod
    label: vSphere HA cluster prod
  - id: ap-northeast-1a
    label: ap-northeast-1a
  - id: ap-northeast-1c
    label: ap-northeast-1c

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
    routingDomain: main
    group: ap-northeast-1a
    addresses:
      web-c: 10.0.1.10
  - id: sub-c
    label: sub-c
    prefix: 10.0.2.0/24
    routingDomain: main
    group: ap-northeast-1c
    addresses:
      db-c: 10.0.2.20

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
  - id: hv-1
    label: hv-1
    product: dell/poweredge-r750
    software: vmware/esxi
    group: server-room
  - id: hv-2
    label: hv-2
    product: dell/poweredge-r750
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
    type: server
    software: ubuntu
    host: prod
    group: server-room
  - id: igw-1
    label: igw-1
    type: internet-gateway
    routingDomain: main
  - id: tgw-1
    label: tgw-1
    type: transit-gateway
    routingDomain: main
  - id: web-c
    label: web-c
    type: ec2-instance
    product: amazon/ec2/t3.medium
    software: amazon-linux
    routingDomain: main
  - id: db-c
    label: db-c
    type: rds-database
    product: amazon/rds/mysql
    routingDomain: main

redundancy:
  - id: prod
    label: vSphere HA cluster prod
    nodes:
      - hv-1
      - hv-2

links:
  - endpoints:
      - node: rt-1
        port: lan2
      - node: ap-1
    segments:
      - vlan-20
  - endpoints:
      - node: rt-1
      - node: hv-1
    speed: 10G
    segments:
      - vlan-10
  - endpoints:
      - node: rt-1
      - node: hv-2
    speed: 10G
    segments:
      - vlan-10
  - endpoints:
      - node: tgw-1
      - node: web-c
    segments:
      - sub-a
  - endpoints:
      - node: tgw-1
      - node: db-c
    segments:
      - sub-c
  - endpoints:
      - node: igw-1
      - node: tgw-1
    routingDomain: main
  - endpoints:
      - node: rt-1
      - node: tgw-1
    connection: site-to-site-vpn
    virtual: true
  - endpoints:
      - node: rt-1
      - node: tgw-1
    connection: site-to-site-vpn
    virtual: true
```

1. **Could not express:** The VPC’s `10.0.0.0/16` range, since the format has no address prefix field on a routing domain. It also cannot express that tgw-1 attaches to the VPC *through* both subnets, or that the link from rt-1 to tgw-1 is made of specifically two IPsec tunnels. The two VPN links and their shared connection capture the count and grouping, but not the tunnel protocol.
2. **Guesses/additions:** I treated `main` as an AWS routing domain because the VPC is named `main`; used it for the AWS nodes and subnets. I represented the subnets and VLANs as segments and the availability zones and server room as groups. The two VPN tunnels are separate virtual links. The links between tgw-1 and the instances are a simplified way to show subnet membership; the description does not state those direct connections. Product paths, node types, and software values are normalized labels inferred from product names.
3. **Unclear:** The types say `routingDomain` is valid on nodes and segments, but not links. I therefore left the VPN links without one. It is also unclear how to represent a routing domain’s overall prefix or relationships such as a gateway’s attachment to a routing domain without a segment.
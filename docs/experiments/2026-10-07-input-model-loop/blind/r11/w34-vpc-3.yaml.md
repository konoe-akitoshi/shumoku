```yaml
name: Company network
description: On-premises server room and AWS Tokyo region
groups:
  - id: server-room
    label: Server room
  - id: ap-northeast-1a
    label: ap-northeast-1a
  - id: ap-northeast-1c
    label: ap-northeast-1c
routingDomains:
  - id: main
    label: VPC main
    prefix: 10.0.0.0/16
connections:
  - id: site-to-site-vpn
    label: Site-to-Site VPN
segments:
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
  - id: hv-1
    label: hv-1
    type: server
    product: dell/poweredge-r750
    software: VMware ESXi
    group: server-room
  - id: hv-2
    label: hv-2
    type: server
    product: dell/poweredge-r750
    software: VMware ESXi
    group: server-room
  - id: fw-v
    label: fw-v
    type: firewall
    product: palo-alto-networks/vm-series
    software: PAN-OS
    host: hv-1
    group: server-room
  - id: app-1
    label: app-1
    type: server
    software: Ubuntu
    host: prod
    group: server-room
  - id: web-c
    label: web-c
    type: instance
    product: aws/ec2/t3.medium
    software: Amazon Linux
    routingDomain: main
  - id: db-c
    label: db-c
    type: database
    product: aws/rds/mysql
    routingDomain: main
  - id: igw-1
    label: igw-1
    type: internet-gateway
    product: aws/internet-gateway
    routingDomain: main
  - id: tgw-1
    label: tgw-1
    type: transit-gateway
    product: aws/transit-gateway
    routingDomain: main
redundancy:
  - id: prod
    label: prod
    nodes:
      - hv-1
      - hv-2
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
      - node: fw-v
      - segment: vlan-10
    virtual: true
  - endpoints:
      - node: app-1
      - segment: vlan-10
    virtual: true
  - endpoints:
      - node: igw-1
      - routingDomain: main
    virtual: true
  - endpoints:
      - node: tgw-1
      - segment: sub-a
    virtual: true
  - endpoints:
      - node: tgw-1
      - segment: sub-c
    virtual: true
  - endpoints:
      - node: rt-1
      - node: tgw-1
    connection: site-to-site-vpn
    virtual: true
    description: IPsec tunnel 1
  - endpoints:
      - node: rt-1
      - node: tgw-1
    connection: site-to-site-vpn
    virtual: true
    description: IPsec tunnel 2
  - endpoints:
      - node: app-1
      - node: web-c
    assumed: true
```

1. The format cannot directly express that web-c is in sub-a and db-c is in sub-c as node-to-segment membership except through their addresses in the segment. It also cannot express that the VPC attachment uses both subnets as a single attachment; I represented it as two links.

2. I inferred group entries for the server room and availability zones, and assigned the AWS nodes to the VPC routing domain. I treated VMware adapter connections and AWS gateway/Transit Gateway attachments as virtual links. I added an assumed link between app-1 and web-c to represent a possible connection; the description does not state that they are connected, so that link should be omitted. I also supplied conventional node types and product paths, and guessed PAN-OS as the firewall software.

3. `host` accepts a string that may name a redundancy set, but it is unclear whether `host: prod` means the VM runs on an unspecified member of that set. The format also does not clearly distinguish AWS attachment links from ordinary segment connections.
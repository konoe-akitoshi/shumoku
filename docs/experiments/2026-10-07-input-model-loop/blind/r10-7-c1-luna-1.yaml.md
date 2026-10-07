```yaml
name: Company network
description: On-premises server room connected to AWS in the Tokyo region.

groups:
  - id: server-room
    label: Server room
  - id: ap-northeast-1
    label: AWS Tokyo region
  - id: ap-northeast-1a
    label: Availability zone ap-northeast-1a
    parent: ap-northeast-1
  - id: ap-northeast-1c
    label: Availability zone ap-northeast-1c
    parent: ap-northeast-1

segments:
  - id: vlan-20
    label: VLAN 20
    vlan: 20
    prefix: 192.168.20.0/24
    group: server-room
    addresses:
      ap-1:
        - 192.168.20.5
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
  - id: sub-c
    label: sub-c
    prefix: 10.0.2.0/24
    group: ap-northeast-1c
    addresses:
      db-c:
        - 10.0.2.20

nodes:
  - id: rt-1
    label: rt-1
    type: router
    product: yamaha/rtx3510
    description: Keeps a main routing table and a separate VRF named guest.
    group: server-room

  - id: ap-1
    label: ap-1
    type: access-point
    group: server-room

  - id: hv-1
    label: hv-1
    type: server
    product: dell/poweredge-r750
    software: vmware/esxi
    group: server-room

  - id: hv-2
    label: hv-2
    type: server
    product: dell/poweredge-r750
    software: vmware/esxi
    group: server-room

  - id: prod
    label: prod
    type: cluster
    description: vSphere HA cluster
    members:
      - hv-1
      - hv-2
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
    software: ubuntu
    host: prod
    group: server-room

  - id: main
    label: main
    type: vpc
    prefix: 10.0.0.0/16
    group: ap-northeast-1

  - id: web-c
    label: web-c
    type: ec2-instance
    product: aws/ec2/t3.medium
    software: amazon-linux
    group: ap-northeast-1a

  - id: db-c
    label: db-c
    type: database
    product: aws/rds/mysql
    group: ap-northeast-1c

  - id: igw-1
    label: igw-1
    type: internet-gateway
    group: ap-northeast-1

  - id: tgw-1
    label: tgw-1
    type: transit-gateway
    group: ap-northeast-1

links:
  - endpoints:
      - node: rt-1
        port: lan2
      - node: ap-1
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
      - node: main

  - endpoints:
      - node: tgw-1
      - node: main

  - endpoints:
      - node: main
      - node: sub-a

  - endpoints:
      - node: main
      - node: sub-c

  - endpoints:
      - node: rt-1
      - node: tgw-1
    virtual: true
    description: Site-to-Site VPN with two IPsec tunnels.
    assumed: true

(1) **Could not express:** The fact that VLAN 20 belongs to the `guest` VRF, since the format has no VRF concept. The Transit Gateway attachment being specifically through both subnets is represented as links from the VPC to each subnet, but the format does not distinguish attachment details from general connectivity.

(2) **Guesses or additions:** I represented the prod cluster as a node with `hv-1` and `hv-2` as members so `host: prod` can capture that `app-1` runs on an unknown cluster member. I inferred product path spellings, node types, labels, and group structure from the descriptions. I marked the VPN link `assumed: true` because the tunnel count is specified but there is no way to represent two distinct tunnels without inventing endpoints or another construct. I also used a generic `database` type for db-c.

(3) **Unclear:** Whether `members` is intended to model a cluster’s constituent devices or only devices a node stands in for when their links cannot be distinguished. The exact representation of multiple VPN tunnels between the same endpoints is also unclear, as is how to express a virtual network such as a VPC routing between subnet segments.
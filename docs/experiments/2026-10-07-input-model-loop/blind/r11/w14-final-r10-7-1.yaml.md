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
  - id: guest
    label: guest
  - id: main
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

redundancy:
  - id: prod
    label: prod
    nodes:
      - hv-1
      - hv-2

nodes:
  - id: rt-1
    label: rt-1
    product: yamaha/rtx3510
    group: server-room

  - id: ap-1
    label: ap-1
    group: server-room
    segments:
      - vlan-20

  - id: hv-1
    label: hv-1
    product: dell/poweredge-r750
    software: vmware-esxi
    group: server-room

  - id: hv-2
    label: hv-2
    product: dell/poweredge-r750
    software: vmware-esxi
    group: server-room

  - id: fw-v
    label: fw-v
    product: palo-alto-networks/vm-series
    software: PAN-OS
    host: hv-1
    group: server-room

  - id: app-1
    label: app-1
    software: ubuntu
    host: prod
    group: server-room

  - id: web-c
    label: web-c
    type: EC2 instance
    product: aws/ec2/t3.medium
    software: Amazon Linux
    routingDomain: main
    segments:
      - sub-a

  - id: db-c
    label: db-c
    type: RDS database
    product: aws/rds/mysql
    routingDomain: main
    segments:
      - sub-c

  - id: igw-1
    label: igw-1
    type: internet gateway
    routingDomain: main

  - id: tgw-1
    label: tgw-1
    type: Transit Gateway
    routingDomain: main

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
      - node: main
    virtual: true

  - endpoints:
      - node: tgw-1
      - node: sub-a
    virtual: true

  - endpoints:
      - node: tgw-1
      - node: sub-c
    virtual: true

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

1. **Could not express:** The description says rt-1 has a main routing table as well as a separate `guest` VRF, but the format has no field for a node’s routing tables. It also does not say which routing domain the on-premises VLAN 10 belongs to, so I left that unspecified. The port group used by each VM is represented by VLAN 10 membership, not by a separate port-group object.

2. **Guesses or additions:** I treated “the prod cluster” as redundancy set `prod`, and used its ID as `app-1`’s host because the format allows a redundancy-set ID there. I represented the AWS availability zones as groups and the VPC attachment as virtual links to subnet segments. I modeled the two VPN tunnels as duplicate links and marked them `assumed: true` because the description says a VPN connection exists but does not explicitly say the tunnels are confirmed. The product paths, software names, and node types are normalized labels inferred from the descriptions.

3. **Unclear in the format:** `host` says a node “runs on” another node, while a redundancy-set ID can stand for an unknown host; it is unclear how broadly that convention applies to clusters. The format also does not specify how to represent cloud attachments such as an internet gateway attached to a VPC, or a VPN connection whose tunnel endpoints are given but whose link-level details are not.
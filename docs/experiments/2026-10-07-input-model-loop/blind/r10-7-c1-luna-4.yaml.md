```yaml
name: On-premises and AWS network
description: Company network with an on-premises server room and AWS in the Tokyo region

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
  - id: vlan-20
    label: VLAN 20 (guest VRF)
    vlan: 20
    prefix: 192.168.20.0/24
    group: server-room
    addresses:
      ap-1:
        - 192.168.20.5
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
    label: vSphere HA cluster prod
    nodes:
      - hv-1
      - hv-2

nodes:
  - id: rt-1
    label: rt-1
    type: router
    product: yamaha/rtx3510
    group: server-room
    description: Keeps a separate VRF named guest in addition to its main routing table.
  - id: ap-1
    label: ap-1
    type: access-point
    group: server-room
  - id: hv-1
    label: hv-1
    type: server
    product: dell/poweredge-r750
    software: vmware-esxi
    group: server-room
  - id: hv-2
    label: hv-2
    type: server
    product: dell/poweredge-r750
    software: vmware-esxi
    group: server-room
  - id: fw-v
    label: fw-v
    type: firewall
    product: palo-alto-networks/vm-series
    software: palo-alto-networks
    group: server-room
    host: hv-1
  - id: app-1
    label: app-1
    type: virtual-machine
    software: ubuntu
    group: server-room
    host: prod
  - id: main
    label: main
    type: vpc
    prefix: 10.0.0.0/16
    group: ap-northeast-1
  - id: web-c
    label: web-c
    type: ec2-instance
    product: amazon/ec2/t3.medium
    software: amazon-linux
    group: ap-northeast-1a
  - id: db-c
    label: db-c
    type: database
    product: amazon/rds/mysql
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
      - node: main
      - node: igw-1
  - endpoints:
      - node: main
      - node: tgw-1
  - endpoints:
      - node: tgw-1
      - node: sub-a
  - endpoints:
      - node: tgw-1
      - node: sub-c
  - endpoints:
      - node: rt-1
      - node: tgw-1
    description: Site-to-Site VPN connection, composed of two IPsec tunnels.
    virtual: true
```

1. **Could not express:** The data gives `guest` as a VRF on `rt-1`, but the format has no explicit VRF or routing-table concept. The VPN is described as two tunnels, but the format cannot represent that those two tunnels form one connection, so I recorded one virtual link and noted the tunnel count in its description.
2. **Guesses or additions:** I used product paths such as `amazon/ec2/t3.medium` and `amazon/rds/mysql`, and software value `palo-alto-networks`; the description does not specify the exact product-path convention or firewall software name. I treated each named subnet as a node so the Transit Gateway attachment can be shown as links to `sub-a` and `sub-c`. The description does not identify which AWS subnet contains the RDS address beyond saying it is in `sub-c`, nor whether the VPC-to-gateway and attachment links carry specific segments.
3. **Unclear in the format:** It is unclear how links to a segment should be modeled when the link endpoint is itself a segment, and whether a named subnet should be represented as both a segment and a node. It is also unclear how to distinguish one VPN connection containing multiple tunnels from multiple independent virtual links.
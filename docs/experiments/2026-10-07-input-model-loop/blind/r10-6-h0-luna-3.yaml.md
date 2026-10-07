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

redundancy:
  - id: prod
    label: prod
    nodes:
      - hv-1
      - hv-2

nodes:
  - id: rt-1
    type: router
    product: yamaha/rtx3510
    group: server-room
  - id: hv-1
    type: server
    product: dell/poweredge-r750
    software: vmware-esxi
    group: server-room
  - id: hv-2
    type: server
    product: dell/poweredge-r750
    software: vmware-esxi
    group: server-room
  - id: fw-v
    type: firewall
    product: palo-alto-networks/vm-series
    software: pan-os
    group: server-room
    host: hv-1
  - id: app-1
    type: vm
    software: ubuntu
    group: server-room
    host: prod
  - id: main
    type: vpc
    prefix: 10.0.0.0/16
    group: ap-northeast-1
  - id: igw-1
    type: internet-gateway
    host: main
    group: ap-northeast-1
  - id: tgw-1
    type: transit-gateway
    group: ap-northeast-1
  - id: web-c
    type: ec2
    product: amazon/ec2/t3.medium
    software: amazon-linux
    group: ap-northeast-1a
    host: main
  - id: db-c
    type: rds
    product: amazon/rds/mysql
    group: ap-northeast-1c
    host: main

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
    description: Site-to-Site VPN tunnel 1
    virtual: true
  - endpoints:
      - node: rt-1
      - node: tgw-1
    description: Site-to-Site VPN tunnel 2
    virtual: true
```

1. **Could not express:** The VPN’s two IPsec tunnels, EC2/RDS service details, VMware port groups, and the attachment of the Transit Gateway to the VPC through both subnets are represented only approximately; the format has no dedicated fields for these concepts. The two VPN links are shown as virtual links. The tunnel protocol itself is not separately modeled.

2. **Guessed or added:** I assigned the server-room VLAN segment to the server-room group and each subnet to its availability-zone group. I treated the VPC as the host of its instances and gateway, and represented the Transit Gateway’s subnet attachments as links. Product paths and node types use inferred normalized names. I included `pan-os` as the firewall software, although the description only says “VM-Series firewall.” The VPC region is not encoded because the format has no region field.

3. **Unclear:** `host` can point to a redundancy-set ID, which supports the unknown host for `app-1`, but the format does not say whether it can also represent cloud containment such as an instance in a VPC. Likewise, it is unclear how to represent a gateway attached to a VPC or a Transit Gateway attached through subnets without treating those relationships as ordinary links.
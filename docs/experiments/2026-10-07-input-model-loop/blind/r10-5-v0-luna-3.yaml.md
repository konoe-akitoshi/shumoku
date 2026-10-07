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

nodes:
  - id: rt-1
    label: rt-1
    product: yamaha/rtx3510
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
    product: paloalto/vm-series
    host: hv-1

  - id: app-1
    label: app-1
    type: vm
    software: ubuntu
    host: prod

  - id: main
    label: main
    type: vpc
    prefix: 10.0.0.0/16

  - id: web-c
    label: web-c
    type: ec2
    product: aws/ec2/t3.medium
    software: amazon-linux

  - id: db-c
    label: db-c
    type: rds
    product: aws/rds/mysql

  - id: igw-1
    label: igw-1
    type: internet-gateway
    host: main

  - id: tgw-1
    label: tgw-1
    type: transit-gateway

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
      - node: tgw-1
      - node: sub-a
    virtual: true
    description: Transit Gateway attachment through sub-a

  - endpoints:
      - node: tgw-1
      - node: sub-c
    virtual: true
    description: Transit Gateway attachment through sub-c

  - endpoints:
      - node: rt-1
      - node: tgw-1
    virtual: true
    description: Site-to-Site VPN tunnel 1

  - endpoints:
      - node: rt-1
      - node: tgw-1
    virtual: true
    description: Site-to-Site VPN tunnel 2

  - endpoints:
      - node: igw-1
      - node: main
    virtual: true
    description: Internet gateway attached to VPC main
```

1. The format cannot directly express that the two VPN tunnels belong to one Site-to-Site VPN connection, or that the Transit Gateway is attached to the VPC through both subnets as a single attachment. The links and descriptions preserve the stated connections.
2. I used product paths and node `type` values for products/services where the types do not define a vocabulary. I represented the subnets as segments and their associations with the Transit Gateway as virtual links. I used `host: prod` for `app-1` to express that it runs on an unknown member of the cluster.
3. It is unclear whether a cloud resource’s type or product should encode its AWS service and instance class, and how a subnet-to-gateway attachment should be modeled when a subnet is a segment rather than a node.
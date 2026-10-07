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
    software: VMware ESXi
    group: server-room
  - id: hv-2
    label: hv-2
    product: dell/poweredge-r750
    software: VMware ESXi
    group: server-room
  - id: fw-v
    label: fw-v
    product: palo-alto-networks/vm-series
    software: PAN-OS
    host: hv-1
    group: server-room
  - id: app-1
    label: app-1
    type: vm
    software: Ubuntu
    host: prod
    group: server-room
  - id: main
    label: main
    type: vpc
    prefix: 10.0.0.0/16
  - id: web-c
    label: web-c
    type: ec2
    product: aws/ec2/t3.medium
    software: Amazon Linux
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
    host: main

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
      - node: rt-1
      - node: tgw-1
    virtual: true
    description: Site-to-Site VPN tunnel 1
  - endpoints:
      - node: rt-1
      - node: tgw-1
    virtual: true
    description: Site-to-Site VPN tunnel 2
```

1. **Could not express:** The VPC-to-subnet and Transit Gateway attachment relationships as such; the format has no explicit attachment type. The internet gateway’s attachment is represented using `host`, which does not fully capture attachment semantics.
2. **Guessed or added:** Group membership for the server room and availability zones; product paths, node `type` values, and the PAN-OS software name; labels; and treating each IPsec tunnel as a virtual link. `app-1` uses `prod` as its host because the format allows a redundancy set ID to mean an unspecified member. The VPC, internet gateway, and Transit Gateway relationships are approximated with `host`.
3. **Unclear:** Whether `host` is intended to represent attachments such as an internet gateway or Transit Gateway to a VPC, or only a machine that runs a node. Also, the description says the VPC is attached through both subnets, but the format has no direct way to state that attachment separately from placing the VPC in those segments.
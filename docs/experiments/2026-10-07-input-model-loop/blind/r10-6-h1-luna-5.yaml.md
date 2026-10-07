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
    product: yamaha/rtx3510
    group: server-room
  - id: hv-1
    label: hv-1
    product: dell/poweredge/r750
    software: VMware ESXi
    group: server-room
  - id: hv-2
    label: hv-2
    product: dell/poweredge/r750
    software: VMware ESXi
    group: server-room
  - id: fw-v
    label: fw-v
    product: palo-alto-networks/vm-series
    host: hv-1
    group: server-room
  - id: app-1
    label: app-1
    software: Ubuntu
    host: prod
    group: server-room
  - id: main
    label: main
    type: VPC
    prefix: 10.0.0.0/16
  - id: igw-1
    label: igw-1
    type: Internet Gateway
    host: main
  - id: tgw-1
    label: tgw-1
    type: Transit Gateway
    host: main
  - id: web-c
    label: web-c
    type: EC2 instance
    product: amazon/ec2/t3.medium
    software: Amazon Linux
    host: main
  - id: db-c
    label: db-c
    type: RDS for MySQL
    product: amazon/rds
    software: MySQL
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

1. The format cannot directly express that the two VPN tunnels belong to one Site-to-Site VPN connection, or that the Transit Gateway is attached through both subnets. The VPC’s routing function between subnets also has no explicit representation beyond the VPC node and subnet segments.

2. I used `server-room` and availability-zone groups to represent the stated places. I treated the VPC as the host of its instances and gateway nodes, and represented the firewall’s VMware port group through its VLAN 10 segment membership. I used product paths for the known hardware and cloud products; the format does not define a canonical naming scheme for those paths.

3. It is unclear whether `host` can refer to a network container such as a VPC, or whether it is intended only for compute hosts. The format also does not specify how to represent attachments that are not ordinary links, such as a gateway’s attachment to a VPC.
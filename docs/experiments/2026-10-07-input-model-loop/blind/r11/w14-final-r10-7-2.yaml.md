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
    segments:
      - vlan-20
  - id: ap-1
    label: ap-1
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
    group: server-room
    host: hv-1
  - id: app-1
    label: app-1
    software: Ubuntu
    group: server-room
    host: prod
  - id: igw-1
    label: igw-1
    type: internet gateway
    routingDomain: main
  - id: tgw-1
    label: tgw-1
    type: transit gateway
    routingDomain: main
  - id: web-c
    label: web-c
    type: EC2 instance
    product: amazon/ec2/t3.medium
    software: Amazon Linux
    group: ap-northeast-1a
  - id: db-c
    label: db-c
    type: RDS database
    product: amazon/rds/mysql
    group: ap-northeast-1c

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
  - endpoints:
      - node: tgw-1
      - node: sub-a
  - endpoints:
      - node: tgw-1
      - node: sub-c
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

1. The format cannot directly express AWS region, the VPC’s name `main` separately from its routing domain, or the VPN’s IPsec protocol. It also has no explicit representation for the vSphere HA cluster as a compute cluster; `redundancy` captures that the hosts form a pair.
2. I used availability zones as groups and assumed the VPN tunnels are virtual links. I marked the VPN links `assumed: true` because the description says the connection exists but does not confirm the individual tunnel links. The links between the internet gateway and VPC, and between the Transit Gateway and subnets, are represented as links to the routing domain and segments.
3. The format says a link endpoint names a node, but AWS attachments naturally connect gateways to a VPC or subnet, which are represented here as routing domains and segments rather than nodes. It is unclear whether such references are valid endpoints. The format also does not specify how a connection with multiple links distinguishes its individual tunnels.
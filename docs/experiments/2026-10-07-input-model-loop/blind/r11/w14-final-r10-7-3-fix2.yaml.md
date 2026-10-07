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
  - id: vpc-main
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
    addresses:
      ap-1: 192.168.20.5
  - id: vlan-10
    label: VLAN 10
    vlan: 10
    prefix: 192.168.10.0/24
    addresses:
      fw-v: 192.168.10.2
      app-1: 192.168.10.20
  - id: sub-a
    label: sub-a
    prefix: 10.0.1.0/24
    routingDomain: vpc-main
    group: ap-northeast-1a
    addresses:
      web-c: 10.0.1.10
  - id: sub-c
    label: sub-c
    prefix: 10.0.2.0/24
    routingDomain: vpc-main
    group: ap-northeast-1c
    addresses:
      db-c: 10.0.2.20

redundancy:
  - id: prod
    label: prod
    nodes: [hv-1, hv-2]

nodes:
  - id: rt-1
    label: rt-1
    type: router
    product: yamaha/rtx3510
    group: server-room
    segments: [vlan-20]
  - id: ap-1
    label: ap-1
    type: access-point
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
    host: hv-1
    group: server-room
  - id: app-1
    label: app-1
    type: virtual-machine
    software: Ubuntu
    host: prod
    group: server-room
  - id: igw-1
    label: igw-1
    type: internet-gateway
    routingDomain: vpc-main
  - id: tgw-1
    label: tgw-1
    type: transit-gateway
    routingDomain: vpc-main
  - id: web-c
    label: web-c
    type: ec2-instance
    product: amazon/ec2/t3.medium
    software: Amazon Linux
    group: ap-northeast-1a
  - id: db-c
    label: db-c
    type: database
    product: amazon/rds/mysql
    group: ap-northeast-1c

links:
  - endpoints:
      - node: ap-1
      - node: rt-1
        port: lan2
    segments: [vlan-20]
  - endpoints:
      - node: hv-1
      - node: rt-1
    speed: 10G
    segments: [vlan-10]
  - endpoints:
      - node: hv-2
      - node: rt-1
    speed: 10G
    segments: [vlan-10]
  - endpoints:
      - node: igw-1
      - node: tgw-1
  - endpoints:
      - node: tgw-1
      - node: sub-a
    segments: [sub-a]
  - endpoints:
      - node: tgw-1
      - node: sub-c
  - endpoints:
      - node: rt-1
      - node: tgw-1
    virtual: true
    connection: site-to-site-vpn
  - endpoints:
      - node: rt-1
      - node: tgw-1
    virtual: true
    connection: site-to-site-vpn
```
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
      fw-v: [192.168.10.2]
      app-1: [192.168.10.20]
  - id: sub-a
    label: sub-a
    prefix: 10.0.1.0/24
    group: ap-northeast-1a
    addresses:
      web-c: [10.0.1.10]
  - id: sub-c
    label: sub-c
    prefix: 10.0.2.0/24
    group: ap-northeast-1c
    addresses:
      db-c: [10.0.2.20]

nodes:
  - id: rt-1
    label: rt-1
    type: router
    product: yamaha/rtx3510
    group: server-room
  - id: hv-1
    label: hv-1
    type: server
    product: dell/poweredge/r750
    software: VMware ESXi
    group: server-room
  - id: hv-2
    label: hv-2
    type: server
    product: dell/poweredge/r750
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
  - id: main
    label: main
    type: vpc
    prefix: 10.0.0.0/16
  - id: web-c
    label: web-c
    type: ec2-instance
    product: aws/ec2/t3.medium
    software: Amazon Linux
  - id: db-c
    label: db-c
    type: database
    product: aws/rds/mysql
  - id: igw-1
    label: igw-1
    type: internet-gateway
  - id: tgw-1
    label: tgw-1
    type: transit-gateway

redundancy:
  - id: prod
    label: prod
    nodes: [hv-1, hv-2]

links:
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
      - node: main
      - node: igw-1
  - endpoints:
      - node: main
      - node: tgw-1
    segments: [sub-a, sub-c]
  - endpoints:
      - node: tgw-1
      - node: rt-1
    virtual: true
    description: Site-to-Site VPN connection with two IPsec tunnels
```

1. The description does not specify the ports at either end of the server cables; the format allows those ports to be omitted. It also does not identify which physical host serves app-1; `host: prod` records that it runs on one of the cluster nodes.
2. I added group IDs for the server room and availability zones, plus generic node types and labels. I treated the VPC as a node in each subnet and represented the two VPN tunnels as one virtual link, since the description gives no tunnel-specific endpoints or attributes.
3. The format does not define a vocabulary for node `type`, `product` path components, or `software`, so those values are descriptive. It is also unclear how best to model an AWS VPC attachment through two subnets when the link endpoint pair is undirected and has no attachment-specific fields.
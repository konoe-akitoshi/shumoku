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
    type: router
    product: yamaha/rtx3510
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
  - id: fw-v
    label: fw-v
    type: firewall
    product: palo-alto-networks/vm-series
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
      - node: igw-1
      - node: main
    virtual: true
  - endpoints:
      - node: tgw-1
      - node: main
    virtual: true
    segments:
      - sub-a
      - sub-c
  - endpoints:
      - node: rt-1
      - node: tgw-1
    virtual: true
    description: Site-to-Site VPN IPsec tunnel 1
  - endpoints:
      - node: rt-1
      - node: tgw-1
    virtual: true
    description: Site-to-Site VPN IPsec tunnel 2
```

1. The description does not specify an address for the VPC attachment, gateway, or VPN tunnels, so none is recorded.
2. I used `main` as the VPC node ID, inferred `aws/` product paths and descriptive node types, and represented the internet gateway and Transit Gateway attachments as virtual links. The format has no explicit field for a VPC attachment, so the Transit Gateway’s links to the VPC node list the two attachment subnets.
3. It is unclear whether `product` paths should include cloud service namespaces such as `aws/`, and how to represent an attachment that uses multiple subnets. The format also has no dedicated way to label VPN tunnel identity beyond link descriptions.
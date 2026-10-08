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
  - id: main
    label: VPC main
    prefix: 10.0.0.0/16

connections:
  - id: site-to-site-vpn
    label: Site-to-Site VPN

segments:
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
    type: vm
    software: Ubuntu
    host: prod
    group: server-room
  - id: igw-1
    label: igw-1
    type: internet-gateway
  - id: tgw-1
    label: tgw-1
    type: transit-gateway
  - id: web-c
    label: web-c
    type: ec2
    product: aws/ec2/t3.medium
    software: Amazon Linux
    group: ap-northeast-1a
  - id: db-c
    label: db-c
    type: rds
    product: aws/rds/mysql
    group: ap-northeast-1c

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
      - node: fw-v
      - segment: vlan-10
    virtual: true
  - endpoints:
      - node: app-1
      - segment: vlan-10
    virtual: true
  - endpoints:
      - node: igw-1
      - routingDomain: main
  - endpoints:
      - node: tgw-1
      - routingDomain: main
  - endpoints:
      - node: tgw-1
      - node: rt-1
    connection: site-to-site-vpn
    virtual: true
    assumed: true
    description: IPsec tunnel 1
  - endpoints:
      - node: tgw-1
      - node: rt-1
    connection: site-to-site-vpn
    virtual: true
    assumed: true
    description: IPsec tunnel 2
  - endpoints:
      - node: tgw-1
      - segment: sub-a
  - endpoints:
      - node: tgw-1
      - segment: sub-c
```

1. **Could not express:** The VPN is explicitly said to have two IPsec tunnels, but the format has no field for tunnel type or protocol. I represented the tunnels as separate links under one connection.
2. **Guesses or additions:** I used generic node `type` values for the AWS services and VM, and inferred `aws/` product paths for AWS products. I treated the VM adapters and AWS attachments as virtual links. I marked the VPN tunnels assumed because their existence is described but the individual tunnels are not otherwise detailed. I used availability zones as groups.
3. **Unclear:** The format does not define whether every physical or virtual attachment should be modeled as a link, or how to represent a VPN tunnel’s technology. It is also unclear whether a VM’s port-group attachment is best represented by a link to a segment or by listing its address there alone.
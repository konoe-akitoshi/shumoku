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

segments:
  - id: vlan-10
    label: VLAN 10
    vlan: 10
    prefix: 192.168.10.0/24
    addresses:
      fw-v: 192.168.10.2
      app-1: 192.168.10.20
  - id: sub-a
    prefix: 10.0.1.0/24
    routingDomain: main
    group: ap-northeast-1a
    addresses:
      web-c: 10.0.1.10
  - id: sub-c
    prefix: 10.0.2.0/24
    routingDomain: main
    group: ap-northeast-1c
    addresses:
      db-c: 10.0.2.20

connections:
  - id: site-to-site-vpn
    label: Site-to-Site VPN

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
    software: vm-series
    host: hv-1
  - id: app-1
    label: app-1
    type: vm
    software: ubuntu
    host: prod
  - id: web-c
    label: web-c
    type: ec2
    product: aws/ec2/t3.medium
    software: amazon-linux
    group: ap-northeast-1a
  - id: db-c
    label: db-c
    type: database
    product: aws/rds/mysql
    group: ap-northeast-1c
  - id: igw-1
    label: igw-1
    type: internet-gateway
    product: aws/internet-gateway
  - id: tgw-1
    label: tgw-1
    type: transit-gateway
    product: aws/transit-gateway
  - id: prod
    label: prod
    type: cluster
    assumed: true

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
      - node: fw-v
      - segment: vlan-10
    virtual: true
  - endpoints:
      - node: app-1
      - segment: vlan-10
    virtual: true
  - endpoints:
      - node: web-c
      - segment: sub-a
    virtual: true
  - endpoints:
      - node: db-c
      - segment: sub-c
    virtual: true
  - endpoints:
      - node: igw-1
      - routingDomain: main
    virtual: true
  - endpoints:
      - node: tgw-1
      - segment: sub-a
    virtual: true
  - endpoints:
      - node: tgw-1
      - segment: sub-c
    virtual: true
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

1. The description does not specify the VPN tunnel endpoints or whether the tunnels connect directly to each other in this model; I represented each as a link between `rt-1` and `tgw-1`.
2. I added generic node types and product paths where needed to encode the stated products. I represented VMware port-group adapters, AWS subnet attachments, the gateway attachment, and VPN tunnels as virtual links. I added an assumed `prod` node as the host reference for `app-1`, since the format permits a redundancy ID as `host` but does not directly model a cluster as a host.
3. It is unclear whether `virtual: true` should mark cloud attachment links and VMware port-group membership, or only links explicitly described as having no cable. The format also does not directly express a compute cluster as a host for a VM when its member host is unknown.
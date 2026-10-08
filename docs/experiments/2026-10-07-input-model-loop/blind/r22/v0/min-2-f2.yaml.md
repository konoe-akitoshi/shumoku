```yaml
name: 本社ネットワーク
groups:
  - id: server-room
    label: 本社サーバ室
  - id: aws-main
    label: AWS 東京 VPC main
  - id: sub-a
    label: サブネット sub-a
nodes:
  - id: rt-1
    label: rt-1
    type: router
    product: yamaha/rtx3510
    group: server-room
  - id: sw-1
    label: sw-1
    type: switch
    group: server-room
  - id: hv-1
    label: hv-1
    type: server
    model: PowerEdge R750
    os: VMware ESXi
    group: server-room
  - id: web-1
    label: web-1
    type: vm
    host: hv-1
    ip: 192.168.10.20
    group: server-room
  - id: vpc-main
    label: main
    type: vpc
    region: ap-northeast-1
    cidr: 10.0.0.0/16
    group: aws-main
  - id: igw-1
    label: igw-1
    type: internet-gateway
    group: aws-main
  - id: sub-a
    label: sub-a
    type: subnet
    cidr: 10.0.1.0/24
    availability-zone: ap-northeast-1a
    group: sub-a
  - id: vgw-1
    label: vgw-1
    type: virtual-private-gateway
    group: aws-main
links:
  - endpoints:
      - node: rt-1
        port: lan3
      - node: sw-1
        port: "1"
    speed: 1G
    cable:
      length: 3m
      type: Cat6
    vlans:
      - id: 10
        label: 業務
        cidr: 192.168.10.0/24
      - id: 20
        label: 来客
        vrf: guest
  - endpoints:
      - node: hv-1
      - node: sw-1
    speed: 10G
  - endpoints:
      - node: vpc-main
      - node: igw-1
  - endpoints:
      - node: rt-1
      - node: vgw-1
    type: vpn
    protocol: IPsec
    kind: Site-to-Site
    tunnel-count: 2
  - endpoints:
      - node: web-1
      - node: hv-1
    type: hosted-on
  - endpoints:
      - node: sub-a
      - node: vpc-main
    type: contained-in
```
```yaml
name: 本社ネットワーク
groups:
  - id: server-room
    label: 本社 サーバ室
  - id: aws-tokyo
    label: AWS 東京
  - id: vpc-main
    label: VPC main
  - id: subnet-sub-a
    label: サブネット sub-a
nodes:
  - id: rt-1
    label: rt-1
    type: router
    product: Yamaha/RTX3510
    group: server-room
  - id: sw-1
    label: sw-1
    type: switch
    product: SWX2322P-16MT
    group: server-room
  - id: hv-1
    label: hv-1
    type: server
    product: Dell/PowerEdge-R750
    group: server-room
    software: VMware ESXi
  - id: web-1
    label: web-1
    type: virtual-machine
    group: server-room
    host: hv-1
    address: 192.168.10.20
  - id: vpc-main
    label: main
    type: vpc
    group: aws-tokyo
    region: ap-northeast-1
    cidr: 10.0.0.0/16
  - id: sub-a
    label: sub-a
    type: subnet
    group: vpc-main
    cidr: 10.0.1.0/24
    availabilityZone: ap-northeast-1a
  - id: igw-1
    label: igw-1
    type: internet-gateway
    group: vpc-main
  - id: vgw-1
    label: vgw-1
    type: virtual-private-gateway
    group: vpc-main
links:
  - endpoints:
      - node: rt-1
        port: lan3
      - node: sw-1
        port: "1"
    speed: 1G
    cable: Cat6
    length: 3m
    vlans:
      - id: 10
        label: 業務
        subnet: 192.168.10.0/24
      - id: 20
        label: 来客
        vrf: guest
  - endpoints:
      - node: hv-1
      - node: sw-1
    speed: 10G
  - endpoints:
      - node: rt-1
      - node: vgw-1
    type: ipsec-site-to-site-vpn
    tunnels: 2
```
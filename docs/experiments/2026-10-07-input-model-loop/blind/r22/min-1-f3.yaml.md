```yaml
name: 本社・AWS東京ネットワーク
groups:
  - id: server-room
    label: 本社 サーバ室
  - id: vpc-main
    label: AWS 東京 VPC main
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
    type: vm
    host: hv-1
    address: 192.168.10.20
  - id: vpc-main
    label: main
    type: vpc
    cidr: 10.0.0.0/16
    region: ap-northeast-1
    group: vpc-main
  - id: sub-a
    label: sub-a
    type: subnet
    cidr: 10.0.1.0/24
    availabilityZone: ap-northeast-1a
    group: subnet-sub-a
  - id: igw-1
    label: igw-1
    type: internet-gateway
    attachedTo: vpc-main
    group: vpc-main
  - id: vgw-1
    label: vgw-1
    type: virtual-private-gateway
    attachedTo: vpc-main
    group: vpc-main
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
        name: 業務
        cidr: 192.168.10.0/24
      - id: 20
        name: 来客
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
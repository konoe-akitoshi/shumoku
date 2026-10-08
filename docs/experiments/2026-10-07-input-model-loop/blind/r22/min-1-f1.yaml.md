```yaml
name: 本社
groups:
  - id: server-room
    label: サーバ室
nodes:
  - id: rt-1
    label: rt-1
    type: router
    product: Yamaha/RTX3510
  - id: sw-1
    label: sw-1
    type: switch
    product: SWX2322P-16MT
  - id: hv-1
    label: hv-1
    type: server
    product: Dell/PowerEdge R750
    software: VMware ESXi
  - id: web-1
    label: web-1
    type: vm
    host: hv-1
    address: 192.168.10.20
  - id: aws-vpc-main
    label: AWS 東京 VPC main
    type: vpc
    address: 10.0.0.0/16
    group: aws-vpc-main
  - id: sub-a
    label: sub-a
    type: subnet
    address: 10.0.1.0/24
    description: ap-northeast-1a
    group: aws-vpc-main
  - id: igw-1
    label: igw-1
    type: internet-gateway
    group: aws-vpc-main
  - id: vgw-1
    label: vgw-1
    type: virtual-private-gateway
    group: aws-vpc-main
links:
  - endpoints:
      - node: rt-1
        port: lan3
      - node: sw-1
        port: "1"
    speed: 1G
    cable: Cat6
    length: 3m
    description: VLAN 10 業務 (192.168.10.0/24)、VLAN 20 来客。VLAN 20 は rt-1 の VRF guest に属する。
  - endpoints:
      - node: sw-1
      - node: hv-1
    speed: 10G
    description: hv-1 側のポート不明
  - endpoints:
      - node: rt-1
      - node: vgw-1
    description: IPsec Site-to-Site VPN、トンネル2本
```
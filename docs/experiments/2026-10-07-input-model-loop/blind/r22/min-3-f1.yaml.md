```yaml
name: 本社
groups:
  - id: server-room
    label: サーバ室
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
    product: Dell/PowerEdge R750
    software: VMware ESXi
    group: server-room
  - id: web-1
    label: web-1
    type: vm
    address: 192.168.10.20
    group: server-room
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
    description: VLAN 10（業務、192.168.10.0/24）と VLAN 20（来客）を運ぶ。VLAN 20 は rt-1 の VRF「guest」に属する。
  - endpoints:
      - node: hv-1
      - node: sw-1
    speed: 10G
  - endpoints:
      - node: web-1
      - node: hv-1
    description: web-1 のアダプタは VLAN 10 のポートグループにある。
  - endpoints:
      - node: rt-1
      - node: vgw-1
    description: IPsec の Site-to-Site VPN、トンネルは2本。
```
```yaml
name: 本社・AWS 東京
groups:
  - id: headquarters
    label: 本社
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
    group: server-room
  - id: hv-1
    label: hv-1
    type: server
    os: VMware ESXi
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
    vlans:
      - id: 10
        label: 業務
        subnet: 192.168.10.0/24
      - id: 20
        label: 来客
        vrf: guest
  - endpoints:
      - node: sw-1
      - node: hv-1
    speed: 10G
  - endpoints:
      - node: rt-1
      - node: vgw-1
    type: ipsec-site-to-site-vpn
    tunnels: 2
    protocol: IPsec
```
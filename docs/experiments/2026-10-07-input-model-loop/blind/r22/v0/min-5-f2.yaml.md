```yaml
name: 本社
groups:
  - id: server-room
    label: サーバ室
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
    product: dell/poweredge-r750
    group: server-room
  - id: web-1
    label: web-1
    type: vm
    host: hv-1
    adapters:
      - portGroup: VLAN 10
        address: 192.168.10.20
  - id: vpc-main
    label: main
    type: vpc
    provider: aws
    region: ap-northeast-1
    cidr: 10.0.0.0/16
  - id: subnet-sub-a
    label: sub-a
    type: subnet
    parent: vpc-main
    cidr: 10.0.1.0/24
    availabilityZone: ap-northeast-1a
  - id: igw-1
    label: igw-1
    type: internet-gateway
    vpc: vpc-main
  - id: vgw-1
    label: vgw-1
    type: virtual-private-gateway
    vpc: vpc-main
links:
  - endpoints:
      - node: rt-1
        port: lan3
      - node: sw-1
        port: "1"
    medium: Cat6
    length: 3m
    speed: 1G
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
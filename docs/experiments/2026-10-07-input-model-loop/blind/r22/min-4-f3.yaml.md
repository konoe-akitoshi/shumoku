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
    product: SWX2322P-16MT
    group: server-room
  - id: hv-1
    label: hv-1
    type: server
    product: Dell PowerEdge R750
    software: VMware ESXi
    group: server-room
  - id: web-1
    label: web-1
    type: vm
    group: server-room
  - id: main
    label: main
    type: vpc
    description: AWS 東京 ap-northeast-1
    address: 10.0.0.0/16
  - id: sub-a
    label: sub-a
    type: subnet
    address: 10.0.1.0/24
    description: ap-northeast-1a
    group: main
  - id: igw-1
    label: igw-1
    type: internet-gateway
    group: main
  - id: vgw-1
    label: vgw-1
    type: virtual-private-gateway
    group: main
links:
  - endpoints:
      - node: rt-1
        port: lan3
      - node: sw-1
        port: "1"
    cable: Cat6
    length: 3m
    speed: 1G
    segments:
      - id: "10"
        label: 業務
        address: 192.168.10.0/24
      - id: "20"
        label: 来客
        description: VRF guest on rt-1
        segments: guest
  - endpoints:
      - node: sw-1
      - node: hv-1
    speed: 10G
  - endpoints:
      - node: hv-1
      - node: web-1
    virtual: true
    description: VM adapter on VLAN 10 port group; address 192.168.10.20
  - endpoints:
      - node: rt-1
      - node: vgw-1
    connection: IPsec Site-to-Site VPN; 2 tunnels
```
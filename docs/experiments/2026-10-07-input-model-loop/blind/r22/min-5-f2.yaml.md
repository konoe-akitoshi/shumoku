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
  - id: web-1
    label: web-1
    type: vm
    host: hv-1
    address: 192.168.10.20
  - id: aws-tokyo
    label: AWS 東京
    type: cloud
  - id: main
    label: main
    type: vpc
  - id: sub-a
    label: sub-a
    type: subnet
  - id: igw-1
    label: igw-1
    type: internet-gateway
  - id: vgw-1
    label: vgw-1
    type: virtual-private-gateway
links:
  - endpoints:
      - node: rt-1
        port: lan3
      - node: sw-1
        port: "1"
    speed: 1G
    cable: Cat6
    length: 3m
  - endpoints:
      - node: sw-1
      - node: hv-1
    speed: 10G
  - endpoints:
      - node: rt-1
      - node: vgw-1
    connection: VPN
```
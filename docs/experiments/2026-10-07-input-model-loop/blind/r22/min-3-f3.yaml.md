```yaml
name: Branch office network
groups:
  - id: hq-server-room
    label: Headquarters server room
  - id: aws-tokyo
    label: AWS Tokyo
  - id: main-vpc
    label: VPC main
  - id: sub-a
    label: Subnet sub-a
nodes:
  - id: rt-1
    label: rt-1
    type: router
    product: Yamaha/RTX3510
    group: hq-server-room
  - id: sw-1
    label: sw-1
    type: switch
    product: SWX2322P-16MT
    group: hq-server-room
  - id: hv-1
    label: hv-1
    type: server
    product: Dell/PowerEdge-R750
    software: VMware ESXi
    group: hq-server-room
  - id: web-1
    label: web-1
    type: virtual-machine
    address: 192.168.10.20
    host: hv-1
    group: hq-server-room
  - id: igw-1
    label: igw-1
    type: internet-gateway
    group: main-vpc
  - id: vgw-1
    label: vgw-1
    type: virtual-private-gateway
    group: main-vpc
groups:
  - id: main-vpc
    label: VPC main
  - id: sub-a
    label: Subnet sub-a
    parent: main-vpc
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
        port: unknown
      - node: hv-1
    speed: 10G
  - endpoints:
      - node: vgw-1
      - node: igw-1
  - endpoints:
      - node: rt-1
      - node: vgw-1
    type: IPsec Site-to-Site VPN
    tunnels: 2
```
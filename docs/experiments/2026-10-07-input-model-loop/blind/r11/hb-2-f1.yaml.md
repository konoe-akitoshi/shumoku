```yaml
name: ネットワーク
groups:
  - id: hq
    label: 本社
  - id: server-room
    label: サーバ室
    parent: hq
  - id: ap-northeast-1a
    label: ap-northeast-1a
routingDomains:
  - id: guest
    label: guest
  - id: vpc-main
    label: main
    prefix: 10.0.0.0/16
segments:
  - id: vlan-10
    label: 業務
    vlan: 10
    prefix: 192.168.10.0/24
  - id: vlan-20
    label: 来客
    vlan: 20
    routingDomain: guest
  - id: sub-a
    label: sub-a
    prefix: 10.0.1.0/24
    routingDomain: vpc-main
    group: ap-northeast-1a
  - id: port-group-vlan-10
    label: VLAN 10 ポートグループ
nodes:
  - id: rt-1
    type: router
    product: yamaha/rtx3510
    group: server-room
  - id: sw-1
    type: switch
    product: ?/swx2322p-16mt
    group: server-room
  - id: hv-1
    type: server
    product: dell/poweredge-r750
    software: VMware ESXi
    group: server-room
  - id: web-1
    type: vm
    host: hv-1
    address: 192.168.10.20
  - id: igw-1
    type: internet-gateway
  - id: vgw-1
    type: virtual-private-gateway
connections:
  - id: site-to-site-vpn
    label: IPsec Site-to-Site VPN
links:
  - endpoints:
      - node: rt-1
        port: lan3
      - node: sw-1
        port: "1"
    speed: 1G
    cable: Cat6
    length: 3m
    segments:
      - vlan-10
      - vlan-20
  - endpoints:
      - node: hv-1
      - node: sw-1
    speed: 10G
  - endpoints:
      - node: web-1
      - segment: port-group-vlan-10
    virtual: true
  - endpoints:
      - node: igw-1
      - routingDomain: vpc-main
  - endpoints:
      - node: rt-1
      - node: vgw-1
    connection: site-to-site-vpn
    virtual: true
    description: IPsec tunnel 1
  - endpoints:
      - node: rt-1
      - node: vgw-1
    connection: site-to-site-vpn
    virtual: true
    description: IPsec tunnel 2
```
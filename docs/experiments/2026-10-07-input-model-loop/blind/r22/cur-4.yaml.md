```yaml
name: Network
groups:
  - id: hq
    label: 本社
  - id: server-room
    label: サーバ室
    parent: hq

routingDomains:
  - id: guest-vrf
    label: guest
  - id: aws-main
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
    routingDomain: guest-vrf
  - id: sub-a
    label: sub-a
    prefix: 10.0.1.0/24
    routingDomain: aws-main
    group: ap-northeast-1a

nodes:
  - id: rt-1
    label: rt-1
    type: router
    product: yamaha/rtx3510
    group: server-room
  - id: sw-1
    label: sw-1
    product: ?/swx2322p-16mt
    group: server-room
  - id: hv-1
    label: hv-1
    product: dell/poweredge-r750
    software: VMware ESXi
    group: server-room
  - id: web-1
    label: web-1
    type: vm
    host: hv-1
    group: server-room
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
    cable: cat6
    length: 3m
    segments:
      - vlan-10
      - vlan-20
  - endpoints:
      - node: sw-1
      - node: hv-1
    speed: 10G
  - endpoints:
      - node: web-1
      - segment: vlan-10
    virtual: true
  - endpoints:
      - node: igw-1
      - routingDomain: aws-main
  - endpoints:
      - node: rt-1
      - node: vgw-1
    connection: site-to-site-vpn
    virtual: true
  - endpoints:
      - node: rt-1
      - node: vgw-1
    connection: site-to-site-vpn
    virtual: true

connections:
  - id: site-to-site-vpn
    label: IPsec Site-to-Site VPN
```

1. 表現できなかったこと: AWS のリージョン（東京）、サブネットの availability zone `ap-northeast-1a` は group として記録しましたが、型にはリージョンや availability zone 専用の項目がありません。VM のアドレスは VLAN 10 上のアドレスとして記録しました。
2. 推測・補足したこと: `Network` の `name`、各種 `type`、ID、ラベルを補いました。`main` を routing domain、`guest` を rt-1 上の VRF routing domain として解釈しました。VPN の2本のトンネルは同じ connection の別リンクとして表し、virtual としました。VM アダプタのポートグループ接続も virtual としました。サブネットを segment として表しました.
3. 不明瞭だったこと: `group` が場所だけでなく availability zone にも使えるか、また VPC と VRF を routing domain としてどう区別するかが型からは明確ではありません。`virtual` が VPN トンネルや VM のポートグループ接続に適用されるかも解釈を要しました.
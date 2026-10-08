```yaml
name: 本社ネットワーク
groups:
  - id: headquarters
    label: 本社
    groups:
      - id: server-room
        label: サーバ室

routingDomains:
  - id: guest-vrf
    label: guest
  - id: aws-main
    label: main
    prefix: 10.0.0.0/16

connections:
  - id: site-to-site-vpn
    label: IPsec Site-to-Site VPN

segments:
  - id: vlan-10
    label: 業務
    vlan: 10
    prefix: 192.168.10.0/24
    group: server-room
    addresses:
      web-1: 192.168.10.20
  - id: vlan-20
    label: 来客
    vlan: 20
    routingDomain: guest-vrf
  - id: aws-sub-a
    label: sub-a
    prefix: 10.0.1.0/24
    routingDomain: aws-main
  - id: hv-1-vlan-10-port-group
    label: VLAN 10 ポートグループ
    vlan: 10
    group: server-room

nodes:
  - id: rt-1
    label: rt-1
    type: router
    product: Yamaha/RTX3510
    group: server-room
  - id: sw-1
    label: sw-1
    type: switch
    product: ?/SWX2322P-16MT
    group: server-room
  - id: hv-1
    label: hv-1
    type: virtualization host
    product: Dell/PowerEdge R750
    software: VMware ESXi
    group: server-room
  - id: web-1
    label: web-1
    type: VM
    host: hv-1
    group: server-room
  - id: igw-1
    label: igw-1
    type: internet gateway
  - id: vgw-1
    label: vgw-1
    type: virtual private gateway

links:
  - endpoints:
      - node: rt-1
        port: lan3
      - node: sw-1
        port: port 1
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
      - segment: hv-1-vlan-10-port-group
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
```

1. **表現できなかったこと:** AWS 東京（リージョン）と sub-a のアベイラビリティゾーン `ap-northeast-1a` は、この型に対応する項目がありません。VPN が IPsec であることも、connection のラベルに記す以上の構造では表せません。
2. **補ったこと:** 型番だけが記録された sw-1 のメーカーを `?` としました。ポートグループを表すセグメントを追加し、web-1 のアダプタ接続をそこへの仮想リンクとして表しました。VPN のトンネルを2本として、同じ両端・connection を持つリンクを2つ記しました。
3. **形式で不明瞭だったこと:** VPC に属するセグメントと VPC 全体への接続は表せますが、AWS のリージョンやサブネットの AZ をどこに記すかは明確でありません。また、ポートグループを `Segment` として表すのが適切か、VLAN 10 のポートグループと VLAN 10 セグメントをどう区別するかも型からは分かりません。
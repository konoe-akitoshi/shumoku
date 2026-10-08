```yaml
name: ネットワーク
groups:
  - id: hq
    label: 本社
  - id: server-room
    label: サーバ室
    parent: hq
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

1. **表現できなかったこと:** VPC が AWS 東京にあること、sub-a が `ap-northeast-1a` にあることは、専用のクラウド・リージョン・AZ の項目がないため `group` に記しました。VLAN 10 のポートグループが VLAN 10 に属する関係も直接表す項目がないため、別セグメントとしました。VPN が IPsec であることは `connection` のラベルに記しました。

2. **推測・補足:** グループ ID、各種 `type`、セグメント ID、VPN connection ID、ポートグループのセグメントを追加しました。トンネル2本を同じ両端のリンクとして記し、それぞれ `virtual: true` としました。VLAN 10/20 がスイッチとルータ間のリンクを通ること、web-1 のアドレスが VLAN 10 上のものと解釈しました。

3. **形式で迷った点:** `Segment.group` が場所を表す一方で AZ を置く専用項目がなく、`group` に AZ 名を入れるのが適切か不明です。また、ポートグループをリンク先のセグメントとして表す方法や、IPsec トンネルを `virtual` とするのが形式の意図に合うかも判断が必要でした。かかった時間は計測していません。
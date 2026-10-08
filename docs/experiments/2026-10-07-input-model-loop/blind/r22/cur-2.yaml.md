```yaml
name: 本社とAWS東京

groups:
  - id: hq
    label: 本社
  - id: server-room
    label: サーバ室
    parent: hq

routingDomains:
  - id: guest
    label: guest
  - id: main
    label: main
    prefix: 10.0.0.0/16

segments:
  - id: vlan-10
    label: 業務
    vlan: 10
    prefix: 192.168.10.0/24
    addresses:
      web-1: 192.168.10.20
  - id: vlan-20
    label: 来客
    vlan: 20
    routingDomain: guest
  - id: sub-a
    label: sub-a
    prefix: 10.0.1.0/24
    routingDomain: main
    group: ap-northeast-1a

nodes:
  - id: rt-1
    type: router
    product: yamaha/rtx3510
    group: server-room
    asn: null
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
  - id: igw-1
    type: internet-gateway
    routingDomain: main
  - id: vgw-1
    type: virtual-private-gateway
    routingDomain: main

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
    cable: cat6
    length: 3m
    segments:
      - vlan-10
      - vlan-20
  - endpoints:
      - node: sw-1
        port: unknown
      - node: hv-1
    speed: 10G
    segments:
      - vlan-10
  - endpoints:
      - node: web-1
      - segment: vlan-10
    virtual: true
  - endpoints:
      - node: igw-1
      - routingDomain: main
    virtual: true
  - endpoints:
      - node: rt-1
      - node: vgw-1
    connection: site-to-site-vpn
    virtual: true
    description: IPsec トンネル 1
  - endpoints:
      - node: rt-1
      - node: vgw-1
    connection: site-to-site-vpn
    virtual: true
    description: IPsec トンネル 2
```

1. **表現できなかったこと:** VLAN 10/20 をスイッチのポートグループとして扱うことや、AWS 東京というリージョン情報は専用フィールドがありません。VLAN 20 のプレフィックスも記載されていないため省きました。

2. **説明にない補足・推測:** `name`、各ノードの `type`、AWS の識別用 routing domain、ID、トンネルの説明を補いました。`sub-a` の `group` に AZ 名を入れています。リンクの `virtual: true` は、ケーブルのない VM アダプタ、ゲートウェイ接続、VPN トンネルとして表現しました。ポート不明は形式に「不明」を書く方法がないため `unknown` としました。

3. **形式で迷った点:** IPsec VPN 全体と2本のトンネルを、`connection` と同じ両端を持つ2本のリンクで表すのが適切か迷いました。また、`group` が場所を表す型なのに、AZ を入れるのが適切か不明です。所要時間は計測していません。
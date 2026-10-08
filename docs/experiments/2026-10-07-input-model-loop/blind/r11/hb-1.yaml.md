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
    label: AWS 東京 VPC main
    prefix: 10.0.0.0/16
connections:
  - id: site-to-site-vpn
    label: IPsec Site-to-Site VPN
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
    asn:  # not specified
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
  - id: vgw-1
    type: vpn-gateway
    routingDomain: main
  - id: igw-1
    type: internet-gateway
    routingDomain: main
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
      - node: hv-1
      - node: sw-1
    speed: 10G
  - endpoints:
      - node: web-1
      - segment: vlan-10
    virtual: true
  - endpoints:
      - node: igw-1
      - routingDomain: main
  - endpoints:
      - node: rt-1
      - node: vgw-1
    connection: site-to-site-vpn
    virtual: true
    description: IPsec tunnel 1 of 2
  - endpoints:
      - node: rt-1
      - node: vgw-1
    connection: site-to-site-vpn
    virtual: true
    description: IPsec tunnel 2 of 2
```

1. **表現できなかったこと:** この型には、サブネットの availability zone を表す項目がありません。`group: ap-northeast-1a` はその場所として仮置きしましたが、availability zone と場所が同じ意味とは限りません。AWS リージョンも独立した項目では表せません。
2. **補ったこと:** ノードの `type` や ID、ラベルの一部、リンクの説明は記述を整理するために補いました。型番のメーカーが不明なスイッチは `?/...` で表しました。VM のポートグループ接続と VPN トンネルは、物理ケーブルのない接続として `virtual: true` にしました。VPN は2本のリンクとして記述しました。
3. **形式で不明瞭だった点:** `Link` に接続先の型は定義されていますが、`Node` に `routingDomain` はありません。そのため `vgw-1` と `igw-1` が属する VPC は、リンクで表しました。YAML では `port: "1"` のような数字のポート名を文字列として引用する必要があるかも判断に迷いました。
4. **時間:** 計測していません。
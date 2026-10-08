```yaml
name: 本社とAWS東京
groups:
  - id: headquarters
    label: 本社
  - id: server-room
    label: サーバ室
    parent: headquarters
routingDomains:
  - id: guest
    label: guest
  - id: main
    label: AWS 東京 VPC main
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
    label: AWS 東京サブネット sub-a
    prefix: 10.0.1.0/24
    group: ap-northeast-1a
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
    group: server-room
  - id: igw-1
    type: internet-gateway
  - id: vgw-1
    type: virtual-private-gateway
links:
  - endpoints:
      - node: rt-1
        port: lan3
      - node: sw-1
        port: port 1
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
      - node: vgw-1
      - routingDomain: main
connections:
  - id: site-to-site-vpn
    label: IPsec Site-to-Site VPN
links:
  - endpoints:
      - node: rt-1
      - node: vgw-1
    virtual: true
    connection: site-to-site-vpn
  - endpoints:
      - node: rt-1
      - node: vgw-1
    virtual: true
    connection: site-to-site-vpn
```

1. **表現できなかったこと:** 型にはトンネル数を表す項目がないため、VPN のトンネル2本は同じ両端のリンク2本として表しました。AWS リージョンと、VLAN 10 のポートグループ名も専用項目がないため、サブネットの場所と VLAN 10 への仮想リンクで表現しています。

2. **推測・補足:** `type` の値、ID、製品パスの小文字化、接続名を補いました。`guest` はルーティングドメイン、VPC `main` もルーティングドメインとして表しました。VLAN 10 と VLAN 20 は同じスイッチ間リンクを運ぶものと解釈しました。VPN を仮想リンクとしました。

3. **不明だった点:** `Segment.group` は場所を指しますが、アベイラビリティゾーンのような場所も `Group` として定義すべきか迷いました。また、VPC へのゲートウェイ接続を `routingDomain` 宛てのリンクで表してよいか、トンネルを個別の `Connection` として区別すべきかは型から判断できませんでした。

**所要時間:** 計測していません。
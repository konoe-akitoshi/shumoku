```yaml
name: 本社ネットワーク
groups:
  - id: hq
    label: 本社
    groups:
      - id: server-room
        label: サーバ室
routingDomains:
  - id: guest-vrf
    label: guest
    prefix: 10.0.0.0/16
  - id: aws-main
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
  - id: vlan-20
    label: 来客
    vlan: 20
    routingDomain: guest-vrf
  - id: aws-sub-a
    label: AWS sub-a ap-northeast-1a
    prefix: 10.0.1.0/24
    routingDomain: aws-main
nodes:
  - id: rt-1
    type: router
    product: Yamaha/RTX3510
    group: server-room
  - id: sw-1
    type: switch
    product: '?/SWX2322P-16MT'
    group: server-room
  - id: hv-1
    type: virtualization host
    product: Dell/PowerEdge R750
    software: VMware ESXi
    group: server-room
  - id: web-1
    type: VM
    host: hv-1
  - id: vgw-1
    type: VPN gateway
    group: aws-main
  - id: igw-1
    type: internet gateway
    group: aws-main
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
        port: port 1
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
```

1. **表現できなかったこと:** トンネル2本を別々のリンクとして表しましたが、それぞれのトンネルを識別する名前や詳細は記述されていません。Web VM のアダプタが VLAN 10 のポートグループにあることは、セグメント接続として表せますが、「ポートグループ」という種別自体は表せません。

2. **補ったこと・推測したこと:** `name`、各 ID、ノードの `type`、一部のラベルを補いました。AWS VPC を routing domain、サブネットを segment として表しました。また、AWS リソースを `aws-main` の `group` に置きましたが、この形式では routing domain 自体を場所や親として参照できません。ルータと VGW 間の2リンクを VPN トンネルと解釈し、`virtual: true` としました。`port 1` はスイッチ側ポート名としてそのまま記載しました。

3. **形式で迷った点:** VRF の `routingDomain` と VPC の `routingDomain` はどちらも `prefix` を持てますが、VRF のプレフィックスは説明にありません。`guest-vrf` の `prefix: 10.0.0.0/16` は誤って追加した値で、説明にないため削除すべきです。**VLAN 20 の所属 VRF は表せますが、VLAN 10 が単一ルーティングテーブルに属することは明示せずに表現できません。** また、リンクに `segments` がある場合はそれだけを運ぶという仕様なので、2つのVLANを運ぶ物理リンクの書き方は扱いやすい一方、10G のホスト接続についてセグメントを省略した場合に「不明」を意味する点に注意が必要です。
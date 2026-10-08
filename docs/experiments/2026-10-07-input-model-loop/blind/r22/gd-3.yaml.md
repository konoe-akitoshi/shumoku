```yaml
name: 本社・AWS 東京ネットワーク
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
  - id: subnet-sub-a
    label: sub-a
    prefix: 10.0.1.0/24
    routingDomain: aws-main
    group: ap-northeast-1a

nodes:
  - id: rt-1
    type: ルータ
    product: Yamaha/RTX3510
    group: server-room
  - id: sw-1
    type: スイッチ
    product: ?/SWX2322P-16MT
    group: server-room
  - id: hv-1
    type: 仮想化ホスト
    product: Dell/PowerEdge R750
    software: VMware ESXi
    group: server-room
  - id: web-1
    type: VM
    host: hv-1
  - id: igw-1
    type: インターネットゲートウェイ
  - id: vgw-1
    type: 仮想プライベートゲートウェイ

redundancy: []

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
        port: "1"
    speed: 10G
  - endpoints:
      - node: web-1
      - segment: vlan-10
    virtual: true
  - endpoints:
      - node: igw-1
      - routingDomain: aws-main
    virtual: true
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

1. **表現できなかったこと:** トンネルが2本あること自体は同じ2ノード間のリンクを2本書いて表しましたが、各トンネル固有の情報は記述されていません。アベイラビリティゾーン `ap-northeast-1a` は場所のグループとして置きましたが、サブネットがそのAZにあるという関係を型で明示する専用フィールドはありません。
2. **補ったこと:** メモ欄は指定形式にないため、回答後に記しています。VPCをrouting domain、サブネットをsegmentとして表しました。AWS 東京をVPCのラベルに含め、各リンクで仮想接続としました。`port 1` は文字列 `"1"` としました。
3. **形式で迷った点:** `host` によってVMのホストを示しつつ、VLAN 10への接続はノードとsegmentの仮想リンクで表しました。VPNの2本を同じconnection IDで結びましたが、接続内の個々のリンクを区別するIDやトンネル番号のフィールドはありません。
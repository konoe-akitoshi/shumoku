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
  - id: sw-1
    type: switch
    product: ?/swx2322p-16mt
    group: server-room
  - id: hv-1
    type: hypervisor
    product: dell/poweredge-r750
    software: VMware ESXi
    group: server-room
  - id: web-1
    type: vm
    host: hv-1
  - id: igw-1
    type: internet-gateway
  - id: vgw-1
    type: vpn-gateway
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
        port: unknown
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
    description: tunnel 1 of 2
  - endpoints:
      - node: rt-1
      - node: vgw-1
    connection: site-to-site-vpn
    virtual: true
    description: tunnel 2 of 2
```

1. **表現できなかったこと:** AWS のリージョン（東京／`ap-northeast-1`）を表す専用フィールドはありません。サブネットのアベイラビリティゾーンは `group` に入れましたが、AZ を場所の階層として扱うのが適切かは形式だけでは決まりません。
2. **補ったこと・推測したこと:** ノードの `type` に `router`、`switch`、`hypervisor`、`vm`、`internet-gateway`、`vpn-gateway` を設定しました。形式に許可値の一覧がないためです。製品名は小文字のパスにしました。VLAN 10/20 のリンクは VLAN 10 と VLAN 20 の両方を運ぶため、rt-1 と sw-1 が両セグメントに属すると読み取りました。VPN の2本は別々のリンクとして表しました。
3. **形式で不明だったこと:** 「ポート不明」はポートを省略する意味なのか、不明であることを明示する値が必要なのかが分かりません。`port: unknown` として記載しました。仮想リンクに `virtual: true` を使いましたが、VPN トンネルや VM のアダプタがこの分類に当たるかは説明から読みました。
4. **時間:** 計測していません。
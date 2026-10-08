```yaml
name: network
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
  - id: vlan-20
    label: 来客
    vlan: 20
    routingDomain: guest
  - id: sub-a
    label: sub-a
    prefix: 10.0.1.0/24
    routingDomain: main
    group: ap-northeast-1a
groups:
  - id: hq
    label: 本社
  - id: server-room
    label: サーバ室
    parent: hq
  - id: ap-northeast-1a
    label: ap-northeast-1a
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
connections:
  - id: site-to-site-vpn
    label: IPsec Site-to-Site VPN
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

(1) **表現できなかったこと:** web-1 の `192.168.10.20` はセグメント上のアドレスとして表しました。トンネルが2本あることは2本のリンクで表せますが、各トンネルの個別設定や接続先の詳細は記述されていません。

(2) **補ったこと:** 形式上必要なIDとして `network`、`hq`、`server-room`、`vlan-10`、`vlan-20`、`sub-a` などを付けました。AWS 東京は場所として扱い、sub-a のグループに `ap-northeast-1a` を置きました。ルータ、スイッチ、サーバ、VM、ゲートウェイの `type` も補いました。記述にない接続詳細は追加していません。

(3) **不明瞭だったこと:** 型には `Segment.addresses` があるため、アドレスは `vlan-10.addresses.web-1` に置くのが自然ですが、単一アドレスを文字列で書くかリストにするかは説明だけでは決めにくいです。また、AWSリージョンを `Group` として表すか、サブネットの `group` にするかも明示されていません。⏱ 所要時間: 計測していません.
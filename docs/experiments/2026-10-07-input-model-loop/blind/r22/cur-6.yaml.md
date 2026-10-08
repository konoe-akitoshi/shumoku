```yaml
name: 本社とAWS東京
groups:
  - id: head-office
    label: 本社
  - id: server-room
    label: サーバ室
    parent: head-office

routingDomains:
  - id: guest
    label: guest

connections:
  - id: site-to-site-vpn
    label: IPsec Site-to-Site VPN

segments:
  - id: vlan-10
    label: VLAN 10
    vlan: 10
    prefix: 192.168.10.0/24
  - id: vlan-20
    label: VLAN 20
    vlan: 20
    routingDomain: guest
  - id: main
    label: main
    prefix: 10.0.0.0/16
  - id: sub-a
    label: sub-a
    prefix: 10.0.1.0/24
    routingDomain: main
    group: ap-northeast-1a
  - id: ap-northeast-1a
    label: ap-northeast-1a
    routingDomain: main

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
      - node: sw-1
      - node: hv-1
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
    assumed: true
    description: IPsec Site-to-Site VPN tunnel 1
  - endpoints:
      - node: rt-1
      - node: vgw-1
    connection: site-to-site-vpn
    virtual: true
    assumed: true
    description: IPsec Site-to-Site VPN tunnel 2
```

1. **表現できなかったこと:** VLAN 20 のラベル「来客」は記載しましたが、説明に VLAN 20 の prefix がないため、prefix は書けませんでした。VPN のトンネルが2本あることは2つのリンクで表しましたが、トンネル固有の設定はありません。

2. **推測・補足したこと:** ノードの `type`、製品パスの表記、ID、VPN の connection ID と各トンネルの説明を補いました。VM のポートグループ接続と VPN は `virtual: true` としました。VPN の存在は明記されていますが、個々のトンネルがどう表現されるかは不明なので、2本のリンクには `assumed: true` を付けました。AWS リージョンとサブネットの配置を表すため、リージョンを group、VPC を routing domain として扱いました。

3. **形式で不明だったこと:** AWS のリージョンのような場所を group にするのが適切か、またVPCを routing domain としたとき、その中のサブネットをどう表現するのが適切かは型だけでは判断できませんでした。VM のポートグループを仮想リンクとして表すのが意図に合うかも不明です。

所要時間: 約10分
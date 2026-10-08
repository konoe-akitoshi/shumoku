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
  - id: aws-main
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
  - id: subnet-sub-a
    label: sub-a
    prefix: 10.0.1.0/24
    routingDomain: aws-main
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
  - id: tunnel-1
    type: vpn-tunnel
  - id: tunnel-2
    type: vpn-tunnel

connections:
  - id: site-to-site-vpn
    label: IPsec Site-to-Site VPN

redundancy: []

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
    segments:
      - vlan-10
  - endpoints:
      - node: web-1
      - segment: vlan-10
    virtual: true
    description: VLAN 10 のポートグループ。アドレスは 192.168.10.20。
  - endpoints:
      - node: igw-1
      - routingDomain: aws-main
  - endpoints:
      - node: vgw-1
      - routingDomain: aws-main
  - endpoints:
      - node: rt-1
      - node: vgw-1
    connection: site-to-site-vpn
    virtual: true
    description: IPsec VPN トンネル 1
  - endpoints:
      - node: rt-1
      - node: vgw-1
    connection: site-to-site-vpn
    virtual: true
    description: IPsec VPN トンネル 2
```

1. **表現できなかったこと:** サブネットの `ap-northeast-1a` は availability zone で、場所の `group` として表すのは意味が違います。仮想ゲートウェイとインターネットゲートウェイを VPC に付けることは接続として表しましたが、形式にはゲートウェイ固有の関係がありません。VM のポートグループも、セグメントとノードの接続以上の情報は表せません。

2. **推測・追加したこと:** ノードの `type`、ID、ラベル、VPN 接続 ID とトンネルの表現は補いました。メーカー不明のスイッチ製品は `?/swx2322p-16mt` としました。VM とホストの所属場所、また VM アダプタのセグメント接続を表すための仮想リンクも補いました。リンクの `segments` が列挙済みのものだけを含む意味なので、既知のセグメントとして VLAN 10 のみを載せた箇所は、そのリンクが VLAN 10 だけを運ぶという記述がない以上、厳密には断定できません。VPN のトンネル数は記述どおり2本ですが、各リンクに `virtual` を付けたのはトンネルを物理ケーブルのない接続とみなしたためです。

3. **形式で不明瞭だったこと:** トンネルを `connection` に属するリンクとしてどう識別するか、同一端点間の複数リンクを区別する方法がありません。ポートグループやアベイラビリティゾーンに専用の属性もありません。また `virtual` は「ケーブルがない」ことを表しますが、IPsec トンネルがこの意味に当たるかは説明だけでは確定しません。

**所要時間:** 約10分
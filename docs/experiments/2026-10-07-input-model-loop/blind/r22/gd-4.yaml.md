```yaml
name: 本社・AWS東京

groups:
  - id: hq
    label: 本社
    groups:
      - id: server-room
        label: サーバ室
  - id: aws-tokyo
    label: AWS 東京
    groups:
      - id: ap-northeast-1a
        label: ap-northeast-1a

routingDomains:
  - id: guest-vrf
    label: guest
  - id: main-vpc
    label: main
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
    routingDomain: main-vpc
    group: ap-northeast-1a

nodes:
  - id: rt-1
    type: router
    product: Yamaha/RTX3510
    group: server-room
  - id: sw-1
    type: switch
    product: ?/SWX2322P-16MT
    group: server-room
  - id: hv-1
    type: virtualization-host
    product: Dell/PowerEdge R750
    software: VMware ESXi
    group: server-room
  - id: web-1
    type: vm
    host: hv-1
    addresses:
      vlan-10: 192.168.10.20
  - id: igw-1
    type: internet-gateway
    group: aws-tokyo
  - id: vgw-1
    type: virtual-private-gateway
    group: aws-tokyo

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
    speed: 10G
  - endpoints:
      - node: web-1
      - segment: vlan-10
    virtual: true
  - endpoints:
      - node: igw-1
      - routingDomain: main-vpc
  - endpoints:
      - node: rt-1
      - node: vgw-1
    virtual: true
    connection: site-to-site-vpn
    description: IPsec Site-to-Site VPN トンネル1/2
  - endpoints:
      - node: rt-1
      - node: vgw-1
    virtual: true
    connection: site-to-site-vpn
    description: IPsec Site-to-Site VPN トンネル2/2
```

1. **表現できなかったこと:** `Node` には `addresses` フィールドがないため、web-1 の `192.168.10.20` は型どおりには書けません。セグメント側の `addresses` に移す形が必要です。また、サブネットが `ap-northeast-1a` にあることはグループで表しましたが、型にはサブネットの可用性ゾーン専用の属性がありません。

2. **補ったこと:** 型の必須 `id` や参照用 ID を付けました。型に `type` の制約がないため、機器や AWS リソースの種類を `type` に入れました。AWS 東京をグループとして追加し、VPC とサブネットの配置を表しました。2本のVPNトンネルは、同じノード間の仮想リンクとして記述しました。

3. **形式で不明瞭だったこと:** トンネル2本を `Connection` と複数のリンクで表すのが意図に合うと判断しましたが、トンネル個別の名前や識別子を置く場所がありません。`NodeToNode` の `segments` と `NodeToSegment` のどちらを使うかも、ポートグループに接続する VM アダプタの例では判断に迷いました。

**所要時間:** 計測していません。
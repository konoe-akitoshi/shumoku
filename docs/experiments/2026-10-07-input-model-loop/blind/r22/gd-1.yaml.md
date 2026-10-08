```yaml
name: 本社とAWS東京
groups:
  - id: hq
    label: 本社
    groups:
      - id: server-room
        label: サーバ室

routingDomains:
  - id: guest-vrf
    label: guest
  - id: aws-main
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
  - id: sub-a
    label: sub-a
    prefix: 10.0.1.0/24
    routingDomain: aws-main
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
    type: virtualization host
    product: Dell/PowerEdge R750
    software: VMware ESXi
    group: server-room
  - id: web-1
    type: VM
    host: hv-1
    addresses:
      vlan-10: 192.168.10.20
  - id: igw-1
    type: internet gateway
  - id: vgw-1
    type: virtual private gateway

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
      - routingDomain: aws-main
    virtual: true
  - endpoints:
      - node: vgw-1
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

1. **表現できなかったこと:** サブネットが ap-northeast-1a にあることは、場所のグループとして記しました。VPN の「トンネル2本」は2本のリンクで表しましたが、各トンネルの詳細はありません。
2. **推測・補完したこと:** `type` の値、ID、リンクの表現を補いました。VLAN 20 のプレフィックスとアドレスは不明なので省略しました。`web-1` のアドレスを `Segment.addresses` 相当として記そうとしましたが、指定形式では `Node` に `addresses` はなく、この YAML は型に合いません。
3. **形式で不明瞭だったこと:** `Segment.addresses` でノードごとのアドレスを表す形式と、`Link.segments` で共有セグメントを表す形式の使い分け。AWS のアベイラビリティゾーンを `Group` として表すのが適切かどうかも判断しにくいです。時間は計測していません。
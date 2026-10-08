```yaml
name: 本社ネットワーク
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
    addresses: {}
  - id: igw-1
    type: internet gateway
  - id: vgw-1
    type: virtual private gateway
    host: aws-main
redundancy: []
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
      - node: rt-1
      - node: vgw-1
    virtual: true
    connection: site-to-site-vpn
    description: IPsec tunnel 1
  - endpoints:
      - node: rt-1
      - node: vgw-1
    virtual: true
    connection: site-to-site-vpn
    description: IPsec tunnel 2
```

1. **表現できなかったこと:** Web-1 の `192.168.10.20` はセグメント内のノードアドレスとして表す意図ですが、`addresses` は `Segment` にしか定義されていません。`addressInUnknownSegment` も既知セグメントのアドレスには適しません。
2. **補ったこと:** `name`、各種 ID、ノードの `type`、VPN 接続名とトンネルの説明を補いました。サブネットが属する場所を表す `group` が必要と考え、`ap-northeast-1a` をグループとして補っています。VPC 全体を `routingDomain`、サブネットを `segment` として表しました。VPN は2本の仮想リンクとして表しました。
3. **形式で迷った点:** `host` は NodeId または RedundancyId だけを受け取るため、VGW と VPC の関係には使えません。IGW のリンクは VPC 全体への接続として表しましたが、VPN と VPC の関係を直接表すリンク型はありません。サブネットの AZ を `group` に入れるのが適切かも明確ではありません。かかった時間は計測していません。
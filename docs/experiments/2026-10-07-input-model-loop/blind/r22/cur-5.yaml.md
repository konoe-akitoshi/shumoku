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
  - id: aws-main
    label: AWS 東京 VPC main
    prefix: 10.0.0.0/16

segments:
  - id: vlan-10
    label: VLAN 10（業務）
    vlan: 10
    prefix: 192.168.10.0/24
  - id: vlan-20
    label: VLAN 20（来客）
    vlan: 20
    routingDomain: guest
  - id: sub-a
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
    group: ap-northeast-1a
  - id: vgw-1
    type: virtual-private-gateway
    group: ap-northeast-1a

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
    description: VLAN 10 のポートグループ
  - endpoints:
      - node: igw-1
      - routingDomain: aws-main
  - endpoints:
      - node: vgw-1
      - routingDomain: aws-main
  - endpoints:
      - node: rt-1
      - node: vgw-1
    virtual: true
    connection: vpn-site-to-site
    description: IPsec Site-to-Site VPN トンネル 1
  - endpoints:
      - node: rt-1
      - node: vgw-1
    virtual: true
    connection: vpn-site-to-site
    description: IPsec Site-to-Site VPN トンネル 2

connections:
  - id: vpn-site-to-site
    label: IPsec Site-to-Site VPN

redundancy: []
```

1. **表現できなかったこと:** VM のアダプタがポートグループに「ある」ことは仮想リンクで表しましたが、ポートグループ名は記述されていません。AWS 東京がリージョンであることも、専用のフィールドがないため group のラベルにせず、VPC のラベルに含めました。

2. **推測・補足したこと:** ノードの `type`、ID、英小文字の product パス表記、各 group ID は補いました。AWS の VPC とサブネットを routing domain と segment に対応づけ、AZ をサブネットの group として表しました。VPN の2本を同じ connection に属する仮想リンクとして記述しました。web-1 の住所は VLAN 10 の segment address に記載する想定ですが、YAML では書き漏らしています。

3. **形式で迷った点:** VPN の2本を `Connection` と2本の `Link` で表す解釈にしました。ポートグループに対応する型がないため、VM と segment の仮想リンクで表しています。`Redundancy` はこの記述には該当しないため省略できます。かかった時間は計測していません。
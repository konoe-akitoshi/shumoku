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
connections:
  - id: site-to-site-vpn
    label: IPsec Site-to-Site VPN
segments:
  - id: vlan-10
    label: VLAN 10
    vlan: 10
    prefix: 192.168.10.0/24
    group: server-room
    addresses:
      web-1: 192.168.10.20
  - id: vlan-20
    label: VLAN 20
    vlan: 20
    routingDomain: guest-vrf
  - id: aws-vpc-main
    label: AWS 東京 VPC main
    prefix: 10.0.0.0/16
  - id: aws-subnet-sub-a
    label: sub-a (ap-northeast-1a)
    prefix: 10.0.1.0/24
    routingDomain: aws-vpc-main
nodes:
  - id: rt-1
    label: rt-1
    type: router
    product: Yamaha/RTX3510
    group: server-room
  - id: sw-1
    label: sw-1
    type: switch
    product: ?/SWX2322P-16MT
    group: server-room
  - id: hv-1
    label: hv-1
    type: virtualization host
    product: Dell/PowerEdge R750
    software: VMware ESXi
    group: server-room
  - id: web-1
    label: web-1
    type: VM
    host: hv-1
  - id: igw-1
    label: igw-1
    type: internet gateway
  - id: vgw-1
    label: vgw-1
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
  - virtual: true
    endpoints:
      - node: web-1
      - segment: vlan-10
    segments: []
  - virtual: true
    connection: site-to-site-vpn
    description: IPsec Site-to-Site VPN tunnel 1
    endpoints:
      - node: rt-1
      - node: vgw-1
  - virtual: true
    connection: site-to-site-vpn
    description: IPsec Site-to-Site VPN tunnel 2
    endpoints:
      - node: rt-1
      - node: vgw-1
  - virtual: true
    endpoints:
      - node: igw-1
      - routingDomain: aws-vpc-main
```

1. **表現できなかったこと:** サブネットの availability zone（`ap-northeast-1a`）と AWS のリージョン（東京）は、型に専用フィールドがないためラベルに含めました。VM のポートグループも名前が示されていないので、VLAN 10 への仮想リンクで表しています。VPN がどの VPC segment に接続するかは記述されていません。
2. **補ったこと:** `guest-vrf` を routing domain として作り、VLAN 20 を所属させました。VPC を routing domain とみなし、VPC のプレフィックスをそこに記載する形で表しました。トンネル 2 本は別々の仮想リンクとして表現しました。VLAN 10/20 の共有リンク、VM の VLAN 10 接続、インターネットゲートウェイの VPC 接続は、説明にある関係をリンクとして補いました。
3. **不明確だった点:** `segments` をリンクに列挙すると「それ以外を運ばない」と読めるため、VLAN 10 と VLAN 20 を両方列挙しました。VM の仮想リンクで `segments: []` とすると「セグメントを運ばない」と明示することになり、意図に合わないため省きました。所要時間は計測できませんでした。
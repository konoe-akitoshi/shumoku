```yaml
name: 本社とAWS東京
groups:
  - id: hq
    label: 本社
    groups:
      - id: server-room
        label: サーバ室
  - id: aws-tokyo
    label: AWS 東京
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
    group: aws-tokyo
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
    type: virtualization-host
    product: Dell/PowerEdge R750
    software: VMware ESXi
    group: server-room
  - id: web-1
    label: web-1
    type: virtual-machine
    host: hv-1
    group: server-room
  - id: igw-1
    label: igw-1
    type: internet-gateway
    group: aws-tokyo
  - id: vgw-1
    label: vgw-1
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
  - endpoints:
      - node: rt-1
      - node: vgw-1
    virtual: true
    connection: site-to-site-vpn
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
    group: aws-tokyo
```

1. **表現できなかったこと:** サブネット `sub-a` が `ap-northeast-1a` にあること。型にはアベイラビリティーゾーンの項目がなく、`group` は場所を表しますが、グループを追加して可用性ゾーンとして表すのは意味を補うことになるため避けました。また、`web-1` のポートグループ名は記載されていません。

2. **推測・追加したこと:** `rt-1` と `vgw-1` の間に、トンネル2本をそれぞれ仮想リンクとして記述しました。ノードの `type`、各場所、VPCの routing domain といった情報も、記述内容を分類するために補っています。形式にはリンクのプロトコル項目がないため、IPsec は connection のラベルに含めました。

3. **形式で迷った点:** 型では `routingDomain` がセグメントに付く一方、VPC 全体への接続も表せますが、VPC の CIDR を routing domain の `prefix` に置くのが適切か迷いました。また、2本のトンネルを区別する項目がないため、同じ connection の重複リンクで表しました。

所要時間は計測していません。
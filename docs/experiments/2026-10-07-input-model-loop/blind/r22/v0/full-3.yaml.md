```yaml
name: Headquarters and AWS Tokyo
groups:
  - id: server-room
    label: Server room
  - id: ap-northeast-1a
    label: ap-northeast-1a
routingDomains:
  - id: guest
    label: guest
  - id: main
    label: main
    prefix: 10.0.0.0/16
segments:
  - id: v10
    label: Business
    vlan: 10
    prefix: 192.168.10.0/24
    addresses:
      web-1: 192.168.10.20
  - id: v20
    label: VLAN 20
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
    type: server
    product: dell/poweredge-r750
    software: VMware ESXi
    group: server-room
  - id: web-1
    type: vm
    host: hv-1
links:
  - endpoints:
      - node: rt-1
        port: lan3
      - node: sw-1
        port: port 1
    speed: 1G
    cable: Cat6
    length: 3m
    segments: [v10, v20]
  - endpoints:
      - node: hv-1
      - node: sw-1
    speed: 10G
  - endpoints:
      - node: web-1
      - segment: v10
    virtual: true
  - endpoints:
      - node: rt-1
      - node: main
  - endpoints:
      - node: rt-1
      - node: vgw-1
    connection: vpn-1
    description: IPsec Site-to-Site VPN, 2 tunnels
  - endpoints:
      - node: igw-1
      - node: main
    virtual: true
```

1. **表現できなかったこと:** VM のアダプタが VLAN 10 のポートグループにあることは、`web-1` と `v10` の仮想リンクとして表しましたが、「ポートグループ」という属性は表現できませんでした。VPN の「2本」は接続の説明に記しましたが、トンネルを個別の要素としては表現できませんでした。

2. **補ったこと:** 形式に合わせてネットワーク名を `Headquarters and AWS Tokyo` とし、サーバ室と Availability Zone をグループとして置きました。型番の表記を小文字化しました。`igw-1`、`vgw-1` はノードとして、VPC への VPN は `connection` として記述しました。

3. **不明だったこと:** VPC を `routingDomains` として表し、VPC へのリンクを `rt-1` と VPC の間に置く形が適切か不明でした。`connection` の定義と VPN トンネル数の表現方法も形式例からは分かりませんでした。かかった時間は計測していません。
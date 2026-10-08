```yaml
name: 本社
groups:
  - id: server-room
    label: サーバ室
  - id: aws-tokyo
    label: AWS 東京
  - id: vpc-main
    label: VPC main
  - id: subnet-sub-a
    label: サブネット sub-a
nodes:
  - id: rt-1
    label: rt-1
    type: router
    product: Yamaha/RTX3510
    group: server-room
  - id: sw-1
    label: sw-1
    type: switch
    model: SWX2322P-16MT
    group: server-room
  - id: hv-1
    label: hv-1
    type: server
    vendor: Dell
    model: PowerEdge R750
    os: VMware ESXi
    group: server-room
  - id: web-1
    label: web-1
    type: vm
    address: 192.168.10.20
    group: server-room
  - id: igw-1
    label: igw-1
    type: internet-gateway
    group: vpc-main
  - id: vgw-1
    label: vgw-1
    type: virtual-private-gateway
    group: vpc-main
links:
  - endpoints:
      - node: rt-1
        port: lan3
      - node: sw-1
        port: "1"
    speed: 1G
    cable: Cat6
    length: 3m
    vlans:
      - id: 10
        name: 業務
        subnet: 192.168.10.0/24
      - id: 20
        name: 来客
        vrf: guest
        vrf_node: rt-1
  - endpoints:
      - node: hv-1
      - node: sw-1
    speed: 10G
  - endpoints:
      - node: web-1
      - node: hv-1
    port_group:
      vlan: 10
  - endpoints:
      - node: rt-1
      - node: vgw-1
    type: ipsec-site-to-site-vpn
    protocol: IPsec
    tunnels: 2
```

1. **表現できなかったこと:** 型番や OS、ノード種別、VPC CIDR・サブネット CIDR/AZ などに対応するフィールドが例から確認できないため、型が許すと判断できる項目のみ記述しました。VPC とサブネット自体もノードとして表す必要があるか分からず、グループで表しました。
2. **推測・補足したこと:** `server-room`、AWS/VPC/サブネットのグループ構造、各 `type` 値、フィールド名は補いました。Yamaha をメーカーとして `product: Yamaha/RTX3510` にまとめ、型番は `model` にしました。VPN のトンネル数なども例にないフィールドで表しました。
3. **不明だったこと:** `types.ts` が提示されていないため、許されるノード種別・属性名、階層グループの扱い、VLAN/VRF、仮想化ホストと VM、クラウド構成、VPN の表現方法が分かりません。所要時間は計測していません。
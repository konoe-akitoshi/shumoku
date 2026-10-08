```yaml
name: 本社
groups:
  - id: server-room
    label: サーバ室
nodes:
  - id: rt-1
    label: rt-1
    type: router
    product: yamaha/rtx3510
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
  - id: web-1
    label: web-1
    type: vm
    host: hv-1
    adapters:
      - network: VLAN 10
        address: 192.168.10.20
  - id: aws-tokyo
    label: AWS 東京
    type: cloud
  - id: main
    label: main
    type: vpc
    cidr: 10.0.0.0/16
    region: ap-northeast-1
    parent: aws-tokyo
  - id: sub-a
    label: sub-a
    type: subnet
    cidr: 10.0.1.0/24
    availability_zone: ap-northeast-1a
    parent: main
  - id: igw-1
    label: igw-1
    type: internet-gateway
    parent: main
  - id: vgw-1
    label: vgw-1
    type: virtual-private-gateway
    parent: main
links:
  - endpoints:
      - node: rt-1
        port: lan3
      - node: sw-1
        port: "1"
    speed: 1G
    cable:
      length: 3m
      type: Cat6
    vlans:
      - id: 10
        label: 業務
        cidr: 192.168.10.0/24
      - id: 20
        label: 来客
        vrf: guest
    vrf: guest
  - endpoints:
      - node: sw-1
      - node: hv-1
    speed: 10G
  - endpoints:
      - node: rt-1
      - node: vgw-1
    type: vpn
    protocol: IPsec
    connection: Site-to-Site
    tunnels: 2
```

1. **表現できなかったこと:** 例の形式だけでは `types.ts` の実際の型が分からないため、上記の多くの属性や階層表現が有効か判断できません。特に VM のポートグループ、VLAN とサブネットの対応、VRF の所属、AWS リソースの親子関係、VPN のトンネル数を表せるかは不明です。
2. **推測・補完したこと:** `server-room`、AWS の親ノード `aws-tokyo`、各種 `type` 名、属性名、`yamaha/rtx3510` の製品表記、VPN のリンク属性を補いました。型番しか記録されていないスイッチのメーカーは追加していません。VLAN 10/20 はリンク上の情報として記載し、VRF は VLAN 20 に付けました。
3. **形式で不明だった点:** `groups` がどの範囲の機器をまとめるか、ノードの親子関係や製品・OSの書き方、リンクの端点やポート省略の扱い、リンクに VLAN・ケーブル・VPN 情報を持たせる方法が分かりません。
4. **時間:** 計測していません。
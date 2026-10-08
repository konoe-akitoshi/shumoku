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
    vlans:
      - id: 10
        label: 業務
        subnet: 192.168.10.0/24
      - id: 20
        label: 来客
        vrf: guest
  - id: sw-1
    label: sw-1
    type: switch
    model: SWX2322P-16MT
    group: server-room
  - id: hv-1
    label: hv-1
    type: server
    product: dell/poweredge-r750
    hypervisor: VMware ESXi
  - id: web-1
    label: web-1
    type: vm
    host: hv-1
    adapters:
      - port-group: VLAN 10
        vlan: 10
        address: 192.168.10.20
  - id: vpc-main
    label: main
    type: vpc
    cloud: aws
    region: ap-northeast-1
    cidr: 10.0.0.0/16
  - id: sub-a
    label: sub-a
    type: subnet
    cidr: 10.0.1.0/24
    availability-zone: ap-northeast-1a
    parent: vpc-main
  - id: igw-1
    label: igw-1
    type: internet-gateway
    attached-to: vpc-main
  - id: vgw-1
    label: vgw-1
    type: virtual-private-gateway
    attached-to: vpc-main
links:
  - endpoints:
      - node: rt-1
        port: lan3
      - node: sw-1
        port: '1'
    speed: 1G
    cable:
      length: 3m
      type: Cat6
    vlans:
      - 10
      - 20
  - endpoints:
      - node: sw-1
        port: unknown
      - node: hv-1
    speed: 10G
  - endpoints:
      - node: rt-1
      - node: vgw-1
    type: ipsec-site-to-site-vpn
    tunnels: 2
```

1. **表せなかったこと:** この例だけでは、VLAN、VRF、VM、クラウド資源、VPN、ケーブルなどの項目に対応する型やフィールドが確認できません。上の記述が `Network` として有効かは分かりません。
2. **推測・補足したこと:** 本社をグループ名として補いました。機器種別、メーカー付きの製品名、ノード ID、AWS リージョンの表記なども補っています。sw-1 のポートは不明のまま記す方法が分からず、`unknown` としました。
3. **形式で不明だったこと:** この例からは、必須フィールド、許される `type` 値、製品名やモデルの書き方、親子関係、リンク属性の表現方法が分かりません。所要時間: 計測していません。
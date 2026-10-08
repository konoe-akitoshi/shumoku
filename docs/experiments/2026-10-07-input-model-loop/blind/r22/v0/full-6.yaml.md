```yaml
name: 本社サーバ室とAWS東京
groups:
  - id: server-room
    label: 本社のサーバ室
  - id: ap-northeast-1a
    label: ap-northeast-1a
routingDomains:
  - id: guest
    label: guest
segments:
  - id: vlan-10
    label: VLAN 10
    vlan: 10
    label: 業務
    prefix: 192.168.10.0/24
  - id: vlan-20
    label: 来客
    vlan: 20
    routingDomain: guest
  - id: vpc-main
    label: main
    prefix: 10.0.0.0/16
  - id: sub-a
    label: sub-a
    prefix: 10.0.1.0/24
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
        port: "1"
    speed: 1G
    cable: Cat6
    length: 3m
    segments: [vlan-10, vlan-20]
  - endpoints:
      - node: hv-1
      - node: sw-1
    speed: 10G
  - endpoints:
      - node: web-1
      - segment: vlan-10
    virtual: true
connections:
  - id: vpn-1
    label: IPsec Site-to-Site VPN
redundancy:
  - id: vpn-tunnels
    label: VPN tunnels
    assumed: true
    # Tunnel endpoints are not represented as separate nodes or links in the example format.
nodes:
  - id: igw-1
    type: internet-gateway
  - id: vgw-1
    type: vpn-gateway
  - id: aws-vpc-main
    type: cloud
    label: AWS Tokyo VPC main
links:
  - endpoints:
      - node: igw-1
      - segment: vpc-main
    virtual: true
  - endpoints:
      - node: vgw-1
      - segment: vpc-main
    virtual: true
  - endpoints:
      - node: rt-1
      - node: vgw-1
    connection: vpn-1
    description: 2 tunnels
  - endpoints:
      - node: web-1
      - segment: sub-a
    virtual: true
```

1. The format/example does not show how to express a VPC as a container distinct from a network segment, or how to explicitly say that `sub-a` is a subnet of the VPC. I represented the VPC as a segment and attached the gateways to it.
2. I added a server-room group and an availability-zone group from the stated locations. I inferred node types for the gateways and labeled the VPN connection. The format does not show a clear way to represent the two VPN tunnels separately, so I recorded “2 tunnels” in the link description and added an assumed redundancy entry.
3. The example uses `label` twice for VLAN 10, so the YAML would have duplicate keys. Also unclear: whether `host` alone captures a VM running on a server, how to attach an address to a VM adapter/port group, and whether a gateway-to-segment link represents attachment to a VPC. I could not determine how to represent the VPN tunnel count without guessing.

かかった時間: 計測していません.
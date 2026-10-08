```yaml
groups:
  - id: hq
    label: 本社
    groups:
      - id: server-room
        label: サーバ室

routingDomains:
  - id: guest
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
    group: server-room
    addresses:
      web-1: 192.168.10.20
  - id: vlan-20
    label: 来客
    vlan: 20
    routingDomain: guest
    group: server-room
  - id: sub-a
    label: sub-a
    prefix: 10.0.1.0/24
    routingDomain: aws-main

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
    group: server-room
  - id: igw-1
    label: igw-1
    type: internet gateway
    group: server-room
  - id: vgw-1
    label: vgw-1
    type: virtual private gateway
    group: server-room

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
        port: port 1
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
  - endpoints:
      - node: rt-1
      - node: vgw-1
    virtual: true
    connection: site-to-site-vpn
```

1. Expressing the subnet’s availability zone (`ap-northeast-1a`) was not possible with these types.
2. I inferred that web-1’s adapter is a virtual link to VLAN 10, that the internet gateway attaches to the VPC as a virtual link, and that the two VPN tunnels are two parallel virtual links in one connection. I also treated the VPC as a routing domain and placed the AWS gateway nodes in the server room; the format has no cloud-region or cloud-location field. The switch port for hv-1 is unspecified, so I left it out. The description does not give addresses for VLAN 20.
3. The format does not define how to represent subnets and availability zones beyond segments and their prefixes, or whether a VPN connection’s two tunnels should be modeled as parallel links. It is also unclear whether `segments` on the router-to-switch link means the VLANs it carries, as assumed here.
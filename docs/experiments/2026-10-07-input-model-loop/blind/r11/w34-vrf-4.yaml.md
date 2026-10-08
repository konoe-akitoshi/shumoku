```yaml
name: Company network
groups:
  - id: server-room
    label: Server room
  - id: ap-northeast-1a
    label: ap-northeast-1a
  - id: ap-northeast-1c
    label: ap-northeast-1c

routingDomains:
  - id: guest
    label: guest
  - id: main
    label: VPC main
    prefix: 10.0.0.0/16

segments:
  - id: vlan-20
    label: VLAN 20
    vlan: 20
    prefix: 192.168.20.0/24
    routingDomain: guest
    group: server-room
    addresses:
      ap-1: 192.168.20.5
  - id: vlan-10
    label: VLAN 10
    vlan: 10
    prefix: 192.168.10.0/24
    group: server-room
    addresses:
      fw-v: 192.168.10.2
      app-1: 192.168.10.20
  - id: sub-a
    label: sub-a
    prefix: 10.0.1.0/24
    routingDomain: main
    group: ap-northeast-1a
    addresses:
      web-c: 10.0.1.10
  - id: sub-c
    label: sub-c
    prefix: 10.0.2.0/24
    routingDomain: main
    group: ap-northeast-1c
    addresses:
      db-c: 10.0.2.20

connections:
  - id: vpn-1
    label: Site-to-Site VPN

redundancy:
  - id: prod
    label: prod
    nodes:
      - hv-1
      - hv-2

nodes:
  - id: rt-1
    label: rt-1
    type: router
    product: yamaha/rtx3510
    group: server-room
  - id: ap-1
    label: ap-1
    type: access-point
    group: server-room
  - id: hv-1
    label: hv-1
    type: server
    product: dell/poweredge-r750
    software: VMware ESXi
    group: server-room
  - id: hv-2
    label: hv-2
    type: server
    product: dell/poweredge-r750
    software: VMware ESXi
    group: server-room
  - id: fw-v
    label: fw-v
    type: firewall
    product: palo-alto-networks/vm-series
    software: PAN-OS
    host: hv-1
  - id: app-1
    label: app-1
    type: virtual-machine
    software: Ubuntu
    host: prod
  - id: web-c
    label: web-c
    type: virtual-machine
    product: aws/ec2/t3.medium
    software: Amazon Linux
    group: ap-northeast-1a
  - id: db-c
    label: db-c
    type: database
    product: aws/rds/mysql
    group: ap-northeast-1c
  - id: igw-1
    label: igw-1
    type: internet-gateway
    product: aws/internet-gateway
  - id: tgw-1
    label: tgw-1
    type: transit-gateway
    product: aws/transit-gateway

links:
  - endpoints:
      - node: ap-1
        port: wireless
      - node: rt-1
        port: lan2
    segments:
      - vlan-20
  - endpoints:
      - node: hv-1
      - node: rt-1
    speed: 10G
    segments:
      - vlan-10
  - endpoints:
      - node: hv-2
      - node: rt-1
    speed: 10G
    segments:
      - vlan-10
  - endpoints:
      - node: fw-v
      - segment: vlan-10
    virtual: true
  - endpoints:
      - node: app-1
      - segment: vlan-10
    virtual: true
  - endpoints:
      - node: igw-1
      - routingDomain: main
  - endpoints:
      - node: tgw-1
      - segment: sub-a
  - endpoints:
      - node: tgw-1
      - segment: sub-c
  - endpoints:
      - node: rt-1
      - node: tgw-1
    connection: vpn-1
    virtual: true
  - endpoints:
      - node: rt-1
      - node: tgw-1
    connection: vpn-1
    virtual: true
```

1. **Could not express:** The VPN’s two IPsec tunnels are represented as two links in one connection, but the format has no field for tunnel protocol or IPsec details. The main routing table on `rt-1` is not a separate routing domain under the definition, so it is left implicit. The VPC attachment’s use of both subnets is shown as links to the segments; the format does not explicitly label those links as an attachment.

2. **Guesses or additions:** I used `server-room` and the two availability zones as groups, and assigned the AWS instances to their respective zone groups based on subnet placement. I used generic node types and product paths where the description did not prescribe exact values. I interpreted VMware ESXi as the software on the hosts, PAN-OS as the firewall software, and “Amazon Linux” as software. The AP’s link port `wireless` is a guess; the description gives its address and the router port, but not the AP’s port. I marked VM adapter links and VPN tunnel links `virtual: true` because the description identifies them as virtual adapters or tunnels without cables. I left `tgw-1`’s links to the subnet segments without `virtual`, since the format says a link whose way is unknown is neither virtual nor given a cable.

3. **Unclear in the format:** Whether `product` should encode cloud services and instance/database variants the same way as hardware products; whether a virtual endpoint link should list the segment in `segments` or connect directly to it; and how to represent a connection’s tunnel count or technology beyond modeling it as multiple links.
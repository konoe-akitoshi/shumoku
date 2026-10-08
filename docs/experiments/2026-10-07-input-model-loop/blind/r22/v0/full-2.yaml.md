```yaml
name: Headquarters and AWS Tokyo

routingDomains:
  - id: guest
    label: guest

segments:
  - id: vlan-10
    label: Business
    vlan: 10
    prefix: 192.168.10.0/24
    addresses:
      web-1: 192.168.10.20
  - id: vlan-20
    label: Guest
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
  - id: sw-1
    type: switch
    product: ?/swx2322p-16mt
  - id: hv-1
    type: server
    product: dell/poweredge-r750
    software: VMware ESXi
  - id: web-1
    type: vm
    host: hv-1
  - id: igw-1
    type: internet-gateway
  - id: vgw-1
    type: vpn-gateway

links:
  - endpoints:
      - node: rt-1
        port: lan3
      - node: sw-1
        port: port 1
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
  - endpoints:
      - node: igw-1
      - segment: vpc-main
  - endpoints:
      - node: rt-1
      - node: vgw-1
    description: IPsec Site-to-Site VPN, two tunnels
```

1. **Could not express:** The VPC-to-subnet relationship and that the internet gateway is attached to the VPC, beyond representing both as segments and linking the gateway to the VPC segment. The availability zone is recorded as a group label because the example format has no explicit availability-zone field. The VM’s adapter being in a VLAN 10 port group is represented as a virtual link to the VLAN segment.
2. **Guesses/additions:** I used `router`, `server`, `vm`, `switch`, and `vpn-gateway` node types; normalized product names to lowercase vendor/model strings; and used `?` for the unknown switch manufacturer, following the example. I represented the two VPN tunnels in the link description because the example does not show a tunnel-count field. I added IDs and labels for the VLANs and VPC-derived segment.
3. **Unclear:** Whether VPCs and subnets should be modeled as segments or groups, and how to express containment, attachment, and availability zones. It is also unclear whether multiple VPN tunnels should be separate links or properties of one connection.
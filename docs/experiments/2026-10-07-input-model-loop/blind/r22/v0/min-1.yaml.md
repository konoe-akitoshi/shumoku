```yaml
name: Head office
groups:
  - id: server-room
    label: Server room
  - id: vpc-main
    label: AWS Tokyo VPC main
    type: vpc
    cidr: 10.0.0.0/16
  - id: subnet-a
    label: Subnet sub-a
    type: subnet
    cidr: 10.0.1.0/24
    availabilityZone: ap-northeast-1a
    group: vpc-main
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
    ip: 192.168.10.20
    host: hv-1
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
    medium: Cat6
    length: 3m
    vlans:
      - id: 10
        label: business
        cidr: 192.168.10.0/24
      - id: 20
        label: guest
    vrf: guest
  - endpoints:
      - node: hv-1
      - node: sw-1
    speed: 10G
  - endpoints:
      - node: rt-1
      - node: vgw-1
    type: ipsec-site-to-site-vpn
    tunnels: 2
```

1. I could not express that `web-1`’s adapter is on the VLAN 10 port group; I also could not clearly represent the VM’s placement on `hv-1`.
2. I assumed field names and values for models, software, AWS resource types, VLANs, VRFs, VPNs, and tunnels. I also assumed VLAN 10’s label could be `business`, and that the router-to-VGW link can omit physical ports.
3. The format’s supported fields, nesting, and relationship rules are unclear. The example does not show how to represent cloud resources, subnets, VM hosting, VLAN/VRF membership, link media and length, or VPN tunnels. I spent about 10 minutes.
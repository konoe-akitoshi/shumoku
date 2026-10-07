```yaml
name: Company network

segments:
  - id: vlan-10
    label: staff
    vlan: 10
    prefix: 192.168.1.0/24
    addresses:
      web-1: 192.168.1.20

  - id: vlan-30
    label: database
    vlan: 30
    prefix: 192.168.3.0/24

nodes:
  - id: core
    type: switch

  - id: esx-1
    type: virtualization-host
    product: vmware/esxi
    members: []
  
  - id: esx-2
    type: virtualization-host
    product: vmware/esxi

  - id: esx-3
    type: virtualization-host
    product: vmware/esxi

  - id: web-1
    type: vm
    host: esx-1
    segments:
      - vlan-10

  - id: db-1
    type: vm
    host: prod
    segments:
      - vlan-30

  - id: mon-1
    type: vm
    address: 10.99.0.50

redundancy:
  - id: prod
    label: prod
    nodes:
      - esx-1
      - esx-2
      - esx-3

links:
  - endpoints:
      - node: core
      - node: esx-1
    speed: 25G
    segments:
      - vlan-10
      - vlan-30

  - endpoints:
      - node: core
      - node: esx-2
    speed: 25G
    segments:
      - vlan-10
      - vlan-30

  - endpoints:
      - node: core
      - node: esx-3
    speed: 25G
    segments:
      - vlan-10
      - vlan-30
```

1. The description's guarantee that the cables carry VLAN 10 and VLAN 30 **and nothing else** is expressible: each link lists its complete set of segments.
2. I added generic node types and the network name `Company network`; neither was specified. I treated `vmware/esxi` as the product path for the ESXi hosts. The description says web-1 runs on esx-1, so I used that host; for db-1, I used the `prod` redundancy ID to express that it runs on an unknown cluster member. I left mon-1's host and segment unknown.
3. The format does not specify how to represent a product when only the software is known. I used `product: vmware/esxi` because the description identifies the hosts as VMware ESXi. It is unclear whether the redundancy ID in `host` is the intended reference for an unknown cluster member.
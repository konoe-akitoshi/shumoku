```yaml
name: Company network
routingDomains:
  - id: staff
    prefix: 192.168.1.0/24
  - id: database
    prefix: 192.168.3.0/24
segments:
  - id: vlan-10
    label: staff
    vlan: 10
    prefix: 192.168.1.0/24
    routingDomain: staff
    addresses:
      web-1: 192.168.1.20
  - id: vlan-30
    label: database
    vlan: 30
    prefix: 192.168.3.0/24
    routingDomain: database
nodes:
  - id: core
    type: switch
  - id: esx-1
    type: server
    software: VMware ESXi
    segments:
      - vlan-10
      - vlan-30
  - id: esx-2
    type: server
    software: VMware ESXi
    segments:
      - vlan-10
      - vlan-30
  - id: esx-3
    type: server
    software: VMware ESXi
    segments:
      - vlan-10
      - vlan-30
  - id: web-1
    type: vm
    host: esx-1
  - id: db-1
    type: vm
    host: prod
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

1. The format has no way to express a VM’s network adapter or port-group membership directly. I represented the VM’s presence in a segment through the segment’s `addresses` map for `web-1`; `db-1` has no address to record.
2. I inferred that the two listed prefixes represent separate routing domains and assigned them IDs. The description names VLANs and subnets but does not say whether they use separate routing tables. I also used generic node types (`switch`, `server`, `vm`), which the description does not specify.
3. It is unclear whether a VM that runs on a redundancy set should be considered present in a segment without a known link. The format allows `host: prod`, and segment addresses can be keyed by node, but it does not say whether `db-1` should be listed in `vlan-30` without an address.
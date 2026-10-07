```yaml
name: Virtual machine network

routingDomains:
  - id: server-room-lan

segments:
  - id: staff
    label: VLAN 10
    vlan: 10
    prefix: 192.168.1.0/24
    routingDomain: server-room-lan
    addresses:
      web-1: 192.168.1.20

  - id: database
    label: VLAN 30
    vlan: 30
    prefix: 192.168.3.0/24
    routingDomain: server-room-lan

redundancy:
  - id: prod
    label: vSphere HA cluster
    nodes:
      - esx-1
      - esx-2
      - esx-3

nodes:
  - id: core
    type: switch
    routingDomain: server-room-lan

  - id: esx-1
    type: virtualization host
    product: vmware/esxi
    routingDomain: server-room-lan

  - id: esx-2
    type: virtualization host
    product: vmware/esxi
    routingDomain: server-room-lan

  - id: esx-3
    type: virtualization host
    product: vmware/esxi
    routingDomain: server-room-lan

  - id: web-1
    type: virtual machine
    host: esx-1

  - id: db-1
    type: virtual machine
    host: prod
    segments:
      - database

  - id: mon-1
    type: virtual machine
    address: 10.99.0.50
    assumed: true

links:
  - endpoints:
      - node: core
      - node: esx-1
    speed: 25G
    segments:
      - staff
      - database

  - endpoints:
      - node: core
      - node: esx-2
    speed: 25G
    segments:
      - staff
      - database

  - endpoints:
      - node: core
      - node: esx-3
    speed: 25G
    segments:
      - staff
      - database
```

1. The description says the three hosts’ VMs restart on another cluster host after a host failure, but the format has no field for that specific HA behavior.
2. I named the single routing domain `server-room-lan` and assigned the known VLANs and core/hosts to it. The description does not explicitly say they share one routing table. I used generic node types and `vmware/esxi` as product details. I marked `mon-1` as assumed because it is known only from monitoring; the format’s `assumed` means believed to exist but unconfirmed, so that may not fit the description exactly.
3. The format does not define whether a VM’s adapter placement should be represented by listing its segment in `Node.segments` when no link exists. I used that for `db-1`; `web-1` is implied to be in `staff` through the address entry. Also unclear: `Redundancy.nodes` lists member nodes but does not say whether its id can be used as `Node.host` for a VM whose specific host is unknown.
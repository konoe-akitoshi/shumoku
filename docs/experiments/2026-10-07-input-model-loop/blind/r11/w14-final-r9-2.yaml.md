```yaml
name: Company network

segments:
  - id: vlan-10
    label: Staff
    vlan: 10
    prefix: 192.168.1.0/24
    addresses:
      web-1: 192.168.1.20

  - id: vlan-30
    label: Database
    vlan: 30
    prefix: 192.168.3.0/24

redundancy:
  - id: prod
    label: prod
    nodes:
      - esx-1
      - esx-2
      - esx-3

nodes:
  - id: core
    type: switch

  - id: esx-1
    label: esx-1
    product: vmware/esxi
    software: VMware ESXi

  - id: esx-2
    label: esx-2
    product: vmware/esxi
    software: VMware ESXi

  - id: esx-3
    label: esx-3
    product: vmware/esxi
    software: VMware ESXi

  - id: web-1
    label: web-1
    host: esx-1
    segments:
      - vlan-10

  - id: db-1
    label: db-1
    host: prod
    segments:
      - vlan-30

  - id: mon-1
    label: mon-1
    address: 10.99.0.50
    assumed: true

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

1. The vSphere HA behavior—VMs restart on another cluster host when a host fails—has no field in the format. The cluster membership is represented as redundancy, but its failover behavior is not.
2. I inferred `mon-1` is unconfirmed from “known only from the monitoring system.” The format’s `assumed` field means believed to exist but not confirmed, which may not be what that description means. I also used `vmware/esxi` as a product path, although the description only identifies the hosts as running VMware ESXi.
3. The format does not make clear whether `host: prod` means the VM runs on an unspecified member of the redundancy set, or whether it could be interpreted as a physical host with ID `prod`. It also does not say how to represent a VM whose host is unknown, as with `mon-1`.
```yaml
groups:
  - id: server-room
    label: Server room

segments:
  - id: staff
    vlan: 10
    prefix: 192.168.1.0/24
    addresses:
      web-1: 192.168.1.20
  - id: database
    vlan: 30
    prefix: 192.168.3.0/24

redundancy:
  - id: prod
    nodes: [esx-1, esx-2, esx-3]

nodes:
  - id: core
    type: switch
    group: server-room
  - id: esx-1
    type: virtualization-host
    software: VMware ESXi
    group: server-room
  - id: esx-2
    type: virtualization-host
    software: VMware ESXi
    group: server-room
  - id: esx-3
    type: virtualization-host
    software: VMware ESXi
    group: server-room
  - id: web-1
    type: vm
    host: esx-1
    group: server-room
  - id: db-1
    type: vm
    host: prod
    segments: [database]
    group: server-room
  - id: mon-1
    type: vm
    address: 10.99.0.50
    group: server-room

links:
  - endpoints:
      - node: core
      - node: esx-1
    speed: 25G
    segments: [staff, database]
  - endpoints:
      - node: core
      - node: esx-2
    speed: 25G
    segments: [staff, database]
  - endpoints:
      - node: core
      - node: esx-3
    speed: 25G
    segments: [staff, database]
```

1. The format cannot explicitly encode vSphere HA’s behavior of restarting VMs on another host after failure; `redundancy` expresses the cluster membership.
2. Added identifiers for the server room and segments, and descriptive `type` values. Interpreted the server room as containing all described nodes.
3. It is unclear whether `redundancy` is intended to include host clusters that restart workloads, as distinct from nodes that directly stand in for one another.
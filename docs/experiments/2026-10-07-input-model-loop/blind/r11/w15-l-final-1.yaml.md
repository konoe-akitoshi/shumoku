```yaml
name: Company network

groups:
  - id: head-office
    label: Head office
  - id: server-room
    label: Server room
    parent: head-office
  - id: branch
    label: Branch
  - id: second-floor
    label: 2nd floor
    parent: branch

routingDomains:
  - id: head-office-domain
    label: Head office routing domain

connections:
  - id: ipsec-tunnel
    label: IPsec tunnel

segments:
  - id: vlan-10
    label: Staff
    vlan: 10
    prefix: 192.168.1.0/24
    routingDomain: head-office-domain
    group: server-room
    addresses:
      fw-ha: 192.168.1.1
      fw-1: 192.168.1.2
      fw-2: 192.168.1.3
      web-1: 192.168.1.20
  - id: vlan-20
    label: Voice
    vlan: 20
    routingDomain: head-office-domain
    group: server-room
  - id: vswitch0
    label: vSwitch0
    group: server-room

redundancy:
  - id: fw-ha
    label: Firewall HA pair
    nodes:
      - fw-1
      - fw-2

nodes:
  - id: fw-1
    label: fw-1
    product: paloalto/pa-3220
    routingDomain: head-office-domain
    group: server-room
  - id: fw-2
    label: fw-2
    product: paloalto/pa-3220
    routingDomain: head-office-domain
    group: server-room
  - id: core
    label: core
    group: server-room
    members:
      - sw-a
      - sw-b
    address: 10.99.0.2
  - id: esx-1
    label: esx-1
    routingDomain: head-office-domain
    group: server-room
  - id: web-1
    label: web-1
    host: esx-1
    group: server-room
  - id: br-rt
    label: br-rt
    group: branch
  - id: ap-1
    label: Access point
    assumed: true
    group: second-floor

links:
  - endpoints:
      - node: fw-1
        port: ethernet1/1
      - node: core
    speed: 10G
    segments:
      - vlan-10
      - vlan-20
  - endpoints:
      - node: fw-2
      - node: core
  - endpoints:
      - node: esx-1
      - node: core
    speed: 25G
    segments:
      - vlan-10
  - endpoints:
      - node: web-1
      - segment: vswitch0
    virtual: true
    segments:
      - vlan-10
  - endpoints:
      - node: vswitch0
      - segment: vlan-10
    virtual: true
  - endpoints:
      - node: br-rt
      - node: fw-1
        port: tun0
    connection: ipsec-tunnel
    virtual: true
    description: IPsec tunnel; tun0 on both sides
```


1. The exact attachment of the VM to `vSwitch0` and how that virtual switch maps to VLAN 10 is not fully specified. I represented it using a virtual node and links; the schema does not directly describe a host’s virtual switch configuration.
2. The description does not provide a branch routing domain, so I omitted one. I used `head-office-domain` for the known head office VLANs and firewall/ESX attachment. I treated the unspecified VLAN 20 prefix as unknown. I used `fw-ha` as the key for the shared virtual address. I used `ap-1` as an identifier for the unconfirmed access point. The IPsec link endpoint on the router is unspecified, so I left its port out; the description says `tun0` on both sides, represented in the link description.
3. A link endpoint can name a segment, but the format does not clearly explain how to represent a device’s virtual adapter attached to a virtual switch that carries a VLAN. The format also lacks a distinct place for an interface name on an endpoint that is a segment.
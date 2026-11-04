# NetBox → input model: mapping design

How `libs/plugins/netbox` should turn NetBox 4.x data into a `SourceNetwork`
(`libs/@shumoku/core/src/models/network-model.ts`): `network` in the shape of
`libs/@shumoku/core/src/input/model.ts`, plus `observation` (identity, provenance) and a thin
`drawing` layer. Design only; nothing here is implemented yet.

Governing rules, from the model's own comments:

- **Unknown stays unwritten.** Nothing is guessed (`type: generic`, a `/16` from an IP, a cable
  type borrowed from the patch lead). A field is written only when NetBox states it.
- **The top of the drawing comes from the input.** `drawNetwork` measures "up" from
  `type: external` / `type: cloud` nodes and from routing domains that a link ends at
  (`drawing/draw.ts`, `beyond()`); otherwise it guesses (`drawing/upstream.ts`). So the one thing
  this plugin must get right is *what lies beyond the network*: providers, provider networks,
  IX/transit, cloud.
- **Identity, not names, correlates nodes** across rescans and sources (`docs/plugin-authoring.md`,
  "Identity contract"). Every node carries ≥1 key; ports carry `ifName`; `sysName` is a
  self-reported name, never an operator string.

## NetBox versions checked

Model pages are the current "stable" docs at `netboxlabs.com/docs/netbox/` (read 2026-11). Release
notes read to pin what changed in 4.x:

| Version | Date | Why it matters here |
| --- | --- | --- |
| [3.7.0](https://netboxlabs.com/docs/netbox/release-notes/version-3.7/) | 2023-12-29 | VPN module: `/api/vpn/tunnels/`, `tunnel-terminations/`, IKE/IPSec; L2VPN moved `ipam/` → `vpn/` |
| [4.0.0](https://netboxlabs.com/docs/netbox/release-notes/version-4.0/) | 2024-05-06 | REST `?fields=` parameter; `VirtualChassis.members`; `device_role` filter removed |
| [4.1.0](https://netboxlabs.com/docs/netbox/release-notes/version-4.1/) | 2024-09-03 | Circuit groups; provider nested in circuit representation |
| [4.2.0](https://netboxlabs.com/docs/netbox/release-notes/version-4.2/) | 2025-01-06 | **Virtual circuits**; circuit termination `site`/`provider_network` → generic `termination_type`/`termination_id`; `Prefix.site` and `Cluster.site` → `scope_type`/`scope_id`; MAC address objects; Q-in-Q |
| [4.3.0](https://netboxlabs.com/docs/netbox/release-notes/version-4.3/) | 2025-05-01 | `L2VPN.status` |
| [4.4.0](https://netboxlabs.com/docs/netbox/release-notes/version-4.4/) | 2025-09-02 | `Platform.parent` |
| [4.5.0](https://netboxlabs.com/docs/netbox/release-notes/version-4.5/) | 2026-01-06 | v2 tokens (`Bearer nbt_…`), already handled in `client.ts` |
| [4.6.0](https://netboxlabs.com/docs/netbox/release-notes/version-4.6/) | 2026-05-05 | `VirtualMachine.cluster` optional, `virtual_machine_type`; `ASN.role`; v1 tokens deprecated (4.6.1) |

Target: **4.2 and later** (the generic `termination`/`scope` shape). 4.0–4.1 differ only in those
two fields; the plugin may read both shapes but need not.

Model pages cited below: [Device](https://netboxlabs.com/docs/netbox/models/dcim/device/),
[Interface](https://netboxlabs.com/docs/netbox/models/dcim/interface/),
[VirtualChassis](https://netboxlabs.com/docs/netbox/models/dcim/virtualchassis/),
[Platform](https://netboxlabs.com/docs/netbox/models/dcim/platform/),
[Cluster](https://netboxlabs.com/docs/netbox/models/virtualization/cluster/),
[ClusterType](https://netboxlabs.com/docs/netbox/models/virtualization/clustertype/),
[VirtualMachine](https://netboxlabs.com/docs/netbox/models/virtualization/virtualmachine/),
[VMInterface](https://netboxlabs.com/docs/netbox/models/virtualization/vminterface/),
[Circuit](https://netboxlabs.com/docs/netbox/models/circuits/circuit/),
[CircuitTermination](https://netboxlabs.com/docs/netbox/models/circuits/circuittermination/),
[Provider](https://netboxlabs.com/docs/netbox/models/circuits/provider/),
[ProviderAccount](https://netboxlabs.com/docs/netbox/models/circuits/provideraccount/),
[ProviderNetwork](https://netboxlabs.com/docs/netbox/models/circuits/providernetwork/),
[VirtualCircuit](https://netboxlabs.com/docs/netbox/models/circuits/virtualcircuit/),
[VirtualCircuitTermination](https://netboxlabs.com/docs/netbox/models/circuits/virtualcircuittermination/),
[ASN](https://netboxlabs.com/docs/netbox/models/ipam/asn/),
[ASNRange](https://netboxlabs.com/docs/netbox/models/ipam/asnrange/),
[VRF](https://netboxlabs.com/docs/netbox/models/ipam/vrf/),
[Prefix](https://netboxlabs.com/docs/netbox/models/ipam/prefix/),
[IPAddress](https://netboxlabs.com/docs/netbox/models/ipam/ipaddress/),
[FHRPGroup](https://netboxlabs.com/docs/netbox/models/ipam/fhrpgroup/),
[FHRPGroupAssignment](https://netboxlabs.com/docs/netbox/models/ipam/fhrpgroupassignment/),
[Tunnel](https://netboxlabs.com/docs/netbox/models/vpn/tunnel/),
[TunnelTermination](https://netboxlabs.com/docs/netbox/models/vpn/tunneltermination/),
[L2VPN](https://netboxlabs.com/docs/netbox/models/vpn/l2vpn/),
[L2VPNTermination](https://netboxlabs.com/docs/netbox/models/vpn/l2vpntermination/),
[WirelessLink](https://netboxlabs.com/docs/netbox/models/wireless/wirelesslink/),
[REST API](https://netboxlabs.com/docs/netbox/integrations/rest-api/).

## Ids

Source ids only have to be unique and stable within one sync; Server mints its own stable ids for
nodes a source found. Still, `toYaml` readers see them, so they are readable:

| Thing | Id | Note |
| --- | --- | --- |
| Device / VM | its `name`; `device-<pk>` / `vm-<pk>` when the name is null or repeats in the result | NetBox names are unique only per site+tenant |
| Provider boundary | `provider-<slug>` | one per provider that has a circuit with no modelled far side |
| Provider network | `pn-<provider slug>-<name slug>` | one per provider network a circuit or virtual circuit reaches |
| Cloud cluster node | `cluster-<slug>` | see Virtualization |
| Group | `site-<slug>`, `location-<slug>`, `rack-<pk>` | nested |
| Segment (VLAN) | `vlan-<vid>`; `vlan-<vid>-<pk>` when the VID repeats across fetched VLANs | the same VID in two VLAN groups is two VLANs |
| Segment (prefix without VLAN) | `prefix-<network>-<len>` e.g. `prefix-10.0.10.0-24`; suffix `-<vrf slug>` inside a VRF | |
| Segment (L2VPN, multipoint) | `l2vpn-<slug>` | |
| Routing domain | `vrf-<name slug>` | |
| Redundancy | `vc-<name slug>`, `fhrp-<protocol>-<group_id>` (`-<pk>` on collision), `cluster-<slug>` | |
| Connection | `tunnel-group-<slug>`, `lag-<a node>-<a if>--<b node>-<b if>` (ends sorted) | |
| Link | `path-<a node>-<a port>--<b node>-<b port>` (ends sorted) for cabled paths; `circuit-<cid>`, `tunnel-<name slug>`, `vcircuit-<cid>-<n>`, `wireless-<pk>`, `l2vpn-<slug>-<node>-<port>`, `vm-<vm>-<if>-<segment>` | today's `link-<index>` changes whenever NetBox reorders; these do not |

Ports: a port is a **physical or parentless interface**. A subinterface (`parent` set) folds into
its parent: its VLANs join the parent's link `segments`, its addresses go to the node. So
`et-0/0/0.100` never appears as a port; `tunnel.1` (virtual, no parent) does.

## Mapping

### 1. Places (groups)

| NetBox | Input | Condition |
| --- | --- | --- |
| Site | `Group{id, label: name}` | every site a fetched node belongs to |
| Location (tree via `parent`) | `Group` nested under its site / parent location | only locations on the path of a fetched node |
| Rack | `Group` nested under its location (or site) | only racks holding a fetched device |
| Device `site`/`location`/`rack` | `Node.group` = the innermost of these | |
| VM | `Node.group` = its `site` (own, or inferred from cluster scope / device) | |
| Prefix `scope` (site / location) | `Segment.group` | only when the scope is a site or location already emitted |

Not mapped: regions, site groups, tenants (organisational, not places; a tenant filter is a
fetch option, not a group). `groupBy: tag|prefix` go away (see "Old tag→level mechanism"); an
option `groupDepth: site|location|rack` (default `location`) replaces `groupBy: site|location`.

### 2. Devices and virtual machines (nodes)

| NetBox | Input | Condition |
| --- | --- | --- |
| Device `name` | `Node.label` | unwritten when null |
| Device `role.slug` | `Node.type` via `ROLE_TO_TYPE` (+ user `roleTypes` option) | **unwritten** when the slug is not mapped (today: `generic`) |
| Device `device_type.manufacturer.slug` / `device_type.slug` | `Node.product` = `manufacturer/device-type` | `?/<device-type>` is never needed: NetBox requires a manufacturer |
| Device / VM `platform.name` | `Node.software` | |
| Device / VM `description` | `Node.description` | not `comments` (free prose, often long) |
| Device / VM `primary_ip4` (else `primary_ip6`) | address in the **segment** of its longest-match prefix (same VRF); `Node.address` only when no prefix is emitted for it | the model: "once [the segment] is known, the address goes in the segment" |
| VM | `Node.type: virtual-machine` | role → type is ignored for VMs (the kind is known); role goes to `observation.metadata.role` |
| VM `device` | `Node.host` = that device | "Cluster + Device" case |
| VM `cluster` (no `device`), cluster has ≥2 host devices | `Node.host` = redundancy `cluster-<slug>` | see Virtualization |
| VM `cluster`, cluster has exactly 1 host | `Node.host` = that device | a one-node set is not a redundancy |
| VM `cluster` of a *cloud* cluster type | `Node.host` = cloud node `cluster-<slug>` | see Virtualization |
| VM `vcpus`/`memory`/`disk`, device `serial`/`asset_tag`/`status`, NetBox `url`/pk | `observation.nodes[id].metadata` | never `description` (today sizing is written there) |
| Device `status` | `drawing.nodes[id].style` (optional `colorByStatus`, as today) | drawing layer only |

Which devices: NetBox returns every status. "The network as it is known now" excludes what is not
there yet or any more: default fetch filter `status=active,staged,offline,failed,decommissioning`
(exclude `planned`, `inventory`); same for VMs and circuits (`active`, `offline`, `provisioning`,
`deprovisioning`). An option exposes the list.

A far-end device that the site filter did not fetch but a path reaches (branch router behind a
circuit) is emitted as a node with only what the nested object gives (`label`, identity); its
group stays unwritten. That is knowledge, not scope leakage.

Not mapped: `oob_ip`, `airflow`, `config_template`, local context, modules, inventory items,
device bays (a child device's cables are on the child, so nothing is lost), VDCs, `tenant`,
`comments`, `asset_tag` (metadata only).

### 3. Cabled links

Build links from each interface's **`connected_endpoints`** (the end of the traced cable path),
not from raw `cables`. A raw cable walk drops every path through a patch panel (front/rear
ports) and every circuit; NetBox's path trace follows both, and a path ending at a provider
network reports that network as the endpoint. Verify this last point on the test instance; the
REST docs describe the field only as the far end of the path.

| NetBox | Input | Condition |
| --- | --- | --- |
| Interface pair at both ends of a path | `Link{endpoints: [{node, port}, {node, port}]}` | deduplicate by sorted end pair (each path is seen from both ends); only when `connected_endpoints_reachable` |
| `speed` of both ends, else nominal rate of `type` (`nominalSpeedFromInterfaceType`) | `Link.speed` = min of the two | unchanged |
| `cable.type` | `Link.cable` | **only when the path is a single cable** (interface↔interface, same `cable.id` at both ends); a path through a panel or a circuit has several media |
| `cable.length` + `length_unit` | `Link.length` | single-cable paths; `mi` → km (×1.609344) since `Length` has no mile |
| `cable.label`, `cable.color`, `cable.status` | `drawing.links[id].label/style` | drawing layer |
| `untagged_vlan` + `tagged_vlans` of the two ends **and of their subinterfaces and of the LAG they belong to** | `Link.segments` | `mode: tagged-all` carries "all VLANs": nothing is listed (the model: a link that lists segments carries those and no others, so listing none is the honest choice) |
| Interface `lag` on either end | `Link.connection` = `lag-…`; `Connection{label: 'ae0 ⇄ Po1'}` | one connection per LAG pair; a LAG on one side only is still a connection |
| Interface `type: virtual|lag|bridge` with no path | nothing | they cannot be cabled |
| Interface `mgmt_only` | link drawn as any other; `observation.ports[port].metadata.mgmtOnly` | a management cable is a cable |

Not mapped: console and power cables, `bridge`, `mark_connected` (no far end), `duplex`, `mtu`,
`poe`, `wwn`, channelised breakouts beyond what `connected_endpoints` already resolves.

### 4. External connections: circuits, providers, provider networks

A circuit (`circuits/circuits`) is "a physical point-to-point data connection", with at most two
terminations, each scoped (4.2+) to a **region, site group, site, location or provider network**
and optionally cabled to an interface. Rules, per circuit:

| Case | Input |
| --- | --- |
| Both terminations cabled to fetched/known devices | the path already yielded the link (section 3); this circuit adds `description: '<provider> <cid>'`, `speed` = min `port_speed`, `bandwidth` = `commit_rate` when written, `connection` unwritten |
| One termination cabled to a device, the other scoped to a **provider network** | `Node{id: pn-…, label: network name, type: external}` with one port per circuit, named by `cid`; `Link{[{node: device, port}, {node: pn-…, port: cid}]}` |
| One termination cabled to a device, the other scoped to a site/location/region with **no cable** (or absent) | `Node{id: provider-<slug>, label: provider name, type: external}`, port `cid`; same link shape |
| No termination cabled to a known device | nothing |
| `Provider.asns` has exactly one ASN | `Node.asn` on the provider / provider-network node | more than one: unwritten; list in `description` |
| `ProviderAccount` | `description` of the provider node (`account <name>`) | optional; nothing structural |
| Circuit `status ≠ active` | not fetched by default (see section 2); when fetched, `drawing.links[id].type: dashed` as today | `assumed` is wrong for a planned circuit: its existence is certain, its presence is not |

Always `external`, never `cloud`, for a provider or provider network: NetBox does not say
whether the far side is a transit backbone, an IX fabric or a cloud on-ramp. The circuit type
slug goes to `observation.links[id].metadata.circuitType` for anyone who wants it.

An IX is simply a provider (the IX operator, with its route-server ASN under `asns`) whose
peering LAN is a provider network; the member router's port address on the peering-LAN prefix
puts it in that segment. BGP sessions over the LAN are not in NetBox core (the `netbox-bgp`
plugin would be a separate mapping) and are not invented.

### 5. Virtual links

| NetBox | Input | Condition |
| --- | --- | --- |
| **Tunnel** with terminations `role: peer` (2) | `Link{virtual: true, description: '<encapsulation> <name>'}` between the two terminated interfaces | ports fold subinterfaces into parents; `tunnel.N` interfaces are their own ports |
| Tunnel with more than two peers | one link per pair | |
| Tunnel with hubs and spokes | one link spoke↔hub for each pair | |
| Tunnel with one termination in NetBox | nothing; `observation` notes the unterminated tunnel | a link needs two ends; the far end is unknown |
| `TunnelGroup` | `Connection{id: tunnel-group-<slug>, label: name}`; each of the group's links names it | the operator's statement that these tunnels belong together (an AWS site-to-site VPN = two tunnels in one group) |
| Addresses of both tunnel interfaces inside one prefix | that prefix is a segment and `Link.segments` lists it | the usual address rule (section 7) does the rest |
| `outside_ip` | not mapped | it is already an address of some interface |
| IKE / IPSec policies and profiles | not mapped | |
| **Virtual circuit** (4.2+) terminations, 2 × `peer` | `Link{virtual: true, description: '<provider network> <cid>'}` between the two interfaces (subinterfaces folded) | |
| Virtual circuit, hub/spoke or >2 peers | one link per spoke↔hub / per pair | |
| Virtual circuit with one termination | `Link{virtual: true}` to the provider-network node `pn-…`, port `cid` | the far side is the provider network by definition |
| **L2VPN** of a point-to-point type (`vpws`, `epl`, `ep-lan`, `ep-tree`, `evpn-vpws`) with 2 interface terminations | `Link{virtual: true, description: '<type> <name>'}` | a pseudowire is a virtual cable |
| L2VPN, multipoint types, interface terminations | `Segment{id: l2vpn-<slug>, label: name}` + for each terminated interface `Link{virtual: true, endpoints: [{node, port}, {segment}]}` | |
| L2VPN **VLAN** terminations | not mapped in the first cut; `observation` metadata on the VLAN segment (`l2vpn: <slug>`) | the VLAN segment and the L2VPN are the same broadcast domain; the model cannot say two segments are one |
| L2VPN `identifier`, `import/export_targets` | metadata / not mapped | |
| **Wireless link** | `Link{description: 'wireless <ssid>, <distance>'}` between the two wireless interfaces | neither `virtual` (it is a real radio path) nor `cable`; see open questions |
| Wireless LANs (`wireless_lans` on an interface) | not mapped | an SSID is a shared network (segment) but which stations join it is not in NetBox |
| **LAG** | `Connection`, section 3 | |
| **VM interface** on VLAN(s) | per VLAN: `Link{virtual: true, endpoints: [{node: vm, port: ifname}, {segment: vlan-…}]}` | the adapter "in a port group"; NetBox has no vSwitch, and a segment end says exactly what is known: the VM is joined to that network. If the VM is pinned to a device whose NIC carries the same VLAN, the drawing connects them through the segment |
| VM interface with an address but no VLAN | address in the prefix's segment, no link | membership by address is already "in the segment" |
| VM interface `bridge`, `parent` | parent folds as for devices; bridge not mapped | |

MLAG / vPC / VSS have no NetBox model; nothing is written for them.

### 6. Redundancy

| NetBox | Input | Condition |
| --- | --- | --- |
| **Virtual chassis** | each member stays a `Node` (its cables are on its own interfaces, so the links *are* told apart: `Node.members` is the wrong shape); `Redundancy{id: vc-<slug>, label: name, nodes: members, kind: 'vc'}` | ≥2 members; `master`, `vc_position` → `observation` metadata |
| **FHRP group** with assignments on interfaces of ≥2 distinct nodes | `Redundancy{id: fhrp-…, label: '<protocol> <group_id>' (or `name`), nodes, kind: 'ha'}`; each VIP (`ip_addresses` of the group) → `Segment.addresses[fhrp-…]` in the VIP's longest-match prefix | protocol slug and priorities → metadata |
| FHRP group whose assignments are all on one node | no redundancy; the VIP is written under that node | |
| **Cluster** with ≥2 host devices (non-cloud) | `Redundancy{id: cluster-<slug>, label: name, nodes: hosts, kind: 'cluster'}` | used as `host` of its un-pinned VMs; see open questions on `assumed` |

### 7. Addresses, segments, routing domains

| NetBox | Input | Condition |
| --- | --- | --- |
| **VLAN** (nested `id/vid/name` on interfaces) | `Segment{id: vlan-…, label: name, vlan: vid}` | only VLANs some emitted link or VM interface carries |
| **Prefix** with `vlan` | `Segment.prefix` of that VLAN segment (`OneOrMore`: one per family) | `status ≠ container`; `vrf` → `Segment.routingDomain` |
| Prefix without VLAN | `Segment{id: prefix-…, label: <prefix>, prefix}` | only when an emitted node has an address in it (longest match in the same VRF), or it is a tunnel's inside prefix |
| Prefix `status: container` | never a segment; the top-level containers of a VRF become `RoutingDomain.prefix` | "the VPC's CIDR blocks" |
| Prefix `scope` site/location | `Segment.group` | |
| **IP address** assigned to a device/VM interface | `Segment.addresses[node]` in its longest-match prefix (same VRF, non-container, emitted); loopbacks and secondaries alike | `role: vip|vrrp|hsrp|glbp|carp` on an interface (not an FHRP group) is still a node address |
| IP address assigned to an FHRP group | under the redundancy id (section 6) | |
| IP address with no emitted prefix | `Node.address` only when it is the primary IP | other unsegmented addresses: metadata |
| **VRF** | `RoutingDomain{id: vrf-…, label: name, prefix: its container prefixes}` | only VRFs some emitted segment names; the global table is no routing domain ("a network with a single routing table has none") |
| VRF `rd`, route targets, `enforce_unique` | metadata / not mapped | L3VPN import/export is not a drawable relation |
| Interface `vrf` | not mapped directly | the interface's addresses already sit in a VRF-scoped prefix |

Routing-domain **link ends** (`{routingDomain}`) are **not** emitted: NetBox never records "this
node is attached to that VRF as a whole". Its nearest fact is a termination at a provider network
(a node end). A VPC still becomes the top of the drawing through the cloud node (next section).

### 8. Cloud (AWS and the like)

NetBox has no cloud model. Two conventions exist and the plugin reads both without inventing:

- **Instances as VMs in clusters** whose cluster type is the provider and cluster the region
  (Jeremy Stretch, [netbox-discuss, 2020-10-21](https://groups.google.com/g/netbox-discuss/c/7XryYmkojPU):
  "cluster types which represent AWS, GCE, etc. and clusters which represent the regions";
  ClusterType docs give "DigitalOcean NYC3" as the cloud example).
- **One VRF per VPC**, prefixes for the VPC CIDR (status `container`) and subnets — what the
  NetBox Labs [AWS VPC IPAM integration](https://netboxlabs.com/docs/integrations/aws-vpc-ipam/aws-vpc-ipam-tech-info)
  writes ("VPC VRFs are always named after the `VpcId`"; prefixes from `vpc` rows get the
  `container` status). The same thread records that single-VRF setups also exist.

| NetBox | Input | Condition |
| --- | --- | --- |
| Cluster whose `type.slug` is in the option **`cloudClusterTypes`** | `Node{id: cluster-<slug>, label: name, type: cloud, product: <type slug>}` with identity `vendorIds['netbox-cluster-id']`; its VMs get `host` = this node | the user names the cloud types; nothing is inferred from slugs. Without the option, VMs of a hostless cluster have no `host` and the drawing guesses the top: document this in the plugin's user page |
| VRF of a VPC | `RoutingDomain` (section 7) | nothing cloud-specific |
| Subnet prefixes in that VRF | `Segment{routingDomain}`; instance addresses in them | |
| VPC CIDR (`container`) | `RoutingDomain.prefix` | |
| VPN to the VPC modelled as tunnels to a VM (gateway) in the cloud cluster | tunnels → virtual links, group → connection (section 5) | |
| Direct Connect | circuit to a provider network + virtual circuit (sections 4–5) | |

Cluster `scope` (site/location) is a place and is mapped as such; a region is not invented as a
place when the cluster has no scope.

### 9. Autonomous systems

ASNs attach to **sites** and **providers**, never to devices
([ASN](https://netboxlabs.com/docs/netbox/models/ipam/asn/): "may be assigned to multiple sites";
[Provider](https://netboxlabs.com/docs/netbox/models/circuits/provider/): "The AS numbers assigned
to this provider").

| NetBox | Input | Condition |
| --- | --- | --- |
| Site with exactly one ASN | `Node.asn` on every node whose group chain is under that site | a device at a single-AS site is in that AS; see open questions for restricting to router-like types |
| Site with 0 or ≥2 ASNs | unwritten | which AS a given device speaks is not known |
| Provider with exactly one ASN | `Node.asn` on its provider / provider-network nodes | this is how transit and IX ASes appear |
| `ASNRange`, `RIR`, `ASN.role`, `tenant` | not mapped | |

### 10. Software and product

| NetBox | Input |
| --- | --- |
| `device_type.manufacturer.slug` + `device_type.slug` | `Node.product` (`juniper/ex4400-48p`); slugs, not names: lowercase and stable |
| `platform.name` (device or VM) | `Node.software` (`Junos 23.4R2`); `Platform.parent` is not walked |
| `device_type.part_number`, `u_height` | metadata |

## REST calls

All list calls paginate as today (`limit=0`, follow `next`). `?fields=` (4.0+) is used
everywhere; `?brief=true` nowhere, because brief drops the nested fields the mapping reads. Site /
tag / role filters stay as fetch options; `tenant` joins them.

| Endpoint | Status | Filters | `fields` |
| --- | --- | --- | --- |
| `dcim/devices/` | existing | `site`, `role`, `tag`, `status`, `tenant` | `id,name,status,role,device_type,platform,site,location,rack,primary_ip4,primary_ip6,cluster,virtual_chassis,vc_position,serial,description,url` |
| `dcim/interfaces/` | existing, more fields | same scoping | `id,name,device,type,enabled,mgmt_only,speed,mode,untagged_vlan,tagged_vlans,parent,lag,vrf,primary_mac_address,cable,connected_endpoints,connected_endpoints_type,connected_endpoints_reachable` |
| `dcim/cables/` | existing | `site` | `id,type,status,label,color,length,length_unit,a_terminations,b_terminations` (only for single-cable attributes) |
| `dcim/sites/`, `dcim/locations/` | existing | | `id,name,slug,parent,site,status` + `asns` on sites |
| `dcim/virtual-chassis/` | **new** | | `id,name,domain,master,members` |
| `virtualization/clusters/` | **new** | `site`, `type` | `id,name,slug,type,group,status,scope_type,scope_id,scope` |
| `virtualization/virtual-machines/` | existing, more fields | `site`, `cluster_id`, `status`, `tenant` | `id,name,status,site,cluster,device,role,platform,primary_ip4,primary_ip6,vcpus,memory,disk,description,url` |
| `virtualization/interfaces/` | existing (client), **newly used** | `virtual_machine_id__in` or same scoping | `id,name,virtual_machine,enabled,mode,untagged_vlan,tagged_vlans,parent,vrf,primary_mac_address` |
| `ipam/prefixes/` | existing (client), **newly used** | `status__n=deprecated` | `id,prefix,family,vrf,vlan,status,scope_type,scope_id,scope,is_pool` |
| `ipam/ip-addresses/` | existing (client), **newly used** | `assigned_to_interface=true` | `id,address,family,vrf,status,role,assigned_object_type,assigned_object_id,assigned_object` |
| `ipam/vrfs/` | **new** | | `id,name,rd` (nested VRF on prefixes carries id/name/rd already; the call exists for labels of VRFs reached only via container prefixes) |
| `ipam/asns/` | **new** | | `id,asn,sites` (sites nested); provider ASNs come from `circuits/providers/` |
| `ipam/fhrp-groups/` | **new** | | `id,name,protocol,group_id,ip_addresses` |
| `ipam/fhrp-group-assignments/` | **new** | | `id,group,interface_type,interface_id,interface,priority` |
| `circuits/circuits/` | existing, more fields | `status` | `id,cid,provider,provider_account,type,status,commit_rate,termination_a,termination_z,description` |
| `circuits/circuit-terminations/` | existing, 4.2 shape | | `id,circuit,term_side,termination_type,termination_id,termination,port_speed,cable,link_peers_type,link_peers` |
| `circuits/providers/` | **new** | | `id,name,slug,asns` |
| `circuits/provider-networks/` | **new** | | `id,name,provider,service_id` |
| `circuits/virtual-circuits/` | **new** (4.2+) | `status` | `id,cid,provider_network,provider_account,type,status,description` |
| `circuits/virtual-circuit-terminations/` | **new** (4.2+) | | `id,virtual_circuit,role,interface` |
| `vpn/tunnels/` | **new** | `status` | `id,name,status,group,encapsulation,tunnel_id,description` |
| `vpn/tunnel-terminations/` | **new** | | `id,tunnel,role,termination_type,termination_id,termination,outside_ip` |
| `vpn/l2vpns/` | **new** | | `id,name,slug,type,identifier,status` |
| `vpn/l2vpn-terminations/` | **new** | | `id,l2vpn,assigned_object_type,assigned_object_id,assigned_object` |
| `wireless/wireless-links/` | **new** | `status` | `id,interface_a,interface_b,ssid,status,distance,distance_unit` |
| `extras/tags/`, `dcim/device-roles/` | existing | | filter candidates only (`getConfigOptions`); add `virtualization/cluster-types/` for the `cloudClusterTypes` option |

Each optional app (circuits, vpn, wireless, virtualization) degrades as circuits do today: a 403 or
404 drops that family of facts and logs once; it never fails the sync.

## Identity keys

| Node kind | `identity` | Ports |
| --- | --- | --- |
| Device | `mgmtIp` = host part of `primary_ip4` (else `primary_ip6`); `sysName` = `name` **only when the name is unique among fetched devices and VMs** (NetBox names are operator-written, but by convention the hostname; a repeated name is dropped from identity and kept as `label`, per the contract); `vendorIds['netbox-device-id']` = pk | `ifName` = interface name; `mac` = `primary_mac_address` when present |
| VM | same, with `vendorIds['netbox-vm-id']` | same |
| Far-end device known only from `connected_endpoints` | `sysName` = name (same uniqueness rule), `vendorIds['netbox-device-id']` | `ifName` |
| Provider node | `vendorIds['netbox-provider-id']` only (today's `sysName: provider:<slug>` is not a sysname and goes) | `ifName` = `cid` |
| Provider network node | `vendorIds['netbox-provider-network-id']` | `ifName` = `cid` |
| Cloud cluster node | `vendorIds['netbox-cluster-id']` | none |

`getHosts()` (HostsCapable) mirrors the same keys so metrics bind to the same entity. The
`validateTopologyIdentityContract` test runs over the fixture below.

## Old tag→level mechanism

Remove it: `DEFAULT_TAG_MAPPING`, `TAG_PRIORITY`, `TagMapping.level/subgraph`, `getLevelByTag`,
`srcLevel/dstLevel` ordering in `ConnectionData`, `SUBGRAPH_TOKENS` by level, `groupBy: 'tag'`
and `groupBy: 'prefix'`. The drawing engine reads no levels (up/down comes from `external`/`cloud`
and routing domains, then the ladder and link speed in `upstream.ts`), links are undirected, and
the `ocx`/`onu` defaults describe one deployment. Tags stay as **fetch filters** only
(`tagFilter`, `excludeTagFilter`). The one thing the mapping did that is still wanted — naming a
node's type when the role slug is not in `ROLE_TO_TYPE` — becomes an option `roleTypes:
Record<roleSlug, type>` rendered from `SchemaForm`. A CHANGELOG entry says the YAML of
tag-grouped topologies changes shape.

## Test dataset: `fictional-corp`

A local NetBox (netbox-docker ≥ 4.2) seeded through the REST API in this order. All names and
addresses are fictional; AS numbers from the private/documentation range. Only objects that
exercise a rule are listed; NetBox requires manufacturer → device type → device, role, site.

**Reference data**

- Manufacturers / device types: `juniper` → `mx204`, `ex4400-48p`, `srx300`; `fortinet` →
  `fortigate-100f`; `dell` → `poweredge-r760`; `ubiquiti` → `airfiber-60`. Platforms (slug →
  name): `junos` → "Junos 23.4R2", `fortios` → "FortiOS", `esxi` → "VMware ESXi 8", `linux` → "Linux".
- Roles: `core-router`, `firewall`, `access-switch`, `hypervisor` (unmapped slug → `type`
  unwritten unless `roleTypes`), `wireless-bridge` (unmapped), `server`, `vpn-gateway` (unmapped).
- Sites: `hq` (Fictional HQ) with locations `hq-mdf`, `hq-annex`; `branch` (Branch Osaka).
- RIR `private`; ASNs: 64496 → sites `hq`, `branch`; 64500 → provider `transit-one`; 64501 →
  `transit-two`; 64510 → `fict-ix`.
- VLANs (site `hq`): 10 `servers`, 20 `users`, 99 `mgmt`. Prefixes (global table): `10.0.10.0/24`
  (vlan 10), `10.0.20.0/24` (vlan 20), `10.0.99.0/24` (vlan 99) and `203.0.113.0/24` (IX peering
  LAN), all with scope site `hq`; `192.0.2.0/30`, `192.0.2.4/30` (tunnel insides),
  `198.51.100.0/31` (transit-one handoff), `198.51.100.2/31` (transit-two) with no scope.

**Devices (site `hq`, location `hq-mdf` unless noted)**

| Device | Type / role / platform | Notes |
| --- | --- | --- |
| `hq-rt1` | mx204 / core-router / junos | primary IP `10.0.99.1/24` on `lo0`; `et-0/0/0` → circuit `TO-IP-1001`, address `198.51.100.1/31`; `et-0/0/2` → `TT-IP-2002`, `198.51.100.3/31`; `et-0/0/3` → `IX-PORT-7`, `203.0.113.10/24`; `et-0/0/1` → `FT-DF-0001`; `ae0` (lag, mode tagged, tagged 10,20, untagged 99) members `et-0/0/4`, `et-0/0/5`; subinterface `et-0/0/0.100` (parent `et-0/0/0`); `irb.20` (virtual) |
| `hq-fw1`, `hq-fw2` | fortigate-100f / firewall / fortios | `port1` access vlan 10, `10.0.10.2/24` and `.3/24`; `hq-fw1` has `tunnel.1` (`192.0.2.1/30`) and `tunnel.2` (`192.0.2.5/30`), both virtual; primary IPs `10.0.99.2`, `.3` on `mgmt` |
| `hq-sw1`, `hq-sw2` | ex4400-48p / access-switch / junos | virtual chassis `hq-vc` (master `hq-sw1`, positions 1, 2); `ae0` on `hq-sw1` (tagged 10,20 untagged 99) with members `hq-sw1:et-0/0/48` **and** `hq-sw2:et-0/0/48` (cross-member LAG); `ge-0/0/1` access vlan 10 on each; `ge-0/0/10` tagged 10,20 untagged 99 on each; `hq-sw2:ge-0/0/20` access vlan 99; primary IP `10.0.99.11` on `hq-sw1` `irb.99` |
| `hq-esx1`, `hq-esx2` | poweredge-r760 / hypervisor / esxi | `cluster: hq-vsphere`; `vmnic0` each; primary IPs `10.0.99.21`, `.22` |
| `hq-wl1` (location `hq-mdf`), `annex-wl1` (location `hq-annex`) | airfiber-60 / wireless-bridge | `radio0` type `other-wireless`, `rf_role` ap / station; `eth0` each |
| `annex-sw1` (location `hq-annex`) | ex4400-48p / access-switch | `ge-0/0/1` |
| `br-rt1` (site `branch`) | srx300 / core-router / junos | `ge-0/0/0` → `FT-DF-0001` Z side; `ge-0/0/1` → `TO-IP-1002`; `ge-0/0/1.100`; `irb.20`; primary IP `10.0.99.254/24` on `lo0` |

**Cables** (`dcim/cables/`, type/length where noted): `hq-rt1:et-0/0/4`↔`hq-sw1:et-0/0/48`
(`smf`, 3 m), `hq-rt1:et-0/0/5`↔`hq-sw2:et-0/0/48` (`smf`, 3 m), `hq-fw1:port1`↔`hq-sw1:ge-0/0/1`
(`cat6`), `hq-fw2:port1`↔`hq-sw2:ge-0/0/1` (`cat6`), `hq-esx1:vmnic0`↔`hq-sw1:ge-0/0/10`,
`hq-esx2:vmnic0`↔`hq-sw2:ge-0/0/10`, `hq-wl1:eth0`↔`hq-sw2:ge-0/0/20`,
`annex-wl1:eth0`↔`annex-sw1:ge-0/0/1`, and one **patch-panel path**: `hq-rt1:et-0/0/1` ↔ panel
`hq-pp1` front port 1 / rear port 1 ↔ circuit termination (below), to check `connected_endpoints`.

**FHRP**: group protocol `vrrp`, `group_id` 10, name `fw-vip`, VIP `10.0.10.1/24` (role vrrp);
assignments `hq-fw1:port1` priority 110, `hq-fw2:port1` priority 100.

**Virtualization**: cluster type `vmware-vsphere`, cluster `hq-vsphere` (scope site `hq`, hosts
`hq-esx1`, `hq-esx2`); cluster type `aws`, cluster `aws-ap-northeast-1` (no scope, no hosts).
VMs: `app01` (cluster `hq-vsphere`, no device, linux, `eth0` access vlan 10, `10.0.10.21/24`);
`db01` (cluster `hq-vsphere`, device `hq-esx1`, `eth0` access vlan 10, `10.0.10.31/24`); `web01`
(cluster `aws-ap-northeast-1`, role server, `eth0` `10.100.1.10/24` in VRF `vpc-0a1b2c3d4e5f60789`);
`vgw` (cluster `aws-ap-northeast-1`, role vpn-gateway, `tun1` `192.0.2.2/30`, `tun2` `192.0.2.6/30`).

**VPC**: VRF `vpc-0a1b2c3d4e5f60789`; prefixes in it: `10.100.0.0/16` status `container`,
`10.100.1.0/24` (subnet-a), `10.100.2.0/24` (subnet-b).

**VPN**: tunnel group `vpn-aws`; tunnels `aws-tun-1` (ipsec; terminations peer `hq-fw1:tunnel.1`,
peer `vgw:tun1`), `aws-tun-2` (peer `hq-fw1:tunnel.2`, peer `vgw:tun2`).

**Circuits**: providers `fictional-telecom`, `transit-one` (asn 64500), `transit-two` (64501),
`fict-ix` (64510); provider networks `transit-one-backbone`, `transit-two-backbone`,
`fict-ix-peering-lan`. Circuits: `FT-DF-0001` (dark-fiber, A: site `hq` cabled via `hq-pp1` to
`hq-rt1:et-0/0/1`, Z: site `branch` cabled to `br-rt1:ge-0/0/0`, port_speed 10 000 000);
`TO-IP-1001` (internet, A: site `hq` cabled `hq-rt1:et-0/0/0`, Z: provider network
`transit-one-backbone`, port_speed 10 000 000, commit_rate 2 000 000); `TO-IP-1002` (A: site
`branch` cabled `br-rt1:ge-0/0/1`, Z: `transit-one-backbone`); `TT-IP-2002` (A: `hq-rt1:et-0/0/2`,
Z: `transit-two-backbone`); `IX-PORT-7` (A: `hq-rt1:et-0/0/3`, Z: `fict-ix-peering-lan`); and
`FT-PLAN-9` status `planned` (A: site `branch`, no cable) to check the status filter.
Virtual circuit `TO-VC-77` on `transit-one-backbone`, terminations peer `hq-rt1:et-0/0/0.100` and
peer `br-rt1:ge-0/0/1.100`.

**L2VPN**: `pw-hq-br` (type `vpws`, terminations `hq-rt1:et-0/0/1.200`, `br-rt1:ge-0/0/0.200`,
both subinterfaces created for it); `evpn-users` (type `vxlan-evpn`, identifier 10020,
terminations `hq-rt1:irb.20`, `br-rt1:irb.20`).

**Wireless**: wireless link `hq-wl1:radio0` ↔ `annex-wl1:radio0`, ssid `hq-annex-ptp`, distance
300 m, status connected.

Fetch options for the test: `cloudClusterTypes: ['aws']`, `roleTypes: { hypervisor: 'server',
'wireless-bridge': 'access-point', 'vpn-gateway': 'router' }`, `groupDepth: 'location'`, no
site filter.

### Expected input-model output (the parts a test asserts)

```yaml
groups:
  - id: site-hq
    label: Fictional HQ
    groups:
      - { id: location-hq-mdf, label: HQ MDF }
      - { id: location-hq-annex, label: HQ Annex }
  - id: site-branch
    label: Branch Osaka
routingDomains:
  - id: vrf-vpc-0a1b2c3d4e5f60789
    label: vpc-0a1b2c3d4e5f60789
    prefix: 10.100.0.0/16
connections:
  - { id: tunnel-group-vpn-aws, label: vpn-aws }
  - { id: lag-hq-rt1-ae0--hq-sw1-ae0, label: ae0 ⇄ ae0 }
segments:
  - id: vlan-10
    label: servers
    vlan: 10
    prefix: 10.0.10.0/24
    group: site-hq
    addresses:
      hq-fw1: 10.0.10.2
      hq-fw2: 10.0.10.3
      fhrp-vrrp-10: 10.0.10.1
      app01: 10.0.10.21
      db01: 10.0.10.31
  - { id: vlan-20, label: users, vlan: 20, prefix: 10.0.20.0/24, group: site-hq }
  - id: vlan-99
    label: mgmt
    vlan: 99
    prefix: 10.0.99.0/24
    group: site-hq
    addresses: { hq-rt1: 10.0.99.1, hq-fw1: 10.0.99.2, hq-fw2: 10.0.99.3, hq-sw1: 10.0.99.11,
                 hq-esx1: 10.0.99.21, hq-esx2: 10.0.99.22, br-rt1: 10.0.99.254 }
  - { id: prefix-192.0.2.0-30, prefix: 192.0.2.0/30, addresses: { hq-fw1: 192.0.2.1, vgw: 192.0.2.2 } }
  - { id: prefix-192.0.2.4-30, prefix: 192.0.2.4/30, addresses: { hq-fw1: 192.0.2.5, vgw: 192.0.2.6 } }
  - { id: prefix-198.51.100.0-31, prefix: 198.51.100.0/31, addresses: { hq-rt1: 198.51.100.1 } }
  - { id: prefix-198.51.100.2-31, prefix: 198.51.100.2/31, addresses: { hq-rt1: 198.51.100.3 } }
  - { id: prefix-203.0.113.0-24, prefix: 203.0.113.0/24, group: site-hq, addresses: { hq-rt1: 203.0.113.10 } }
  - id: prefix-10.100.1.0-24-vpc-0a1b2c3d4e5f60789
    prefix: 10.100.1.0/24
    routingDomain: vrf-vpc-0a1b2c3d4e5f60789
    addresses: { web01: 10.100.1.10 }
  # 10.100.2.0/24 is NOT emitted: no node has an address in it
  - { id: l2vpn-evpn-users, label: evpn-users }
redundancy:
  - { id: vc-hq-vc, label: hq-vc, nodes: [hq-sw1, hq-sw2], kind: vc }
  - { id: fhrp-vrrp-10, label: fw-vip, nodes: [hq-fw1, hq-fw2], kind: ha }
  - { id: cluster-hq-vsphere, label: hq-vsphere, nodes: [hq-esx1, hq-esx2], kind: cluster }
nodes:
  - { id: hq-rt1, label: hq-rt1, type: router, product: juniper/mx204, software: Junos 23.4R2,
      asn: 64496, group: location-hq-mdf }
  - { id: hq-fw1, label: hq-fw1, type: firewall, product: fortinet/fortigate-100f, software: FortiOS,
      asn: 64496, group: location-hq-mdf }
  - { id: hq-sw1, type: l2-switch, product: juniper/ex4400-48p, asn: 64496, group: location-hq-mdf }   # label etc. elided
  - { id: hq-esx1, type: server, product: dell/poweredge-r760, software: VMware ESXi 8, asn: 64496, group: location-hq-mdf }
  - { id: hq-wl1, type: access-point, product: ubiquiti/airfiber-60, asn: 64496, group: location-hq-mdf }
  - { id: br-rt1, type: router, product: juniper/srx300, asn: 64496, group: site-branch }
  - { id: app01, label: app01, type: virtual-machine, software: Linux, host: cluster-hq-vsphere, group: site-hq }
  - { id: db01, type: virtual-machine, host: hq-esx1, group: site-hq }
  - { id: cluster-aws-ap-northeast-1, label: aws-ap-northeast-1, type: cloud, product: aws }
  - { id: web01, type: virtual-machine, host: cluster-aws-ap-northeast-1 }      # no group: cluster has no scope
  - { id: vgw, type: virtual-machine, host: cluster-aws-ap-northeast-1 }
  - { id: pn-transit-one-transit-one-backbone, label: transit-one-backbone, type: external, asn: 64500 }
  - { id: pn-transit-two-transit-two-backbone, label: transit-two-backbone, type: external, asn: 64501 }
  - { id: pn-fict-ix-fict-ix-peering-lan, label: fict-ix-peering-lan, type: external, asn: 64510 }
  # NOT emitted: a node for fictional-telecom (both ends of FT-DF-0001 land on our devices),
  # a node for FT-PLAN-9 (planned), hq-pp1 (a patch panel is not a node; the path passes through it)
links:
  # LAG members: segments from the LAG interface, one connection
  - { id: path-hq-rt1-et-0/0/4--hq-sw1-et-0/0/48, endpoints: [{node: hq-rt1, port: et-0/0/4}, {node: hq-sw1, port: et-0/0/48}],
      speed: 100G, cable: smf, length: 3m, segments: [vlan-10, vlan-20, vlan-99], connection: lag-hq-rt1-ae0--hq-sw1-ae0 }
  - { id: path-hq-rt1-et-0/0/5--hq-sw2-et-0/0/48, endpoints: [{node: hq-rt1, port: et-0/0/5}, {node: hq-sw2, port: et-0/0/48}],
      speed: 100G, cable: smf, length: 3m, segments: [vlan-10, vlan-20, vlan-99], connection: lag-hq-rt1-ae0--hq-sw1-ae0 }
  - { endpoints: [{node: hq-fw1, port: port1}, {node: hq-sw1, port: ge-0/0/1}], speed: 1G, cable: cat6, segments: [vlan-10] }
  - { endpoints: [{node: hq-esx1, port: vmnic0}, {node: hq-sw1, port: ge-0/0/10}], speed: 1G, segments: [vlan-10, vlan-20, vlan-99] }
  # circuit between two own devices, through a patch panel: no cable type, no length
  - { id: path-br-rt1-ge-0/0/0--hq-rt1-et-0/0/1, endpoints: [{node: hq-rt1, port: et-0/0/1}, {node: br-rt1, port: ge-0/0/0}],
      speed: 10G, description: fictional-telecom FT-DF-0001 }
  # circuits to provider networks
  - { endpoints: [{node: hq-rt1, port: et-0/0/0}, {node: pn-transit-one-transit-one-backbone, port: TO-IP-1001}],
      speed: 10G, bandwidth: 2G, description: transit-one TO-IP-1001, segments: [prefix-198.51.100.0-31] }
  - { endpoints: [{node: br-rt1, port: ge-0/0/1}, {node: pn-transit-one-transit-one-backbone, port: TO-IP-1002}], description: transit-one TO-IP-1002 }
  - { endpoints: [{node: hq-rt1, port: et-0/0/2}, {node: pn-transit-two-transit-two-backbone, port: TT-IP-2002}], description: transit-two TT-IP-2002, segments: [prefix-198.51.100.2-31] }
  - { endpoints: [{node: hq-rt1, port: et-0/0/3}, {node: pn-fict-ix-fict-ix-peering-lan, port: IX-PORT-7}], description: fict-ix IX-PORT-7, segments: [prefix-203.0.113.0-24] }
  # virtual circuit: subinterfaces fold into their parents
  - { id: vcircuit-TO-VC-77-1, endpoints: [{node: hq-rt1, port: et-0/0/0}, {node: br-rt1, port: ge-0/0/1}], virtual: true, description: transit-one-backbone TO-VC-77 }
  # VPN: two tunnels, one connection, inside prefixes as segments
  - { id: tunnel-aws-tun-1, endpoints: [{node: hq-fw1, port: tunnel.1}, {node: vgw, port: tun1}], virtual: true,
      connection: tunnel-group-vpn-aws, segments: [prefix-192.0.2.0-30], description: ipsec aws-tun-1 }
  - { id: tunnel-aws-tun-2, endpoints: [{node: hq-fw1, port: tunnel.2}, {node: vgw, port: tun2}], virtual: true,
      connection: tunnel-group-vpn-aws, segments: [prefix-192.0.2.4-30], description: ipsec aws-tun-2 }
  # L2VPN: point-to-point as a virtual link (subinterfaces folded); multipoint as a segment
  - { endpoints: [{node: hq-rt1, port: et-0/0/1}, {node: br-rt1, port: ge-0/0/0}], virtual: true, description: vpws pw-hq-br }
  - { endpoints: [{node: hq-rt1, port: irb.20}, {segment: l2vpn-evpn-users}], virtual: true }
  - { endpoints: [{node: br-rt1, port: irb.20}, {segment: l2vpn-evpn-users}], virtual: true }
  # wireless
  - { id: wireless-1, endpoints: [{node: hq-wl1, port: radio0}, {node: annex-wl1, port: radio0}], description: "wireless hq-annex-ptp, 300m" }
  - { endpoints: [{node: hq-wl1, port: eth0}, {node: hq-sw2, port: ge-0/0/20}], segments: [vlan-99] }
  # VM adapters: virtual links to the VLAN segment
  - { id: vm-app01-eth0-vlan-10, endpoints: [{node: app01, port: eth0}, {segment: vlan-10}], virtual: true }
  - { id: vm-db01-eth0-vlan-10, endpoints: [{node: db01, port: eth0}, {segment: vlan-10}], virtual: true }
  # web01: address in the VPC subnet only, no VLAN → no link
```

Observation-layer assertions: every node has ≥1 identity key (`validateTopologyIdentityContract`);
`hq-rt1` has `mgmtIp: 10.0.99.1`, `sysName: hq-rt1`, `vendorIds['netbox-device-id']`; the three
provider-network nodes and the cloud node carry only `vendorIds`; ports `et-0/0/0`, `tunnel.1`,
`irb.20` exist with `ifName`; no port `et-0/0/0.100`.

Drawing assertion: `boundaryOf(model)` returns the three provider-network nodes and
`cluster-aws-ap-northeast-1`; nothing from `upstream.ts` is needed for the `hq` part.

## Decisions (user, 2026-11-04)

These settle the questions the first draft left open. Where they differ from a section above, they
take precedence.

1. **No `sysName` from NetBox names.** Identity is `mgmtIp` + `vendorIds` only. A NetBox name is
   operator-written, and the identity contract reserves `sysName` for the device's self-reported
   name (#581).
2. **A single-AS site's ASN goes on router-like nodes only**: `router`, `firewall`, `l3-switch`.
3. **A hypervisor cluster with two or more hosts is `redundancy{kind: cluster}`, not assumed.** It
   is the `host` of its un-pinned VMs. "One of these, not known which" is what `host` naming a set
   means.
4. **A wireless link** is neither `virtual` nor cabled; the medium goes in `description`. A medium
   field is left for later.
5. **L2VPN VLAN terminations are not mapped** in this cut.
6. **Cloud is opt-in** through `cloudClusterTypes`. Nothing is inferred from slugs or tags.
7. **`planned` and `inventory` devices and circuits are excluded by default.** The input is the
   current configuration.
8. **A node's id is its name when the name is unique in the result**, else `device-<pk>` /
   `vm-<pk>`.
9. **`ipam/services` is out of scope.**
10. **No colour from the plugin.** `colorByCableType` and the cable-type colours are removed. The
    cable type is a fact and goes in `Link.cable`; the colour of a line is the drawing's to choose,
    by one rule for every source.

## Checked against NetBox 4.7.4 (the seeded `fictional-corp`)

- `connected_endpoints` of an interface whose circuit ends at a provider network is that provider
  network (`connected_endpoints_type: circuits.providernetwork`); the provider is reached through
  the circuit or the provider network's `provider`.
- Through a patch panel and a circuit, `connected_endpoints` is the far device's interface;
  `link_peers` is the nearest front port and `cable` the nearest cable only. Nested cables carry
  only `id`, `label`, `description`: whether a path is one cable, and its `type` and `length`,
  need `dcim/cables`.
- IP addresses on interfaces: `assigned_to_interface=true` (device and VM interfaces both);
  `assigned_object_type=dcim.interface` for devices only. An FHRP VIP is not among them.
- FHRP protocols are `vrrp2` / `vrrp3` (no `vrrp`), alongside `hsrp`, `glbp`, `carp` and others.
- `cable.length_unit` and an interface's `mode` are `{value, label}` objects; `cable.type` is a
  string; an interface's `speed` is in kbps.
- The fixtures in `libs/plugins/netbox/src/fixtures/fictional-corp/` are the recorded responses;
  `libs/plugins/netbox/live/` seeds and records them.

## Implemented (`libs/plugins/netbox`, notes where the data or the model differs)

The plugin follows the sections above. Where NetBox 4.7 or the input model disagreed with the
sketch, the code follows the data and `src/converter.test.ts` pins it:

- **FHRP ids** use the NetBox protocol slug: `fhrp-vrrp2-10` (there is no `vrrp`).
- **Tunnel descriptions** write the encapsulation as NetBox gives it: `ipsec-tunnel aws-tun-1`.
- **ASN** is written on `router` / `firewall` / `l3-switch` nodes only (Decision 2); the sample
  above that gave it to a switch, a server and an access point is superseded.
- **Circuit links to a provider network** take `speed` from the interface's own `speed` and the
  circuit termination's `port_speed` (the least of those stated); a nominal rate from the optic
  type is not the circuit's. So `TO-IP-1002` has `speed: 1G` where the sample left it out.
- **Status filtering is done by the converter, not the request.** A device left out for being
  `planned` must be known as left out, or a cable path reaching it would bring it back as an
  unknown far-end device.
- **A patch panel is a device with front/rear ports and no interface** (`interface_count == 0`);
  it is not a node, and the path passes through it.
- **Clusters and VRFs have no slug in NetBox.** `cluster-<slug>`, `vc-<slug>` and `vrf-<slug>`
  use the name lower-cased with runs of other characters turned into `-`.
- **Colour is gone** (Decision 10), including the status colours: no `colorByCableType`, no
  `colorByStatus`, no cable-type palette. The drawing layer keeps a cable's `label` and a
  `dashed` circuit that is not active.
- **`roleTypes` is a list of `role-slug=type` lines**, because the options form (`SchemaForm`)
  has no map-of-text field.
- **`toYaml(data, options)`** stays: it writes the converter's `network` as YAML.
- **Open in core:** the resolver's graph makes a node for each segment a link ends at, and
  `validateTopologyIdentityContract` reads that node as one with no identity (a source cannot key
  it). A port's `mgmt_only` has no place in `PortObservation`, so it is not kept.

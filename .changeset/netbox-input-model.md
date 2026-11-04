---
'shumoku-plugin-netbox': patch
---

**NetBox maps into the input model as designed** (`docs/plugins/netbox-mapping.md`). Cabled links come from `connected_endpoints` (through patch panels and circuits) and carry `speed`, and `cable` / `length` only for a single cable; LAGs are connections; providers and provider networks are `external` nodes with their ASN; tunnels, virtual circuits, L2VPNs and VM adapters are virtual links; virtual chassis, FHRP groups and hypervisor clusters are redundancy sets; VLANs, prefixes, addresses and VRFs become segments and routing domains; a cluster of a `cloudClusterTypes` type is a cloud that hosts its VMs. Nodes are recognized by `mgmtIp` and the NetBox ids, not by a `sysName` taken from a name. Planned and inventory devices and circuits are left out by default.

**Removed:** the `groupBy` option (`tag`, `prefix`), the tag-to-level mapping (`DEFAULT_TAG_MAPPING`, `TAG_PRIORITY`), `colorByCableType` and every colour. New options: `groupDepth`, `cloudClusterTypes`, `roleTypes`, `tenantFilter`, `statusFilter`, `circuitStatusFilter`. `convertToSourceNetwork` and `toYaml` now take the fetched lists (`NetBoxClient.fetchTopologyData()`) instead of the response wrappers.

---
'@shumoku/core': minor
'@shumoku/renderer': patch
'@shumoku/renderer-svg': patch
'@shumoku/renderer-png': patch
'@shumoku/renderer-html': patch
'@shumoku/cli': patch
'shumoku': patch
'shumoku-plugin-zabbix': patch
'shumoku-plugin-netbox': patch
---

Device attributes are configuration. A node's `address`, `sysName`, `chassisId` and `mac` and a
port's `mac` are fields of the network YAML (`inputModel.Node` / `Port`); `resolveNetwork` matches
nodes on them (and on a node's segment addresses) plus each source's own `vendorIds`, which stay in
the source's observation with a port's `ifIndex`. The `identity` field is gone from the observation
record, and the drawn graph (`Node`, `NodePort`, `Link`, `Subgraph`, `NetworkGraph`) carries no
`identity`, `provenance`, `entityId`, `attachments`, `metadata` or `exclusions`: `toNetworkGraph(model)`
takes no observation and `fromNetworkGraph(graph)` returns a `NetworkModel`. The graph-shaped
`resolve()` / `SnapshotEntry` / `ResolvedGraph`, `graphToSource`, `stampObserved` and
`deriveMappingFromGraph` are removed; `deriveMapping(graph, observation)`,
`effectivePolicyForNode(graph, observation, node)`, `nodeIdentityKeys(DeviceKeys)`,
`portIdentityKeys(PortKeys)`, `deviceKeysOfIdentity`, `segmentAddressesOf`, `deviceAttributes` and
`vendorIdsOf` replace them. `validateTopologyIdentityContract` reports `portsMissingName` instead of
`portsMissingIfName`. Topology plugins write the attributes on the nodes and ports they return.

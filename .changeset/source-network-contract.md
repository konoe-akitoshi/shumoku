---
"@shumoku/core": minor
"shumoku-plugin-zabbix": minor
"shumoku-plugin-netbox": minor
---

Topology plugins now return what they discovered as a `SourceNetwork`: the network in the input's shape, with identity, provenance and attachments in its observation layer, port facts in its design layer and icons in its drawing layer. `fetchTopology()` resolves to one, `Snapshot.source` holds one in place of `Snapshot.graph`, and `validateTopologyIdentityContract` checks one. `sourceToGraph` builds the graph the resolver merges from it, and `rateFromBps` writes a rate as the input does. The Zabbix plugin now gives LLDP links their speed. The NetBox plugin's `toYaml` writes the new YAML from `convertToSourceNetwork`, and its older graph and per-location YAML converters are removed.

---
'shumoku-plugin-netbox': minor
'shumoku-plugin-zabbix': minor
---

**Topology comes back as a `SourceNetwork`, the input's own shape** (see `@shumoku/core`). `fetchTopology()` resolves to one, and the server merges it with the project's configuration.

- NetBox: `toYaml` writes the new network YAML from `convertToSourceNetwork`. The older graph converter and the per-location YAML converter are removed. Links no longer set the removed `arrow` field, and nodes no longer carry `rank`.
- Zabbix: LLDP links carry their speed.
- **Fixed:** the plugins name `@shumoku/core` and `@shumoku/plugin-sdk` by version range. 0.2.30 declared `workspace:*` and could not be installed from npm.

---
'shumoku-plugin-prometheus': patch
'shumoku-plugin-netbox': patch
---

Populate `Host.identity` in `getHosts()` so node auto-mapping can bind a
topology node to a monitored host by a stable key (mgmtIp > chassisId >
sysName > vendorId) instead of only fuzzy name matching. Previously only the
zabbix plugin filled host identity (the original PoC was Zabbix-only), so
mapping e.g. a NetBox topology onto Prometheus/SNMP hosts matched nothing —
the hosts were named by IP/hostname while the nodes were named by device
name, and with no shared identity key auto-map produced zero matches.

- **prometheus**: derive identity from the `instance` label — an IPv4 target
  (bare or `IP:port`, e.g. an SNMP target) becomes `mgmtIp`; a hostname
  becomes `sysName`.
- **netbox**: mirror the topology-node identity (`mgmtIp` from `primary_ip`,
  `sysName` from device name) on the host side too.
- **aruba-instant-on**: `mgmtIp` from `ipAddress`, `mac` from `macAddress`,
  and `{ 'aruba-serial': … }` in `vendorIds`; the operator-editable `name`
  stays a `displayName`, never `sysName`.

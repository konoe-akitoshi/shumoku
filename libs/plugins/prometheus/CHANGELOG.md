# shumoku-plugin-prometheus

## 0.2.26

### Patch Changes

- a8457bf: Populate `Host.identity` in `getHosts()` so node auto-mapping can bind a
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

- c907392: `testConnection()` now fails (instead of silently reporting success) when the
  health check passes but `/api/v1/status/buildinfo` doesn't respond. Hosts and
  metrics both depend on the query API, so a target that passes the health
  check with no query engine at all (e.g. this URL points at a scrape/forward
  agent like vmagent instead of the queryable Prometheus/VictoriaMetrics
  server) was previously reported as a successful connection with zero
  hosts/metrics and no indication why.
- 38b4086: Add a first-class `secret` flag to plugin config schemas.

  `PluginConfigProperty` gains `secret?: boolean`, and `@shumoku/core/plugin-kit`
  exports `isSecretProp`. Secret-ness is declared once on the schema
  (`secret: true`; `format: 'password'` is still honoured for back-compat), so the
  host can render token/password fields masked with a show/hide reveal toggle and
  suppress password-manager autofill from a single definition — no per-plugin
  branches, no hard-coded field-name lists.

  Bundled plugins mark their token/password/webhook-secret fields with
  `secret: true`.

- Updated dependencies [1be13c4]
- Updated dependencies [d9625fb]
- Updated dependencies [e60404d]
- Updated dependencies [14db853]
- Updated dependencies [d2b560c]
- Updated dependencies [b19c2ec]
- Updated dependencies [caf0c50]
- Updated dependencies [d943f92]
- Updated dependencies [3764162]
- Updated dependencies [d2051be]
- Updated dependencies [e5c79a4]
- Updated dependencies [caf0c50]
- Updated dependencies [caf0c50]
- Updated dependencies [38b4086]
  - @shumoku/core@0.3.0

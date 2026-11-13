# shumoku-plugin-prometheus

## 0.2.33

### Patch Changes

- Updated dependencies [570c86e]
- Updated dependencies [60d6f2f]
- Updated dependencies [d5f9beb]
- Updated dependencies [64a17e6]
- Updated dependencies [eb1f58e]
- Updated dependencies [b262fe4]
- Updated dependencies [fea9b1c]
- Updated dependencies [bcefedd]
- Updated dependencies [317dd26]
- Updated dependencies [e5d6270]
- Updated dependencies [475ba09]
  - @shumoku/core@0.7.0

## 0.2.32

### Patch Changes

- Updated dependencies [173780d]
- Updated dependencies [62252ae]
- Updated dependencies [5bece3c]
  - @shumoku/core@0.6.0

## 0.2.31

### Patch Changes

- 6f89ee5: Name `@shumoku/core` by version range instead of `workspace:*`. `@shumoku/catalog` 0.1.5 was published with `workspace:*` and could not be installed from npm; the Grafana and Prometheus plugins would have gone out the same way.
- Updated dependencies [6f89ee5]
  - @shumoku/core@0.5.0

## 0.2.30

### Patch Changes

- Updated dependencies [9830a35]
- Updated dependencies [0e8b8b4]
- Updated dependencies [704357a]
  - @shumoku/core@0.4.2

## 0.2.29

### Patch Changes

- Updated dependencies [cbc429d]
  - @shumoku/core@0.4.1

## 0.2.28

### Patch Changes

- Updated dependencies [97a473f]
  - @shumoku/core@0.4.0

## 0.2.27

### Patch Changes

- Updated dependencies [78f6864]
  - @shumoku/core@0.3.1

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
- Updated dependencies [48199ff]
- Updated dependencies [d2b560c]
- Updated dependencies [97a4cf6]
- Updated dependencies [b19c2ec]
- Updated dependencies [6dcfdc3]
- Updated dependencies [caf0c50]
- Updated dependencies [97a4cf6]
- Updated dependencies [d943f92]
- Updated dependencies [3764162]
- Updated dependencies [4639a38]
- Updated dependencies [912bf6f]
- Updated dependencies [d2051be]
- Updated dependencies [e5c79a4]
- Updated dependencies [2e27e77]
- Updated dependencies [caf0c50]
- Updated dependencies [caf0c50]
- Updated dependencies [38b4086]
- Updated dependencies [a8370b8]
- Updated dependencies [091471f]
  - @shumoku/core@0.3.0

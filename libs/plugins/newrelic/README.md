# New Relic source for Shumoku Server

A bundled, read-only plugin for ktranslate SNMP and Infrastructure data.
Capabilities: **topology, hosts, metrics, alerts**. It does not collect SNMP or
change New Relic/device configuration.

## Setup

1. Add a New Relic data source with account ID, User API key and account **data
   region** (US/EU/JP, not the operator's location). Test the connection.
2. Attach the same source instance to a topology for both **topology** and
   **metrics**. In topology source options enable **Bind monitoring on source sync**.
3. Sync the source. Newly discovered nodes/ports are automatically bound on
   subsequent syncs. Human overrides and explicit unmapping survive synchronization.
   Bindings only drive polling while that instance is attached for metrics.
4. Select a device to inspect **Interfaces**, **Source diagnostics**, and
   **All Metrics**. Click an interface to filter its observations. A cable is not
   required to inspect its current bps and operational state.

Secrets stay in server configuration; never embed keys in topology data or URLs.
The source option is `{"autoBindMetrics":true}`. Disable it and resync to stop
providing automatic defaults; human-authored mappings remain independent.

## Data contract

| Information | Behavior |
| --- | --- |
| Inventory | Registered EXT network entities plus recently reporting SNMP GUIDs; historical attributes/ports default to 7 days (configurable 1–30). Optional Infrastructure hosts come from SystemSample. |
| Duplicate GUIDs | Collapse corroborated IP/sysName/OID aliases; suppress a profile migration only with matching IP/name/collector and non-overlapping observation epochs. Ambiguous identities stay separate without shared merge keys. |
| Ports | One port per interface name, including VLAN/bridge/tunnel/loopback interfaces. Latest ifIndex; shared/zero MACs are not identity keys. Historical ports retain actual observation times. |
| Classification | Aruba AP-535 requires matching OID and description; VyOS router requires OID and description; Allied switch gets vendor and switch pictogram without guessing L2/L3. Infrastructure gets server type. Other devices get a generic icon and an unknown-classification annotation. |
| Health | Device reachability stays unknown. GOOD heartbeat without recent usable telemetry is pending; BAD polling is collection failure. Stale telemetry is not zero or device-down. |
| Traffic | SNMP interval octets become bps with `rate(sum(...)*8,1 SECOND)`. Standard Kentik `if_Speed` is Mbps; explicit mapping bandwidth is bps. Infrastructure bytes/sec become bits/sec. Missing per-field observations are omitted. |
| Detail | Generic keyset/latest queries preserve primitive upstream values, separated into device/interface scopes. Labels show observation time and freshness; historical attributes do not masquerade as live readings. Current-window derived interface bps/state are included separately. |
| Alerts | Paginated NerdGraph Issues, with an explicit epoch start to include long-running open issues. CREATED/ACTIVATED/DEACTIVATED remain active; only CLOSED is resolved. Severity and per-entity GUIDs are translated to the core contract. |

Default freshness: SNMP 180 seconds, Infrastructure 1200 seconds. Rates average
`max(2 × freshness, 300 seconds)`, not an instantaneous rate; collection gaps can
understate the average. Inventory ages out of the configured history even when a
registered device remains. Raw inventory retains provider/type hints separately
from classification. Exact hardware front-panel images are not inferred from names.

## Physical links and collector requirements

IF-MIB lists ports but does **not** identify cables. The adapter requires:

- LLDP remote rows (`lldpRemSysName`, `lldpRemPortId`, `lldpRemPortIdSubtype`) with
  entity GUID, full remote table `Index` (`timeMark.localPortNum.remoteIndex`), timestamp.
- LLDP local rows (`lldpLocPortId`, `lldpLocPortIdSubtype`) indexed by localPortNum.
- An explicit `interfaceName` local/remote ID (numeric subtype 5 also accepted),
  or a uniquely matching remote MAC. The peer system name must uniquely resolve
  to an inventoried device. Chassis matching is available only if inventory
  actually supplies a chassis identity.
- The referenced interfaces must exist on both devices and the remote observation
  must be within two hours (to accommodate hourly LLDP collection).

LocalPortNum is **never** assumed to be IF-MIB ifIndex. Unresolved/ambiguous,
conflicting and stale neighbors are omitted with diagnostics; reciprocal records
become one cable. CDP and arbitrary vendor port aliases are not yet adapted.
`neighborMode=auto` permits device/port inventory without LLDP; `required` fails
sync on missing/unresolved neighbors so the server retains the last good graph;
`disabled` intentionally skips the query. Auto mode retracts missing links in a
successful snapshot, so use required mode when missing collection must block replacement.

The tested account currently has no LLDP observations. Physical link conversion
is covered by fixtures and DB mapping tests, **not validated against live cables**.
Collector profile configuration and device LLDP access must be verified before
claiming physical topology works in that environment. See the official
[ktranslate LLDP profile](https://github.com/kentik/snmp-profiles/blob/main/profiles/kentik_snmp/_general/lldp-mib.yml)
and [New Relic Issues API](https://docs.newrelic.com/docs/apis/nerdgraph/examples/nerdgraph-issues-api-via-github/).

## Reliability and validation

Inventory cache: 60 seconds, shared in-flight requests; sync forces a fresh read.
Dispose/reinitialize aborts requests and invalidates the cache. Maximum two
concurrent requests per instance; HTTP 429/502/503/504 retry at most twice.
Queries hitting 5000 results, repeated cursors, partial GraphQL errors, and
incomplete API responses fail instead of publishing a silently truncated snapshot.
Large single batches currently require narrower account scope; adaptive splitting
is not implemented. Error messages exclude upstream bodies and credentials.

```sh
bun run --cwd libs/plugins/newrelic build
bun run --cwd libs/plugins/newrelic test --run
bun run --cwd libs/plugins/newrelic typecheck
# Database tests need the API's bunfig.toml SQL loader:
cd apps/server/api
bun test test/db/source-bindings.test.ts test/db/metrics-mapping.test.ts
```

Tests use synthetic upstream responses. Development validation exercised live
inventory, interface metrics, issues, repeated source synchronization, and manual
source composition. No live LLDP cables were available for validation.

## Combining manual cables with monitoring

Attach a manual topology source to the same topology. Give its device anchors
the identity of the corresponding discovered device; do not match devices by
display name alone. A manual port needs a verified `identity.ifName` to merge
with a discovered interface and inherit its monitoring binding. Unidentified
endpoints can describe a cable without claiming an interface metric.

Logical relationships and inferred paths are not evidence of physical cables.
Do not bind an aggregate router interface to every downstream relationship:
that would repeat the same traffic total on several lines. Keep inferred links
explicitly labeled and leave their interface bindings unset.

DB regression tests cover merging an independent manual source with monitored
inventory, adding a verified interface identity, and preserving the cable and
monitoring bindings after inventory resynchronization.

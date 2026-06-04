# Zabbix LLDP Topology Source — Design

Status: spec (2026-06-05). Supersedes the initial map-import approach (#341).

## Goal

Make the Zabbix plugin a **topology source that generates nodes + links from
standard Zabbix data** — no dependency on Zabbix maps or the custom netmap/L2DM
map-generation module, and **no direct SNMP reach** from shumoku (Zabbix is the
collector).

- **nodes** ← `host.get` (scoped by host group)
- **links** ← per-host **LLDP-MIB** neighbor items (`lldp.rem.*` / `lldp.loc.*`)

## Why this works (verified 2026-06-05 against zabbix-test, Zabbix 7.0.23)

- Zabbix has no native topology object, but LLDP neighbor data is collected as
  **standard SNMP items** (SNMP_walk of IF-MIB `1.3.6.1.2.1.2.2.1.*` + LLDP-MIB
  `1.0.8802.1.1.2.*` → LLD → dependent items). See `reference_zabbix_lldp_topology`.
- Reconstructed real adjacency from items alone: mx304.noc 4/4 neighbors resolved
  to other Zabbix hosts; ptx10002-60mr.noc 6/8 (2 neighbors aren't Zabbix hosts).
- The resolver already folds cross-source nodes+links by identity
  (`foldLinks`/`remapEndpoint`), so this composes with other sources.

## Config (per-attachment `optionsSchema` → `optionsJson`)

| key | type | note |
|-----|------|------|
| `hostGroups` | string[] (`optionsSource:'hostgroup'`, freeSolo) | **Scope.** Strongly recommended — instances have 1000s of hosts (zabbix-test: 1386). Empty = all (guarded/limited). |
| `groupBy` | `'hostgroup'` \| `'none'` (default `hostgroup`) | Subgraphs from host groups (most-specific). Reused from the map version. |
| `includeExternalNeighbors` | boolean (default `true`) | Synthesize nodes for LLDP neighbors that aren't Zabbix hosts. |

`getConfigOptions('hostgroup')` supplies candidates via `hostgroup.get`.

## LLDP item families (per host, joined by the item NAME `[ifName]` suffix)

Joining by the trailing `[ifName]` in the item **name** is reliable; the item
**keys** are inconsistent across families (some keyed by ifName, some ifIndex,
some carry template macro params) so do NOT parse keys.

| family | use |
|--------|-----|
| `lldp.rem.sysname` | remote neighbor system name → resolve to a node |
| `lldp.rem.port.id` | remote port id (may be a port name or a MAC) |
| `lldp.rem.chassisid` | remote chassis id (identity for external nodes) |
| `lldp.neighbor.present` | "has neighbor" (or treat `rem.sysname` ∉ {`* No Info *`,`-`,`unknown`,``}) |
| `lldp.loc.if.ifSpeed` / `ifHighSpeed` | local port speed → `Link` bandwidth |

**Detection:** if a host has no `lldp.rem.sysname` items, it contributes a node
only (no links). Future: make the family prefix configurable for non-L2DM LLDP
templates.

## Algorithm

1. `host.get({ groupids, output:[host,name,status], selectInterfaces, selectInventory:[hardware], selectHostGroups })`.
   For each host → **Node**:
   - `id = ${sourceId}:host:${hostid}`
   - `label = host.name`
   - `identity = { mgmtIp: pickMgmtIp(interfaces), sysName: host.name, vendorIds:{'zabbix-hostid':hostid} }`
     — **`sysName = host.name`** (the real hostname), NOT `host.host` (often the IP
     here). This is what makes neighbor sysnames resolve and what clusters with
     other sources.
   - `spec = deriveSpec(inventory.hardware)` (reused)
   - `parent` = most-specific host group (reused grouping)
2. For each host, `item.get` the LLDP families above (search by key family, output
   `[name,lastvalue]`). Join values by `[ifName]`. For each ifName with a neighbor:
   - ensure a local **NodePort** on the host node: `id=${nodeId}:port:${ifName}`,
     `label=ifName`, `speed` from ifSpeed/ifHighSpeed.
   - resolve neighbor `rem.sysname` → a host node (match against `host.name`);
     if unresolved and `includeExternalNeighbors`, synthesize an **external node**
     (`identity.sysName = rem.sysname`, `metadata.external = true`) so a later
     discovery of that device clusters with it; else skip the link.
   - ensure a remote NodePort (label from `rem.port.id` when it looks like a port
     name, else synthesized).
   - create **Link** `from {hostNode, localPort}` `to {neighborNode, remPort}`,
     `rateBps`/bandwidth from local ifSpeed, `metadata.discoveredVia='zabbix-lldp'`.
3. **De-dup** (LLDP is bidirectional): canonical key = `sorted([`${aNode}:${aPort}`, `${bNode}:${bPort}`])`,
   keep first. Known limit: when `rem.port.id` is a MAC (not the peer's ifName) the
   mirror may not collapse — acceptable for v1, refine later (e.g. de-dup by node
   pair + chassisId).
4. Subgraphs from host groups (reused). Return graph.

## Pitfalls folded into this spec

1. **Scale** — `hostGroups` filter; fetch only the needed `lldp.*` families, not all
   ~3000 items/host; batch per host with bounded concurrency.
2. **Unresolved neighbors** — synthesize external nodes (identity-keyed) instead of
   dropping, so topology stays complete and future-clusters.
3. **identity.sysName = host.name** (the map version used `host.host`=IP — a bug for
   clustering; fixed here).
3b. **`metadata.hostname = host.name`** — the compound layout
   (`layout/auto-placement/flat-tree/compound.ts`) reads `metadata.hostname` (FQDN)
   to (a) tell a real device from an information-less *ghost* and (b) band link-less
   members by domain (`.noc` / `.sec` / …). Without it every link-less host (the
   majority — only backbone gear has LLDP) is treated as a ghost and dumped into the
   "未マップ" grid, discarding the topology subgraphs. NOTE: the compound layout then
   groups by hostname **domain**, which overrides the host-group `parent` this
   converter sets — so `groupBy` currently affects the resolved graph but not the
   compound-rendered diagram. (No production plugin set `metadata.hostname` before
   this — the compound layout's hostname features were effectively dormant.)
4. **Template coupling** — auto-detect `lldp.rem.*`; absent → nodes-only. Don't hard-fail.
5. **Bidirectional LLDP** — de-dup links.

## Deferred

- Node positions, VLANs, link aggregation grouping.
- Configurable LLDP key prefix for non-L2DM templates (v1 auto-detects the common one).
- A general "links from source B complement nodes from source A" Discovery-tab UX —
  the resolver engine already merges; the orchestration/auto-adopt UX is a separate track.

## Code changes

- `types.ts` — drop sysmap types; add an LLDP item helper type + `ZabbixTopologyOptions {hostGroups, groupBy, includeExternalNeighbors}`.
- `topology.ts` — rewrite: hosts+LLDP → graph; keep `deriveSpec` + hostgroup grouping helpers.
- `plugin.ts` — `fetchTopology` = host.get + batched LLDP item.get → converter; `getConfigOptions('hostgroup')`.
- `index.ts` — `optionsSchema { hostGroups, groupBy, includeExternalNeighbors }`.
- tests — LLDP converter unit tests.

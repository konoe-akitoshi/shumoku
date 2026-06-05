# Metrics mapping as an identity-resolved store

Mapping is what connects a topology element (the diagram) to its live metrics
(a source's host/interface). Today it is a hand-maintained JSON blob; it should
be the same kind of **identity-resolved, provenance-tracked, human-overridable
store** the topology layer already is. This is the rethink.

## What's wrong now

- **Storage is a JSON blob** (`topologies.mapping_json`): no schema, no joins,
  partial edits rewrite the whole blob, no per-binding provenance.
- **Bindings are inconsistent**: node → `hostId` (a stored id), but link →
  interface *name* re-resolved to item ids on every poll; the
  `ZabbixLinkMapping.in/out` id slots exist but go unused.
- **Volatile resolution leaks into the hot path**: because the blob has no home
  for the resolved counter, resolution happens per-poll (links) or gets
  memoized in plugin RAM — both are workarounds for the blob.
- **Keyed by unstable ids**: topology element ids change across re-sync
  (`discovered:N` ↔ `zabbix:host:N`), but the blob is keyed by them, so a
  re-generated topology silently detaches its mapping.

## The real axis: derived vs stored (not blob vs table)

Both sides already carry **identity**: topology elements have
`identity` (mgmtIp / chassisId / sysName / ifName / ifIndex / mac); metrics
sources return hosts/interfaces under the same keys (proved for nodes in #348).
So most of the mapping is **derivable by an identity join** — it isn't truth a
human must hand-maintain.

The project already solved the equivalent problem on the topology side:
all-sources-equal **priority-merge + human contribution + provenance, clustered
by identity** (see `topology-source-priority-merge.md`,
`topology-foundation-identity.md`). **Mapping is the layer that never got this
treatment.** The fix is to apply the same model.

### …but pure derivation is also wrong

- Operators **confirm** an auto-map and expect it to stick; a pure re-derive can
  silently re-bind after a re-sync and surprise them.
- Deriving the join every poll is the O(N×M) cost we already flagged
  (`performance-scaling.md`).

So the answer is neither blob nor pure-derive: **materialize the identity-derived
binding into a table, with provenance, and let humans override** — exactly the
topology model. "Make it a table" is necessary but not sufficient; the table
holds a *resolved-with-provenance* binding, not a hand-kept ledger.

## Three layers

| Layer | What | Where it lives | Volatile? |
| --- | --- | --- | --- |
| **Binding** | element ↔ source/host/interface, **by identity** | materialized table (auto-resolved + human override, provenance) | no |
| **Resolution** | identity → concrete counter (e.g. Zabbix item id) | cached column on the row (`resolved_ref` + `resolved_at`), re-validated | yes |
| **Value** | current bps / status | never stored — fetched each poll | — |

The earlier mistakes map cleanly: the blob conflated all three; per-poll
re-resolution and the RAM memo were the resolution layer with no home; storing
item ids in config would have frozen a volatile value.

## Sketch

```
mapping_binding(
  id,
  topology_id,
  element_kind,            -- 'node' | 'link'
  element_identity,        -- stable join key (node identity; link = endpoint + port identity)
  source_id,
  host_ref,                -- bound host (source host id / identity)
  port_identity,           -- ifName / ifIndex for links (neutral)
  resolved_ref,            -- concrete counter id(s), e.g. {in,out} item ids — CACHE
  resolved_at,             -- for re-validation / staleness
  origin,                  -- 'auto' | 'human'
  method,                  -- 'mgmtIp' | 'sysName' | 'lldp' | 'name' (how it was bound)
  created_at, updated_at
)
```

- **Key by identity**, not the volatile element id, so re-sync re-attaches by
  re-joining instead of detaching.
- `origin='human'` rows win and survive re-derivation (the override/contribution
  half of the priority-merge model).
- `resolved_ref` is a cache: poll reads it; on miss / `resolved_at` too old /
  re-sync, the source re-resolves from `port_identity` and updates the row.

## Flows

- **Resolve (once)** — at map time or topology re-sync, the resolver identity-
  joins elements to source hosts/interfaces, writes/updates rows. Human
  overrides are preserved (merged by precedence, like topology).
- **Poll** — read `resolved_ref` from the table; ask the source plugin only for
  the *values* of those refs (batched). No resolution, no per-poll matching, no
  RAM cache.
- **Re-sync** — re-join by identity; keep `origin='human'` rows; refresh
  `resolved_ref`. The mapping never silently detaches.

## Role split

- **Plugin** = stateless resolver (`identity → resolved_ref`) + value fetcher.
  No mapping state in the plugin (removes the RAM memo).
- **Server DB** = the persistent mapping store (binding + cached resolution +
  provenance).

## Dependency

Requires **port identity on topology elements** (`NodePort.identity` =
ifName / ifIndex / mac) — the T0 gap in `link-interface-resolution.md`. TTDB
ports currently carry none. This is the same theme throughout: **the node-side
identity migration is done; ports + mapping are the unfinished half.** Port
identity is the prerequisite phase.

## Phasing

1. **Port identity (prereq)** — sources stamp `NodePort.identity`
   (ifName/ifIndex/mac). Zabbix already has it via LLDP/ifName; TTDB needs to
   emit it.
2. **Binding table** — introduce `mapping_binding`; resolver populates it by
   identity join; human edits write `origin='human'` rows. Migrate existing
   `mapping_json` in.
3. **Poll reads the table** — plugins drop to value-fetch only; delete per-poll
   interface resolution and the RAM memo. (This is where the metrics-poll
   perf win lands structurally, not as a cache.)
4. **Re-sync reconciliation** — re-join by identity, preserve human overrides.

## Supersedes / connects

- Supersedes the closed PR #355 (plugin-RAM memo) — that was a blob-era
  workaround.
- Closes the structural half of `performance-scaling.md` §② (link re-resolution
  disappears because the binding is stored, not recomputed).
- Builds on `link-interface-resolution.md` (T0/T1) and reuses the
  identity + priority-merge + provenance model from the topology docs.

## Open questions

1. One `mapping_binding` table for nodes and links, or split? (Links carry port
   identity; nodes don't.)
2. How to express **link** `element_identity` — by the two endpoint node
   identities + port identity, or a link-level identity?
3. `resolved_ref` re-validation cadence — lazy (on poll miss) vs on re-sync vs a
   TTL.
4. Migration: derive bindings fresh from identity on first load, or import the
   existing `mapping_json` verbatim and back-fill identity?

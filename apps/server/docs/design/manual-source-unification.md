# Manual source unification — make Manual a uniform data source

> Status: IMPLEMENTED — merged in PR #370. Issue: #368. Supersedes #361. Builds on the composition-store
> refactor (`topology-composition-store.md`). No backward compatibility.

## The problem

Every other data source (zabbix / netbox / prometheus / …) follows one shape:

```
source row in data_sources (config = how to reach upstream)
  → attached to topologies via topology_data_sources (m2m)
  → content recorded as snapshots in topology_observations (per topology, source)
  → resolve() folds all sources' latest snapshots into the displayed graph
```

**Manual does not.** It's wedged into the data-source abstraction but special-cased:

- Its authored graph lives in `data_sources.config_json.graph` — *content* parked
  in the *config* (connection) blob. Migration 011 put it there.
- ~13 `type === 'manual'` branches are scattered across the server
  (`topology.ts`, `datasource.ts`, `discovery-scheduler.ts`,
  `api/topology-sources.ts`).
- The editor saves the manual graph through the **generic datasource config PUT**
  (`PUT /datasources/:id` with `configJson.graph`), not the observation path the
  other sources use.

So Manual is "a data source" in name but a bespoke thing in implementation. That
mismatch is the wart: `config_json` means two different things (connection for
real sources; content for Manual), and the special-casing leaks everywhere.

## Decision

**Manual is a fully uniform data source.** Its authored graph is its
*contribution*, recorded as a **`topology_observations` snapshot** like every
other source — written by the editor's save (the human is the "scanner"). There
is no source-level graph store and no `config_json.graph`.

- **Storage:** the authored graph is a per-(topology, manual-source) observation.
  `config_json` for a Manual source is `{}` (it has no connection).
- **Editor save = record an observation** (status `ok`, `capturedAt = now`),
  exactly like a source sync records one. Retention gives a short edit history
  for free.
- **resolve** already treats the authored contribution as top priority with no
  `authored ===` field-merge casing — unchanged. It now reads the manual source's
  latest observation instead of `config_json.graph`.
- **"Sharing" = the source entity is attachable to many topologies** (m2m), the
  same as every source — NOT one graph mirrored across topologies. Each topology
  gets its own per-topology content (observations), identical to how zabbix
  attached to A and B scans each independently. (Literal "reuse the same drawing
  in another topology" is a future clone/template action, not source behaviour.)

### Why this reverses migration 011

011 moved the graph to `config_json.graph` to (a) allow one Manual to be *shared*
(content-mirrored) across topologies and (b) avoid "orphan Manual" semantics. But:

- Content-mirroring (one graph reflected across topologies) is *unlike every
  other data source* — it's what made Manual special. Dropping it (per
  no-backcompat) is what makes Manual uniform: content is per-(topology, source)
  observations, exactly like a Zabbix attached to A and B scanning each
  independently.

So 011 is reversed; we go back to 010's shape (manual content = observations),
which is the uniform model.

> **No cardinality / sharing constraints (corrected 2026-06).** Earlier drafts of
> this doc said "Manual is one-per-topology (enforced at attach)" and kept a 409
> guard. That **contradicted** the core decision (§Decision: "the source entity is
> attachable to many topologies, the same as every source") and is **wrong**.
> Manual is fully uniform: create it on `/datasources`, attach it to one *or many*
> topologies, multiple per topology if you like — no special guards. Content stays
> per-(topology, source). The attach-rejection guards
> (`topology-sources.ts` POST + bulk PUT) and `listByDataSource` were removed.
> "Orphan Manual" simply isn't a concern — a detached Manual's data source row is
> an ordinary unattached source, like any other.

## What changes (inventory → target)

Legend: **keep** (inherent, survives) · **fold** (becomes generic) · **remove**.

| Today | What it does | Target |
| --- | --- | --- |
| `config_json.graph` storage | source-level authored graph | **remove** — graph is a per-topology observation |
| `readManualGraph(sourceId)` | read `config_json.graph` | **fold** → "latest observation for (topology, manual)" (or delete; callers use the observation feed) |
| `writeManualGraph(sourceId, g)` | write `config_json.graph` + fan-out invalidate | **fold** → `observations.record({topologyId, sourceId, graph, status:'ok'})` (per topology) |
| editor save → `PUT /datasources/:id {configJson.graph}` | persist graph in config | **fold** → `POST /topologies/:id/sources/:sid/observation {graph}` (the existing generic path) |
| `parseTopology` authored = `readManualGraph` | feed resolve's authored slot | **fold** → authored = latest manual observation for this topology (it's just another snapshot, but top priority) |
| `attachManualSource` seeds `config_json.graph` | empty-canvas seed | **fold** → seed nothing; absent observation = empty authored graph |
| `topology-sources.ts` one-per-topology 409 + bulk "owned elsewhere" 409 | cardinality / sharing guard | **remove** — Manual is fully uniform; attach to one or many topologies, no cardinality limit (corrected; was mistakenly "keep") |
| `datasource.ts:90` Manual in `listByCapability('topology')` | no capability flags | **keep** (inherent: no upstream → declares nothing) |
| `discovery-scheduler.ts:278` skip Manual in tick | no upstream to scan | **keep** (inherent) |
| `discovery-scheduler.ts:167,320` readManualGraph for SNMP creds | reads authored for per-target community | **fold** → read via the observation/resolved feed |
| `discovery-policy.ts` writeManualGraph (×6) | mutate authored attachments/exclusions | **fold** → record a new manual observation with the mutated graph |
| `manual-plugin.ts` (server stub) | no-op DataSourcePlugin | **keep** (it's a legit capability-less source; optionally move to `libs/plugins/manual` later) |

Net: `config_json.graph` and the storage-specific branches disappear; Manual
flows through the same observation pipeline as every source. The remaining
`type==='manual'` checks are the genuinely inherent ones (no upstream → skip
scan, no capability flags).

## Migration

`014_manual_graph_to_observations.sql` (reverse of 011, restore 010's shape):

```sql
-- Move each Manual source's config_json.graph back into a fresh observation.
INSERT INTO topology_observations
  (id, topology_id, source_id, captured_at, status, graph_json,
   node_count, link_count, port_count, created_at)
SELECT
  'obs_man_' || tds.topology_id,
  tds.topology_id,
  ds.id,
  ds.updated_at,
  'ok',
  json_extract(ds.config_json, '$.graph'),
  COALESCE(json_array_length(ds.config_json, '$.graph.nodes'), 0),
  COALESCE(json_array_length(ds.config_json, '$.graph.links'), 0),
  0,
  ds.updated_at
FROM data_sources ds
JOIN topology_data_sources tds
  ON tds.data_source_id = ds.id AND tds.purpose = 'topology'
WHERE ds.type = 'manual'
  AND json_extract(ds.config_json, '$.graph') IS NOT NULL;

-- Strip the graph from config (content no longer lives in config).
UPDATE data_sources
SET config_json = json_remove(config_json, '$.graph')
WHERE type = 'manual' AND json_extract(config_json, '$.graph') IS NOT NULL;
```

(Validate against bun:sqlite first, like 013/014 were. Guard `json_valid`.)

## Open wrinkle: live document vs append-only history

Observations are append-only with retention (keep ~10/source). The authored graph
is a *live, edited-in-place* document, and discovery-policy can mutate it often
(toggling one attachment = one save). Recording every edit as an observation:

- gives a short **edit history / undo** for free (nice), but
- churns rows on rapid edits.

Resolve only ever uses the **latest** per source, so correctness is fine. Pick the
retention for manual: keep last N (history) or 1 (no history). Recommend **keep a
small N** (cheap, useful). Not a blocker.

## Risks

- Discovery-policy edits become observation writes — confirm the
  read-modify-write (read latest manual observation → mutate → record new) is
  race-safe under the composition_revision invalidation (it funnels through the
  same `clearCacheEntry`).
- The frontend editor + datasources detail page must switch from the
  `configJson.graph` read/write to the observation endpoint (the real surface
  area of this change is mostly here + discovery-policy).
- `man_<topologyId>` derived ids from migration 010 are reused by 015's
  `obs_man_<topologyId>` — confirm idempotency / no collision on re-run.

## Old-design remnants to clean up (manual-centric UX)

The original model treated a topology AS its manual diagram, so the UX still
assumes "topology = a manual thing you edit":

1. **Auto-attach Manual on create.** The topology list create flow
   (`topologies/+page.svelte:41-45`) creates the shell, immediately attaches a
   Manual source, and navigates to `/datasources/<manualId>`. → A new topology
   should be an empty *composition*; Manual is just one source you add (or it's
   created lazily on first edit). Remove the auto-attach; create → go to the
   topology page (Sources/Composition), not a datasource page.
   (`initializeSample` in topology.ts also does this for the seed — fine to keep
   for the sample, but it should use the observation path, which it already does.)

2. **Card "Edit" button → `/datasources/<manualId>`** (`topologies/+page.svelte:112-119`).
   Editing a topology routes to its *manual datasource page* — a remnant. The
   diagram editor itself lives **only** on `/datasources/[id]/+page.svelte`
   (there is no topology editor route). Under the unified model the authored
   graph is per-topology, so the editor belongs in the **topology context**.

3. **Create-dialog copy** ("edit its content on the next screen") and the
   manual-content-on-datasource framing across the datasources detail page.

**Entanglement with the 5→3 tab IA (#362):** because the manual editor currently
lives on the datasource page, relocating it into the topology context IS part of
the IA work. So the *full* remnant removal (editor relocation) lands with #362.
What this PR does now: remove the auto-attach + stop routing create/Edit through
the datasource page as the canonical "edit topology" path; the editor keeps
working (now writing observations) until #362 moves it.

## Phasing

**This PR (Manual unification + remnant cleanup, backend-led):**
1. Migration 014 (config_json.graph → observation; strip config).
2. Service: `readManualGraph`/`writeManualGraph` → observation read/record;
   `parseTopology` authored = latest manual observation; `attachManualSource`
   seeds nothing; **`create()`/create-flow no longer auto-attach Manual** (lazy
   via `ensureManualSource` on first edit).
3. discovery-policy mutations → record-observation.
4. Editor + datasources/settings web pages → observation endpoint (keep the
   editor where it is for now); fix the create flow + card "Edit" affordance so
   they don't treat the manual datasource as "the topology".
5. Remove the now-dead `config_json.graph` paths; keep the inherent
   `type==='manual'` checks.

**Follow-up (#362):** relocate the manual editor into the topology context and
collapse the 5 topology sub-tabs → 3. After that, the datasource page stops
hosting a graph editor entirely.

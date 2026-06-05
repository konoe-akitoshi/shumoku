# Performance scaling: mapping, metrics, diagram

Large topologies (ShowNet: ~1454 / ~782 nodes) make three distinct things slow.
They share a root but need different fixes. This is the plan.

## Root causes

**Meta-root — built for small N.** The pipeline assumes tens-of-nodes diagrams,
where doing everything eagerly, full-set, one-item-at-a-time is fine. ShowNet is
10–50× the design point, so the same code falls over. The meta-root splits into
two cross-cutting roots:

- **Common root A — no scope.** We process *everything, always*: the server
  polls *all* DB topologies every cycle (even unviewed 1454-node ones); mapping
  scores *all nodes × all hosts* and loads *all* hosts; the diagram lays out and
  renders *every* node/port even off-screen. There is no "working set" notion.
- **Common root B — single-item granularity.** No batching / indexing /
  virtualization: metrics is 1 API call per node and per link; mapping is one
  score per (node, host) pair (rebuilding the host's keys each time); the diagram
  is one component/DOM subtree per node and per port.

A × B compounds: full-set work, item-by-item, eagerly, repeated.

Each layer then has an **individual root** that survives the common fixes:

| Layer | Individual root | Nature |
| --- | --- | --- |
| ① Mapping | all-pairs O(N×M) matching | CPU / algorithm |
| ② Metrics | one remote Zabbix round-trip per item | network I/O |
| ③ Diagram | SVG-DOM degrades with element count + JS layout cost | browser render |

## Plan per layer

### ② Metrics poll (server) — biggest, I/O-bound

Files: `apps/server/api/src/server.ts` (`updateDbTopologyMetrics`),
`libs/plugins/zabbix/src/plugin.ts` (`pollMetrics`, `evaluateHostHealth`).

- **A — poll only subscribed topologies.** The websocket layer already tracks
  `state.subscribedTopology` per client. Maintain a server-wide Set of active
  subscriptions; `updateDbTopologyMetrics` iterates that set, not
  `topologyService.list()`. Add a short grace window after the last unsubscribe
  so a quick reload doesn't drop data. **Precondition:** audit every consumer of
  the broadcast `dbTopologyMetrics` (topology list status counts? dashboard
  widgets?) — anything that needs metrics without an open topology view must be
  handled (poll-on-demand or keep those in scope).
- **B — batch the per-cycle Zabbix calls** inside `pollMetrics`:
  - *Node health:* replace per-node `evaluateHostHealth` (which does
    `item.get hostids:[one]` + `host.get hostids:[one]`) with one
    `item.get hostids:[all mapped]` + one `host.get hostids:[all]`, chunked
    (~500/req). Group by hostid, feed the existing **pure** classifiers
    (`classifyDevice` / `classifyMonitoring`) unchanged. 2N calls → ~2.
  - *Link interfaces:* group mapped links by host; fetch each host's traffic
    items **once** (`getHostItems`, already host-scoped) and build an
    `interface → {inItemId, outItemId}` map reused for all that host's links;
    then one `item.get itemids:[union]` for values+lastclock. 2 calls per link →
    ~2 per host.

Individual root ②: batching cuts the *count* of round-trips, the only lever that
matters for an I/O-bound fan-out.

### ① Mapping (client) — cheap, CPU-bound

Files: `apps/server/web/src/lib/auto-mapping.ts`, `.../stores/mapping.ts`,
`.../mapping/+page.svelte`.

- **B — index hosts once.** `identityMatchScore` rebuilds
  `nodeIdentityKeys(host.identity)` + a Set for every (node, host) pair. Build a
  host identity index `{ "kind:value" → host[] }` once per auto-map run and look
  up per node. O(nodes × hosts) → O(nodes × keys-per-node). Same scores, just a
  faster path (keep `matchNodeToHost`'s behaviour; the index is internal).
  Name-fuzzy fallback can index host base-names too; substring containment stays
  linear but only runs for the identity-miss residual.
- **A — don't ship all hosts to the UI.** `getHosts` returns ~1386 rows rendered
  into a dropdown per node row. Virtualise / lazily render the dropdown (or
  search-on-type) rather than emitting thousands of `<option>` × rows.
- **Shared with ②:** the link-auto-map prep (`loadInterfacesForMappedNodes` →
  `getHostItems` + `getInterfaceNeighbors` per mapped host) is the same fan-out;
  reuse ②-B's host-batched interface fetch where possible.

### ③ Diagram (client render) — design-heavy, the real call

Files: `apps/server/web/src/lib/components/topology/TopologyViewer.svelte`
(client `computeNetworkLayout`, existing `layout` override), `ShumokuRenderer`.

- **Individual root — move layout to the server and cache it.** A `layout`
  override already exists (share pages pass a server-computed layout and skip the
  client `computeNetworkLayout`). Extend that to the main app: compute layout
  server-side on topology change, cache it keyed by graph version (observation id
  / graph hash), invalidate on re-sync. Removes the heaviest client cost and
  makes it reusable.
- **A — viewport virtualization + LOD.** Render only nodes/links in the visible
  viewport (+margin); when zoomed out, drop ports/labels and/or cluster. Ports
  are the DOM multiplier, so cutting them at low zoom is the biggest single win.
- **B — rendering tech.** If SVG-DOM still can't hold the element count after
  virtualization, consider canvas/WebGL for the base layer. Decide only if
  needed; it's the largest change.
- Keep layout output identical whether computed on client or server (same
  `computeNetworkLayout`); only the location and caching change.

## Sequencing (impact × effort × risk)

| # | Change | Impact | Effort | Risk |
| --- | --- | --- | --- | --- |
| 1 | ②-A poll only subscribed | very high | low | low* |
| 2 | ①-B host identity index | medium | low | low |
| 3 | ②-B batch node health + interface resolution | high | medium | medium |
| 4 | ③ server-side layout + cache | high (big graphs) | medium | medium |
| 5 | ③ viewport virtualization / LOD | high (big graphs) | high | higher |
| 6 | ①-A virtualise host dropdown | medium (UX) | low–med | low |

\* ②-A risk is low *after* the consumer audit; that audit is the gate.

Do them as **separate PRs by axis** — compute (①), I/O fan-out (②), render (③) —
each measured before/after. Start with 1 and 2 (cheap, low-risk, large effect),
then 3, then take the ③ decisions deliberately.

## Invariants to preserve

- **② correctness:** freshness window (`LIVE_DATA_WINDOW_SEC`), the silence rule
  for hosts a source doesn't own, and priority-merge across sources must be
  byte-identical after batching. A host with no items in a bulk `item.get`
  simply yields no entries — same as the per-host path today.
- **② plumbing:** per-method Zabbix auth and insecure-TLS are unaffected.
- **① results:** the index is an optimization; composite scores and the
  identity → name fallback order stay identical (the unit tests must still pass).
- **③ output:** server layout must equal client layout for the same graph, and
  invalidate on graph change so a re-sync never shows a stale layout.

## Open decisions (need a call before ③)

1. **Client vs server layout** as the default for the main app (not just share).
2. **SVG vs canvas/WebGL** for large graphs — only if virtualized SVG still
   stutters.
3. **Subscription-scope grace window** length, and whether any non-view consumer
   forces some topologies to stay always-polled.

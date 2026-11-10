# System Explorer plugin

A **bundled** Shumoku data source plugin that brings the public
[system_explorer](https://github.com/) samples into Shumoku. Each sample is an
authored network topology plus one or more **declarative protocol scenarios** —
step-by-step walkthroughs that show packets flowing across the diagram.

It is deliberately thin so it does not drift when Shumoku updates:

- It depends only on `@shumoku/core` (for `readNetworkModel` + the plugin
  contract) and `js-yaml`.
- It does **not** depend on the Shumoku renderer or the system_explorer packet
  builder. The plugin ships the *declarative* scenario data; the standalone
  viewer builds the actual packet bytes.

## Capabilities

| capability | status | what it does |
|---|---|---|
| `topology` | known | `fetchTopology()` returns the authored `SourceNetwork` for the configured `sample`. Renders as an ordinary topology layer. |
| `scenario` | open | Declared so the plugin self-documents. Shumoku skips unknown capabilities (`missingCapabilityMethods`), so this is safe. Consumers reach the data via the documented methods below or `nativeApi`. |

## Config

| field | type | meaning |
|---|---|---|
| `sample` | string | Which bundled sample `fetchTopology()` returns (default: first). |
| `viewerUrl` | uri | Base URL of a deployed standalone system_explorer (hash-routed SPA) — hand this to the **Embed** dashboard widget to show the animated walkthrough inside a Shumoku dashboard. |

Bundled samples: `ra`, `ipsec`, `tailscale`, `kerberos`, `bgp`, `lvs-dns`.

## Scenario data contract

The scenario document structure is described by:

- `scenario.schema.json` — a standalone JSON Schema (draft 2020-12), usable by
  any validator without importing this package.
- `src/scenario/schema.ts` — the same schema as a TS object
  (`SCENARIO_JSON_SCHEMA`) plus the TypeScript types.

Data examples (real scenario documents) live in `data/scenario-*.yml`. Each is a
single YAML document; `getScenario(id)` returns it parsed to JSON (with the
owning `topology` id stamped).

A minimal shape (abbreviated from `data/scenario-lvs-dns-dns-vip.yml`):

```json
{
  "id": "lvs-dns",
  "name": "DNS クエリ (LVS/DSR)",
  "topology": "lvs-dns",
  "overview": { "full": "…", "description": "…" },
  "steps": [
    {
      "title": "クライアントが VIP へ DNS クエリを送る",
      "desc": "…",
      "state": { "lvs1": "MASTER (VIP)" },
      "events": [
        { "kind": "local", "node": "client", "label": "www.example.com を解決", "text": "…" },
        {
          "kind": "pkt",
          "from": "client",
          "to": "lvs1",
          "color": "blue",
          "label": "DNS クエリ",
          "packet": { "summary": "…", "layers": [ { "ipv4": { "src": "10.0.0.10", "dst": "10.0.0.51", "proto": 17 } } ] }
        }
      ]
    }
  ]
}
```

## Consumer access

Programmatic (the plugin instance):

```ts
plugin.listScenarios()              // ScenarioSummary[]
plugin.getScenario('lvs-dns')       // ScenarioDoc
plugin.scenarioSchema()             // the JSON Schema object
plugin.listTopologies()             // ['ra','ipsec',...]
plugin.fetchTopology()              // SourceNetwork for config.sample
```

Generic (any consumer that holds a `DataSourcePlugin`, e.g. the server API):

```ts
await plugin.nativeApi('scenario.list', {})
await plugin.nativeApi('scenario.get', { id: 'lvs-dns' })
await plugin.nativeApi('scenario.schema', {})
await plugin.nativeApi('topology.list', {})
```

## Updating the bundled data

1. Edit a file under `data/` (add `topology-<id>.yaml` and/or `scenario-<id>.yml`).
2. `node scripts/gen-data.mjs` — regenerates `src/generated-data.ts`.
3. Rebuild.

Only **public** samples belong here. Operational/internal examples (real
addresses, hostnames) stay in the system_explorer repo and are never shipped in
this plugin.

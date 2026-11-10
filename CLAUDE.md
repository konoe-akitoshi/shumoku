# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Shumoku is a modern network topology visualization library for Markdown. It enables network engineers to create interactive network diagrams directly in documentation. The project is a TypeScript monorepo using bun workspaces and Turborepo.

## Commands

### Development
```bash
bun install           # Install all dependencies
bun run build         # Build all packages (respects dependency order)
bun run dev           # Run all packages in dev mode
bun run dev:server    # Run the Server API + Web UI with a loopback dev credential
bun run dev:server:request -- GET /api/topologies  # Authenticated dev API request
bun run typecheck     # Type check all packages
bun run lint          # Lint all packages
bun run format        # Format with Biome
bun run test          # Run tests across packages
```

### Interacting with a running dev server — prefer the API

Prefer `bun run dev:server:request -- <METHOD> /api/...` over the
`claude-in-chrome` browser tools for driving a Server dev instance. It's
faster, headless, and scriptable — creating/attaching sources, syncing,
resolving graphs, and reading state are all plain `/api/*` calls. Reserve
`claude-in-chrome` for what genuinely requires eyes on rendered pixels:
verifying a layout/visual change, screenshotting a UI regression, or clicking
through a flow the API can't drive (drag-to-bend, hover states). Don't open
Chrome "just to check" something an API GET would answer just as well.

**This only works if the server was started with `bun run dev:server`
specifically** (not the root `bun run dev`, not `apps/server`'s own `dev`,
not `bun run dev` inside `apps/server/api`) — those all boot the same API
process but skip the credential-generation step, so no Bearer token exists
and every `dev:server:request` call fails. Check first:
`bun run dev:server:request -- GET /api/health`. If it errors with
"Development API credential not found", either the server isn't running the
`dev:server` way (ask before restarting it — another process may depend on
the current one) or you'll need the browser / session-cookie login instead.

`bun run dev:server` generates a fresh 256-bit Bearer credential for the API
process, stored in the gitignored `apps/server/.shumoku/` directory with
owner-only permissions. Use `bun run dev:server:request -- <METHOD> /api/...`
instead of reading or printing the credential yourself. The wrapper refuses
non-API paths and non-loopback destinations. Never pass the token in a URL,
command argument, log, or chat message. This credential is `NODE_ENV=development`
+ loopback-only.

For live/streaming needs (watching a value change over time instead of
polling), prefer an SSE endpoint (`text/event-stream`, plain HTTP — readable
with `curl`/`fetch`, no WebSocket client needed) over `/ws`. `/ws` is
authenticated but full-duplex — the browser UI uses it because it sends
messages back (`subscribe`/`filter`/`setInterval`) to change what it's
watching without reconnecting. An agent/script watching read-only usually
doesn't need that: see `streamSSE` in `apps/server/api/src/api/share.ts` for
the existing pattern (share-token-scoped public dashboards, subscription
fixed at connect time). If the thing you need to watch has no SSE endpoint
yet, that's a gap to flag/fix, not a reason to reach for `/ws`.

### Package-specific
```bash
# Run the static documentation site
cd apps/docs && bun run dev

# Run tests for core package only
cd libs/@shumoku/core && bun run test

# Watch mode for core development
cd libs/@shumoku/core && bun run dev
```

## Architecture

### Monorepo Structure
```
libs/
  @shumoku/core              ← models, YAML reader, drawing engine, themes, plugin-types, plugin-kit, fixtures, icons
  @shumoku/renderer          ← Svelte kit + static SVG; draws core's Scene (ShumokuRenderer, camera, overlays)
  @shumoku/renderer-svg      ← thin wrapper: re-exports @shumoku/renderer/static + renderGraphToSvg, icon fetch helpers
  @shumoku/renderer-png      ← PNG renderer (depends on renderer, renderer-svg, @resvg/resvg-js)
  @shumoku/renderer-html     ← HTML renderer (depends on renderer, renderer-svg)
  @shumoku/catalog           ← device / service catalog (vendor, model, sysObjectID)
  @shumoku/plugin-sdk        ← HTTP client + pagination for data-source plugins
  shumoku                    ← Main wrapper (re-exports core + renderer-svg + renderer-html)
  plugins/
    grafana/                 ← Grafana plugin (alerts)
    netbox/                  ← NetBox plugin (topology, hosts)
    prometheus/              ← Prometheus plugin (metrics, hosts, alerts)
    zabbix/                  ← Zabbix plugin (topology, metrics, hosts, auto-mapping, alerts)
    aruba-instant-on/        ← hosts, metrics, alerts
    arista-cv-cue/           ← topology, hosts, metrics, alerts
    huawei-nce-campus/       ← topology, hosts, metrics, alerts
    newrelic/                ← topology, hosts, metrics, alerts
    network-scan/            ← SNMP / LLDP discovery

apps/
  cli/     ← CLI tool (shumoku render)
  docs/    ← Documentation site (Astro, Cloudflare)
  server/  ← Real-time visualization server
```

The public website and browser Playground live in the separate
`shumoku-dev/shumoku-website` repository and consume published `@shumoku/*` packages.

### Core Library (`@shumoku/core`)

**Input** (`src/input/model.ts`): the YAML's shape, as plain TS types (`inputModel` namespace)
- `Network` with `nodes`, `links` (two `endpoints`), `groups`, `segments`, `redundancy`,
  `routingDomains`. The YAML reference in the docs is generated from these types' comments.

**Models** (`src/models/`)
- `NetworkModel` - the project's truth, two things: `config` (the configuration data, in the
  YAML's shape: nodes with their `ports`, `productId`, `platform` / `service` / `resource`;
  links with each end's `plug`, the `cable` and `via`; `terminations`) and `drawing` (looks,
  icons and `order`, keyed by id). No coordinates, no observation. Every contribution, the
  project's configuration and each source's discoveries alike, is a `SourceNetwork` of the same
  shape (`network` + `observation` + `drawing`); `resolveNetwork(project, snapshots)` merges
  them and returns `{ model, observation }`, the observation record (identity, provenance,
  attachments, exclusions) beside the model, which the Server joins into the display graph with
  `toNetworkGraph(model, observation)`. The Editor keeps coordinates in its scenes only
- `DrawingLayer.order` - the one intent a person adds before coordinates: by frame (group id, or
  `ROOT_FRAME` `''`), a sparse list of the nodes, redundancy sets and groups whose relative order
  was chosen. Ids the drawing has no child for are ignored, not removed; `drawNetwork` reads it
- `readNetworkModel()` / `writeNetworkModel()` - YAML text ⇄ `NetworkModel`
- `toNetworkGraph(model, observation?)` - draws a model as a `NetworkGraph` for layout and the
  renderers; `fromNetworkGraph()` splits a graph back into `{ model, observation? }`;
  `graphToSource()` makes a contribution of it; `applyGraphEdits()` writes edits made on a
  drawn graph back into the model, keeping what the graph cannot say
- `resolveNetwork()` - merges contributions in the configuration's shape
- `NetworkGraph` (`Node`, `Link`, `Subgraph`) - the drawing graph; not an input format

**Drawing** (`src/drawing/`): the serial drawing engine. Everything discrete (ranks, left-right
order, corridors, routes, line order) is decided from relations before any coordinate; the
coordinates are then solved once per axis. Up/down is measured from the boundary, which
`boundaryOf` (`drawing/draw.ts`) decides in this order, an earlier step winning: (1)
`drawing.settings.boundary` (no YAML field or UI sets it today; only code that builds the
model); (2) the structure's candidates, the nodes with both a cable and a
virtual link (`structure/orientation.ts`); (3) `type: external` / `cloud` nodes and the routing
domains that links reach (`type: internet` is not included); (4) for each connected part that
none of (1)-(3) reaches, a guessed upstream (`drawing/upstream.ts`): by node type (router /
firewall / vpn / cpe, then l3-switch / load-balancer, then l2-switch, then access-point), else
the node(s) ending the fastest link, else the graph centre. (4) applies per part, also when
other parts have a boundary; a lone node gets nothing.
- `layoutNetwork(model, { metrics })` - a `NetworkModel` → `Drawing`: the `Scene` (boxes, ports,
  wires) and the `Arrangement` it was solved from (each frame's children left to right with the
  rows they hold, by id, no coordinate; plus `unmet`, the order hints the structure overrode).
  `drawNetwork` is the same keeping the scene. `metrics` is a function `(model) => Metrics`; in
  practice use `layoutNetwork(model)` / `drawNetworkScene(model)` from `@shumoku/renderer`,
  which supply the kit's metrics
- `layoutDrawing()` - the layout behind it; `DrawHints` (`siblings`) is what `drawing.order` becomes
- `layoutNetwork` reads `model.drawing.order` itself, so the Editor
  (`apps/editor/src/routes/project/[id]/diagram/+page.svelte`) and the Server bake
  (`apps/server/api/src/services/derive.ts`) draw one model the same way. The Editor reads a drop
  against the last `Arrangement` (`apps/editor/src/lib/state/order-hints.ts`) and writes only
  what changed: the group (a configuration edit) and the frame's order (an intent)
- The old tiered engine and ELK are gone; do not reintroduce either

**Plugin Types** (`src/plugin-types.ts`): All capability interfaces
- `DataSourcePlugin`, `TopologyCapable`, `HostsCapable`
- `MetricsCapable`, `AlertsCapable`, `AutoMappingCapable`
- `MetricsData`, `MetricsMapping`, `Alert`, `AlertSeverity`

**Themes** (`src/themes/`): Visual styling
- `lightTheme`, `darkTheme` presets
- `createTheme()`, `mergeTheme()` utilities

### Renderer (`@shumoku/renderer`)

**Static** (`@shumoku/renderer/static`, no Svelte needed): the kit draws core's `Scene`
- `drawNetworkScene(model, options)` - model → `Scene` with the kit's metrics
- `renderNetworkSvg(model, options)` / `renderSceneSvg(scene, options)` - SVG string
- `ShumokuRenderer` (Svelte) draws a scene interactively (pan/zoom, selection)

### Renderer SVG (`@shumoku/renderer-svg`)

- A thin wrapper: re-exports `renderNetworkSvg`, `renderSceneSvg`, `drawNetworkScene` from
  `@shumoku/renderer/static`; `renderGraphToSvg(graph)` takes a `NetworkGraph`. Its `theme`
  option is a `Theme` object (e.g. `darkTheme`); renderer-html's `theme` is `'light' | 'dark'`.
  Icon fetch (`fetchIconAsDataUrl`) lives in `src/icon-fetch.ts`.

### Renderer PNG (`@shumoku/renderer-png`)

- `renderNetworkPng(model, options)` - model → PNG `Buffer` (Node.js only, requires @resvg/resvg-js)
- `renderSvgToPng(svg, options)` - rasterize an SVG string; `renderGraphToPng(graph)` for a graph

### Renderer HTML (`@shumoku/renderer-html`)

- `render(svg, options)` - the drawn SVG in a standalone page with pan/zoom, tooltips
- `renderHtml(model)`, `renderSceneHtml(scene)`, `renderGraphToHtml(graph)` - convenience wrappers
- IIFE bundle for interactive features. Hierarchical sheets were removed; the whole network is one page

### Plugins (`libs/plugins/`)

Plugins implement `DataSourcePlugin` from `@shumoku/core` and depend only on core.
- **grafana**: Alerts via Alertmanager API or webhook
- **netbox**: Topology and hosts from NetBox DCIM/IPAM
- **prometheus**: Metrics, hosts, alerts from Prometheus/Alertmanager
- **zabbix**: Topology (hosts + LLDP neighbor links), metrics, hosts, auto-mapping, alerts from Zabbix
- **aruba-instant-on**: Hosts, metrics, alerts from the (unofficial) Aruba Instant On portal API
- **arista-cv-cue**: Topology (AP↔switch from LLDP uplinks), hosts (APs + uplink switches), metrics, alerts from the Arista CV-CUE (CloudVision CUE) Wi-Fi Open API (session auth)

**Plugin contract invariants** (see `docs/plugin-authoring.md` for the full reference):
- Core types are the display contract. Plugins translate their upstream vocabulary
  (Zabbix priorities, Prometheus severities, Aruba health tokens) into core's
  vocab at the plugin boundary — never widen core types with plugin-name literals.
- `Alert.source` is `string`, not a union of plugin names. New plugins must not
  require edits to `@shumoku/core` or `apps/server/web/src/lib/types.ts`.
- `AlertSeverity` is the neutral CVSS-style scale `'critical' | 'high' | 'medium' | 'low' | 'info' | 'ok'`.
  Don't reintroduce Zabbix-flavored values (`disaster` / `average` / `information`).
- `DiscoveredMetric.value` is `number | string | boolean`. The "All metrics" panel
  is a passthrough dump — plugins should walk the upstream record generically
  (use `flattenObject` from `@shumoku/core/plugin-kit`) rather than enumerating fields.
- The web app renders plugin config through `configSchema` via one generic
  `SchemaForm`, never per-plugin branches (#270 resolved). A vitest guard
  (`apps/server/api/src/plugins/host-branch-guard.test.ts`) fails the build if a
  `type === '<plugin>'` branch reappears in the config surfaces.
- Plugins reuse shared helpers, not re-rolled copies: `@shumoku/core/plugin-kit`
  (severity / Alertmanager parse / `flattenObject` / `stampObserved` / `validateAgainstSchema`
  / `mapWithConcurrency`) and `@shumoku/plugin-sdk` (`createHttpClient` / `paginate`).
  Bundled plugins self-describe via `registerDescriptor({...configSchema}, factory)`.
- Topology plugins obey the **identity contract** (checked by
  `validateTopologyIdentityContract` from plugin-kit; every topology plugin has a
  test running it over fixture output): every node ≥1 identity key; ports carry
  `ifName` when they carry any port key. Semantically, `identity.sysName` is the
  device's *self-reported* sysname — never an operator display string (those go
  in `label`); polluted sysName mints duplicate entities (#581).

When in doubt, refuse to add `plugin.type === 'foo'` branches anywhere outside
the plugin's own `libs/plugins/foo/` directory.

### Data Flow
```
YAML input → readNetworkModel() → NetworkModel → drawNetwork() → Scene → renderSceneSvg / renderSceneHtml / renderNetworkPng() → Output
Server: resolveNetwork(project, snapshots) → NetworkModel → drawNetworkScene() → baked {scene}
Plugin fetchTopology() → SourceNetwork → sourceToGraph() → (server resolve) → NetworkGraph
```

`renderNetworkSvg(model)` does the whole path (draw, then the kit's SVG). Icons are resolved from
`@shumoku/core/src/icons/`; the layout needs no icon sizes fetched first.

## Documentation

ドキュメントの正本は読者・対象ごとに1箇所。**二重に書かない。**

- **利用者向け（docs.shumoku.dev）**
  - server / editor: `apps/<app>/docs/` に置き、frontmatter に `public: true` を付ける。
    Docs の収集・生成契約は `tooling/docs/docs.sources.json` を参照する。
    **`apps/docs/.generated/` は生成物なので直接編集しない。**
  - ライブラリ: コード内説明と対象ディレクトリの原稿を更新する。
    `tooling/docs/legacy-content/` は旧MDXの保管用で、現在のDocsの正本ではない。
- **開発・設計メモ（サイトに出ない）**: 各アプリの `docs/` に `public:` なしで置くか、
  プロジェクト横断のものはルート `docs/`（ARCHITECTURE, releasing 等）へ。
  デフォルト非公開なので、`public: true` を付けない限りサイトには載らない。
- **利用者に見える挙動（YAML 構文、CLI、server の機能・設定、プラグイン）を変える PR では、
  対応する `.ja.mdx` を同じ PR で更新する。** 日本語が正本。`.en.mdx` が無いページは
  fallback で ja が表示されるので、翻訳は後追いでよい。

## Versioning & Releases

完全な手順は **`docs/releasing.md`** が source of truth。Shumoku は成果物ごとに
独立したリリースストリームを持ち、**モノレポ全体の単一バージョンは存在しない**。

### エージェントが守るルール（重要）

- **PR をマージしても何も publish/deploy されない。** リリースは別の意図的な操作
  （npm は release PR のマージ、Server は `server-v*` タグ push、Editor は main マージ）。
  普段の機能 PR では「リリース予約」を積むだけ。
- **公開パッケージ（`libs/@shumoku/*` か `apps/cli`）を変更したら、同じ PR に
  changeset を必ず入れる**：`bun run changeset`（対象パッケージ + bump 種別を選ぶ）。
  CI の `changeset` ジョブが未添付の PR を落とす。リリース不要な変更（テスト・内部
  リファクタ）は `bun x changeset add --empty` で明示する。
- **バージョンを手で書き換えない。** Server/Editor は必ず
  `bun run version:server <X.Y.Z>` / `bun run version:editor <X.Y.Z>` を使う
  （`package.json` + Helm Chart + `bun.lock` を一括同期）。CI の
  `version:products:check` が不整合を落とす。
- **`shumoku` ラッパーから露出するライブラリ群は独立バージョン**（`linked: []`）。
  番号は揃わなくてよい。内部依存は `updateInternalDependencies: patch` で追従する。

### bump 種別の選び方

- 0.x の間は基本 **patch** を使う
- **minor** は大きな新機能追加・新しい公開API追加時のみ
- **major** は 1.0.0 リリース時または破壊的変更時
- 迷ったら patch

### 人間がレビュー時に検証できること

- `.changeset/*.md` がそのまま「どのパッケージを、なぜ、どの bump で出すか」の
  レビュー可能な意図表明になる。
- リリース自体は別 PR（`chore: release packages`）のマージで起きるため、公開前に
  必ず人間の承認が挟まる。

## Code Style

- Biome for formatting and linting
- Single quotes, no semicolons, trailing commas
- 100 character line width
- ESM modules (`"type": "module"`)

### Lint Rules (IMPORTANT)
コミット前に必ず `bun x biome check <変更ファイル>` を実行してlintエラーがないか確認する。

- **Non-null assertion (`!`) は使わない** — optional chaining (`?.`) またはガード句 (`if (!x) return/continue`) を使う
- **`any` は原則使わない** — 外部ライブラリのWASMバインディング等でやむを得ない場合のみ `// biome-ignore lint/suspicious/noExplicitAny: <理由>` で抑制
- **`for...of` を使う** — `for (const item of array)` または `for (const [i, item] of array.entries())` を使う。通常の `for (let i = 0; ...)` は使わない
- **未使用変数/importを残さない** — biomeが検出する。`_` プレフィックスで意図的な未使用を明示
- **import順序** — biomeの `organizeImports` に従う（自動修正される）
- **引数を破壊的に変更しない** — 引数を変更する場合はコピーして変更後の値を返す

## Key Types

The input is a network YAML, not a `NetworkGraph`. Write the YAML, read it with
`readNetworkModel`, then draw it with `drawNetwork` / `renderNetworkSvg`. `NetworkGraph`
(`version`, `name`, `nodes`, `links`, `subgraphs?`, `settings?: GraphSettings`, ...) is only the
display projection `toNetworkGraph(model)` makes for the drawing and the renderers.

```typescript
// Draw a model
import { readNetworkModel } from '@shumoku/core'
import { renderNetworkSvg } from '@shumoku/renderer-svg'
import { renderHtml } from '@shumoku/renderer-html'
import { renderNetworkPng } from '@shumoku/renderer-png'

const model = readNetworkModel(yamlText)
const svg = renderNetworkSvg(model)
const html = renderHtml(model)
const png = await renderNetworkPng(model, { scale: 2 })

// Only when a NetworkGraph is already in hand (a display projection, not an input)
import { renderGraphToSvg } from '@shumoku/renderer-svg'
const svg2 = await renderGraphToSvg(graph)
```

## Testing

Tests use the shared sample network from `@shumoku/core`:

```typescript
import { sampleNetworkModel, sampleNetworkYaml, toNetworkGraph } from '@shumoku/core'
const graph = toNetworkGraph(sampleNetworkModel()) // YAML text is `sampleNetworkYaml`
```

`libs/@shumoku/core/src/drawing/golden.test.ts` pins the drawing of fixed networks. A PR that
changes a drawing on purpose runs `bun x vitest run src/drawing/golden.test.ts -u` in
`libs/@shumoku/core` and checks which drawings changed; a pure refactor must pass it unchanged.

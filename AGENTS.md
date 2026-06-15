# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Project Overview

Shumoku is a modern network topology visualization library for Markdown. It enables network engineers to create interactive network diagrams directly in documentation. The project is a TypeScript monorepo using bun workspaces and Turborepo.

## Commands

### Development
```bash
bun install           # Install all dependencies
bun run build         # Build all packages (respects dependency order)
bun run dev           # Run all packages in dev mode
bun run typecheck     # Type check all packages
bun run lint          # Lint all packages
bun run format        # Format with Biome
bun run test          # Run tests across packages
```

### Package-specific
```bash
# Run docs dev server (includes playground)
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
  @shumoku/core              ← models, layout, themes, parser, plugin-types, fixtures, icons
  @shumoku/renderer-svg      ← SVG renderer, pipeline, CDN icons
  @shumoku/renderer-png      ← PNG renderer (depends on renderer-svg, @resvg/resvg-js)
  @shumoku/renderer-html     ← HTML renderer (depends on renderer-svg)
  shumoku                    ← Main wrapper (re-exports core + renderer-svg + renderer-html)
  plugins/
    grafana/                 ← Grafana plugin (alerts)
    netbox/                  ← NetBox plugin (topology, hosts)
    prometheus/              ← Prometheus plugin (metrics, hosts, alerts)
    zabbix/                  ← Zabbix plugin (topology, metrics, hosts, auto-mapping, alerts)

apps/
  cli/     ← CLI tool (shumoku render)
  docs/    ← Documentation site with playground (Next.js)
  server/  ← Real-time visualization server
```

### Core Library (`@shumoku/core`)

**Models** (`src/models/`): Data structures for network topology
- `Node` - Network devices with type, vendor, model
- `Link` - Connections between nodes with bandwidth, VLAN
- `Subgraph` - Logical groupings with nested structure
- `NetworkGraph` - Root container for the entire network definition

**Parser** (`src/parser/`): YAML parser for network definitions
- `YamlParser` - Single-file YAML parser
- `HierarchicalParser` - Multi-file parser with `file:` references
- Device:port notation, type aliases, bandwidth normalization

**Layout Engines** (`src/layout/`): Automatic positioning algorithms
- Custom tiered (Sugiyama-style) engine — `computeNetworkLayout()` (`unified-engine.ts`
  + `engine/` role-tiers/placement/spacing). ELK was removed; do not reintroduce it.
- Produces `LayoutResult` with positioned nodes, links, subgraphs

**Plugin Types** (`src/plugin-types.ts`): All capability interfaces
- `DataSourcePlugin`, `TopologyCapable`, `HostsCapable`
- `MetricsCapable`, `AlertsCapable`, `AutoMappingCapable`
- `MetricsData`, `MetricsMapping`, `Alert`, `AlertSeverity`

**Themes** (`src/themes/`): Visual styling
- `lightTheme`, `darkTheme` presets
- `createTheme()`, `mergeTheme()` utilities

### Renderer SVG (`@shumoku/renderer-svg`)

**Pipeline API** (`src/pipeline.ts`): Unified render pipeline
- `prepareRender()` - Resolve icon dimensions and compute layout
- `renderSvg()` - Render to SVG from prepared data
- `renderEmbeddable()` - Render for embedding in web apps

**CDN Icons** (`src/cdn-icons.ts`): Icon dimension resolution

### Renderer PNG (`@shumoku/renderer-png`)

- `renderPng()` - Render to PNG from prepared data (Node.js only, requires @resvg/resvg-js)
- `renderGraphToPng()` - Convenience one-liner
- Depends on renderer-svg for SVG generation

### Renderer HTML (`@shumoku/renderer-html`)

- `render()` - Interactive HTML with pan/zoom, tooltips
- `renderHierarchical()` - Multi-sheet navigation
- `renderHtml()`, `renderHtmlHierarchical()` - Pipeline convenience wrappers
- IIFE bundle for interactive features

### Plugins (`libs/plugins/`)

Plugins implement `DataSourcePlugin` from `@shumoku/core` and depend only on core.
- **grafana**: Alerts via Alertmanager API or webhook
- **netbox**: Topology and hosts from NetBox DCIM/IPAM
- **prometheus**: Metrics, hosts, alerts from Prometheus/Alertmanager
- **zabbix**: Topology (hosts + LLDP neighbor links), metrics, hosts, auto-mapping, alerts from Zabbix
- **aruba-instant-on**: Hosts, metrics, alerts from the (unofficial) Aruba Instant On portal API

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
  / `mapWithConcurrency`) and `@shumoku/plugin-sdk` (`httpClient` / `paginate`).
  Bundled plugins self-describe via `registerDescriptor({...configSchema}, factory)`.

When in doubt, refuse to add `plugin.type === 'foo'` branches anywhere outside
the plugin's own `libs/plugins/foo/` directory.

### Data Flow
```
YAML input → YamlParser.parse() → NetworkGraph → prepareRender() → PreparedRender → renderSvg/Html/Png() → Output
```

Pipeline internally handles:
1. Icon dimension resolution (CDN fetch with caching)
2. Layout computation (custom tiered engine — `computeNetworkLayout`)
3. Rendering with proper icon aspect ratios

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

```typescript
// Creating a network programmatically
const graph: NetworkGraph = {
  name: 'My Network',
  nodes: Node[],
  links: Link[],
  subgraphs?: Subgraph[],
  settings?: NetworkSettings
}

// Recommended: Use pipeline API (handles icon dimensions automatically)
import { prepareRender, renderSvg } from '@shumoku/renderer-svg'
import { renderHtml } from '@shumoku/renderer-html'

const prepared = await prepareRender(graph)
const svgOutput = await renderSvg(prepared)
const htmlOutput = renderHtml(prepared)

// Or use convenience functions
import { renderGraphToSvg } from '@shumoku/renderer-svg'
import { renderGraphToHtml } from '@shumoku/renderer-html'

const svg = await renderGraphToSvg(graph)
const html = await renderGraphToHtml(graph)
```

## Testing

Tests use the shared `sampleNetwork` fixture from `@shumoku/core`:

```typescript
import { sampleNetwork } from '@shumoku/core'
// Multi-file sample: main.yaml, cloud.yaml, perimeter.yaml, dmz.yaml, campus.yaml
```

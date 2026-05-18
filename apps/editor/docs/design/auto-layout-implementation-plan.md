# Auto-layout 実装計画

設計検討の総合計画。背景・選択肢・トレードオフ全網羅は [auto-layout-redesign.md](./auto-layout-redesign.md) を参照。本書は実装担当向けの操作可能な仕様。

## 1. Executive summary

Diagram view の自動配置は、既存の `NetworkGraph` と `@shumoku/core/src/layout` を維持したまま、network 図として自然に読める role-based 階層へ寄せる。MVP は **kind-tier による層補正** と **同一ポート fan-out の lane offset** だけを実装し、既存の Buchheim / Sugiyama / Bezier 構成を壊さない。P2 で Forster 型の制約付き sibling ordering と bus route を入れ、P3 で multi-start、品質関数、worker、incremental layout を足す。実装順は「型と正規化」「tier 注入」「lane offset」「fixture と snapshot」「P2/P3 の拡張点」の順に固定する。

## 2. Final algorithm stack

| Phase | 採用する処理 | 実装フェーズ | 完了条件 |
|---|---|---:|---|
| Graph normalization | `NetworkGraph` から layout 専用の正規化 graph を作る | P1 | 欠損 port、自己 loop、孤立 node、subgraph nesting を deterministic に扱う |
| Primary layout | 既存の Buchheim tree path を優先し、非 tree は既存 Sugiyama compound fallback | P1 | 現行テストを維持し、tree-dominant 図の見た目を崩さない |
| Kind-tier layer bias | `Node.spec.type` と `Node.layoutIntent` から desired tier を作り、Sugiyama layer assignment に soft constraint として注入 | P1 | Internet / Cloud が上、switch が中段、endpoint が下に寄る |
| Same-kind grouping | 同一 tier 内で同種 node を近接させる安定 sort key を追加 | P1 | 同一 access switch 群、AP 群、server 群が分断されない |
| Edge route | 既存 Bezier を維持し、同一 source port または target port の多本 edge に lane offset を付与 | P1 | fan-out の曲線が完全重畳しない |
| Constrained ordering | Forster 2005 の block contraction 付き barycenter | P2 | subgraph / sibling block の連続性を維持して crossing を減らす |
| Bus routing | lane scan による幹線生成、失敗時は sparse A* | P2 | N 本 fan-out が共通幹 + stub で描ける |
| Candidate search | seeded PRNG + 8-metric score + multi-start | P3 | 同一 seed で完全再現、候補から最良を選ぶ |
| Runtime mode | Web Worker と incremental local relaxation | P3 | 100 node 以上で UI を blocking しない |

決定事項は 1 つだけである。P1 では新規大型 router を入れず、bundle 影響をゼロに近く保つ。P2 以降も pure TypeScript で実装し、libavoid / ELK / dagre などの外部 layout 依存は追加しない。

## 3. MVP definition

MVP は `kind-tier + lane offset` の出荷単位である。Forster、bus、A*、multi-start、worker は MVP に含めない。

| File | 変更内容 | 目安 |
|---|---|---:|
| `libs/@shumoku/core/src/models/types.ts` | `LayoutIntent` と `Node.layoutIntent` を追加 | 35 行 |
| `libs/@shumoku/core/src/layout/layout-graph.ts` | layout 用の正規化 graph、incident edge、port group、node role を作る | 180 行 |
| `libs/@shumoku/core/src/layout/role-tiers.ts` | `DeviceType` から tier / group / spacing hint を解決する | 140 行 |
| `libs/@shumoku/core/src/layout/sugiyama/layers.ts` | `tierHints` を受け取り、topological layer へ soft bias を適用 | 80 行 |
| `libs/@shumoku/core/src/layout/sugiyama/ordering.ts` | same-tier / same-kind の安定 grouping key を追加 | 70 行 |
| `libs/@shumoku/core/src/layout/sugiyama/compose.ts` | `SugiyamaOptions` に tier / grouping options を通す | 35 行 |
| `libs/@shumoku/core/src/layout/sugiyama/compound.ts` | compound recursion へ options を伝播 | 50 行 |
| `libs/@shumoku/core/src/layout/network-layout.ts` | public option 解決、normalizer 呼び出し、tier hint 注入 | 120 行 |
| `libs/@shumoku/core/src/layout/route-edges.ts` | `ResolvedEdge.route` と Bezier lane offset 用 points を生成 | 130 行 |
| `libs/@shumoku/core/src/layout/resolved-types.ts` | route variant 型を追加 | 50 行 |
| `libs/@shumoku/core/src/layout/index.ts` | 新規 public 型の export | 15 行 |
| `libs/@shumoku/core/src/fixtures/layout-regressions.ts` | 回帰 fixture を追加 | 120 行 |
| `*.test.ts` | unit / snapshot / perf smoke | 350 行 |

MVP merge 条件は固定する。

| 種別 | 必須条件 |
|---|---|
| Unit | `role-tiers.test.ts`, `layout-graph.test.ts`, `layers.test.ts`, `route-edges.test.ts` を追加 |
| Existing regression | `bun test libs/@shumoku/core/src/layout` が全通 |
| Snapshot | 5 fixture の node order、layer、edge route を JSON snapshot 化 |
| Perf smoke | 50 node / 49 link / 11 subgraph fixture が main thread で 50ms 未満 |
| Compatibility | 既存 `NetworkGraph` は `layoutIntent` 未指定で従来どおり動く |
| Determinism | 同一入力、同一 options で `nodes`, `ports`, `edges`, `bounds` が deep equal |

## 4. Phase 1, 2, 3 boundaries

| Phase | Done の定義 | 明示的に含めないもの |
|---|---|---|
| P1: semantic MVP | kind-tier が layer へ反映され、same-kind grouping が動き、同一 port fan-out が lane offset で分離される。既存 renderer は追加対応なしで描画できる。 | Forster block contraction、bus、A*、multi-start、worker、incremental |
| P2: crossing and fan-out | sibling / subgraph block を壊さず crossing を減らす constrained ordering が入り、fan-out は bus route variant で描ける。route failure は Bezier lane offset に graceful fallback する。 | multi-start、quality winner selection、worker、local relaxation |
| P3: quality and scale | 8-metric quality function、seeded multi-start、Web Worker、incremental local relaxation が入り、100-300 node の編集で UI 応答性を保つ。 | 外部 layout engine、WASM router、非 deterministic default |

P1 は layout の意味を改善するフェーズ、P2 は線の読みやすさを改善するフェーズ、P3 は探索品質と大規模性能を改善するフェーズである。各 phase は単独で release 可能にする。

## 5. Concrete API additions

```ts
// libs/@shumoku/core/src/models/types.ts
export interface LayoutIntent {
  tier?: number
  tierStrength?: 'weak' | 'normal' | 'strong'
  group?: string
  pinLayer?: boolean
  pinOrder?: boolean
  role?: 'wan' | 'edge' | 'core' | 'distribution' | 'access' | 'endpoint' | 'service'
}

export interface Node {
  // existing fields...
  layoutIntent?: LayoutIntent
}
```

```ts
// libs/@shumoku/core/src/layout/network-layout.ts
export interface NetworkLayoutOptions {
  direction?: Direction
  gap?: number
  topLevelGap?: number
  subgraphPadding?: number
  subgraphLabelHeight?: number
  nodeWidth?: number
  minPortSpacing?: number
  portSize?: number
  portLabelPadding?: number
  fixed?: Set<string>
  hints?: Map<string, { x: number }>

  semanticLayout?: boolean
  roleTiers?: Partial<Record<DeviceType | 'service' | 'generic', number>>
  tierStrength?: 'weak' | 'normal' | 'strong'
  groupSameKind?: boolean
  routeStyle?: 'bezier' | 'bezier-lanes' | 'bus'
  seed?: number
}
```

```ts
// libs/@shumoku/core/src/layout/resolved-types.ts
export type EdgeRoute =
  | { kind: 'bezier'; points: Position[] }
  | { kind: 'bezier-lane'; points: Position[]; lane: number; laneCount: number }
  | { kind: 'bus'; trunk: Position[]; stubs: Position[][]; lane: number }
  | { kind: 'orthogonal'; points: Position[]; fallback?: boolean }

export interface ResolvedEdge {
  id: string
  fromPortId: string
  toPortId: string
  fromPort: ResolvedPort
  toPort: ResolvedPort
  fromNodeId: string
  toNodeId: string
  fromEndpoint: LinkEndpoint
  toEndpoint: LinkEndpoint
  points: Position[]
  route: EdgeRoute
  width: number
  link: Link
}
```

```ts
// libs/@shumoku/core/src/layout/layout-graph.ts
export interface LayoutGraph {
  nodes: LayoutNode[]
  edges: LayoutEdge[]
  subgraphs: LayoutSubgraph[]
  incident: Map<string, LayoutEdge[]>
  portGroups: Map<string, LayoutPortGroup>
}

export interface LayoutNode {
  id: string
  parent?: string
  deviceType?: DeviceType
  semanticTier?: number
  semanticGroup?: string
  intent?: LayoutIntent
}
```

## 6. Concrete file structure

```txt
libs/@shumoku/core/src/layout/
  layout-graph.ts              # NetworkGraph -> layout graph normalization
  layout-graph.test.ts
  role-tiers.ts                # DeviceType / LayoutIntent -> semantic tier
  role-tiers.test.ts
  network-layout.ts            # public entry; option resolution; phase wiring
  route-edges.ts               # route variant construction; P1 lane offset
  route-edges.test.ts
  resolved-types.ts            # EdgeRoute additions
  sugiyama/
    layers.ts                  # tier-aware layer assignment
    layers.test.ts
    ordering.ts                # same-kind stable grouping; P2 constrained ordering hook
    ordering.test.ts
    constraints.ts             # P2 Forster block model
    constraints.test.ts
    compose.ts
    compound.ts
  quality/
    metrics.ts                 # P3 8 metrics
    metrics.test.ts
    multi-start.ts             # P3 seeded candidate search
    prng.ts                    # P3 deterministic PRNG
  worker/
    layout-worker.ts           # P3 worker entry
    protocol.ts
  fixtures/
    layout-regressions.ts      # shared regression graphs
```

Editor 側は P1 では変更しない。`apps/editor` は `@shumoku/core` の `layoutNetwork` / `computeNetworkLayout` を既存どおり呼ぶ。UI で options を露出するのは P2 後に別タスクとする。

## 7. Quality assurance plan

| QA 領域 | 実施内容 | 合格基準 |
|---|---|---|
| Fixtures | `basic-chain`, `wide-ap-fanout`, `distribution-11-areas`, `mixed-router-switch-server`, `compound-cross-boundary`, `cycle-with-role`, `missing-port`, `isolated-nodes` | 全 fixture が例外なしで layout 完了 |
| Snapshots | node layer、x order、subgraph bounds、edge route kind、lane index を JSON に保存 | 意図しない差分は review 必須 |
| Visual smoke | docs/editor playground で 3 fixture を render し、SVG path 数と bbox を確認 | blank SVG、NaN、負サイズなし |
| Regression catalog | round 7 の 15 edge cases を `layout-regressions.ts` に明文化 | すべて unit test で固定 |
| Performance | 10 / 50 / 100 node fixture を `performance.now()` で計測 | P1: 50 node < 50ms、100 node < 120ms |
| Determinism | 同一 graph を 20 回 layout し serialized output を比較 | 完全一致 |
| Compatibility | `semanticLayout: false` で旧挙動に戻ることを確認 | 既存 snapshot と一致 |
| Fallback | 欠損 kind、欠損 port、循環、self-loop、空 subgraph | warning metadata を残して描画継続 |

8-metric quality function は P3 で実装する。metric 名は `edgeCrossings`, `nodeEdgeCrossings`, `totalEdgeLength`, `bendCount`, `portDisorder`, `sprawl`, `densityVariance`, `tierViolation` に固定する。P1/P2 では metric 実装を持たず、snapshot と deterministic test で品質を守る。

## 8. Concrete defaults

10 ラウンド検討で合意した default 値。`role-tiers.ts` の PR 先頭で固定する。

### 8.1 DeviceType → tier table

`tier` は 0 (top, WAN entry) → 100 (bottom, endpoint) の 0-100 スケール、10 刻み。スパース割当で将来挿入余地を残す。

| Tier | DeviceType / Kind | `role` ラベル |
|---:|---|---|
| 0 | `Internet`, `Cloud` | wan |
| 10 | `VPN` | wan |
| 20 | `Firewall`, `LoadBalancer` | edge |
| 30 | `Router` | core |
| 40 | `L3Switch`, `ConsoleServer` | distribution |
| 50 | `L2Switch` | access |
| 60 | `Generic` hardware、未指定 hardware | (none) |
| 70 | `AccessPoint`, `CPE`, `Server` | endpoint |
| 80 | `Database`, compute (VM/container) | endpoint |
| 90 | `service` spec (cloud service) | service |
| - | tier 未解決 | `null` → topology のみで決定 |

`tierStrength` は `'soft'` (デフォルト) / `'strong'` / `'pinned'`。soft は topology が強く反対するなら譲歩、strong は譲歩しない、pinned は絶対固定 (制約破綻時 diagnostics)。

### 8.2 Spacing multiplier (parent_kind → child_kind)

| Parent → Child | Multiplier |
|---|---:|
| `Internet` / `Cloud` → `Firewall` / `LB` / `VPN` | 1.35 |
| `Firewall` / `LB` / `VPN` → `Router` | 1.20 |
| `Router` → `L3Switch` | 1.10 |
| `L3Switch` → `L2Switch` | 1.00 |
| `L2Switch` → `AccessPoint` | 0.90 |
| `L2Switch` → `Server` | 1.00 |
| `Server` → compute | 0.85 |
| `service` → `service` | 0.80 |
| unknown → unknown | 1.00 |

境界デバイス上下は広く、workload 周りは詰める。

### 8.3 Lane offset 計算

同一 source port から N 本出る edge に、port 中心からの水平方向 offset を割当：

```
laneOffset(i, N) = (i - (N-1)/2) * laneStride
laneStride = min(portWidth / N, MAX_LANE_STRIDE)
MAX_LANE_STRIDE = 8px (default)
```

ResolvedEdge.points の最初の control point に offset を加算。最後の control point (target port 近傍) には逆方向の対称 offset を加算 (visual に "fanning out then converging" になる)。

### 8.4 Default options

| Option | Default | 備考 |
|---|---|---|
| `semanticLayout` | `true` | 新規 / 既存ともに opt-out のみ |
| `tierStrength` | `'soft'` | 強制したい時のみ override |
| `groupSameKind` | `true` | 同種クラスタリング ON |
| `routeStyle` | `'bezier-lanes'` | P1 default。P2 で `'bus'` 追加 |
| `seed` | `0` | P3 multi-start で意味、それ以前は無視 |

### 8.5 Edge case handling matrix

Round 7 で議論した 15 ケース。`layout-regressions.ts` に fixture を置き、unit test で固定する。

| Case | MVP 対応 | 備考 |
|---|---|---|
| Cycle in topology | SCC 検出、最小の back-edge を `visual-only` に降格 | 警告 metadata |
| Topology ≠ tier 矛盾 | topology hard、tier soft (default) | strength=pinned のみ強制 |
| Mixed subgraph depths | containment depth と logical rank 分離 | 同 tier の Y を共有 |
| Empty subgraph | 最小サイズ placeholder で描画 | label のみ表示 |
| Single node | fast path、Forster / multi-start skip | deterministic |
| Self-loop | DAG から除外、curl として描画 | crossing 計算に含めない |
| HA pair | topology rank には使わない | bus 参加は role 次第 |
| Detached components | component 分解、packer で配置 | 既存位置あれば順序保持 |
| Bus router failure | fallback: bezier-lane | `route.fallback=true` flag |
| Quality regression | hard-fail (overlap/missing) を score と分離 | metric snapshot で回帰検知 |
| Intent contradiction | 優先順位: pin > topology > node intent > sg intent > kind > 美観 | discarded は diagnostics |
| Perf pathology | budget 段階低下: multi-start ↓ → sweep ↓ → bus → bezier | timeout 時も描画 |
| Renderer compat | `route` 未指定 → bezier fallback | 旧 file crash 無し |
| Incremental | 既存 position = soft anchor、displacement penalty | local relaxation |
| Drag race | cancellation token / generation id | drag node = pin |

## 9. Remaining open questions (post-default)

以下は MVP 後に決める。設計凍結対象外：

| Question | When | Owner |
|---|---|---|
| `tierStrength: 'strong'` UI 露出方法 | P2 | editor owner |
| Worker boundary (full layout or refinement only) | P3 | core owner |
| Spatial index 実装 (R-tree / grid) | P3 perf chase | core owner |
| Cache 永続化 (memory or IDB) | P3 | editor owner |
| 8-metric weight 調整 UI | P3 後 | product owner |
| `service` の vendor 別 tier 分岐 | P2 後 | catalog owner |
| Force-directed hybrid (ハイブリッド) | indefinitely deferred | - |

これらは MVP の merge には影響しない。


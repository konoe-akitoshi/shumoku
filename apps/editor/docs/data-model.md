# neted データモデル

## プロジェクトファイル（.neted.json）

```
NetedProject
├── version: 1
├── name: string
├── settings?: Record<string, unknown>
├── palette: SpecPaletteEntry[]
│   └── { id, source, catalogId?, spec: NodeSpec, properties?, notes? }
│       └── NodeSpec = HardwareSpec | ComputeSpec | ServiceSpec
│           ├── { kind: 'hardware', type?: DeviceType, vendor?, model? }
│           ├── { kind: 'compute', type?: DeviceType, platform?, vendor? }
│           └── { kind: 'service', service, resource?, vendor? }
├── bom: BomItem[]
│   └── { id, paletteId?, nodeId?, notes? }
└── diagram: NetworkGraph                   ← ライブラリ型をそのまま使用
    ├── nodes: Node[]                       ← 保存時に position を確定
    │   └── { id, label, shape, spec?, ports?, position?, parent?, rank?, style? }
    │       └── ports = NodePort[]          ← 機材／インターフェースのスナップショット
    ├── links: Link[]
    │   └── { id, from, to, cable?, type?, vlan?, arrow?, redundancy?, label?, style? }
    │       └── from / to = LinkEndpoint { node, port, plug?, ip?, pin? }
    │             └── plug = LinkPlug { cage?, module? }
    │                   └── module = LinkModule { standard, sku? }
    │       └── cable = LinkCable { medium?, category?, length_m? }
    ├── subgraphs?: Subgraph[]              ← 保存時に bounds を確定
    │   └── { id, label, children?, parent?, bounds?, direction?, pins? }
    └── settings?: GraphSettings
```

派生値（`NetworkGraph` の保存ワイヤには載らない）：

- ノードサイズ — `computeNodeSize()` が label / spec / shape から算出
- 解決済みポート（`absolutePosition`、`side`）— `placePorts()` がノード位置と link endpoint から算出
- ルーティング済みエッジ — `routeEdges()`（libavoid WASM）が nodes / ports / links から算出

ポートとケーブルのモデリングは [`connection-model.md`](./connection-model.md) で網羅的に解説（関係図 / UI 導線 / バリデーション framework）。クイックリファレンス：

- `NodePort.id` は内部的な安定参照で、`LinkEndpoint.port` から指される
- `NodePort.label` はユーザー向けインターフェース名（例: `Gi1/0/1` / `ge-0/0/0` / `E0`）
- `NodePort.cage` は物理レセプタクル種別（`rj45` / `sfp+` / `qsfp28` 等）
- `NodePort.poe` は port 単位の **capability flag**（boolean）。PoE クラス・予算・ロール等の詳細は catalog の `PowerProperties.poe_in / poe_out` 側にあり、port インスタンスには重複させない
- `LinkEndpoint.plug` はケーブル側 form factor + optional モジュールを保持（`LinkPlug { cage?, module? }`）。`plug.cage` は通常 `module.standard.spec.cage` か `port.cage` から派生可能なので、明示するのは「**プラグだけ決まってモジュール未決**」の中間状態のときだけ
- `LinkModule.standard`（例: `10GBASE-SR`）が cage / cable medium / reach を `STANDARD_SPECS` 経由で含意する
- `Link.cable` はプラグ間に実際に敷かれているケーブルを記述：`medium`（`twisted-pair` / `fiber-mm` / `fiber-sm` / `dac` / `aoc`）、`category`（CableGrade — Cat6a / OM4 / OS2 等）、`length_m`。ケーブル端コネクタ（LC / MPO / RJ45 plug）は **派生** で、`module.standard` から導出する
- `faceplateLabel` / `interfaceName` は物理マーキングと OS / API 名のオプショナル metadata

## ランタイム状態（context.svelte.ts）

```
diagram ($state, single object)       SvelteMap-based (reactive)
├── nodes: SvelteMap<id, Node>        ← 配置済み、source of truth
├── subgraphs: SvelteMap<id, Subgraph>
├── links: Link[]
├── ports: SvelteMap<id, ResolvedPort>  ← 派生、placePorts() が rerouteEdges() で再構築
├── edges: SvelteMap<id, ResolvedEdge>  ← 派生、routeEdges() が rerouteEdges() 経由で再構築
└── bounds: { x, y, width, height }

palette: SpecPaletteEntry[]           独立した $state
bomItems: BomItem[]                   独立した $state
poeBudgets: PoEBudget[]               nodes + links + catalog から派生
```

`ResolvedNode` / `ResolvedSubgraph` のラッパ型は #115 で削除済 — runtime Map は直接 `Node` / `Subgraph` を保持する。

## データフロー

```
diagram  <──$bindable──>  ShumokuRenderer（双方向）
  |                            |
  | diagramState.xxx           | drag / link / delete
  | (getter/setter)            |
  v                            v
Connections ページ          Diagram ページ
BOM ページ                   SideToolbar
Specs ページ                 ContextMenu

save:  exportGraph()  ->  NetworkGraph（Node[] と position）  ->  JSON
load:  NetworkGraph  ->  importGraph()  ->  state + placePorts + routeEdges
       └─ いずれかのノードに position が無ければ → computeNetworkLayout（full layoutNetwork pass）にフォールバック
```

### Load パイプライン

ロードは線形パイプライン — 各ステップが入力を一段抽象化して次に渡す。`loadProject` が終端で、状態リセット / `initialized` フラグ / status を所有する。

```
applyYaml(yaml)          YAML  →  NetedProject（既存の palette / bom は保持）
     │
     ▼
importProject(input)     NetedProject（文字列またはオブジェクト）  →  loadProject('imported', data)
     │
     ▼
loadProject(id, data?)   状態をリセット + applyProject(data or builtin)
```

二つの adapter（`applyYaml` / `importProject`）は薄く、変換 + forward だけ。private helper の `applyProject` / `applyGraph` はモジュールスコープにあり、sanitize + `placePorts` + `routeEdges` を担う。あらゆるロード（サンプル / YAML 貼り付け / JSON drop）は同じ終端を通る。

### 配置 API — 二つのプリミティブ、二つの意図

`@shumoku/core` は二つの配置関数を露出する。意図的に統合せず分離して保持している。

|              | `placeNode`                              | `layoutNetwork`                                              |
| ------------ | ---------------------------------------- | ------------------------------------------------------------ |
| 意図         | **幾何学的**（この点に置く）             | **構造的**（リンクの流れに沿って整列）                       |
| 入力         | 1 ノード + 初期 (x, y)                   | グラフ全体                                                   |
| アルゴリズム | 初期点周辺の衝突回避                     | Sugiyama: サイクル除去 → レイヤ分け → 順序 → 座標            |
| 構造の尊重   | しない（リンク無視）                     | する（レイヤは flow direction に従う）                       |
| コスト       | O(既存障害物)                            | O(V + E)、libavoid 級                                        |
| 用途         | ユーザの drop / paste / 「ここに追加」   | 自動整列 / 再レイアウト / YAML インポート                    |

`layoutNetwork` は選択的配置のための二つのつまみを受け付ける：

- **`fixed: Set<string>`** — ハード制約。リスト中のノードは Sugiyama の後に入力位置にスナップバックされる。ポートは一緒に動き、subgraph bounds は再計算される。
- **`hints: Map<string, { x }>`** — ソフト制約。リスト中のノードは座標パスでヒントを優先 x として使う。詰め込みで重なりは依然として防がれるため、混雑領域では最終 x が漂う可能性あり。

「選択範囲を整列」 = `layoutNetwork({ fixed: nonSelectedIds })`、  
「これらのノードをこの x に寄せる」 = `layoutNetwork({ hints })`、  
クリックして drop = `placeNode`。

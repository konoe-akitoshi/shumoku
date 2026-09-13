# ネットワーク配置 pre 版

実験の最新版（V8 dependency-y ＋ 構造ベースの上流検出）を、読みやすく保守しやすい
TypeScript に作り直したもの。**本番の配置エンジンには未統合。** 実験用の `archive/` の
`tmp-test6-*` チェーンと同じ結果を出すことを回帰テストで保証している。

## 入口

```ts
import { layoutNetwork } from './src'

const layout = layoutNetwork(seed) // LayoutSeed → NetworkLayout
```

中間結果まで見たい場合は `runLayoutStages(seed)` を使う。各段の出力（index ベース）を
そのまま返す。`presentLayout(stages)` で id ベースの `NetworkLayout` に変換できる。

### 入力 `LayoutSeed`

| 要素 | 内容 |
|---|---|
| `nodes[]` | `id`、`width`/`height`、粗い配置の中心 `position`、グループ内で左右順を決める `preferredOffsetX` |
| `groups[]` | `id`、所属 `nodeIds`（全ノードがちょうど1グループ）、粗い枠 `frame`、枠と中身の余白 `padding` |
| `links[]` | `id`、`source`/`target`。無向。並列リンクは別レコードのまま。自己ループは不可 |

`position` は起点ノードの絶対位置と、グループ間リンクが最初に枠のどの辺から出るかにだけ使う。
機器の役割・名前は一切使わない。

## パイプライン

```mermaid
flowchart LR
  seed[LayoutSeed] --> model[入力の検証と index 化]
  model --> upstream[上流検出]
  upstream --> rows[1 段詰め]
  rows --> ports[2 端点分散]
  ports --> channels[3 配線レーン]
  channels --> depy[4 依存Y最適化]
  depy --> result[NetworkLayout]
```

| 段 | ファイル | やること |
|---|---|---|
| 上流検出 | `src/upstream.ts` | 端点の接続先ごとに1票。距離の厳密な極大に投票し、最高得票の全同点を上流とする。決まらない成分は距離 `null` |
| 1 段詰め | `src/stages/row-packing.ts` | 上流距離ごとに1行。途中の行を横切る線には細い通過枠を確保。行間と横詰めは余白帯から決め、グループ単位で分離して配線 |
| 2 端点分散 | `src/stages/port-distribution.ts` | 同じ辺の接続を辺中央から1ピッチずつ分散。直線部分を一緒にずらし、機器に掛かる区間だけ迂回 |
| 3 配線レーン | `src/stages/wire-channels.ts` | 行間を横切る線の区間を区間分割でレーンに割り当て、足りない行間だけ広げる |
| 4 依存Y最適化 | `src/stages/dependency-y/` | 機器とレーンに独立なYを与え、依存ばね・配線ばね＋非重複制約の凸二次問題を ADMM で解く |

段をまたいで共有する部品:

| フォルダ | 役割 |
|---|---|
| `src/geometry/` | 点・矩形・線分・最短路。座標比較の許容誤差は `tolerance.ts` に集約 |
| `src/spacing/halo.ts` | 面積比 × sqrt(1 + 接続数) の余白帯と、辺ごとの本数による配分 |
| `src/spacing/separation.ts` | 余白帯が重ならなくなるまでグループ単位で押し離す。起点ノードは毎回元の位置へ戻す |
| `src/routing/` | 枠の境界端子、グループ内の迂回経路、グループ間の可視グラフ経路 |
| `src/metrics/` | 貫通・近接、交差・共有区間・線長、余白帯の重なり。`assertDrawable` で各段の出力を検証 |

### 設計上の約束

- **入力を書き換えない。** 各段は前段の結果を受け取り、新しいオブジェクトを返す。
- **決定的。** 同順位の選択は常に index 順または id 順で決める。
- **成立しない図を返さない。** 線の貫通・近接、余白帯の重なりが残る場合は `LayoutError` を投げる。
  内部の前提が崩れた場合は `LayoutInvariantError`。
- **上流を捏造しない。** 上流未定の成分は上下の依存ばねを置かず、配線ばねと非重複制約だけで解く。
  座標を固定するためのゲージ（`translationGaugeId`）は上流扱いしない。

## 数値設定

`DEFAULT_LAYOUT_OPTIONS` は採用済み保存地点の値。変更は `layoutNetwork(seed, options)` の第2引数で行う。

| 設定 | 既定値 | 派生値 |
|---|---:|---|
| `nodeStrokeWidth` / `frameStrokeWidth` / `wireWidth` | 1 / 1.5 / 1.6 | クリアランス = (1 + 1.6) / 2 = 1.3 |
| `haloAreaRatio` | 0.15 | — |
| `wireClearanceScale` | 1.5 | レーン・端点ピッチ = 1.6 + 2 × 1.3 × 1.5 = 5.5、通過枠幅 = 4.2 |
| `maxSeparationPasses` | 128 | — |
| `solverMaxIterations` / `solverTolerance` | 20000 / 1e-7 | — |

コード内に残る定数は、境界端子の角からの距離 18px と端子間隔の上限 10px
（`routing/boundary-terminals.ts`）。実験版から引き継いだ値で、見直し候補。

## 実験版との対応

| pre 版 | 実験版 `archive/` |
|---|---|
| `upstream.ts` | `structure-analysis/upstream.mjs` |
| `stages/row-packing.ts` | `tmp-test6-v8-virtual-rows.mjs`（面積比 15%） |
| `stages/port-distribution.ts` | `tmp-test6-v8-distributed-ports.mjs` の `spreadNodeAttachments` |
| `stages/wire-channels.ts` | `tmp-test6-v8-wire-channels.mjs`（線余白係数 1.5） |
| `stages/dependency-y/` | `tmp-test6-v8-dependency-y.mjs` |
| `spacing/separation.ts` | `tmp-test6-v8-hard-halo.mjs` の `projectHardHalos`（内部固定モードのみ） |
| `routing/` | `tmp-test6-v7-boundary-search.mjs` / `tmp-test6-v7-boundary-routing.mjs` / `interiorPath` |

実験版からの意図的な違い:

- 起点 `test:internet` の直書きを全段から撤去し、上流検出の結果（なければ id 最小のノード）を使う。
- 行の段番号は保存済みの `depth` ではなく、上流距離から毎回求める。上流未定のノードはグループの最後の1行にまとめる。
- 分離処理から、全段で使っていなかった「内部を個別に動かすモード」と深さ順の補正を削除。
- 評価・描画用に保存していた旧来の中間値（`haloProfiles`、`moved`、比較図用の値など）は出力しない。

実験版と同じく、左右順・接続辺・境界点・レーン順は開始時の選択を引き継ぐ。
配置全体の同時最適化ではない。未解決の課題は実験メモ（`../README.md`）を参照。

## 検証

`pre/` で実行する。

```sh
bun test
bun x tsc -p tsconfig.json
bun x biome check .
```

`test/test6-regression.test.ts` は `archive/` の `hard-halo` と `side-centers` のレポートからシードを作り、
最新版 `tmp-test6-v8-dependency-y-report.json` と照合する。機器・枠・全配線・端子・端点・レーン・
依存ばねの座標が 1e-6px 以内で一致すること、交差数 371 を含む計測値が一致することを確認する。
あわせて、上流ノードの id を変えても座標が変わらないこと、上流未定の成分を足しても既知成分の依存ばねが
変わらないこと、各グループの解が制約を満たし初期値に依存しないことを検証する。

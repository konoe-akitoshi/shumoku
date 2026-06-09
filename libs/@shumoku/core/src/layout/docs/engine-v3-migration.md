# v3 → core 本実装 移植設計

v3 プロト（`research/findings/proto/v3-composite-proto.ts`、設計史は `engine-v3-design.md` §23-40）を
core の layout エンジンへ移植する設計。**既存改善（A）** と **新規モジュール（B）** に分割し、
PR フェーズ（C）と制約（D)を明記する。

## 現行実装の地図（移植先）

```
layout/
  unified-engine.ts        … adapter: autoLayoutFlatTree|layoutCompound → routeEdges
  auto-placement/flat-tree/ … 配置本体(tidy-tree, blocks, spine, sort, parents, pack,
                              port-placement, hulls, pin, spacing, diagnostics …)
  route-edges.ts           … 2点polyline + lane offset + bus routing(辺ごとのpolyline上書き)
  role-tiers.ts            … 役割tier推定
  link-utils.ts            … getLinkWidth(帯域→px)
  engine/                  … 空間ルールエンジン(node-size/rules/spacing/text-measurer)
```
レンダラーはポート位置から cubic Bezier を描く。**bus routing が既に「辺ごとに polyline で
Bezier を置き換える」機構を持つ** — octilinear 経路はこの上書き経路で流せる（renderer 変更最小）。

## A. 既存実装の改善で済むもの

| # | 対象 | 改善内容 | プロト出典 |
|---|---|---|---|
| A1 | `link-utils.getLinkWidth` | 幅モード追加: `linear`(幅∝帯域, ユーザ採用) / `log`(現行) / `class`(離散等級)。**per-link幅**(LAG束は1本あたり)を返す API を追加 | §37-40 strandW |
| A2 | `unified-engine.ts` の maxLinkWidth→gap | 一律拡張 → **需要ベースのチャネル混雑拡幅**(gap毎に Σ束高 vs 利用可能高、不足分だけ拡幅、累積反復)。B2 ルータ導入後に置換 | §38-39 bandExtra |
| A3 | `role-tiers.ts` | metadata 信号の追加: `location` 由来の apex 導出(`NOC#N-{k}` 最小tier)・zoneBase。構造推定(betweenness系)は fallback として残す | §16 locTier |
| A4 | `flat-tree/parents.ts` | 親選択に **primary dependency**(最大帯域 uplink を1本)の概念を導入。描画強調・配置整列の基準になる | §25 prim |
| A5 | `flat-tree/sort.ts` | 兄弟順序の外部barycenter反復が既にあれば流用、無ければ追加。ペア隣接制約 | §24 |
| A6 | `flat-tree/port-placement.ts` | **幅対応ポートスロット**: 辺ごとのスロット幅=束幅+3px(面に収まらない時のみ比例縮小) | §38 |
| A7 | `flat-tree/compound.ts` + `hulls.ts` | zone(location)を合成 subgraph として箱化 → 既存の compound/hull 描画を流用。**child-block packing**(同じ主依存親を持つzone群を親直下のグリッドブロックに) と band wrap を追加 | §18, §24 |
| A8 | `route-edges.ts` lane offset / bus | B2 ルータが既定になったら fallback に格下げ(削除はしない: 小規模グラフ・compound では bezier+lane が依然適切) | — |

## B. 新規モジュール

| # | モジュール | 内容 | プロト出典 |
|---|---|---|---|
| B1 | `layout/composite/` | 複合配置パイプライン: ①ペアcollapse(`link.redundancy` **フィールド優先**・推定 fallback=stem一致+直結or共有uplink+zoneBase一致) ②zone毎ローカル配置(兄弟行+決定論jitter) ③**quotient layered**(zone群のみ大域、barycenter+同時配線裁定) ④port refine ⑤vertical snap ⑥行内分離。**配置パス追加毎に invariant(B4) を通す** | §24-30 |
| B2 | `layout/router/` | octilinear チャネルルータ: route分類(straight/orth/gutter/ramp/sink) → **グローバルH/Vトラック割当**(floor+ceil 双方向スパイラル・束幅分離) → gutter選定(ノード遮蔽の補集合から最近スロット) → 45°面取り polyline 出力 → `ResolvedEdge.points` 上書き(bus機構と同型)。**libavoid は再導入しない**(自作 ~400行・依存ゼロ) | §27-36, §39-40 |
| B3 | `layout/search/` | 探索ハーネス: `routedScore`(実ポリライン: 交差/collinear重なり/箱貫通/ベンド/全長/上向き) + multi-start(パラメタ格子) + hill-climb(move語彙: ±x シフト, **pair-flip**; 拡張点: 行内swap/zone幅) + バンド毎の同時配置配線裁定。時間予算オプション(大規模時は候補数/反復を縮退) | §32-35 |
| B4 | `layout/invariants.ts` | 検証の常設: ①全ノードがzone箱内 ②ノード重なり0 ③collinear重なり検出(平行<閾値・共有>12px) ④flow/純度/バンド数の可読性メトリクス。dev assert + vitest。**プロトで2回、視覚バグの正体がここの欠如だった**(thunder箱外/qfx重なり) | §30-31 |
| B5 | renderer-svg 拡張 | ①**ストランド描画**(1物理リンク=1平行線, ×N廃止) ②**HAメガネ**(redundancyペア=二重ブリッジ+輪郭echo, 非ワイヤ) ③zone領域(箱+ラベル — hull流用) ④意味の文法スタイル(主依存=濃/peer下ループ=中/sink=最薄collector) | §29-30, §25-26 |
| B6 | `LayoutOptions` 拡張 | `widthMode`, `composite: boolean`(zone複合の有効化), `searchBudget`, `organicJitter` 等。既定は現行挙動互換、composite はオプトインから始める | — |

## C. フェーズ（PR チェーン想定 / parent issue + child issues）

1. **P0: B4 invariants + A1 幅モード** — 小さく独立、即マージ可。以降の全PRの安全網
2. **P1: A3+A4+A5 (metadata tier / primary dep / 兄弟順序)** — flat-tree の改善として完結
3. **P2: B1+A7 composite 配置**（オプトイン `composite: true`）
4. **P3: B2 ルータ + A6 ポート + A2 混雑拡幅**（composite 配置の上に）
5. **P4: B3 探索ハーネス**（決定論・時間予算つき）
6. **P5: B5 レンダラー意味文法 + 既定切替の判断**

各フェーズで test6 相当の**合成フィクスチャ**による snapshot + invariant テスト。

## D. 制約・注意

- **機微データ**: tmp-test6-graph.json は実IP/ホスト名を含む。テスト用に**構造だけ写した合成
  フィクスチャ**(ノード名・IP差し替え)を作ってコミットする。tmp-* はコミットしない
- **lint**: プロトは non-null `!` を多用 — 本実装ではガード句/`?.` に全面書き換え(CLAUDE.md)
- **決定論**: RNG禁止は維持(R-seq/rank-based)。`Date.now` 等も layout 結果に入れない
- **ELK/libavoid 再導入禁止**(CLAUDE.md)。B2 は自作
- **HA**: `Link.redundancy`(types.ts:874) を一次情報として読む。推定昇格(resolve側で
  `redundancy:'ha'` を書く)は discovery 側の別トラック
- **deferred のまま**: root 自動決定の本格解(現状は location 由来 apex + fallback)、
  インタラクティブ層(§26 スタブ/hover実体化 — renderer-html の将来トラック)

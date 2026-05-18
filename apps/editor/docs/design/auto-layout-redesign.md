# Auto-layout 再設計の検討

Diagram view の自動配置を「ノード・サブグラフ・配線・ポートの相関を見て全体最適化する」方向へ寄せたい。現状の tidy-tree + Bezier router 構成の限界と、選択肢を網羅的に並べる検討用ドキュメント。実装プランではなく**理想形と選択肢の見取り図**。

決定はまだ何もしてない。各案は実装コストではなく「効果」と「他案との両立性」で評価する。

---

## 1. 問題提起

### 現状

- 配置: Buchheim tidy-tree（compound 対応、bottom-up 再帰）
- 配線: 単純な cubic Bezier、port-to-port、router なし（libavoid は PR #227 で削除）
- ポート配置: 方向ベース（top/bottom/left/right）、HA pair は垂直方向

### 顕在化してる症状

50 ノード / 49 link / 11 subgraph の図で確認できる 2 系統の不満：

1. **横方向の sprawl** — 1 つの distribution switch 配下に 11 個の area subgraph があると、その 11 個が一列に並んでビューポート幅を超える
2. **fan-out 部の配線重なり** — 1 ノードから 11 本の Bezier が放射状に伸びて、図の中央で大量に交差

### 設計上の根本原因

- **tidy-tree の本質的制約**: 兄弟は同一 layer に水平展開。fan-out が大きい木に弱い
- **配置と配線が独立フェーズ**: 配置時に edge crossings を見てない、router は配置を所与の前提として動く
- **port 位置が固定**: 1 ポートから N 本出る場合、出発点が同一座標に集中して curve が密集

---

## 2. 設計原則（議論で合意したもの）

| 原則 | 意味 |
|---|---|
| **配置と配線は coupled** | 別フェーズで最適化しない。配置決定時に edge cost を見る |
| **subtree contiguity is invariant** | 「同じ親の子は塊」が崩れると network 図として読めなくなる。これは硬い制約 |
| **配線分離は努力目標** | 完璧な orthogonal routing は追わない。多少の交差は許容 |
| **Scene view と責務分離** | Diagram = 意味的配置（座標はキャッシュ）、Scene = 物理配置（座標がユーザー所有物） |
| **Auto = suggestion, intent = constraint** | 完全自動でも完全手動でもない。骨格を意図で固定、詳細を algorithm が埋める |
| **pure JS, bundle conscious** | libavoid 級の WASM 依存は採用しない |

---

## 3. アーキテクチャ選択肢の俯瞰

「配置と配線をどの粒度で coupling するか」で 4 段階に整理。

### A. 完全分離パイプライン（現状）

```
nodes/links → layout(graph) → positions → route(positions, links) → edges
```

各フェーズは前のフェーズの結果を所与とする。実装はシンプル、性能良い。**現状の問題**：上流フェーズは下流の cost を知らない。

### B. 段階パイプライン + 制約注入

```
nodes/links → layout(graph, constraints) → positions
              ↑
              constraints は事前計算した「configuration hint」
              (port 順、sibling block 等)
```

層は分かれるが、各層に「他層が後で困らないような hint」を制約として注入する。yFiles HierarchicalLayout, ELK Layered の実態がこれ。**現実的な落としどころ**。

### C. 反復改善 (iterative refinement)

```
loop:
  positions, edges ← layout + route
  evaluate quality
  perturb candidate
  if better, keep
```

候補を何度も生成して評価関数で選ぶ。Simulated annealing 系。理論的には強力、実用的には tuning 困難。

### D. 真の joint optimization

```
minimize energy(positions, edges) subject to constraints
```

ILP / SAT / SDP 等で同時最適化。学術的には存在、実用化された商用は皆無。**graph drawing 50 年の歴史で誰も成功してない**ので追わない。

---

## 4. 配置アルゴリズム選択肢

### 4.1 Tree drawing

| アルゴリズム | 強み | 弱み | tidy-tree との関係 |
|---|---|---|---|
| **Buchheim tidy-tree** (現行) | O(n) 線形、subtree contiguity 保証、決定的 | 兄弟順は input 順、wide fan-out で sprawl | base case |
| **Reingold-Tilford** | 古典、Buchheim の前身 | quadratic、Buchheim で代替済 | 上位互換は Buchheim |
| **Non-layered / compact tidy tree** ([van der Ploeg 2014](https://core.ac.uk/download/pdf/30810563.pdf)) | 兄弟が depth 揃わなくてもいい、コンパクト | tree の見た目崩れる、network 図には不向き | 採用しない |
| **Radial tree** | hub-and-spoke で美しい | 階層深いと読みにくい | 別ビューとしてなら有り |
| **Phyllotaxis / sunflower** | 自然な密度分布 | 数学的美しさ ≠ 読みやすさ | 採用しない |

### 4.2 Layered (Sugiyama 系)

| アルゴリズム | 強み | 弱み | 採用可能性 |
|---|---|---|---|
| **Sugiyama** (現行 fallback) | crossing minimization が強い | sibling contiguity 破壊、長辺 dummy 必要 | tidy-tree との hybrid なら |
| **Constrained Sugiyama** ([Forster 2005](https://michael.forster.pro/publication/constrained-crossing-reduction/)) | 相対順序制約付き barycenter | 制約強いほど crossing 減らせない | **本命**、tidy-tree との合体可 |
| **Port-aware Sugiyama** ([arxiv:2008.10583](https://arxiv.org/abs/2008.10583)) | ポート位置を考慮した crossing min | 実装重い | 取り入れる発想として |
| **Generalized Sugiyama with port groups** | yFiles 系 | 商用、再実装は無理 | 参考のみ |

### 4.3 Force-directed

| アルゴリズム | 強み | 弱み | 採用可能性 |
|---|---|---|---|
| **Spring embedder (Eades 1984)** | 任意グラフ、対称美しい | 木で不安定、収束遅い | 補助的にも採用しない |
| **Fruchterman-Reingold** | spring の改良 | 同上 | 同上 |
| **Stress majorization** | 距離保存に強い | tree dominance 壊す | 採用しない |
| **ForceAtlas2** | 大規模対応 | 確率的、非決定的 | 採用しない |

理由: network topology は tree-dominant なので、force-directed の「対称・均等配置」は構造を見えにくくする。

### 4.4 Orthogonal

| アルゴリズム | 強み | 弱み | 採用可能性 |
|---|---|---|---|
| **Kandinsky** | orthogonal で曲がり最小 | 実装複雑度高、tree の自然さ失う | 採用しない |
| **Topology-shape-metrics** | 古典 orthogonal | 同上 | 採用しない |
| **OGDF orthogonal** | 学術的に強い | C++、bundle 不可 | 参考のみ |

理由: network 図は orthogonal grid に強制すると物理感が出すぎて意味的配置と相性悪い。

### 4.5 Hybrid / 新規発想

| 案 | 中身 | 議論ポイント |
|---|---|---|
| **Tidy-tree + Forster local reorder** | Buchheim で初期配置、sibling block 内だけ Sugiyama 的 reorder | 本命。`§5 配置と配線の coupling 戦略` 参照 |
| **Tree + radial fan-out** | 通常は tidy-tree、N 個超える子だけ親の周囲に円配置 | radial の利点を局所適用 |
| **Tidy-tree + row wrap** | 子が多い時に複数行に折り返す | 折り返した行への edge が前段をまたぐ → router 側 awareness 必要 |
| **Two-pass with feedback** | tidy-tree → crossings 計測 → 兄弟 swap で改善 → 再 layout | local search 系 |

---

## 5. 配置と配線の coupling 戦略

各層が「他層の cost」を意識する具体手段。

### 5.1 Layout が routing を意識する

- **Sibling order = source port order** — 子の x 順を、親の出力 port の x 順と一致させる
- **Crossing-aware sibling reorder** — 兄弟群を「外部辺の接続先 x の barycenter」で reorder
- **Port-aware layer assignment** — port position を input として layer 内 ordering に反映
- **Fan-out aware spacing** — fan-out 多い親には子間 gap を広く取る（curve 余裕）
- **Edge length penalty in coord assignment** — 単純な「中央寄せ」じゃなく「edge total length 最小化」で coord を選ぶ

### 5.2 Routing が layout を活かす

- **Port spreading at source** — 1 port から多本出る時、出発点を水平に分散
- **Bus-style consolidation** — `parent → short trunk → horizontal backbone → child stubs` の T 字 / B 字構造
- **Sibling-aware curve direction** — 隣接する edge は同方向に curve、反対方向に curve しない
- **Per-layer channel** — layer 間に「水平 channel」を確保、edge は channel 内を通る（dagre 系の発想）

### 5.3 共通リソース

- **品質関数 (quality function)** — `crossings_count + α * total_edge_length + β * sprawl + γ * port_disorder` 等の加重和
- **候補生成 (candidate generation)** — 同じ入力でも sibling permutation, port assignment の小変動で N 個候補
- **Score-based selection** — 候補集合から品質関数最良を選ぶ

---

## 6. 配線アルゴリズム単体

| 方式 | 説明 | bundle 影響 | 効果 |
|---|---|---|---|
| **直線 polyline** | 2 点を直線で結ぶ | ゼロ | 最低、見栄え悪 |
| **Cubic Bezier (現行)** | port から control point 経由で curve | ゼロ | 見栄え普通、密集で重なる |
| **Orthogonal L/dogleg** | 水平・垂直のみで連結 | 軽い | 重なり可視化やや改善、機械的 |
| **Bus-style** | 共通幹 + 分岐 | 軽 | fan-out で劇的改善 |
| **Edge bundling** ([Holten 2006](https://www.win.tue.nl/~mwesteri/dataviz/papers/Holten06_HEB.pdf)) | 並走 edge を視覚的に束ねる | 中 | 大規模図で読みやすい |
| **A* path-finding** | grid 上で最短経路探索 | 中 | obstacle 避ける、決定的 |
| **libavoid (削除済)** | 完全 orthogonal + 障害物回避 | 重 (500KB WASM) | 完璧だが過剰 |

bundle と効果のバランスから、**bus-style + orthogonal L-shape の組合せ** が現実解。A\* も pure JS で十分書ける（数百行）が、bus で 80% 解決するなら不要かもしれない。

---

## 7. 「全体最適」探索戦略

joint optimization を諦めずに pragmatic にやる方法。

### 7.1 Multi-start

```
for seed in [s1, s2, ..., sN]:
  positions, edges = pipeline(graph, seed)
  score = quality(positions, edges)
  if score > best_score: best = (positions, edges, score)
return best
```

シード違いで N 回実行、最良を返す。**最も実装しやすい joint approximation**。N=5 程度で十分効果あるという経験則。

### 7.2 Simulated annealing

```
state = pipeline(graph)
for T in cooling_schedule:
  candidate = perturb(state)  # 兄弟 swap, port reorder 等
  Δ = score(candidate) - score(state)
  if Δ > 0 or random() < exp(Δ/T):
    state = candidate
return state
```

確率的だが収束強い。エネルギー関数の tuning が art。実装は中規模。

### 7.3 Iterative deepening

```
state = pipeline(graph)
loop until no improvement:
  swaps = candidates_within_distance(state, k=2)  # 2 個までの swap 試行
  best_swap = argmax(score after swap)
  if best_swap improves: apply
```

deterministic、局所探索。simulated annealing より単純、局所最適に陥る。

### 7.4 Genetic algorithm

複数 candidate を「個体」として cross-over / mutation で進化。理論的には強いが、graph layout で実用化された例は少ない。実装重い。**採用候補外**。

### 7.5 RRT 的なアプローチについて

ユーザーから提案された「RRT 的なもの」は **continuous space の motion planning** 由来で、離散組合せ問題である graph layout には直接適用できない。ただし**「複数候補を木構造的に展開して最良 path を選ぶ」**という発想は **Monte Carlo Tree Search (MCTS)** に近い。

MCTS を layout に応用する研究は数えるほどしかなく、決定打になってない。**採用は当面しない**が、idea 倉庫としては残す。

---

## 8. 既存ライブラリ実態（再確認）

| ライブラリ | 配置 | 配線 | port | sibling 制約 | bundle 規模 |
|---|---|---|---|---|---|
| **dagre** | Sugiyama | rect-points | × | × | 小 |
| **ELK Layered** | Sugiyama (Java/GWT) | orthogonal / spline | ◯ | △ | 大 (200KB+) |
| **graphviz dot** | Sugiyama | spline (後付け) | × | × | C 製、JS 移植 emscripten |
| **yFiles** (商用) | hierarchical + 多種 | edge grouping + port groups | ◯ | ◯ | 大、商用 |
| **OGDF** | 学術用全部入り | 同上 | ◯ | ◯ | C++ |
| **Cytoscape.js** | 座標設定のみ | なし | × | × | 中 |
| **D3-hierarchy** | tree (Reingold-Tilford) | なし | × | × | 小 |
| **Mermaid** | dagre 内包 | dagre rect-points | × | × | 中 |

**インスパイア源として一番有用なのは yFiles の `edgeGrouping` + `portGroups`**。商用なので実装は見られないが、API 仕様から発想を読み取れる。

---

## 9. 全選択肢のトレードオフマトリクス

「配置 × 配線 × 探索戦略」の組合せで主要パターンを整理。

| パターン | 配置 | 配線 | 探索 | 強み | 弱み |
|---|---|---|---|---|---|
| **現状** | Buchheim | Bezier | なし | 単純、subtree 保護 | sprawl + 重なり |
| **A. 最小改善** | Buchheim + sibling reorder | Bezier + port spread | なし | 実装小、後方互換 | 効果限定的 |
| **B. 本命** | Buchheim + Forster reorder | Bezier + bus | なし | 効果大、現状を活かす | fan-out 以外への効果限定 |
| **C. 強化版** | Buchheim + Forster + row wrap | bus + orthogonal | multi-start (N=5) | 大規模図でも見やすい | 実装中規模、tuning 必要 |
| **D. 探索フル** | Buchheim + Forster | bus + bundled | simulated annealing | 局所最適脱出、品質最高 | 非決定的、tuning art |
| **E. 完全再設計** | Constrained Sugiyama + port-aware | orthogonal + A* | iterative refinement | 文献的に最強 | 実装大、subtree 制約満たすか不明 |

---

## 10. Open questions（未解決の論点）

このまま放置せず、いずれ答えが必要な問い。

### 10.1 品質関数をどう定義するか

候補比較するなら必須。候補（加重和の重み α, β, γ は要 calibration）：

- **crossing count** — edge 同士の交差数
- **edge total length** — 全 edge の長さ和
- **node-edge crossings** — edge が無関係ノードを横切る数
- **bend count** — orthogonal edge の曲がり数
- **port disorder** — 親の port 順と子の x 順の不一致度
- **sprawl** — bounding box の aspect ratio（横長すぎ penalty）
- **density** — 単位面積あたりの要素数（均一性）

業界では **GraphRender benchmark** 等で標準化試行があるが定説はない。

### 10.2 subtree contiguity をどこまで硬く守るか

「同じ親の子は塊」は invariant だが、極端なケース（fan-out 100 個）でも守るべきか？ 緩める閾値はどこ？

### 10.3 候補生成の seed 空間をどう設計するか

multi-start で「違うシードで違う結果」を出すには：

- sibling permutation の seed
- port assignment の seed
- coord assignment の sweep 方向
- どれを変えると quality に差が出るか？

### 10.4 ユーザーが「Auto」を押した時の期待値

- 「毎回同じ結果」を期待するか？
- 「毎回ちょっと違うがどれもまとも」で OK か？
- 「最初の Auto 押下から N 秒以内」の制約はあるか？

UX 要件次第で simulated annealing vs deterministic の選択が変わる。

### 10.5 Incremental layout の扱い

このドキュメントは「Auto = 全体再配置」を前提。だが将来「ノード 1 つ追加で局所更新」を実装する場合、全体最適は意味が違ってくる。incremental vs full の住み分けはここで決めるべきか後で考えるか？

### 10.6 配線の表現を変えるか

bus-style や bundled edge は「1 link = 1 path」の現モデルと噛み合わない。「N link をまとめて 1 visual path」にするとデータモデル変更が必要。許容するか？

---

## 11. Node kind を layout に活かす

これまでの議論は「グラフ構造（ノードと辺の topology）」だけを入力として layout を決める前提だった。だが我々のモデルでは **`NodeSpec.kind` + `DeviceType`** という強い semantic 情報が既にデータに乗ってる。これを layout の意思決定に組み込めば、tree topology だけでは出せない「network 図らしい」配置が自動で出る。

### 11.1 観察：network 図は role-based 階層に強い慣習がある

実世界の network diagram（Cisco / NetBox / 教科書）には強い stereotyped layout がある：

```
       Internet / Cloud / WAN entry
              │
          ─ Edge router / Firewall ─
              │
       Core / Distribution Switch (L3)
              ├──────┬──────┐
       Access Switch (L2)  ...
              │
       Server / AP / Endpoint
```

これは **topology から導出される階層ではなく、role から導出される階層**。同じ "switch" でも L3 distribution は上、L2 access は下に置きたい。同じ "leaf node" でも server と AP は別の見せ方をしたい。

現状の tidy-tree は **「親 → 子」の topology しか見てない**ので、この role 階層は出ない。

### 11.2 `kind` を layout 決定に注入する具体策

#### (a) Role-biased layer assignment

各 `DeviceType` に **デフォルト tier** を割り当てる：

| Tier | DeviceType |
|---|---|
| 0 (top) | `Internet`, `Cloud`, `VPN` |
| 1 | `Firewall`, `LoadBalancer` |
| 2 | `Router` |
| 3 | `L3Switch` |
| 4 | `L2Switch` |
| 5 (leaf) | `AccessPoint`, `Server`, `Database`, `CPE`, `ConsoleServer` |
| - | `Generic` (= topology に任せる) |

Sugiyama の layer assignment では、topology による layer をベースに **role tier を soft constraint として加味**：

```
layer(node) = topological_layer(node) + α * role_tier_bias(node)
```

「AP が Router に直接繋がってる」みたいな topology 矛盾ケースでも、role tier がじわっと引っ張るので「AP は下のほう」に落ち着く。

#### (b) Same-tier 兄弟の clustering

同じ tier の兄弟同士は隣接配置を優先する。`§5.1` の sibling reorder の barycenter 計算に「同 kind なら距離 penalty 減」を加える：

```
sibling_distance(a, b) = topology_barycenter_distance(a, b) - β * same_kind_bonus(a, b)
```

これで「foyer-sw01 と foyer-sw02 は隣同士」「server 群はまとまる」が自動で出る。

#### (c) Kind-aware spacing

Switch と AP のような「親子で物理的に近い役割」は gap 狭く、Router と Switch のような「論理的境界」は gap 広く。各 (parent_kind, child_kind) ペアに spacing 係数：

```
gap(parent, child) = base_gap * spacing_multiplier[parent.kind, child.kind]
```

これで密度差で階層感が視覚的に出る（compact なクラスタ + 大きめの境界）。

#### (d) Kind-driven port direction

`port-placement.ts` は現在 flow direction（TB/LR 等）で port side を決めてる。これを kind と組み合わせる：

| 関係 | 期待される port direction |
|---|---|
| Switch → AP (downlink) | bottom |
| Switch → Switch (uplink) | top |
| Switch → Switch (peer / MLAG) | left/right |
| Router → Switch | bottom |
| Router → Internet | top |
| Server → Switch (NIC uplink) | top |

`(local_kind, peer_kind, link_role)` から port side を決定するルール表。HA pair の特別扱い（垂直方向）と同じ枠組み。

#### (e) Bus routing トリガーを kind 依存に

fan-out 閾値（§5.2 の bus 化判定）を kind ごとに変える：

| Parent kind | Bus 化閾値（子の数） |
|---|---|
| `L2Switch` → AP | 4（密集が当たり前） |
| `L3Switch` → L2Switch | 6 |
| `Router` → Subgraph | 3（区域分けは少数でも幹を見せたい） |
| `Server` → クライアント等 | 8（多いとき） |

「access switch が AP 6 個率いてる」と「distribution router が 3 区域に分配」は視覚的扱いを変えるべき。

#### (f) Auto-zoning by kind

ユーザーが subgraph 作らなくても、kind を見て自動的に「論理 zone」を提案する：

- 同じ tier かつ topology 的に近い node 群 → 自動 zone
- zone は subgraph と同じ render 扱い、ただし「auto-generated」フラグ付き
- ユーザーが手動 subgraph 作るとそっち優先

これは将来の話だが、kind 情報を持ってるからこそ可能になる。

### 11.3 設計上の注意

- **Soft constraint** にする — kind から導かれる tier は hint であって絶対ではない。topology が強く矛盾する場合は topology を優先する余地を残す
- **`Generic` の扱い** — kind 不明 / 設定なしのノードはこれまで通り topology だけで配置
- **tier 表は変更しやすく** — `core/layout/role-tiers.ts` のような独立モジュールで table 化、user override 可
- **kind 由来の決定はログ可能に** — debug 時に「なぜこの node がここに置かれたか」を説明できる方が良い（`layoutDecisions[nodeId] = { source: 'role-tier', tier: 3 }` 等）

### 11.4 どこまで kind に頼るか

ここはまだ議論ポイント。両端：

- **最小派** — `Internet` / `Cloud` だけ top に固定。それ以外は topology のまま。実装極小、効果も限定
- **最大派** — 全 DeviceType に tier 割当、kind-aware spacing、kind-driven port direction まで。「network 図らしさ」全開、ただし kind の正確性に layout 品質が依存
- **中道** — tier 割当 + same-tier clustering までは入れる、spacing と port direction は後付け

中道が現実的だが、最大派の世界観も検討する価値はある（pluggable で段階導入なら）。

### 11.5 Open question 追加

- 11.4 の「どこまで頼るか」の答えは何か？
- tier 表は固定 or ユーザー編集可？ プロジェクト設定として持つ？
- topology vs kind の優先度 weighting α, β はどう calibrate するか？
- `Generic` 以外の kind 不明（古いプロジェクトファイル）の互換性

---

## 12. 次のステップ（このドキュメントの使い方）

このドキュメントは「議論の土台」。次にやることは以下のいずれか：

1. **§9 のパターン A-E から 1 つ選んで実装計画に落とす**
2. **§10 の open question を先に潰す**（特に 10.1 と 10.4 が意思決定の前提）
3. **§4-7 の選択肢を更に深掘りする**（個別アルゴリズムの詳細検討）

意思決定はまだ。コメント・追加アイデア・反論・参考文献は随時追記してこの doc を成長させる。

---

## Appendix: 参考文献

- [Buchheim, Jünger, Leipert 2002 — Improving Walker's Algorithm](https://link.springer.com/chapter/10.1007/3-540-36151-0_32) — 現行 tidy-tree のベース
- [Forster 2005 — Constrained Two-Level Crossing Reduction](https://michael.forster.pro/publication/constrained-crossing-reduction/) — sibling 制約付き barycenter
- [Brandes, Köpf 2001 — Fast and Simple Horizontal Coordinate Assignment](https://link.springer.com/chapter/10.1007/3-540-45848-4_3) — 現行 coord assignment のベース
- [Holten 2006 — Hierarchical Edge Bundling](https://www.win.tue.nl/~mwesteri/dataviz/papers/Holten06_HEB.pdf)
- [van der Ploeg 2014 — Compact Tidy Tree](https://core.ac.uk/download/pdf/30810563.pdf)
- [Generalized Port Constraints (arxiv:2008.10583)](https://arxiv.org/abs/2008.10583)
- [Davidson, Harel 1996 — Drawing Graphs Nicely Using Simulated Annealing](https://dl.acm.org/doi/10.1145/234535.234538)
- [yFiles Bus-style Edge Routing](https://docs.yworks.com/yfiles-html/dguide/layout/bus_router.html)
- [yFiles Edge Grouping](https://docs.yworks.com/yfiles-html/dguide/layout-edge_grouping/)
- [ELK Layered Algorithm](https://eclipse.dev/elk/reference/algorithms/org-eclipse-elk-layered.html)
- [Graphviz TSE93 Paper](https://graphviz.org/documentation/TSE93.pdf)

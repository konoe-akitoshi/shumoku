# Findings 03: 隣接技術スカウティング（移植可能性）

各クラスタ: core idea / アルゴリズム / なぜトポロジに効くか / limitation / source。

## 1. Metro-map / Schematic / Octilinear
- **Core**: 辺の向きを離散方位(0/45/90°=octilinear)に制限し経路を直線化。地下鉄図の7ルールを hard/soft 制約へ。
- **Algos**: Nöllenburg & Wolff (MIP, NP-hard) / Bast et al. (グリッド最短路に帰着、near-interactive) / Chivers & Rodgers (force-directed octilinear + mental map, 段階スケジューリング) / Stott (hill-climb) / Shape-Guided (入力方位をk-meansで最適スロープ決定)。
- **効く**: バックボーンを「トランジットライン」として読める。共有区間のライン束を直線化。tier=水平レーン、line=octilinearセグメント。
- **Limit**: MIP重い。octilinearは実座標を歪める。ライン抽象(順序付き経路)の前処理が要、任意メッシュに直接非適用。
- src: https://www1.pub.informatik.uni-wuerzburg.de/pub/wolff/pub/nw-mipdh-06.pdf / https://onlinelibrary.wiley.com/doi/full/10.1111/cgf.13986 / https://link.springer.com/chapter/10.1007/978-3-662-44043-8_1 / https://arxiv.org/pdf/2208.07301 (survey)

## 2. Edge Bundling
- **Core**: 似た方向/端点の辺を束ねクラッタ低減。
- **Algos**: Hierarchical EB (Holten 2006) / FDEB (Holten & van Wijk 2009, 辺をバネで自己組織化) / Divided EB (方向別分離)。
- **効く**: many-to-many フロー(VLAN/テナント共有uplink, east-west)を束ね「太さ=集約帯域」を示す。
- **Limit(致命的・経験済み)**: 個々の source→target が辿れなくなる(ambiguity)。緩和=末端テーパー/source色分け/同一論理グループ内限定。display層でありレイアウト座標は不変。
- src: https://classes.engineering.wustl.edu/cse557/readings/holten-edgebundling.pdf / https://lliquid.github.io/homepage/files/ts13_edgebundle.pdf

## 3. Hybrid Node-Link + Matrix (NodeTrix)
- **Core**: 全体=node-link、密サブグラフ=隣接行列ブロック。
- **Algos**: NodeTrix 2007（ドラッグで行列化、行列内は交差ゼロ）。
- **効く**: **spine-leaf/Clos full-mesh** を1行列ブロック(行=leaf, 列=spine, セル=リンク/帯域/状態)に畳む→交差ゼロ・面積一定・欠落リンク即読・障害セル着色。
- **Limit**: 経路追跡(A→B→C)が苦手。クラスタ自動検出が要。matrix reordering 品質依存。node-link↔matrix の目線移動コスト。
- src: https://inria.hal.science/file/index/docid/144496/filename/nodetrixRR.pdf / https://link.springer.com/chapter/10.1007/978-3-030-92931-2_2

## 4. Constraint-Generation パターン（recipes）— WebCola/IPSep-CoLa
ソルバでなく「何を制約に書くか」が要点。WebColaの実エンコーディング:
- **Separation(不等式)** `{type:separation, axis:y, left:0, right:1, gap:25}` → `n0.y+25 ≤ n1.y`。**有向分離=tier/階層**。
- **Separation(equality)** `equality:true` → `n0.y+25 == n1.y`。**等間隔ラック/ライン整列**。
- **Alignment** `{type:alignment, axis:x, offsets:[...]}` → 中心を1軸に揃える。**同一ラック/サブネットを縦一列**。
- **Group/Containment** `{leaves:[...], padding:20}`(ネスト可) → 矩形内包。**subgraph(サイト/VLAN/ラック)境界**。
- **Page boundary** = ページ矩形へのcontainment。
→ composite意味論はほぼこの4プリミティブに落ちる。Sugiyama系に「制約レイヤ」を被せれば宣言的にsemantics表現。
- **Limit**: 制約矛盾で解なし/破綻、増えると硬直・収束遅延。**SetCoLa(2018)** が高レベル宣言(「align all nodes in each rack」)で組合せ爆発を緩和 ← composite本命。
- src: https://github.com/tgdwyer/WebCola/wiki/Constraints / https://jhoffswell.github.io/website/resources/papers/2018-SetCoLa-EuroVis.pdf

## 5. Stable / Online / Incremental（mental map保存）
- **Algos**: Foresighted Layout (Diehl & Görg, offline super-graph基準で全フレーム安定) / Online incremental (Crnovrsanin, 差分をupdate actionに分解、FM³+GPU) / pinning(既存=固定アンカー、新規のみ自由) / Staged animation。
- **効く**: 複数ソース非同期再同期・discovery/auto-adopt に直撃。Human/curation座標をpin。
- **Limit**: 安定性 vs 品質トレードオフ(drift)、pin過多で新規ノードの置き場喪失。
- src: https://vis.cs.ucdavis.edu/papers/tarik_incremental.pdf / https://www.researchgate.net/publication/2565942_Preserving_the_Mental_Map_using_Foresighted_Layout

## 6. Overlapping Clusters（集合可視化 over node-link）
- **Algos**: BubbleSets(implicit surfaceの泡) / LineSets(集合=1本の線) / KelpFusion(最短経路グラフ, MST↔凸包補間) / MetroSets(集合=メトロライン) / EulerView。
- **効く**: 「同じスイッチがrack3 ∧ VLAN100 ∧ tenantA ∧ 障害ドメインB」の多重所属を、node-link配置はそのままに色付きoverlayでon/off。
- **Limit**: 3-4集合が実用上限。輪郭ベースは配置が集合に不利だと歪む。レイアウトと集合凝集の同時最適化は未解決。
- src: https://www.sciencedirect.com/science/article/pii/S002002551630384X / https://arxiv.org/pdf/2008.09367

## 移植価値ランク
1. **制約生成(CoLa+SetCoLa)** — 骨格。リスク最小・適合最大。
2. **安定/incremental(pin+Foresighted)** — ユースケース直撃、#4の制約として実装可。
3. **NodeTrix(mesh→matrix)** — spine-leaf hairballの決定打。
4. **重複集合overlay(Kelp/Bubble)** — 多重所属、座標不変のdisplay層。
5. **octilinear(soft)** — 価値高だが導入コスト大、#4/#5上にsoft forceで後付け。
6. **edge bundling** — 最も慎重(faithfulness喪失)。display専用に厳格制約のみ。

**アーキ方針**: #4骨格 → #5時間安定 → #3密部分抽象 → #6/#1/#2はdisplay overlay(座標不変)。挿入点は `unified-engine.ts` + `engine/`。

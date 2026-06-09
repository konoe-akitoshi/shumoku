# ネットワークトポロジ・レイアウトの空白と新規貢献（統合）

> 第1ラウンド深掘り調査（サブエージェント5本）の統合。問題の構造化 → ギャップ分析 → 新規手法の提案。
> 生の調査は [findings/](findings/) と各エージェント報告。カタログは [prior-art-survey.md](prior-art-survey.md)。
> 結論: **運用ネットワークトポロジに特化した、faithful かつタスク指向の自動レイアウトは学術的にほぼ空白で、最も近い先行は産業特許**。独自実装＋論文化の余地が確認できた。

---

## 0. 一行結論

汎用グラフ描画（force / Sugiyama / 直交）・EDA・BPMN の流用はいずれも、**ネットワーク固有の構造（冗長・LAG・spine-leaf・役割・多重グルーピング）をノイズとして潰す**。これを第一級入力として扱い、**運用タスクに忠実（faithful）**なレイアウトは未開拓。

---

## 1. 検証されたギャップ（なぜ paper-worthy か）

| 層 | 実態 | 出典 |
|---|---|---|
| **商用NMS** | LibreNMS / NetBox topology-views は **vis.js 力学を素ラップ**。LibreNMSは**並行リンクを1本に潰す**コードがあり LAG/MLAG が地図から消える（PR #10687まで）。密度は**全製品が interactivity/手配置に丸投げ** | findings/01 |
| **トポロジ特化** | 唯一の構造特化は **Cisco特許 US9781008B1**（spine-leaf=完全二部の規則性を使い辺を既定で隠す）。査読・一般化・定量評価された学術版が**存在しない** | agent B |
| **学術(汎用)** | edge bundling は **faithfulness を犠牲**（Nguyen & Eades 2017）＝個別リンク追跡不能で運用に致命的。metro/octilinear は **平面・最大次数8・near-tree 前提**でメッシュに非適用。CoLa/SetCoLa は最良の基盤だが汎用。grouped-grid は「小規模でも significant issues」 | agent B,C |

→ **空白の中心**: トポロジの構造規則性（tier / pod / 冗長対称）を制約・先験として取り込み、**faithful（束ねない・単射）かつ 層＋メッシュ同時最適、運用タスク忠実、online 安定**を満たすネットワーク特化レイアウト。先行は特許(US9781008B1) + 制約基盤(IPSep-CoLa/SetCoLa) + 評価枠(Faithfulness)に断片化しており、**橋渡しする一般化が無い**。

---

## 2. ネットワーク構造が汎用グラフ描画の前提を壊す10点（問題の構造化）

実ネットワークの非木構造は**ノイズでなく設計意図**。汎用手法が壊す前提（agent E）:

1. **「親は一意」が偽** — dual-homing/dual-core は複数親がベストプラクティス。木は2本目uplinkを捨てる。
2. **「閉路はノイズ」が偽** — redundancy/ring/mesh の閉路＝可用性そのもの。分解すると設計意図が消える。
3. **「多重辺は別経路」が偽** — LAG/port-channel は N物理＝1論理、MLAGは2台分岐で1論理。**物理/論理の多重度二層**を汎用グラフは持たない。
4. **「ランクは辺方向から計算」が偽** — tier は role(core/agg/access, spine/leaf)で**先験的**に決まる。Sugiyamaは逆向き。
5. **「辺は隣接層間のみ」が偽** — peer-link(層内)・skip-level link が常在。純階層は層内辺を扱えず面積爆発。
6. **「重要度 ∝ degree」が偽** — 構造的重要度は **betweenness 的**。低次数コア > 高次数アクセス。degree駆動は階層を上下反転。
7. **「最短経路は一意」が偽** — ECMP/Clos は等コスト複数経路が設計目標。1本縮約は情報破壊。
8. **「グルーピングは単一所属の入れ子」が偽** — 物理(rack/site)と論理(VLAN/VRF/zone)は**直交・交差**。単一コンテナの木で表現不能。
9. **「完全二部の交差は乱れ」が偽** — spine-leaf の全結線は**読みどころの規則性**。交差最小化器は塊に変える。
10. **「密度は一様にスパース」が偽** — DC fabric は局所的に O(|V|²)。スパース前提のチューニングが破綻。

---

## 3. レイアウトが最適化すべきもの＝運用タスク（タスク指向）

汎用は crossing/area を最適化するが、エンジニアは**運用上の問い**で読む（agent D, Lee et al. タスク分類に1:1写像）。

| 読みタスク | レイアウトが満たすべき特性 |
|---|---|
| パストレース A→B | **単調方向性**（主軸に沿い折り返さない、ホップが一列） |
| ECMP多重経路 | **並行経路の分離＋対称**（束ねず等価に並置） |
| ブラスト半径/障害影響 | **下流サブツリーの空間的連続性**（依存方向＝主軸） |
| 冗長/SPOF検出 | **冗長対の局所対称＋articulation pointの顕在化** |
| キャパシティ/輻輳 | **負荷チャネル確保**（太さ/色が潰れない間隔） |
| 変更/diff | **レイアウト安定性**（mental-map保存、変化分のみ動く） |
| 概観(NOC大画面) | **tierの明示＋均等分布** |

**最重要の洞察**: **第一軸を「トラフィック/依存方向」に固定すると、パストレース(単調)とブラスト半径(下流連続)が同一制約の表裏として同時に満たせる。** さらに「単一目的関数では競合する→タスクモード別の重み切替」が学術的にも正当（2009 比較研究: 最適レイアウトは task 依存）。

設計慣習（人間の事前知識）: core上/access下の3層垂直、外部=上or片側、トラフィック流れ方向、crossing回避（Purchase 1997: crossing最優先、対称/bendは効果小）。

---

## 4. 移植する技術、ランク順（agent C）

各技法の limitation を相互補完する **layered architecture**:

| 順 | 技術 | 役割 | 移植の要点 / 注意 |
|---|---|---|---|
| 1 | **制約生成(IPSep-CoLa + SetCoLa)** | 配置座標を決める骨格 | tier=有向分離 / subgraph=包含 / rack=alignment / 冗長対=equality。`computeNetworkLayout`に制約レイヤを被せる。SetCoLaの高レベル宣言で組合せ爆発を回避 |
| 2 | **安定/incremental(pinning + Foresighted)** | 時間軸の安定化 | Human/curation座標を pin(=equality制約)に。複数ソース非同期再同期に直撃 |
| 3 | **NodeTrix(mesh→matrix block)** | 密部分の抽象 | spine-leaf full-mesh を**行列ブロック**に畳む（交差ゼロ・面積一定・faithful・障害セル着色）。クラスタ自動検出が要設計 |
| 4 | **重複集合可視化(BubbleSets/KelpFusion)** | 多重グルーピングのoverlay | 物理rack ∧ 論理VLAN を**色付きoverlay**で（座標不変、3-4集合上限） |
| 5 | **octilinear(soft)** | バックボーンの直線化 | force-directed octilinear を soft force で後付け。MIPは重いので回避 |
| 6 | **edge bundling** | （原則回避） | **faithfulness喪失**で運用と衝突。使うなら同一論理グループ限定+末端テーパー+source色分けのdisplay専用に厳格制約 |

---

## 5. 新規手法のスケッチ（独自実装の核）

**Structure-Aware, Faithful, Task-Oriented Layout for Operational Network Topology**

パイプライン（各段が上記ギャップ/タスク/技法に対応）:

```
入力グラフ(複合・非木)
  │
  ▼ ① Structure Recognizer ── ネットワーク構造を第一級で検出
  │     - role/betweenness で tier 推定（degree でなく）
  │     - 冗長対 / LAG束 / spine-leaf 二部ブロック / ring / mesh-core をパターン認識
  │     - 多重グルーピング(物理∧論理)を set membership として保持
  │
  ▼ ② Constraint Generator ── 構造→幾何制約に翻訳（SetCoLa流）
  │     - tier → 有向分離  / subgraph(1軸投影) → 包含
  │     - 冗長対 → 局所対称 / LAG → 論理単一辺へ畳む（faithful、展開可能）
  │     - mesh-block → matrix/grid ブロックに置換（NodeTrix流）
  │     - pin(Human/前回座標) → equality
  │
  ▼ ③ Constraint Solver ── 同時最適化（IPSep-CoLa基盤）
  │     目的: 単調方向性 + 下流連続 + 冗長対称 + 負荷チャネル（crossingは制約として）
  │
  ▼ ④ Faithful Router ── 配線（束ねない）
  │     - source→target を保つ。LAGは1本(本数バッジ)、mesh-blockは行列セル
  │     - octilinear soft + lane分離（過去のbus失敗=対応喪失を回避）
  │
  ▼ ⑤ Overlay(座標不変) ── 多重グルーピング/状態
        - BubbleSets/Kelp で論理グループ、weathermapで容量/状態
```

**新規性の主張（論文の貢献）**:
1. **構造認識を一級ステージにした初の汎用ネットワーク特化レイアウト**（特許US9781008Bはspine-leaf専用・非一般化、本手法は冗長/LAG/ring/meshを統一的に）。
2. **faithfulness を保ったまま密メッシュを可読化**（mesh→matrix は単射、bundlingと違い個別リンク追跡可）。
3. **運用タスク忠実な目的関数**（単調方向＝path∧blast-radius を同一制約で、冗長対称、負荷チャネル）を定義・評価。
4. **多項式時間の近似**（NP-hard核を構造制約で縮約: tier=分離、pod=等価クラスで対称化、mesh=ブロック置換で辺数削減）。

**評価軸（ベンチ）**: test6 を起点に、enterprise(3-tier+冗長) / DC(spine-leaf) / ISP(mesh+ring) の代表ケースで、(a) faithfulness、(b) タスク別の読み取り正確性・時間、(c) 安定性、(d) 計算量を測る。

---

## 6. 主要引用（load-bearing）

- Kosak, Marks, Shieber — Automating layout of network diagrams with specified visual organization — IEEE TSMC 1994（network特化古典・知覚的組織化を上位制約）
- Henry, Fekete, McGuffin — NodeTrix — InfoVis/TVCG 2007（sparse=線/dense=行列）
- Nguyen & Eades — Towards Faithful Graph Visualizations — arXiv 2017（faithfulness=単射、bundlingは犠牲）
- Dwyer, Koren, Marriott — IPSep-CoLa — TVCG/InfoVis 2006（分離制約レイアウト基盤）
- Hoffswell, Borning, Heer — SetCoLa — EuroVis 2018（高レベル制約宣言）
- Nöllenburg & Wolff — MIP for Metro Maps — TVCG 2011（octilinear、NP-hard、平面/次数≤8前提）
- Holten & van Wijk — Force-Directed Edge Bundling — EuroVis 2009
- Lee et al. — Task Taxonomy for Graph Visualization — BELIV 2006
- Purchase et al. — Which aesthetic has the greatest effect — GD 1997（crossing最優先）
- **US9781008B1 — Visualization of dynamic fabric automation network topology (spine-leaf)** — 2017（唯一の構造特化先行）
- Crnovrsanin et al. — Incremental Layout for Online Dynamic Graphs — GD 2015；Diehl & Görg — Foresighted Layout（mental map保存）

---

## 7. 次の工程

- **Round 2（設計の具体化）**: ① Structure Recognizer のパターン検出アルゴリズム、② 制約の形式化と衝突解決の優先順位、③ ソルバ選定（WebCola採用 vs 自作）、④ mesh→matrix の自動クラスタ検出。
- **Round 3（敵対的検証）**: 既出でないかの再確認、test6の構造で本当に効くかの机上検証、NP-hard近似の妥当性。
- **Phase 0（並行・即効）**: 容量を線幅から分離（[composite-layout-redesign.md](../composite-layout-redesign.md) §7）。設計と独立に出せる。

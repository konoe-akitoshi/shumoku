# v3 Findings 03: ミクロ算法ツールボックス（半径/角度/配線）

**規模前提**: 数十〜低数千ノード。**この規模で計算速度はボトルネックでない**。効くのは「意味論」と「決定性」。

## 評価サマリ
| アルゴリズム | 役割 | Fit | 決定性 | 判定 |
|---|---|---|---|---|
| **Weighted Dijkstra SSSP** | 半径=帯域/コスト中心性 | ◎(hopトグル前提) | 決定的(タイbrk固定要) | **採用** |
| BFS hop-distance | 半径=ホップ階層 | ○ | 決定的 | **採用(並置・既定候補)** |
| **Duan-Mao 2025 SSSP(速度)** | 半径計算高速化 | ✗ | 決定的 | **不採用(overkill)** 実用クロスオーバー数百万エッジ |
| Duan-Mao 2025(概念) | bounded-frontier設計メタファ | ○ | — | **borrow** |
| **OLO(Bar-Joseph)** | 兄弟の角度順序最適化 | ◎ | 決定的(厳密DP) | **採用(角度の中核)** |
| TSP(角度順序) | 同上代替 | ✗ | ヒューリ依存 | **不採用(木制約無視・NP-hard)** |
| A\* on visibility graph | 非木エッジ配線(従) | ○ | 決定的 | **条件付採用(本数少時)** |
| Hierarchical edge bundling | 非木エッジ配線(主) | ◎ | 幾何固定なら決定的 | **採用(hazeの主処理)** |

## 1. SSSP for RADIUS
- weight=1/bandwidth → 高帯域直結が中心寄り＝**容量の中心性**。BFS hop=ホップ階層。**weightedは意味を一段昇格**だが副作用: リングが連続値で崩れる→**順序だけ決めリング割当は量子化(tier化)**。直感に反する場合あり→`radiusMetric:'hops'|'weighted'`トグル。タイブレーク(id安定キー)固定必須。O((m+n)log n)瞬時。

## 2. Duan-Mao 2025「Breaking the Sorting Barrier」
- 有向・非負実数SSSPを**決定的O(m log^{2/3}n)**。BMSSP再帰+pivot finding+「だいたい順序付いたブロック」処理（大域ソート放棄）。
- **速度はスケール的に無関係(NO)**: n=2000でDijkstra数百μs、改善定数大で実用クロスオーバー数百万〜千万エッジ。**完全にオーバーキル、不採用**。
- **概念はborrow(YES)**: 「大域ソートなしbounded frontier局所処理」がv3の emergent/local/no-global-order と思想一致。**リング=距離バンドのwavefront**（B₀<B₁<… で波面を押し出し各バンド=1リング、角度は親フロンティアからローカル継承）。

## 3. OLO for ANGULAR order（Bar-Joseph DP）
- **木制約下で葉順序最適化**。各内部ノードの子フリップDP、O(n_local³)、多項式・厳密・決定的。radialの「子の並べ替え」と問題定義が**完全一致**。
- コスト=「**非木エッジで結ばれた葉を角度的に近づける**」→haze交差を配線前に角度段階で先食い削減。n_localは各内部ノードの子数で小（star病的時のみ2-optフォールバック）。**TSPは木制約無視＋NP-hardで筋悪、不採用**。

## 4. EDGE ROUTING非木エッジ（haze）
- radialで非木を素朴に弦で引くと中心横断大混雑＝haze本質。
- **第一選択=hierarchical edge bundling(Holten)**。制御点を**木の最近共通祖先に幾何固定→決定的**、同心構造に沿い内側湾曲。個別追跡性は失うが「どの領域間に冗長か」俯瞰が効く。
- **第二選択=A* on visibility graph**（本数少・個別追跡必要時、bend最小）。force-directed bundlingは非決定的→幾何的決定的バンドリングを使う。

## 合成レシピ（3段）
- **Stage0 木抽出**: roleトップからスパニングツリー、残り=非木(haze)。
- **Stage1 RADIUS**: Dijkstra(weight=1/bw, hopトグル)→**bounded-frontier wavefrontで量子化**(各バンド=1リング)。タイブレークid固定。
- **Stage2 ANGULAR**: 各内部ノードでOLO DP、コスト=非木近接＋スポーク長。parent-centered配分で親子交差0。star時2-opt。
- **Stage3 ROUTING**: 非木をhierarchical bundling(制御点=LCA固定=決定的)主、少数重要冗長のみA*従。
- **決定性5点**: ①Dijkstraタイブレーク ②距離バンド境界Bᵢ ③OLO DPタイブレーク ④バンドリング制御点幾何固定 ⑤A*タイブレーク。

## Sources
- Duan et al. Breaking the Sorting Barrier STOC2025: https://arxiv.org/abs/2504.17033 ; 実装評価 arXiv:2511.03007
- Bar-Joseph OLO Bioinformatics2001: https://people.csail.mit.edu/tommi/papers/BarGifJaa-ismb01.pdf
- PLANET radial: S037843711931670X ; parent-centered: arXiv cs/0606007
- Wybrow/Marriott orthogonal connector routing: https://users.monash.edu/~mwybrow/papers/marriott-diagrams-2014.pdf
- Edge Routing with Ordered Bundles arXiv:1209.4227

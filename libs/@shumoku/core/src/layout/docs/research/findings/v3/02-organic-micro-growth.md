# v3 Findings 02: 有機的/ミクロ成長レイアウト

**結論先出し**: 有機的成長を**配置の主役にはしない**。意味的な親子・階層・flowはtop-downで確定（依存legibilityの命綱）。有機成長は (A)確定済みサブツリーの空間展開 (B)エッジ曲線 に限定注入。

## 1. Force-directed / Stress majorization「有機的だが構造的」
- stress(Kamada-Kawai起源)=幾何距離をグラフ理論的最短距離に合わせる。格子に乗らず距離忠実。Gansner-Koren-North(GD2004)のmajorization=SMACOF、高速安定。**決定的**（初期配置依存→PivotMDS/seeded initで再現）。
- **致命的弱点**: path/hierarchyタスクで負ける（複数study一致）。Sugiyama(root上)がradial/orthogonalを上回る。**network topology=依存/到達性が主タスク→forceはここを表現しない。主軸にしない。**

## 2. RRTのレイアウト転用
- **直接の先行研究は実質無い**。RRT/RRGはmotion planning用。「既存ノードを障害物、未踏自由空間へ枝を伸ばす」=エッジルーティングとほぼ同型（visibility/A*）。
- **ノード配置をRRTで育てるのはlegibilityを壊す（枝向きがサンプル依存でflowが出ない）→不採用**。発想はエッジに限定。乱択は決定論化必須（次項）。

## 3. Space Colonization（本命）— Runions et al. EG-WNP 2007
- 葉脈モデル。**「空間の奪い合いが枝分かれを決める」**。attractor撒く→influence radius内の最近傍ノードに関連付け→方向平均で新ノード生成→kill distance内のattractor除去→反復。パラメータ(di/dk/D)が枝の太さ・密度に対応。
- **「未占有キャンバスへ有機的に枝を伸ばす」をformalize**。network=木+少数閉路でtree-growthと相性良い。**決定性=attractor配置のみ乱数源**→quasi-randomで完全再現。
- **弱点**: 決めるのは枝の幾何であって意味的配置でない（トポロジは論理が先に固定）。**生のまま使うと依存legibility破壊**。closed venationの閉路生成は危険→無効化。
- **採り方**: 親子・階層はtop-downで確定、space-colonizationは「サブツリーを未占有扇形へ展開する枝の伸ばし方」と「有機エッジ曲線」に限定。

## 4. Macro(imposed) vs Micro(emergent)
- emergentの強み=**クラスタ知覚・空間の有機的充填**（近接・連続を自然に満たす）。imposed(層状)の強み=**flow/階層の読み取り**（方向を強制）。**相補的＝役割分担**。
- 交差が多くても分布が良ければ読みやすいことがある（force長所、structure-based aesthetics）。

## 5. 決定性: 有機的に見えて完全再現
- **R-sequence（黄金比加法列）** `t_n={s0+n·α}, α=1/φ_d`: パラメータ不要・完全決定論・blue-noise状均等（Halton/Sobolの退化なし、最小距離1/√n）。
- Halton/Sobol、deterministic relaxation(stressは決定的反復)。**motion planningの教訓: 乱択をquasi-random化すると決定性＋性能＋実測すべて有利。「organic=要乱数」は誤り。**

## v3への筋（核心テーゼ）
有機成長は配置の主役にしない。**(1)tier/role/親子をtop-down確定（emergent化禁止＝legibilityの命綱）→(2)space-colonizationをtier内/サブツリー展開に限定（所属保存、closed venation無効）→(3)attractorはR-sequenceで決定論的に撒く→(4)stress majorizationをy固定で薄く仕上げ（flow方向保つ）→(5)エッジは自由空間を縫う決定的曲線**。
**不変条件**: tier/親子はemergent化禁止、意味なし閉路禁止、RNG禁止(R-sequenceのみ)、flow方向はy固定で保証。

## Sources
- Gansner-Koren-North stress majorization GD2004: https://graphviz.org/documentation/GKN04.pdf
- Runions et al. Space Colonization EG-WNP2007: https://algorithmicbotany.org/papers/colonization.egwnp2007.large.pdf
- RRT Wikipedia ; Janson-Ichter-Pavone deterministic sampling IJRR2018: https://stanfordasl.github.io/wp-content/papercite-data/pdf/Janson.Ichter.Pavone.IJRR18.pdf
- Roberts R-sequence: https://extremelearning.com.au/unreasonable-effectiveness-of-quasirandom-sequences/
- force vs hierarchical (DiVA): http://www.diva-portal.org/smash/get/diva2:1472455/FULLTEXT01.pdf ; hierarchical drawings arXiv2209.04522
- Gestalt in Graph Drawing: Springer 978-3-319-27261-0_50

# v3 Findings 05: 乱雑さの解消 ＋ 左寄りの修正（実装プラン）

3エージェント調査の統合。対象: ローカル極座標成長＋力学緩和の有機ツリーが「グチャグチャ」＋「左寄り」。

## 左寄り(lean)の診断＝初期配置の非対称（力学でなく）
力学(spring/repulsion/depth)は等方で方向バイアス無し。だが**重心を中心へ戻す力が無いので初期の偏りを保存**。原因3つ:
- **(c) 複数root**: x=0から右へ積む＋刻み=leafCount×30(推定)が実占有幅とズレ→軽いroot側に空白・重いroot側に密集。配列がID順固定で恒常化。**主犯**。
- **(a) 子の扇**: 子順がID昇順固定→重いsubtreeが片側(小角度=左)に偏る。角度等配分≠直交等配分(cos非線形)も左積算。
- **(b) leaf-cursor**: v3には無い(tidy-forestに残存。本番化ならcentroid化で対処)。

**修正(優先)**:
1. **root を実測bbox幅で重心中心に配置**(cursorを−total/2始点、刻み=実測幅)。重いrootを中央寄せ(heaviest-center)。
2. **力学ループ末尾でhard recenter**(全ノードを重心が原点へ平行移動)。drift完全消去。
3. **per-parent re-centering**: 各親で子の角度重心を測り `dir−meanAngle` だけsubtree回転(RT/Buchheim criterion2のpolar等価)。
- force自体は触らない(等方)。root pin or 毎iter recenterで重心固定。

## 乱雑さ(clutter)の解＝順序＋空き成長＋bundle
crossingの主因は「兄弟の角度順序が悪い」＋「非ツリーがメッシュで全体貫通」。優先順:

**P0 兄弟ordering（即効・最大）**: 各内部ノードで子を**subtreeの希望角度(pref)でソート**。pref[v]=葉から集約した平均角度。**TSPは1次元角度seriation=ソートに退化**。O(V log V)決定的。crossingの角度interleaveを直撃。Bar-Joseph OLOで左右flip最適化も可(厳密DP)。
- 実装: 初期grow→各subtreeの外部リンク先方向(barycenter)で子reorder→re-grow を数回反復（tidy-forestの外部barycenterの極座標版）。

**P1 space colonization（本命・clump解消, Runions2007）**: 固定wedge fanをやめ、canvasにR2低離散列(決定的)でattractor撒き、BFS順・大subtree優先で各子を**未占有attractor方向へ伸ばす**。influence/kill距離で消費。clumping根本(占有領域への成長)を消す。spatial hashで~O(V+M)。**効果高**。RRTは「空きへ伸ばす」概念の正当化のみ(トポロジは壊さない)。

**P2 半径をsubtree規模で重み付け(軽量SSSP)**: `radius[v]=radius[parent]+baseGap+k·log1p(leafCount[child])`。bushy枝を半径方向に事前分離。O(V)ほぼ無料。

**P3 非ツリーbundling(Holten HEB)**: 非ツリー辺を tree上の src→LCA→dst パスの制御点でB-spline。同方向の束が寄り知覚clutter激減。LCA制御点固定=決定的。tree=直線濃、非tree=束薄。**効果大**。

**P4 Duan2025**: 速度は2000ノードでオーバーキル=実装しない。「frontier/bucketでグローバルソートせず距離バンドでリング化」の概念のみ借用(Δ-stepping的)。

## 着手順
1. **左寄り修正**(root実測幅centroid化 + force recenter) ← 即効
2. **P0 兄弟ordering**(外部barycenterで子reorder反復) ← 交差削減の本命
3. **P3 非ツリーbundle/抑制** ← もや消し
4. (P1 space colonization, P2 半径重み = 次段の本格改善)

## Sources
- Duan et al. Breaking the Sorting Barrier STOC2025 arXiv:2504.17033 (概念のみ)
- Runions et al. Space Colonization EG-WNP2007
- Bar-Joseph OLO Bioinformatics2001
- Holten Hierarchical Edge Bundles 2006
- Roberts R2 quasi-random ; Reingold-Tilford/Buchheim criterion2 ; Yee radial InfoVis2001
- yWorks/D3 center-force (drift防止) ; Bertault PrEd / Simonetto ImPrEd (交差非増加post-pass)

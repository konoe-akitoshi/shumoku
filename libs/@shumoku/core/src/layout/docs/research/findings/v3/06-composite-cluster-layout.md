# v3 Findings 06: 複合(divide-and-conquer)クラスタレイアウト — 調査報告

背景: 単一のグローバル力学シミュレーションは~23ゾーンを1つのblobに混ぜる(ゾーン純度37%)。
参照図(ShowNet)は「コンパクトなゾーン群＋たっぷりの余白＋冗長ペアの対称配置＋ゾーン間の縦flow」。
サブエージェント調査の保存版。

## 1. 古典: 標準パイプライン
- **Eades & Feng GD'96 (Multilevel Visualization of Clustered Graphs)**: clustered graph C(G,T) と
  **quotient graph**(クラスタ→super-node縮約)を定式化。標準再帰: ①各leaf clusterをローカル配置
  ②quotientをsuper-node(子bbox寸法)で配置 ③平行移動で合成。クラスタ領域は互いに素。
- **Sugiyama & Misue 1991 (compound digraphs)**: 階層版の祖先(ELK/dotの系譜)。
- **c-planarity (Feng-Cohen-Eades 1995)**: 理論。実務上の教訓は1つ:
  「**越境エッジの内部端点をパートナー側のクラスタ境界に寄せる**」=ports。

## 2. 実エンジンの具体機構
- **yFiles RecursiveGroupLayout**: グループ毎に別アルゴリズム可(organic/layered混在)。越境エッジは
  グループ境界でclipし、**境界port candidates**(内部端点の相対位置)を置いてから内部配置。
- **Graphviz**: dot=クラスタ毎mini-dot→親rankingに折込み。fdp=**クラスタをローカル力学→親シミュ
  レーションでは剛体扱い**。osage=純divide-and-conquer(packはエッジ無視=越境エッジ長が犠牲)。
- **ELK**: bottom-up(子configが寸法とhierarchical port位置を確定→親は動かせない) vs
  INCLUDE_CHILDREN(全体1パス, 交差減るが侵襲的)。
- **共通の本丸**: quotient配置そのものではなく**越境エッジのport anchoring**が効く。

## 3. Quotient配置の有効性のエビデンス
- **Group-in-a-Box (Rodrigues 2011)** → **GIB meta-layouts (Chaturvedi CGF2014)**:
  グループ間結合量で箱を力学配置。309 Twitterネットワークで可読性評価＋選好実験で flat 力学に勝つ。
- **Saket et al. TVCG2014**: 明示的なグループ表現(領域描画)は**グループ系タスクの精度/時間を有意に
  改善し、ノード系・ネットワーク系タスクを害さない**。←「ゾーンblob+余白+領域描画」の直接の根拠。
- 23 super-nodeのquotientは計算的に自明。**quotientエッジは越境リンク数で重み付け**(密結合ゾーンを隣接させる)。
- 落とし穴: (a)quotientは端点がゾーン内のどこかを知らない→far-side進入。port passで解消
  (b)剛体合成は不揃いbboxで空間浪費→pack/アスペクト調整 (c)**1ノードゾーンは箱にしない**(インク優位)。

## 4. 冗長ペアの対称配置
- 理論(Hong & Eades symmetric drawing)はNP困難でオーバーキル。
- **実務=twin検出**: N(u)=N(v)(false twin) / N[u]=N[v](true twin)。O(n+m) partition refinement。
  modular decompositionの並列/直列葉=ペア。Papadopoulos & Voglis GD'05 がこれでlayout駆動。
- 実ネットワークは**near-twin**(mgmtリンク1本差等)→ **Jaccard≥0.8＋直結リンク＋同role**で判定。
- 強制の3段階: (i)片方を配置して鏡映 (ii)同y＋固定gap制約 (iii)**シミュレーション中は1メタノードに
  collapse→終了後に横並びexpand**。(iii)が最安でシミュレーション中のエッジclutterも半減。←推奨。

## 5. 余白の定量
- 「gap = k×内部間隔」の検証済みルールは**存在しない**。de-facto慣行:
  **ゾーン間gap ≥ 内部ノード間隔の1.5–2倍**(ELKのnodeNode vs componentComponent, Graphviz cluster margin)。
  知覚的に効くのは**比**(inter/intra距離比=クラスタ分離の標準尺度)。
- **領域描画(tint/outline)は余白より強い**(Saket 2014のグループ効果は明示領域由来)。
- gapは束幅対応(平行越境バンドル＋ラベルbufferぶん確保)。

## 推奨パイプライン(ゾーン内は有機のまま)
1. **ペアcollapse**(near-twin検出→メタノード化, 並行エッジ多重度マージ)
2. **ゾーン毎ローカル有機配置**(1–7ノード=自明, 決定論seed) → bbox+padding
3. **ペアexpand**(横並び固定gap, エッジは平行バンドル)
4. **quotient配置**(23 super-node, 越境リンク数重み)。flowが明確なので**quotientはlayered**推奨
   (これがマクロの上→下を無料で与える)。flow無しグラフはforce+overlap除去にfallback。
5. **port割当**(越境エッジをパートナー方向の境界に anchor、内部1回refine)
6. **合成＋余白**(ゾーンgap ≥ 内部間隔の~2倍＋バンドル/ラベルbuffer)＋**ゾーン領域描画**
7. **越境エッジは境界→境界でゾーンpair毎にバンドル**(他ゾーンの箱を貫通しない)

計算量は50–500ノード/23ゾーンで無視できる。= yFiles RecursiveGroupLayout(有機内部+layered core)
パターンの自作版。十分に踏まれて評価済みの設計。

## Sources
Eades&Feng GD'96 / Sugiyama&Misue 1991 / Feng-Cohen-Eades 1995 / yFiles RecursiveGroupLayout docs /
Graphviz attrs,osage,fdp / ELK hierarchyHandling + arXiv:2311.00533 / Group-in-a-Box SocialCom2011 /
GIB meta-layouts CGF2014 / Saket et al. TVCG2014 arXiv:1404.1911 / Hong&Eades GD Handbook ch.3 /
Papadopoulos&Voglis GD'05 / arXiv:2408.11673 / arXiv:2107.07477

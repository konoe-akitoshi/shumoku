# v3 Findings 07: 有機アルゴリズムのまま階層を読ませる機構 — 調査報告

背景: v3力学版は指標(交差/重なり/上向き)は良いのに「階層が読めない」。グローバルlayered/gridに
戻らず、出力が上→下のトポロジ図として読める機構の先行研究。サブエージェント調査の保存版。

## 1. Magnetic Spring Model (Sugiyama & Misue 1994/95)
- spring embedderの拡張: エッジ=磁化された針、大域磁場の中で**回転力ペア**(両端点に垂直に印加)が
  エッジを磁場方向へ向ける。`f_rot = c·b·d^α·θ^β` (b=磁場強度, d=辺長, θ=磁場との角度)。
- 磁場タイプ: parallel(一様下向き=layered風) / radial / concentric、合成可。エッジ毎に
  単方向磁化/双方向/非磁化を選択可 → **tier辺だけ磁化し、peer/冗長辺は普通のバネ**にできる。
- 階層が読める理由: flowが**辺の統計的性質として創発**(層割当なし)。力学の対称性/クラスタ性は残る。
- コスト: ベース力学+O(m)。既存forceループに~30行で足せる。
- 弱点: 上向き違反が局所解に残り得る(β>1＋冷却で緩和)。**保証は無い**。
- yFiles OrganicLayoutの `edgeOrientation` がこれの製品化。

## 2. DiG-CoLa / IPSep-CoLa / hierarchy energy (Dwyer, Koren, Marriott 2005-06)
- **DiG-CoLa**: stress majorization + **レベル制約** `y_child ≥ y_parent + gap`(有向辺毎)。
  各ステップ=yのQPをgradient projectionで解く(分離制約はほぼ線形時間)。
- **hierarchy energy (Carmel-Harel-Koren 2004)** = soft版:
  `E_H(y) = Σ_(u→v) (y_u − y_v − δ)²` を最小化(線形ソルブ1回 or 辺毎のy-spring+rest offset δ)。
  サイクルは平均化で自然に潰れる。xは方向無視の通常stress。
- 階層が読める理由: 全有向辺が**確実に**(hard)または平均的に(soft)下向き。yは連続=層snapしない。
  力学の対称性・近接性は保たれ、dotよりも対称性/アスペクト比が良い(論文の図)。
- 実装が現存: **WebCola `flowLayout('y', gap)`** / **Graphviz `neato -Gmode=hier`**(levelsgapで強度)
  / `-Gmode=ipsep`。**`neato -Gmode=hier` でルックを1コマンドでA/B検証できる**。
- 50–500ノードはcola.jsの守備範囲そのもの。

## 3. 商用ハイブリッドの共通解
**force core + (a)辺毎の方向バイアス + (b)認識した部分構造のテンプレート配置**。
yFilesは star/chain/**parallel(=冗長ペア)**/cycle/tree を組合せ的に検出し、専用の対称テンプレートで
描いてから力学に縫い込む。「yFiles organicの綺麗さ」の大半はforceでなく**テンプレート**由来。

## 4. 可読性向けforce拡張(polish層)
- 角度解像/交差角force(Argyriou GD2010, Eades-Huang-Hong 2010): 交差を90°へ押す=冗長メッシュが
  許容可能になる。
- **Octilinear snap force (Chivers & Rodgers, Diagrams 2014)**: エッジを45°倍数へ回す磁気force。
  「エンジニアが描いた風」にする最強の既知トリック。
- twin-pair整列: 完全な対称描画はGI困難だが、**同neighbor集合のペア検出→same-y＋鏡映オフセット
  制約/バネ**で実用十分(Xu 2018, force-only版)。

## 5. 実証文献の要点
- **Purchase JVLC2002のflow metric**: 有向辺方向の主方向への整合度(平均角度偏差を0-1スケール)。
  costへ直接使える。
- Purchase系の結論: **交差が支配的**、有向グラフでは**flow一貫性が理解を有意に助ける**。
  **厳密なlayer化自体は効果が示されていない** ← 「layeredに戻らなくていい」の直接の根拠。
- 標準メトリクス: 下向き辺% ＋ 縦からの平均角度偏差。前者はDiG-CoLaが保証、後者はmagneticが最適化。

## ランク付き推奨
1. **hierarchy energy / DiG-CoLa系のy次元**(まずsoft: tier辺に `(y_u−y_v−δ)²` のy-spring、
   必要ならhard projection)。下向きの**保証**を持つ唯一の機構。peer辺は制約しない。
2. **magnetic torque(選択的磁化)** を polish 層として追加。octilinear snap・twin整列と相性良。

## Sources
Sugiyama&Misue JVLC1995 + GD'94 / Dwyer&Koren InfoVis2005 / Dwyer-Koren-Marriott TVCG2006 /
Carmel-Harel-Koren TVCG2004 / Graphviz neato mode=hier, levelsgap / yFiles Organic docs /
Kobourov arXiv:1201.3011 / Eades&Hong GD Handbook ch.3 / Xu 2018 / Purchase JVLC2002 /
Chivers&Rodgers Diagrams2014 / arXiv:2204.01006

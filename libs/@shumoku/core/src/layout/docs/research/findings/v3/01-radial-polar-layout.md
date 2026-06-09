# v3 Findings 01: 放射状/極座標レイアウト

## 本命骨格: Radial Tree Layout（radial Reingold-Tilford / tidy）
- **半径=depth、角度=leaf数比例の再帰セクター配分**。子は親より外リング＆親セクター内 → **outward=downstream＋階層が幾何的に一致**。O(n)2パス、完全決定的（子走査順を leaf降順→id昇順 で固定）。
- D3: `d3.tree().size([2π,R])`（Buchheim O(n) tidy）/ `d3.cluster()`（葉を最外周）。separation `(siblings?1:2)/depth` で外周の角度ギャップを詰める。
- **Eades の tangent-wedge制約（重要）**: 子を「親セクター∩次リング内円への接線くさび」に閉じ込めると**木エッジ交差ゼロ（平面性）保証**。leaf比例幅だけだとはみ出し交差が出る。

## Balloon/Bubble Tree
- 各部分木を円で囲み親円周に再帰配置。有機的見た目。On Balloon Drawings(Lin&Yen)、Bubble Tree(Grivet, 線形時間1bend)。
- **半径のグローバル距離意味が崩れる**（親基準のローカル極座標）→「中心からの距離で層を読む」用途には radial tree 劣位。

## Radial Stress（Brandes & Pich, "More Flexible Radial Layout" JGAA）
- **一般グラフ（メッシュ込み）**をリングに乗せつつ stress最小化。`(1−t)stress + t·radial` を t:0→1 漸増で純stress初期化→リングへ凍結。半径所与（distance/centrality）、角度を最適化。**非木エッジも stress項に自然に含む**のが radial tree に対する利点。決定性は初期化固定で可。

## Hyperbolic（Lamping-Rao Poincaré / Munzner H3）
- 周長/面積が指数増→外周過密を原理的に解消。focus+context。O(n)〜O(n log n)、決定的。**半径が非線形に歪む→距離を実数で読めない**。巨大階層ブラウザ向け、静的topology図には過剰。

## リング過密対策（必須）
separation/depth、最大角制約、半径適応拡大、**alternating-ring(2円交互で実質周長2倍)**、内側からの overlap-removal、leaf比例配分。出典: ELK Radial / yEd Radial。

## 要点と落とし穴
- **骨格=radial tree（leaf比例＋tangent-wedge＋O(n)tidy）**。これだけで outward=downstream・グリッドなし・O(n)・決定的。
- **実ネットは木でない** → スパニングツリーに射影、**非木は chord/arc 後乗せ**（中心横断は bundling回避）。非木が主役級ならBrandes-Pich radial stress。
- **root選択が結果を支配**。betweennessベースの距離でroot/depthを決めると outward=downstream がネットワーク的に正しい（単純BFS depthは冗長経路で乱れる）。MEMORY: tier root-cause=betweenness。
- ラベルは角度に沿わせず水平、アイコン正立。深い木で外周爆発（実topologyは3-5層で実害小）。

## Sources
- Eades radial/annulus wedge: https://www.csd.uoc.gr/~hy583/papers/ch8.pdf
- d3-hierarchy tree/cluster: https://d3js.org/d3-hierarchy/tree
- Brandes & Pich, More Flexible Radial Layout: https://www.uni-konstanz.de/algo/publications/bp-mfrl-11.pdf
- Munzner H3: https://graphics.stanford.edu/papers/h3/html.nosplit/
- Balloon: https://arxiv.org/pdf/1004.2338 ; Bubble Tree: ResearchGate 225836738
- ELK Radial: https://eclipse.dev/elk/reference/algorithms/org-eclipse-elk-radial.html ; yEd Radial manual
- PLANET radial: https://www.sciencedirect.com/science/article/abs/pii/S037843711931670X ; parent-centered radial: https://arxiv.org/pdf/cs/0606007

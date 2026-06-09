# Findings 02: 学術SOTA — ネットワークトポロジ特化レイアウト

> ネットワーク特化レイアウトの査読成果は薄く、最も的を射た成果は**産業特許**(US9781008B1)。これが paper-worthy の根拠。

## 主要文献 × 前提適合 早見表

| 手法 / 論文 | 構造前提 | 実運用網適合 | 最適化対象 | アルゴリズム族 |
|---|---|---|---|---|
| Kosak/Marks/Shieber 1994 | 一般・network特化 | △ 概念最適、スケール非対応 | 知覚的組織化を上位制約 | ルール + GA |
| NodeTrix 2007 | globally sparse / locally dense | △ 密部分の行列化は有効、層保持なし | 表現切替(node-link↔matrix) | 半自動・interaction |
| Edge bundling (Holten 06/09) | 一般 | × faithfulness喪失で運用不可 | クラッタ低減 | 階層/force束ね |
| Faithfulness (Nguyen/Eades 17) | 評価論 | ◎ 運用要件を言語化 | 単射性(faithful) | 評価フレーム |
| Power/Confluent | 共通近傍/平面 | △ full-mesh圧縮に好適も非平面で破綻 | 可逆圧縮 | NP-hard最適化 |
| Metro/octilinear | 平面・次数≤8・near-tree | × 前提が全壊 | octilinear・曲げ最小 | MIP/SA/hill-climb |
| CoLa/SetCoLa/Grid 06–18 | 一般+制約 | ○ 層を制約で表現可、品質に難 | 制約充足+stress | stress majorization+QP |
| Internet map/H3/VAST | 巨大疎・標本 | × 個別リンクreadability欠如 | 規模の俯瞰 | spring/hyperbolic |
| **US9781008B1 (spine-leaf)** | **folded Clos/full-mesh** | **◎ 唯一の構造特化** | 可読化(辺を隠す)+状態符号化 | 規則利用ヒューリスティック |

## 載っている load-bearing な事実
- **NodeTrix**: 「social networks are globally sparse and locally dense」、global Internet を small-world 例に明示。行列は「ill-suited to path-related tasks」、定量評価は future work と自認。
- **Faithfulness (Nguyen & Eades)**: readabilityは「necessary but not sufficient」。faithful=「different graphs to distinct drawings（単射）」。「bundling often sacrifices faithfulness」。
- **Metro (Nöllenburg & Wolff)**: 入力は「planar graph G with maximum degree 8」、hard制約充足判定が NP-hard。degree-2 path 支配の near-tree 前提。
- **Grouped-grid (Yoghourdjian 2016)**: 「significant issues in the quality … even for quite small networks … especially … with grouping constraints」「practical results have been slight」。
- **US9781008B1**: 「each tier is fully connected to all switches in the partition below」。例 16 spine + 384 leaf = 6,144 links。従来「sheer number … illegible chaos」「solid ball of edges」。解=full-mesh前提で辺を既定で隠し tier-link 状態を色符号化、on-demand 展開。

## 学術側の空白（結論）
1. **トポロジ構造の規則性を第一級入力とする汎用レイアウトが無い**（特許に偏在、査読/一般化/定量評価なし）。
2. **「層＋メッシュ」同時最適化が空白**（Sugiyamaは段内mesh交差爆発、metroはmesh非適用）。
3. **faithful かつ dense-readable のトレードオフ未解決**（bundling/confluent/power-graphはfaithfulness犠牲）。
4. **密メッシュ向け安定(online)レイアウトが無い**。
5. **タスク特化(faithful-to-operation)目的関数の不在**。
6. **NP-hard障壁への実務的近似が薄い**（構造規則性を制約注入し多項式時間で良解、が未開拓）。

## 引用一覧（title — venue/year — URL）
- Kosak, Marks, Shieber — Automating the layout of network diagrams with specified visual organization — IEEE TSMC 1994 — https://www.osti.gov/biblio/57303
- Dengler, Friedell, Marks — A formal specification scheme for network diagrams — JVLC 1993 — https://dl.acm.org/doi/10.1016/S1045-926X(05)80006-0
- Henry, Fekete, McGuffin — NodeTrix — InfoVis/TVCG 2007 — https://www.microsoft.com/en-us/research/wp-content/uploads/2016/12/Henry_infovis07.pdf
- Holten & van Wijk — Force-Directed Edge Bundling — CGF/EuroVis 2009 — https://onlinelibrary.wiley.com/doi/10.1111/j.1467-8659.2009.01450.x
- Wallinger et al. — Edge-Path Bundling — TVCG 2022 — https://arxiv.org/pdf/2108.05467
- Nguyen & Eades — Towards Faithful Graph Visualizations — arXiv 2017 — https://arxiv.org/pdf/1701.00921
- Dwyer et al. — Improved Power Graph Compression — arXiv/GD 2013 — https://arxiv.org/pdf/1311.6996
- Nöllenburg & Wolff — A MIP for Drawing High-Quality Metro Maps — TVCG 2011 — https://www1.pub.informatik.uni-wuerzburg.de/pub/wolff/pub/nw-mipdh-06.pdf
- Stott et al. — Automatic Metro Map Layout using Multicriteria Optimization — TVCG 2011
- Bast et al. — Metro Maps on Octilinear Grid Graphs — CGF/EuroVis 2020 — https://onlinelibrary.wiley.com/doi/full/10.1111/cgf.13986
- Bast et al. — Shape-Guided Mixed Metro Map Layout — CGF 2022 — https://arxiv.org/pdf/2208.14261
- Dwyer, Koren, Marriott — IPSep-CoLa — TVCG/InfoVis 2006 — https://pubmed.ncbi.nlm.nih.gov/17080805/
- Hoffswell, Borning, Heer — SetCoLa — EuroVis 2018 — https://jhoffswell.github.io/website/resources/papers/2018-SetCoLa-EuroVis.pdf
- Yoghourdjian et al. — Ultra-Compact Grid Layout of Grouped Networks — TVCG 2016 — https://ialab.it.monash.edu/~dwyer/papers/gridlayout2015.pdf
- Crnovrsanin et al. — Incremental Layout for Online Dynamic Graphs — GD 2015 — https://vis.cs.ucdavis.edu/papers/tarik_incremental.pdf
- US9781008B1 — Visualization of dynamic fabric automation network topology (spine-leaf) — 2017 — https://patents.google.com/patent/US9781008B1/en
- Internet Mapping Project — https://en.wikipedia.org/wiki/Internet_Mapping_Project ; CAIDA/H3 — https://www-old.caida.org/tools/visualization/mapnet/summary.html ; VAST — https://www.semanticscholar.org/paper/2165420781169b14ed37e913b0e5f6812c249933

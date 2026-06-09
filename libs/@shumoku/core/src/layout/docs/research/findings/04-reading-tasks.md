# Findings 04: 運用読みタスク → レイアウト特性

汎用は crossing/area を最適化。エンジニアは**運用上の問い**で読む。Lee et al. (BELIV'06) のタスク分類に1:1写像。

## 運用タスク × Lee分類
| 運用タスク | 具体の問い | Lee分類 |
|---|---|---|
| パストレース A→B | どの経路を通るか(ECMPは複数同時) | Follow Path / Connectivity(shortest path) |
| ブラスト半径/障害影響 | これが死ぬと下流の何が落ちるか | Accessibility(直接/間接到達) |
| 冗長検証/SPOF | dual-homedか/単一障害点はどこか | Connectivity(bridges, articulation) |
| キャパシティ/輻輳 | どのリンクが混んでいるか | Attribute(links largest values)+Overview |
| 変更/diff | 昨日から何が変わったか | High-Level(temporal change) |
| RCA | 故障源はどこか | Adjacency + 逆Accessibility |
| 概観 | 規模/構造/クラスタ数 | Overview |

## ★ 読みタスク → レイアウトが満たすべき特性（中心成果物）
| 読みタスク | レイアウト特性(制約/目的) | 根拠 |
|---|---|---|
| パストレース A→B | **単調方向性**: 主軸に沿い折り返さない、ホップが一列。エッジ長均一・crossing最小がpath-following性能と相関 | Purchase, follow-path, 流れ方向慣習 |
| ECMP多重経路 | **並行経路の分離＋対称**: 束ねず等価・対称に並置(fan-out/in対称) | ECMP, 対称性 |
| ブラスト半径 | **下流サブツリーの空間的連続性**: accessibility集合が連続領域。tier方向=依存方向、影響は一方向(下/右)へ | accessibility, propagation次元 |
| 冗長/SPOF | **冗長対の局所対称＋articulation point顕在化**: dual-home2経路を左右対称、単一経路ノードが「束ねた首」 | connectivity, dual-home対称 |
| キャパシティ/輻輳 | **負荷チャネル確保**: 太さ/色(利用率)が潰れない間隔・最小エッジ長、高負荷を重畳させない | weathermap, attribute-on-links |
| 変更/diff | **レイアウト安定性(mental-map保存)**: 前回位置保存、変化分のみ動く | temporal change, time-slider |
| RCA | **逆方向到達性＋adjacency密度**: 障害から上流へ単調軸で逆探索、隣接近接 | adjacency, 逆accessibility |
| 概観(NOC大画面) | **tier明示＋均等分布**: core/dist/accessが水平バンド分離 | overview, 3層慣習, core-top |
| 全般(前提) | **crossing最小化(最優先)＋階層メンタルモデル整合**(core上/access下, 外部=上or片側, 流れ方向)。対称/bendは二次 | Purchase(効果序列) |

## 設計含意
1. **第一軸=トラフィック/依存方向**。tier方向を依存伝播方向に固定→パストレース(単調)とブラスト半径(下流連続)が**同一制約の表裏**で同時成立。
2. **冗長性は対称性で表現**。汎用対称(効果小)でなく redundancy-aware な局所対称を目的関数に。
3. **diffは安定性制約**として別枠(前回解からの最小移動)。
4. **単一目的関数では競合**(単調 vs クラスタ近接)→ **タスクモード(trace/impact/capacity/diff)別の重み切替**が研究的に正当(2009比較研究: 最適はtask依存)。

## 設計慣習(人間の事前知識)
- 3層(core/distribution/access)が支配的メンタルモデル(Cisco由来)。core上/dist中/access下の垂直配置。外部=上or片側。トラフィック流れ方向(ユーザ片側/サーバ反対)。crossing回避。シンボル一貫(L3=円/L2=矩形)。

## 主要ソース
- Lee et al. — Task Taxonomy for Graph Visualization — BELIV'06 — https://datavis2020.github.io/pdfs/lee-beliv06.pdf
- Purchase et al. — Which aesthetic has the greatest effect — GD 1997 — https://link.springer.com/chapter/10.1007/3-540-63938-1_67
- Comparing Readability of Graph Layouts (Eyetracking, task-oriented) — Comp. Aesthetics 2009 — https://dl.acm.org/doi/10.5555/2381286.2381296
- Blast radius/依存: https://lightrun.com/blog/blast-radius-analysis/ / https://www.datadoghq.com/blog/dependency-map-navigator/
- パス分析: https://www.netbraintech.com/product/dynamic-map-and-path/ / https://www.liveaction.com/solutions/network-performance/topology-mapping/
- 3層/慣習: https://study-ccna.com/cisco-three-layer-hierarchical-model/ / https://www.auvik.com/franklyit/blog/effective-network-diagrams/
- weathermap: https://quadrang.com/understanding-the-network-weathermap-a-critical-tool-for-internet-providers/

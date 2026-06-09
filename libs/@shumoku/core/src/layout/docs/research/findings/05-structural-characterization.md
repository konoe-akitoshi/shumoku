# Findings 05: 実ネットワークの内在構造（レイアウト設計の前提）

核心: **これらの非木構造はノイズでなくネットワークの設計意図そのもの**。レイアウトは潰すのでなく可視化すべき。

## 1. 非ツリー構造（意味的）
### 1.1 Redundancy (dual-homing/dual-core)
- 定義: アクセスが2上位に同時接続/コア2台冗長。意味: SPOF排除(複数親が設計要求)。
- 破綻: ツリー=2本目を捨てる。Sugiyama=冗長対が非対称に潰れる。力学=ペア近接保証なし。

### 1.2 Link Aggregation (LAG/Port-Channel/MLAG)
- 定義: 複数物理を1論理に束ねる(LACP/802.3ad)。MLAG=2台へ分岐して1論理。意味: 帯域加算+無瞬断failover。**物理/論理の多重度二層**。
- 破綻: 全汎用が多重辺をN本の独立辺として描く=「N本の独立経路」と誤伝達。MLAGの「2台分岐=1論理」モデルがエッジ表現に無い。畳む/展開する抽象度を持てない。

### 1.3 Spine-Leaf (完全二部メッシュ)
- 定義: 全leafが全spineに1本ずつ=**完全二部 K(leaf,spine)**(folded 3-stage Clos)。leaf間は必ずspine 1ホップ経由。意味: 等距離・等コスト・ECMP無閉塞・水平スケール。欠け辺=設計バグ。
- 破綻: Sugiyama=完全二部の交差は最小化不可(本質的に大)、O(n²)辺で時間浪費しスパゲッティ。**規則性(読みどころ)が乱雑に見える**。力学=2団子に潰れる。ツリー=不能。

### 1.4 Ring (メトロ/STP)
- 定義: 閉路接続。L2はSTP/ERPSで1リンクブロックし論理ツリー化。意味: 任意1リンク切断耐性(2-edge-connected)。物理=閉路/論理=ツリーの二重構造。
- 破綻: ツリー/Sugiyama=back edgeに分解し直線化、「環状」の第一特徴が消滅。STPブロックリンクの区別を持たない。

### 1.5 Full/Partial Mesh コア
- 定義: コア相互直結(K_n / 一部)。iBGPフルメッシュ、MPLSコア、WANバックボーン。意味: 低レイテンシ・any-to-any・経路冗長。
- 破綻: メッシュに自然な階層が無い→Sugiyamaが**偽の階層**を作る。

### 1.6 ECMP/Fat-Tree/Clos
- 定義: 等コスト複数経路をハッシュ分散。Clos無閉塞条件 **m≥2n−1**。意味: 複数等価最短経路が設計目標。
- 破綻: 最短経路ツリーに畳む手法は複数経路を1本に縮約=情報破壊。多段Closは§1.3交差問題が段数分悪化。

## 2. 層構造 + 層内/スキップリンク
- tier化されているが「辺は隣接層間のみ」は偽: **層内辺**(core peer link, MLAG peer-link, mesh)・**skip-level辺**(access→core直結)が常在。
- 破綻: Sugiyamaは層内辺(同ランク)を扱えず無視/追い出し→偽の階層差。skip辺は長いダミー鎖で面積爆発。
- **本質**: ネットワークのtierは**roleに基づく意味ラベル**で先験的に決まる。辺はそのランク制約内で自由。Sugiyamaはランクを辺から計算する=逆向きのミスマッチ。

## 3. 役割/重要度 ≠ degree
- 構造的重要度は **betweenness的**(最短経路がどれだけ通るか)。低次数コア>高次数アクセス。
- 例: 48ポートアクセスSWはdegree高いが先は葉ばかり=betweenness低。uplink2本のコアはdegree=2だが全サイト間トラフィックが通る=betweenness最大。
- 破綻: degreeでサイズ/中心性を決める手法は**アクセスを巨大・中心、コアを周辺**に=**階層を上下逆転**。力学も高次数が中心に寄る。
- 含意: tier決定は**betweenness/role**、degreeは使わない（メモリ TTDB layout: `betweenness not degree` と一致）。

## 4. 重複する多重グルーピング
- 1装置が同時に複数グループ所属: 物理(rack/room/site/chassis) ∧ 論理(VLAN/VRF/tenant/security-zone/AZ)。これらは**直交**(1ラックに複数VLAN、1VLANが複数ラック)。
- 破綻: 標準subgraph/コンテナは**単一所属の入れ子**のみ。交差する集合を表現不能。compound-graphは1ノードを2矩形に同時に入れられない。
- 含意: グルーピングは**set membership(多重ラベル)**、選択1軸を矩形包含に投影、他軸は色/ハッチ/overlay。

## 5. 規模・密度
| クラス | ノード数 | 密度 | 支配パターン |
|---|---|---|---|
| Enterprise/campus | 数十〜数百(端末込み数百〜数千) | スパース、平均次数低 | 3-tier, dual-homing, STP/MLAG |
| Data center/fabric | leaf+spine数十〜数百(サーバ込み数千〜数万、AI fabricは10万超) | **密**: spine-leafは|E|=leaf×spine | spine-leaf/fat-tree/Clos, ECMP |
| ISP/WAN | コアPoP数十〜数百(AS全体数百〜数千) | コア密(mesh)・エッジ疎、地理制約強 | mesh core + ring + hub&spoke混成 |
- 含意: enterprise/ISPエッジ |E|≈O(|V|)(疎、平面近) → 力学/階層が効く。DC fabric 局所 |E|=O(|V|²) → 交差最小化が支配コスト、**規則的格子配置が必須**。

## 汎用グラフ描画の前提を壊す10点
1. 「親は一意」が偽(dual-homing)。2. 「閉路はノイズ」が偽(redundancy/ring/mesh=可用性)。3. 「多重辺は別経路」が偽(LAG=N物理/1論理)。4. 「ランクは辺から計算」が偽(tier=role先験)。5. 「辺は隣接層間のみ」が偽(peer/skip辺)。6. 「重要度∝degree」が偽(betweenness的)。7. 「最短経路は一意」が偽(ECMP)。8. 「グルーピングは単一所属の入れ子」が偽(物理∧論理直交)。9. 「完全二部の交差は乱れ」が偽(規則性=読みどころ)。10. 「密度は一様に疎」が偽(fabric局所O(|V|²))。

## 設計含意(要約)
- tier=role/betweenness由来。多重辺は論理リンクへ畳む/展開の抽象度を一級に。完全二部/ring/meshは専用配置で規則性保存。冗長対の対称性を明示。グルーピングは多重ラベル(1軸を包含投影、他軸overlay)。層内/skip辺を一級市民に。

## Sources
- spine-leaf/Clos: https://www.networkershome.com/fundamentals/data-center/spine-leaf-architecture-modern-data-center/ / https://ipwithease.com/clos-architecture/ / https://blog.ipspace.net/2018/10/leaf-and-spine-fabric-myths-part-1/
- betweenness vs degree: https://www.sciencedirect.com/topics/computer-science/betweenness-centrality / https://visiblenetworklabs.com/2021/04/16/understanding-network-centrality/
- scale: https://cloud.google.com/blog/products/networking/introducing-virgo-megascale-data-center-fabric / https://engineering.fb.com/2025/10/20/data-center-engineering/disaggregated-scheduled-fabric-scaling-metas-ai-journey/ / https://www.cisco.com/c/en/us/products/collateral/switches/nexus-9000-series-switches/white-paper-c11-743245.html

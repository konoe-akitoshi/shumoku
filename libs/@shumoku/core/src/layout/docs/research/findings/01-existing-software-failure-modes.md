# ネットワーク監視・トポロジ製品のレイアウト内部と密ネットワークでの破綻モード

調査目的: 新規ネットワークトポロジ自動レイアウトアルゴリズム(論文化を意図)のため、既存の監視/トポロジ製品が **実際に** どのレイアウトエンジンを使い、**密で冗長な複合ネットワーク**(spine-leaf、dual-homed access、MLAG、多数の高帯域リンク)で **どう破綻するか** を、マーケティング文言ではなく一次情報(docs/ソース/issue/フォーラム)から特定する。

各製品について: (1) 実際のレイアウトエンジン、(2) 密度・冗長性の扱い、(3) レイアウトで解かずに対話操作へ逃がすもの、(4) 文書化された破綻・苦情。

---

## 1. LibreNMS — Network Map / Dependency Map

**(1) エンジン**: `vis.js` / `vis-network` の力学(force-directed)シミュレーション。ソルバは設定可能で `barnesHut`(既定)、`forceAtlas2Based`、`repulsion`、`hierarchicalRepulsion`。パラメータは `network_map_vis_options` で `gravitationalConstant` / `springLength` / `springConstant` / `damping` / `avoidOverlap` を露出。要は **vis.js の物理エンジンをそのまま使っているだけ** で、独自レイアウトロジックは持たない。
出典: https://docs.librenms.org/Extensions/VisJS-Config/ , https://docs.librenms.org/Extensions/Network-Map/

**(2) 密度・冗長性**: ここが致命的。LibreNMS は歴史的に **2ノード間の複数リンク(LAG / port-channel / parallel link)を 1本のエッジに潰していた**。原因コードは `print-map.inc.php` の「any two ports / any two devices 間にエッジは1本だけ」を強制する処理。冗長リンクこそネットワーク監視の主役なのに、地図上は単線になり MLAG・dual-homing が **可視化として消える**。修正は PR #10687(louisが提出、Markovが検証)でようやく develop にマージされた程度で、構造的解決ではなくパッチ。
出典: https://community.librenms.org/t/network-map-w-port-channels-or-multiple-links/2467 , https://community.librenms.org/t/network-maps-edge-between-same-nodes-overlap/4973

**(3) 対話へ逃がすもの**: 個別ノードの座標固定すら設定だけでは難しく、コード改変が必要というフォーラム回答。レイアウト品質はユーザーが物理パラメータを手で調整して「ばらける」ようにするしかない。
出典: https://community.librenms.org/t/trying-to-fix-some-nodes-in-the-dependency-map/13892

**(4) 破綻・苦情**:
- `"physics": false` を edges に設定すると **地図全体が壊れる**(コンソールエラー)。静的配置に切り替える正規の逃げ道が機能しない。出典: https://github.com/librenms/librenms/issues/12972
- コミュニティでは「機能は素晴らしいが自動生成マップは実用にならない」という声。ノード数が増えると物理シミュレーションが収束せず hairball 化・性能劣化。

---

## 2. NetBox topology-views プラグイン

**(1) エンジン**: 描画は `vis.js`(vis-network)。READMEは「physics engine で座標を計算」とだけ書き、**どのソルバか・どんなオプションかは一切明記していない**(vis.js の既定に丸投げ)。

**(2) 密度・冗長性**: parallel link / LAG / 密トポロジの扱いは **ドキュメントに記載なし**。設計として対応していない。vis-network 自体が同一ノード対の複数エッジを綺麗に描けない(下記7参照)ため、ここも単線/重なりになる。

**(3) 対話へ逃がすもの**: 完全に手動配置へ依存。アイコンをドラッグすると **その座標が保存され、以後その1ノードは物理計算から除外**される。「Coordinate Groups」で同一トポロジに対し複数の手描きレイアウトを保存可能 = **自動レイアウトを諦め、人間が並べた結果をDBに焼く**設計。フィルタ(name/site/tag/role)、draw.io XML/PNG エクスポートも「整形は外でやれ」という逃がし。
出典: https://github.com/netbox-community/netbox-topology-views , https://pypi.org/project/netbox-topology-views/

**(4) 破綻**: 初期配置が物理任せのため、ケーブル本数が増えると最初の絵がぐちゃぐちゃで、結局 **全ノードを手で並べ直す** のが既定運用。これがプラグインの実態(coordinate group 機能の存在自体が自動レイアウト不信の証拠)。

---

## 3. Observium — Network Map

**(1) エンジン**: サーバ側で `graphviz` を使用。`dot`(階層レイアウト)が必須インストール、用途により `fdp`(Fruchterman-Reingold ベースの spring + マルチグリッドソルバ)も。ブラウザ描画系の派生ツールは Viz.js(graphviz の WASM 版)で SVG 化。要は **graphviz の汎用レイアウトに依存**、ネットワーク固有の最適化はしていない。
出典: https://lists.observium.org/hyperkitty/list/observium@lists.observium.org/ , https://graphviz.org/docs/layouts/fdp/

**(2) 密度・冗長性**: graphviz `dot` は DAG 前提の Sugiyama 系。冗長ループ・並列リンクの多い実ネットワークは DAG ではないため、`dot` は無理にランク付けして **不自然な階層** を作るか、`fdp`/`neato` の spring で hairball になる。LAG 束ねの概念はなし。

**(3) 対話へ逃がすもの**: ポート単位の「Map」サブタブで1ホップ近傍だけ表示 = **全体図を諦め、局所ビューに退避**。全体マップは weathermap(手動座標定義の .conf)に丸投げで、weathermap 自体「インフラ回線の利用率表示には有用だがアドホック/キャンパス網には不向き」とコミュニティが明言。

---

## 4. NetXMS — Network Map

**(1) エンジン**: 自前で6種の自動レイアウトを実装(または同等):Spring(力学)、Radial、Horizontal tree、Vertical tree、Sparse vertical tree、Manual(カスタムマップ既定)。
出典: https://www.netxms.org/documentation/adminguide/visualisation.html

**(2) 密度・冗長性**: 密トポロジ専用の処理はない。tree 系は冗長リンク(複数親)を表現できず、spring は密だと崩れる。

**(3) 対話へ逃がすもの**: 自動レイアウトは更新ごとに再計算され座標が安定しない(incremental stability なし)ため、本番は Manual 配置を保存して使う運用。**密対策の公式アドバイスが「キャンバスを大きくして広げろ」**=レイアウトではなくスペースで誤魔化す。

**(4) 破綻**: 自動レイアウトはリフレッシュごとに位置が動く(揺れる)ため、人間が認知地図を維持できない。

---

## 5. Nmap / Zenmap — RadialNet(radial topology)

**(1) エンジン**: João Paulo S. Medeiros の RadialNet を移植。中心ホストから **放射状(radial)**。ネットワーク距離(hop 数)を **同心円リング** で表現(1リング=1ホップ)。
出典: https://nmap.org/book/zenmap-topology.html , https://github.com/nmap/nmap/tree/master/zenmap/radialnet

**(2) 密度・冗長性**: 2モード。
- *Symmetric*: 各サブツリーに等角度を割当 → 階層は明確だが遠方ノードが角度的に潰れる。
- *Weighted*: 子の多いホストに広い角度。
リンク太さ=RTT、色=主経路(青)/代替経路(橙)。**冗長経路は橙線として描けるが、リング+角度モデルなので spine-leaf のような「同距離・多対多」メッシュは角度競合で破綻**。

**(3) 対話へ逃がすもの**: fisheye(選択リング間隔を拡大)で局所的に潰れを緩和=レイアウトではなく歪曲ズームで逃がす。

**(4) 破綻**: **traceroute データが無いとパスが描けず**、ホストが中心周辺に黒破線でダンゴになる。tree/radial 前提なので一般グラフ(ループ・冗長)は本質的に表現外。

---

## 6. その他(一次情報が層として薄い製品)

**Kentik Map**: spine-leaf に対しては **leaf=下段 / spine=上段の段組み(tiered)グラフ**を自動生成 — 調査対象中、唯一 spine-leaf を意図した階層レイアウトを謳う。ただし汎用の **Logical Map は star(ルータ)/ point-to-point(ホスト)** ベースで、site は半透明矩形、最終配置は **手動ドラッグ+保存**。階層的自動グルーピングや spine-leaf 段組みの記述は logical map 側には無い。
出典: https://kb.kentik.com/docs/logical-map , https://www.kentik.com/blog/identifying-idle-paths-in-a-data-center-leaf-spine-fabric/

**MikroTik The Dude**: 「Layout」ボタンで自動整列、discovery 後は **デバイスを順次の行(sequential rows)に並べてから logical layout を試みる**。基本は手動ドラッグ + Line/Arc 整列ツール + Lock。自動再 discovery でマップが reset される苦情あり(incremental 非対応)。
出典: https://wiki.mikrotik.com/Manual:The_Dude_v6/Device_map , https://forum.mikrotik.com/viewtopic.php?t=108620

**SolarWinds Network Atlas / NTM**: 既製レイアウト(circular / symmetrical / hierarchical / tree / orthogonal)から選ぶ方式 = **汎用グラフ描画ライブラリの定番アルゴリズム選択メニュー**。ネットワーク意味論(LAG, 冗長, 段組み)を理解した最適化ではなく、形のテンプレを当てるだけ。
出典: https://documentation.solarwinds.com/en/success_center/orionplatform/content/core-selecting-automatic-layout-styles-sw3521.htm , https://documentation.solarwinds.com/en/success_center/orionplatform/content/core-advanced-map-layouts-sw3359.htm

**Auvik**: 自動 L1/L2/L3 ディスカバリ(CDP/LLDP/forwarding/ARP)は強いが、**レイアウトアルゴリズムの中身は非公開**。マーケ文言のみで一次的なエンジン記述は得られず(=ブラックボックス、これ自体が「公開可能な新規性が無い」ことの傍証)。

**NetBrain Dynamic Map / Cisco Catalyst Center / Forward Networks**: いずれも **レイアウトエンジンの技術詳細は非公開**。NetBrain は「マップを好きにレイヤ化できる」=手動編集前提。Catalyst Center はコミュニティ報告がリンク情報誤り等で、レイアウト品質より正確性が論点。Forward Networks は L3/L2 ビューを持つが auto-layout の内部アルゴリズムを公開していない。**主要商用製品が軒並みレイアウト内部を公開していない = 確立された解が無い領域**。

---

## 7. 共通の構造的弱点(横断観察)

- **エンジンの出自が2系統に収束**: ①汎用 JS 力学(vis-network: LibreNMS, NetBox)②graphviz/古典アルゴリズム(Observium, SolarWinds, NetXMS の tree)。**どちらもネットワーク意味論を知らない汎用グラフ描画**。
- **vis-network 自体が parallel edge を綺麗に描けない**: 同一ノード対の複数エッジが重なる既知 issue 群(visjs/vis-network #1248, #1546, visjs/vis #1957, #3349)。LAG/冗長を持つネットワークの描画基盤として根本的に不適。
出典: https://github.com/visjs/vis-network/issues/1248 , https://github.com/visjs/vis/issues/1957
- **密対策が「対話操作」か「諦めて手動」**: フィルタ、expand/collapse、局所ビュー、fisheye、手動ドラッグ+座標保存。**レイアウトそのものを賢くする方向の解は誰も持っていない**。
- **incremental stability の欠如**: 自動レイアウトはリフレッシュ毎に位置が動く(NetXMS, The Dude reset)。人間の認知地図が維持できない。

---

## ネットワーク監視製品が解けていないこと

調査した全製品を横断して、**どれも十分に解けていない**レイアウト問題(=研究のギャップ)を具体に列挙する。

1. **Spine-leaf 対称性の表現**
   leaf 群と spine 群は「等距離・全対全に近いメッシュ」。力学レイアウトはこれを hairball にし、tree/Sugiyama は無理に1つを上位ランク化して偽の階層を作る。Kentik だけが段組みを謳うが、汎用 logical map では未解決。**対称ファブリックを対称に、かつ交差最小で描く専用解が存在しない。**

2. **LAG / parallel link / 冗長リンクの束ね(bundling)**
   ほぼ全製品が複数リンクを1本に潰す(LibreNMS は print-map.inc.php で明示的に潰していた)か、重ねて潰れる(vis-network)。**「N本の物理リンクを1本の太い論理エッジに束ね、本数・帯域・冗長度を保持したまま読みやすく描く」レイアウトプリミティブが誰にも無い。** dual-homing / MLAG が地図上で消える。

3. **冗長経路の可読性(redundant-path readability)**
   ループ・代替経路を持つ一般グラフを、冗長性を「見える美点」として描く手法が無い。radial/tree は冗長を表現外、力学は冗長を hairball の原因にする。

4. **安定した incremental layout(stable incremental layout)**
   ディスカバリ更新やノード増減のたびに座標が大きく動き、人間の認知地図が壊れる。「前回の配置を最大限保ちつつ差分だけ動かす」安定レイアウトを実装している製品が(手動座標保存を除いて)無い。

5. **複合・多階層トポロジの同時可読性(composite multi-tier readability)**
   core / aggregation / access / DC fabric / WAN / cloud が混在する実網を、**各部分構造に適したレイアウト(段組み・メッシュ・スター・リング)を局所適用しつつ全体を1枚にまとめる**手法が無い。各製品は全体に単一アルゴリズムを当てるため、どこかが必ず崩れる。

6. **意味論駆動のレイアウト(semantics-driven layout)**
   役割(spine/leaf/core/edge)、帯域、冗長度、サイト境界といったネットワーク意味論を **レイアウトの制約として一級に扱う**エンジンが存在しない。既存は汎用グラフ描画に意味論を後付けする(色/太さ)だけ。

7. **「自動レイアウトを信用しない」が業界の前提になっている**
   NetBox の coordinate groups、The Dude の手動整列、NetXMS の Manual 既定、商用各社のレイアウト内部非公開 — **業界全体が「最後は人間が手で並べる」ことを暗黙の前提にしている**。これは自動レイアウトが密・冗長・複合ネットワークで実用品質に達していないことの最も強い傍証であり、本研究の存在意義そのもの。

---

### 出典一覧(主要)
- LibreNMS VisJS Config: https://docs.librenms.org/Extensions/VisJS-Config/
- LibreNMS Network Map: https://docs.librenms.org/Extensions/Network-Map/
- LibreNMS 複数リンク潰し(port-channel): https://community.librenms.org/t/network-map-w-port-channels-or-multiple-links/2467
- LibreNMS edge overlap: https://community.librenms.org/t/network-maps-edge-between-same-nodes-overlap/4973
- LibreNMS physics:false 破綻 #12972: https://github.com/librenms/librenms/issues/12972
- NetBox topology-views: https://github.com/netbox-community/netbox-topology-views
- NetXMS visualisation: https://www.netxms.org/documentation/adminguide/visualisation.html
- Zenmap/RadialNet: https://nmap.org/book/zenmap-topology.html , https://github.com/nmap/nmap/tree/master/zenmap/radialnet
- Observium maps(graphviz)/weathermap: https://lists.observium.org/hyperkitty/ , https://graphviz.org/docs/layouts/fdp/
- Kentik Logical Map: https://kb.kentik.com/docs/logical-map
- Kentik spine-leaf: https://www.kentik.com/blog/identifying-idle-paths-in-a-data-center-leaf-spine-fabric/
- The Dude Device map: https://wiki.mikrotik.com/Manual:The_Dude_v6/Device_map
- SolarWinds layout styles: https://documentation.solarwinds.com/en/success_center/orionplatform/content/core-selecting-automatic-layout-styles-sw3521.htm
- vis-network parallel edge overlap: https://github.com/visjs/vis-network/issues/1248 , https://github.com/visjs/vis/issues/1957

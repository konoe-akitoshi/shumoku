# Auto-Layout / Auto-Routing 先行事例カタログ（下調べ）

調べた配置/配線アルゴリズム・ライブラリの事実カタログ。増やしていく前提の台帳。

---

## 調査一覧

| 名前 | 分野 | 配置/配線 | コアアルゴリズム | 解く制約 | 提供形態 | スケール目安 |
|---|---|---|---|---|---|---|
| ELK (elkjs) | グラフ可視化 | 配置+配線 | Sugiyama層化（サイクル除去→層割当→交差最小→座標→配線）, Brandes-Köpf | 階層維持・交差最小・compound・port配線 | GWT→JS, Web Worker標準 | 10〜1,000 |
| WebCola (Cola.js) | グラフ可視化 | 配置 | 力学モデル + VPSC（分離制約付き変数配置＝二次計画法） | 非重なり・整列・境界ボックス包含 | JS | 10〜500 |
| Libavoid (libavoid-js) | グラフ可視化 | 配線 | 直交可視性グラフ + A\* + ナッジング(line-sweep+VPSC近似) | 障害物完全回避・直交・bend最小・平行分離 | WASM (Emscripten) | 数十〜数百エッジ |
| maxGraph | グラフ可視化 | 配置+配線 | マンハッタン配線, 階層, 力学モデル | 汎用フローチャート/BPMN | JS | 数十〜数千 |
| yFiles / JointJS+ | グラフ可視化（商用） | 配置+配線 | Hierarchic(Sugiyama変種), Organic(力学), Orthogonal, Circular, Tree, ループ検出, edge label | 商用品質ネットワーク図 | JS（有償） | 数千〜数万 |
| Cassowary | UIレイアウト | 配置 | 双対シンプレックス法（増分・タブロー部分更新） | 線形等式/不等式・強度(Req/Strong/Weak)・過剰拘束 | JS (cassowary.js) | 数十〜数百 |
| Yoga Layout | UIレイアウト | 配置 | Flexboxヒューリスティクス, ツリー走査 | 高速寸法計算（厳密解でない） | C/WASM/JS | 数百〜数千 |
| Freerouting | EDA/PCB | 配線 | グリッドレスA\*, Rip-up & Reroute, Shove | 物理クリアランス・高密度・非交差 | Java | 数千〜数万ネット |
| tscircuit/autorouting | EDA/PCB | 配線 | グリッドレスA\* + Rip-up & Reroute（連続平面・任意角） | 100%完全非交差（絶対ハード） | TS | 100〜10,000+ |
| Altium Designer | EDA/PCB（商用） | 配線 | インタラクティブ, Walkaround/Push/Hug | リアルタイムDRC | デスクトップ | 設計者主導 |
| Conflict-Based Search (CBS) | ロボティクス(MAPF) | 配線（動的） | 制約木(CT)探索 + 時空間A\* | 時空間衝突回避 | アルゴリズム | 50〜数百エージェント |
| FLP (QAP/MILP) | 施設配置 | 配置 | 混合整数線形計画(MILP), 遺伝的アルゴリズム | 距離×物流量の最小化（NP困難） | ソルバ依存 | 10〜100部門 |
| Dagre / dagrejs | グラフ可視化 | 配置+簡易配線 | Sugiyama層化, cycle removal, network simplex rank割当, crossing min, Brandes-Köpf | DAG/フローチャート階層維持・交差低減・ノード間隔 | JS / TS派生 / Rust移植 | 10〜1,000 |
| Graphviz / dot | グラフ可視化 | 配置+配線 | dot:階層, neato/fdp/sfdp:力学系, spline/orthogonal風エッジ | DOT記述から静的図生成・クラスタ・rank・ラベル | CLI / Cライブラリ / ラッパ | 数十〜数万 |
| OGDF | グラフ可視化・研究基盤 | 配置+配線 | Sugiyama, 力学系, planarization, orthogonal, tree/circular | 平面化・直交描画・階層・大規模比較 | C++ライブラリ | 数百〜数万 |
| MSAGL | グラフ可視化 | 配置+配線 | Sugiyama系階層, MDS, incremental, spline/rectilinear routing | .NET系ネットワーク図・依存図・ラベル/クラスタ | .NET / C# | 数百〜数千 |
| GoJS Layouts | 商用グラフ/diagram UI | 配置+配線 | LayeredDigraph, Tree, ForceDirected, Circular | 対話的diagram・リンクルーティング・レイヤード/ツリー | JS（商用） | 数十〜数千 |
| d3-dag | グラフ可視化 | 配置 | DAG向けlayered, 複数のlayering/decross/coord戦略 | 軽量DAG配置・座標戦略の差し替え | TypeScript / D3系 | 10〜1,000 |
| Mermaid layout engines | テキスト図 | 配置+配線 | dagre, ELK, tidy-tree, cose-bilkent | Markdown/DSLから自動配置 | JS / Mermaid | 数十〜数百 |
| TikZ Graph Drawing | 論文・TeX図 | 配置 | Sugiyama, force-based, tree/circular（Lua実装） | 論文用の再現可能配置・LaTeX統合 | TeX / Lua | 数十〜数百 |
| Sprotty + ELK | モデル駆動diagram | 配置+配線 | SModel→ELK graph変換, ELK layered委譲 | DSL/IDE上のモデル図・port/label/compound | TypeScript / Eclipse系 | 数十〜数千 |
| Cytoscape.js + cose-bilkent | ネットワーク可視化 | 配置 | CoSE/compound spring embedder, 力学モデル | biological/social network・compound node・探索 | JS | 数百〜数万 |
| OpenROAD RePlAce/gpl | EDA/ASIC | 配置 | 解析的非線形配置, electrostatic force, Nesterov法 | 標準セル配置・密度制約・wirelength/routability | C++ / OpenROAD | 数万〜数百万セル |
| DREAMPlace | EDA/ASIC | 配置 | RePlAce/ePlace系解析的配置をPyTorch/GPU最適化 | 大規模VLSI placement・GPU高速化・HPWL/density | Python/CUDA/PyTorch | 数十万〜数百万セル |
| VPR / VTR | EDA/FPGA | 配置+配線 | Simulated Annealing配置, PathFinder系negotiated congestion routing | FPGA packing/place/route・チャネル幅・timing | C++ / OSS CAD flow | 数千〜数十万LUT |
| OpenPARF | EDA/FPGA | 配置+配線 | GPU/PyTorch, multi-electrostatic配置, irregular routing資源グラフ | 大規模ヘテロFPGA・CLB内部配線資源・routed wirelength | Python/C++/CUDA | 大規模FPGA |
| ALIGN | EDA/Analog IC | 配置+配線 | 階層検出, parameterized cell生成, 制約付きブロックアセンブリ | SPICE netlist→GDSII・対称性・マッチング・DRC | OSS flow | 小〜中規模アナログ |
| KiCad Push-and-Shove Router | EDA/PCB | 配線 | interactive push/shove, walkaround, DRC連動 | 手動主導配線・既存配線を押しのける・クリアランス | Desktop OSS | 設計者主導 |
| Android ConstraintLayout | UIレイアウト | 配置 | 制約グラフ + 線形ソルバ, chains/guidelines/barriers | フラット階層配置・親子/兄弟制約・比率・bias | Android View / Compose | 数十〜数百View |
| Kiwi / kiwisolver | UIレイアウト | 配置 | Cassowary系incremental linear constraint solverの高速C++実装 | 線形等式/不等式・強度付き制約・UI配置 | C++ / Python / TS派生 | 数十〜数百制約 |
| OR-Tools CP-SAT | 汎用最適化 | 配置 | CP-SAT, interval variable, NoOverlap/NoOverlap2D, branch-and-bound | 矩形packing・スケジューリング・離散配置・非重なり | Python/C++/Java/C# | 10〜数千変数 |
| VivaGraphJS | グラフ可視化 | 配置 | Force-Directed（カスタム可）+ 複数レンダラ | 動的インタラクティブ描画・拡張性 | JS (WebGL/SVG/CSS) | 数百〜数千 |
| Arbor.js / Springy | グラフ可視化 | 配置 | Force-Directed (Spring Embedder変種) + Web Worker | 軽量力学シミュレーション | JS (Web Worker) | 小〜中規模（数百） |
| SetCoLa (+ WebCola) | グラフ可視化 | 配置 | 高レベル制約DSL → WebCola低レベル制約へコンパイル | セット/グループ制約（alignment, flow, relative positioning） | JS/TS (WebCola上) | 中規模 |
| ORCSolver | UIレイアウト | 配置 | Branch-and-Bound + ヒューリスティック前処理（OR-Constraints） | 適応的GUI（OR制約で柔軟フロー+制約混在） | 研究実装 (C++/JS派生) | 数十〜数百要素 |
| QRouter | EDA/ASIC | 配線 | Lee Maze Routing（グリッドベース） | LEF/DEF対応・基本配線 | C++/OSS | 中規模VLSI |
| Spectral Layout | グラフ可視化 | 配置 | グラフラプラシアンの固有ベクトル | 大域構造の初期配置（force-directedの種） | 各種ライブラリ | 数百〜数万 |
| d3-force | グラフ可視化 | 配置 | Force-Directed (Velocity Verlet積分, charge/link/gravity/collision) | 非重なり(collision)・リンク距離・吸引/反発 | JS (D3.jsモジュール) | 数十〜数千 |
| Sigma.js (+ graphology) | グラフ可視化 | 配置 | ForceAtlas2, 他力学/カスタム | 大規模描画・インタラクティブ・WebGL | JS (WebGL/Canvas) | 数千〜数万エッジ |
| mxGraph / draw.io | グラフ可視化 | 配置+配線 | Hierarchical/Organic/Circular, コンテナレイアウト | フローチャート・自動整列・コンテナ | JS (Apache 2.0) | 数百〜数千 |
| JointJS / JointJS+ | グラフ可視化（OSS+商用） | 配置+配線 | 各種レイアウト(Hierarchical等), リンクルーティング | インタラクティブdiagram・BPMN・カスタム | JS (OSSコア + 有償+) | 数百〜数千 |
| Ogma | グラフ可視化（商用） | 配置 | Force-Directed/WebGL + 多様なレイアウト | 大規模・Geo・グループ・高性能 | JS（商用） | 数万〜数十万 |
| KeyLines | グラフ可視化（商用） | 配置+配線 | Canvas/WebGL + 複数レイアウト | エンタープライズ規模・フィルタ・スタイル | JS（商用） | 大規模（企業向け） |
| Tom Sawyer Perspectives | グラフ可視化（エンタープライズ） | 配置+分析 | 5種先進レイアウト（階層/有機/直交等） | 複雑データ統合・分析・大規模 | 商用SDK | 数万〜数十万 |
| OrthoRoute | EDA/PCB | 配線 | GPU加速 Manhattan + PathFinder | 高密度・直交・KiCadプラグイン | KiCadプラグイン | 中規模（数千ネット） |
| PureLayout | UIレイアウト (iOS/macOS) | 配置 | Cassowary風制約APIの簡易化 | 線形制約・優先度・View階層 | Objective-C/Swift | 数十〜数百View |
| Nulab autog | グラフ可視化 / 業務図 | 配置 | 階層グラフ自動配置, DAG向けレイヤリング | 業務フロー/依存図の階層配置 | Go OSS | 10〜数百 |
| bpmn-auto-layout | BPMN / 業務プロセス | 配置+配線 | BPMN要素のDI生成, フローベース自動配置 | BPMN XMLに図形座標/エッジ経路を付与 | JS OSS (Node/Browser) | 数十〜数百要素 |
| bpmn-moddle-auto-layout | BPMN / 業務プロセス | 配置+配線 | BPMN moddle上でDIなしプロセスにlayout生成 | BPMNプロセスの図形表現補完 | npm / MIT | 小〜中規模 |
| Rete Auto Arrange Plugin | ノードエディタ | 配置 | elkjs委譲, port/node情報付き自動配置 | ノードUIの初期整列・ポート位置考慮 | TS/JS OSS plugin | 数十〜数百 |
| jsPlumb Toolkit | 業務diagram UI | 配置+配線 | endpoint/connector/router, Toolkit側layout群 | Web業務アプリの接続線・フロー・ワークフロー | JS/TS 商用SDK + Community | 数十〜数千 |
| LiteGraph.js | ノードエディタ / AI workflow | 配置+編集 | Canvas2Dノードグラフ, 手動中心+簡易整列 | ComfyUI系ワークフロー・Blueprint風接続 | JS OSS (Canvas) | 数十〜数百 |
| QGIS PAL / Labeling | GIS / 地図 | 配置 | label candidate生成 + collision avoidance + 優先度探索 | 地図ラベル重なり回避・地物優先度・可読性 | QGIS OSS | 数百〜数万ラベル |
| Mapbox / MapLibre Symbol Placement | GIS / Web地図 | 配置 | collision detection, variable label placement, tile/global collision | ズーム中のラベル衝突回避・密度・タイル境界 | JS/Native SDK | 数千〜数万シンボル |
| polylabel | GIS / 地図ラベル | 配置 | pole of inaccessibility, グリッド探索/priority queue | ポリゴン内部の最適ラベル点（最大内接的代表点） | JS OSS (Mapbox系) | 数百〜数万ポリゴン |
| SVGnest | CNC / レーザー加工 | 配置 | irregular bin packing, concave area detection, part-in-part | 材料歩留まり・非重なり・回転・凹形状利用 | Web OSS | 数十〜数百部品 |
| Deepnest | CNC / 板取り | 配置 | no-fit polygon系ネスティング, 遺伝的/ヒューリスティック | レーザー/プラズマ/CNC板取り・材料削減 | Desktop OSS | 数十〜数百部品 |
| sparrow | 2D Nesting研究 / 製造 | 配置 | irregular strip packing, feasibility問題列, 衝突逐次解消 | 不規則形状のストリップパッキング・再現可能ベンチ | OSS研究実装 | ベンチ〜実務 |
| Automatic Warehouse Layout Generation | 倉庫 / 物流 | 配置 | constrained beam search, feasibility check, scoring | 通路接続・最小クリアランス・保管位置数・アクセスコスト | 研究/業務 | 倉庫区画単位 |
| Intelligent Warehouse Layout Evolution | 倉庫 / AMR物流 | 配置 | two-layer evolutionary algorithm, fitness approximation | AMR前提の倉庫レイアウト・搬送効率 | アルゴリズム/研究 | 中〜大規模倉庫 |
| PlantStream | プラント設計 | 配線 | 3D空間配管自動ルーティング, 設計知識のアルゴリズム化 | 配管ラック・レイヤ割当・配管径/流体/接続先・工程 | 商用SaaS (Windows系) | 数百〜数千配管 |
| Paneldes Raceway / Cable Routing | 産業電気CAD | 配線 | cable route optimization, tray/raceway graph探索, fill計算 | ケーブルトレイ・電力分離・充填率・干渉・waypoint/lock | 商用CAD | 数百〜数万ケーブル |
| MagiCAD Automatic Cable Packet Routing | 建築設備 / MEP | 配線 | 既存ケーブルトレイ上のstart-end route生成 | Revit/MEP上のケーブル束・既設tray追従 | 商用BIM add-on | 設備モデル依存 |
| SchemCABLING | 産業電気 / 制御盤 | 配線 | cable management, cable tray layout生成 | 電気設備のケーブル管理・トレイ設計・帳票化 | 商用CAD | 工場/設備単位 |
| Automatic Cable Routing via NAVIS 3D | 産業電気 / 船舶・プラント | 配線 | Dijkstra系最短経路, 3D CAD座標抽出, Excel出力 | ダクト/トレイ経路・検証・導体長算出 | Python研究/業務補助 | プロジェクト単位 |
| Automatic Pipe Routing Survey系 | プラント / 船舶 / 建築設備 | 配線 | A\*/Dijkstra, GA, PSO, RL, multi-objective | 3D障害物回避・曲げ数・長さ・保守性・勾配・安全離隔 | アルゴリズム群 | 小規模配管〜プラント |
| Shape-Guided Metro Map Layout | 交通図 / 情報可視化 | 配置+配線 | route selection, shape/layout deformation, grid alignment | 路線図の模式化・45/90度整列・形状誘導・可読性 | 研究アルゴリズム | 都市路線網 |
| HOLA | グラフ可視化 / 手描き風直交図 | 配置+配線 | human-like orthogonal layout, 直交ネットワーク描画 | 手作業に近い直交図・少交差・少曲げ | 研究実装 | 小〜中規模 |
| Orthogonal Drawing Pipeline | グラフ可視化 / UML・ケーブル図 | 配置+配線 | 初期配置→重なり除去→edge routing→ordering→LP nudging | UML/ケーブル図の直交描画・bend/crossing/area低減 | 研究アルゴリズム | 小〜中規模 |
| Wave Function Collapse | ゲーム / PCG / タイル配置 | 配置 | constraint propagation, entropy最小セル選択, backtracking変種 | タイル隣接制約・局所パターン維持・マップ生成 | 多言語OSS実装 | グリッド数百〜数万セル |
| Dungeon Two-Step Generation | ゲーム / レベル設計 | 配置 | layout creator + furnisher, constructive generation | 部屋/通路構造生成・開始/ゴール/敵/報酬配置 | 研究アルゴリズム | 1レベル単位 |
| Planogram AI / Shelf Optimization | 小売 / 棚割 | 配置 | sales/demand予測 + rule-based/AI layout生成 | 棚面・フェイス数・在庫・売上・視認性・店舗別制約 | 商用SaaS中心 | 店舗×カテゴリ単位 |
| HyLiMo | 論文図 / IDE diagram | 配置+手動調整 | DSL生成 + graphical editor同期, layout/styleをDSLへ保存 | 自動配置と手動微調整の両立・UML/技術図 | Web app / IDE拡張研究 | 小〜中規模 |
| DiagrammerGPT | AI diagram生成 | 配置+配線 | LLM diagram plan生成→監査→generator→label rendering | 多物体・矢印・ラベルを持つ図の構造制御 | 研究フレームワーク | 図1枚単位 |
| Generative Layout Modeling | 汎用レイアウト生成 | 配置 | transformerでlayout graph生成→constraint optimization | 要素生成・制約生成・条件付きレイアウト | 研究モデル | 画面/ポスター/家具配置 |
| LiveNX / LiveAction | ネットワーク運用監視 / NPM | 配置+論理配線 | SNMP/Flow/IPFIX/NetFlow/sFlow/API telemetry相関, トポロジ上に性能overlay | 物理/論理可視化・アプリ/フロー/IF/障害箇所の把握 | 商用NPM platform | 中〜大規模Enterprise |
| NetBrain | ネットワーク自動化 / 自動ドキュメント | 配置+論理配線 | Dynamic Map, discovery, CLI/SNMP/APIから構成抽出, intent/diagnosis連携 | L2/L3 topology・経路・依存関係・runbook/診断連携 | 商用platform | 大規模Enterprise |
| Zabbix Maps | 監視 / 可視化 | 配置+リンク表示 | 手動/半自動マップ, host/group/trigger/image/map要素, link状態表示 | 監視対象の状態可視化・障害俯瞰・NOC画面 | OSS本体機能 | 小〜中規模（手動前提） |
| zabbix-map-creator | Zabbix周辺OSS / L2 topology | 配置+論理配線 | LLDP/CDP/SNMPからL2接続を推定しZabbix map生成 | Zabbix上にL2トポロジーを自動作成 | OSS scripts | 小〜中規模 |
| netTerrain + Zabbix collector | DCIM / ネットワーク図面 | 配置+配線 | Zabbix API/collector連携, physical/logical diagram生成 | 監視データを物理/論理図へ変換・資産/接続管理 | 商用DCIM/diagram | 中〜大規模 |
| SolarWinds Network Topology Mapper | ネットワーク自動マップ | 配置+論理配線 | SNMP/ICMP/CDP/WMI/VMware/Hyper-V discovery → topology図生成 | 自動探索・図生成・状態変化追従 | 商用desktop/tool | 中〜大規模 |
| Auvik / Domotz / ManageEngine OpManager | ネットワーク監視 / MSP | 配置+論理配線 | 自動discovery, SNMP/LLDP/CDP, grouping/subgrouping | 拠点/部門/フロア別の自動マップ・監視状態overlay | 商用SaaS/監視製品 | SMB〜Enterprise |
| PRTG (Paessler) | ネットワーク監視 | 配置+論理配線 | 自動discovery(SNMP/ping/sFlow), Map Designer | センサーベース監視・カスタムマップ・状態overlay | 商用 | SMB〜中規模 |
| Netdisco | ネットワーク資産 / L2探索 | 配置 | SNMP/CDP/LLDP discovery, MAC/ARP収集, デバイス隣接推定 | L2接続・ポート/MAC/IPインベントリ・隣接マップ | OSS (Perl) | 中〜大規模 |
| LibreNMS | 監視 / OSS NMS | 配置+論理配線 | 自動discovery(SNMP/LLDP/CDP), Weathermap(リンク利用率) | 自動トポロジ・帯域利用率の重み付き表示 | OSS (PHP) | 小〜大規模 |
| NetworkBrain | ネットワーク可視化/自動化 / 国内商用 | 配置+論理配線 | NetBrain系の国内展開(NTT-AT), 動的マップ, AI/自動診断, path analysis | マップUI運用・ドキュメント・トラブルシュート・設定変更自動化 | NTT-AT商用 | 大規模Enterprise |
| ZABICOM / T-View for Zabbix | Zabbix統合監視 / 国内SI | 配置+論理配線 | Zabbixデータ活用, トポロジー図自動描画, 監視画面ビジュアル化 | Zabbix運用効率化・ネットワーク図管理・現場可視化 | 商用/国内SI | 中〜大規模 |
| NetBox Topology Views | DCIM/IPAM / 図面 | 配置+論理配線 | NetBox内のdevice/cable関係からgraphical topology map生成 | Source-of-truthベースの物理/論理接続図 | NetBox plugin | 小〜大規模（SoT依存） |
| natlas | ネットワーク自動図面 / OSS | 配置+論理配線 | SNMP+CDP+LLDP discovery, Graphviz等でdiagram生成 | L2/L3隣接の自動図化・手作業削減 | Python OSS | 小〜中規模 |
| secure_cartography | ネットワーク自動図面 / OSS | 配置+論理配線 | SSHで構成/隣接取得→topology map生成 | 閉域SSH前提・SNMP依存回避 | Python OSS | 小〜中規模 |
| Network Miner | ネットワーク自動図面 / OSS | 配置+論理配線 | SNMP request, LLDP/CDP/EDP抽出 | スイッチ/ルータ間接続の推定 | OSS | 小規模 |
| The Dude | ネットワーク監視 / 実務ツール | 配置+論理配線 | subnet auto scan, device discovery, map auto layout, service monitoring | MikroTik/小規模NWの自動マップ・死活監視 | MikroTik無料 | 小〜中規模 |
| OpenNMS Topology Map | OSS NMS / 自動トポロジー | 配置+論理配線 | Linkd Topology Provider, LLDP/CDP/L2 link discovery | 監視ノード間L2接続・NMS上map | OSS/商用NMS | 中〜大規模 |
| NagVis | Nagios可視化 / NOC | 配置+リンク表示 | Nagios状態を背景画像/図上へoverlay | 業務/NW状態の一枚絵・NOC監視 | PHP OSS addon | 小〜中規模 |
| PHP Network Weathermap | Cacti/NMS可視化 / レガシーOSS | 配置+リンク表示 | RRD/Cactiの帯域データをSVG/画像mapへ反映 | 回線使用率・混雑・NOC weathermap | PHP OSS / Cacti plugin | 小〜中規模 |
| Grafana Network Weathermap Panel | 監視dashboard / OSS | 配置+リンク表示 | SVG component + Grafana datasource値overlay | 帯域/状態をGrafana図に重ねる | Grafana plugin | 小〜中規模 |
| JDisc Discovery Topology | IT資産管理 / 商用探索 | 配置+論理配線 | LLDP/CDP/MAC forwarding tableからtopology生成 | 混在環境の接続・依存・資産管理 | 商用Discovery | 中〜大規模 |
| Datadog Device Topology Map | NPM / SaaS監視 | 配置+論理配線 | LLDP/CDP devices, SNMP監視deviceと対応付け | 監視済/未監視含むトポロジー可視化 | SaaS | 中〜大規模 |
| LogicMonitor Topology Mapping | NPM / SaaS監視 | 配置+論理配線 | LLDP/CDP/BGP/OSPF/EIGRPからdynamic topology map | データ流・動的依存・障害影響範囲 | SaaS/商用 | 中〜大規模 |
| Scanopy | ネットワーク探索 / 新興OSS | 配置+論理配線 | VLAN scan, host/service discovery, interactive topology生成 | 自己ホスト型ライブNW図・資産発見 | Self-hosted | 小〜中規模 |
| Open-AudIT / NMIS周辺 | IT資産管理 / 監視 | 配置+関係表示 | network discovery, inventory, relationship mapping | 資産台帳・機器関係・監視連携 | OSS/商用混在 | 小〜中規模 |
| Bentley Raceway and Cable Management | プラント/電気設備CAD | 配置+配線 | raceway layout, cable routing, material estimating | ケーブルトレイ・電線管・材料見積・施工 | 商用CAD | 中〜大規模プラント |
| Open BIM Cable Routing | BIM / 電気設備 | 配置+配線 | BIM上のcable routing system modeling, 部材/単線結線連携 | 電気/通信経路・BIM統合・部材情報 | CYPE系BIM | 建物/設備単位 |
| ESApro Cable Trays | プラント電気設計 | 配置+配線 | 3D cable tray modeling, 電気プラント設計支援 | ケーブルトレイ設計・材料/施工情報 | 商用CAD | プラント単位 |
| Industrial Electrical Routing Optimization | 産業機械/電装設計 | 配線 | 2段階最適化（tray内ケーブル配置 + 3D tray routing） | コスト最小化・電力/信号分離・tray選定・3D経路 | 研究/業務候補 | 製品/設備単位 |
| 3D Cable Harness Routing | 自動車/航空/産業機器 | 配線 | 多目的最適化, shared path reward, avoid zones, Pareto候補生成 | ハーネス長・束ね・避ける領域・製造ルール・3D空間 | 研究アルゴリズム | 産業3Dケース |
| Microsoft Workspace Optimizer | オフィス/座席配置 | 配置 | collaboration dataベースseating最適化, Jupyter notebook | 共同作業関係を反映した座席・フロアプラン最適化 | OSS notebooks | オフィス単位 |
| BauPlan | オフィス/座席管理 | 配置+編集 | floor layout上のpeople placement, 手動調整中心 | 組織内座席/所在管理・移動計画 | OSS Web app | オフィス単位 |
| OPENCatman | 小売/棚割 | 配置 | planogram design, space utilization analysis | 棚割・商品配置・売場スペース最適化 | Free+Pro SaaS | 店舗/カテゴリ単位 |
| Quant Planogram | 小売/棚割 | 配置 | template-based自動生成, sales-optimized planogram | 店舗別棚割自動生成・売上最適化・多店舗 | 商用SaaS | 多店舗/大規模 |
| RELEX Planogram Software | 小売/棚割 | 配置 | localized planogram automation, 3D planogram update | 店舗別棚割・カテゴリ更新・手作業削減 | 商用SaaS | 多店舗/大規模 |
| Sweet Home 3D | 住宅/インテリア | 配置+編集 | 2D floor plan + furniture placement + 3D preview | 間取り・家具配置・視覚確認 | OSS desktop/web | 住宅/小規模 |
| Arcada | インテリア/フロアプラン / OSS | 配置+編集 | custom floor plan engine, React + Pixi.js | ブラウザ上の間取り/家具配置・2D編集 | OSS Web app | 小規模 |
| MetroSets | 情報可視化 / セット図 | 配置+配線 | hypergraph→metro map, path-based support, schematization | 集合関係を路線図風に・octolinearity・monotonicity | 研究/オンライン | 小〜中規模集合 |
| OpenMPL | EDA / 製造レイアウト分解 | 配置系前処理 | multiple patterning layout decomposition, graph coloring/最適化 | 半導体マスク分解・conflict最小化・設計閉塞回避 | OSS研究 | VLSIベンチ規模 |
| LAREX | OCR/文書画像 | 配置解析 | rule-based connected components, semi-automatic layout analysis | 古書ページの領域抽出・OCR前処理・手動補正 | OSS tool | 書籍ページ単位 |
| MapReader | 地図画像解析 | 配置解析+抽出 | map patching, annotation, CV model training | 大量歴史地図から地物/鉄道/建物等を抽出 | Python OSS | 数万地図patch |
| EPLAN Harness proD | 電気ワイヤハーネス3D CAD | 配線 | 3Dパス上のピン間最短路探索 + ワイヤ長自動算出 + 手動リルート | 経路長・分岐・曲げ・釘板(nailboard)平坦化・製造帳票 | 商用CAD | 数百〜数千ワイヤ/ハーネス |
| EPLAN Pro Panel | 制御盤3D配線(盤内) | 配置+配線 | 配線ホール経由の最短路 + ダクト充填率制約解消 | ダクト充填率・盤内最短経路・干渉回避・配置 | 商用CAD | 制御盤1面〜数百端子 |
| Zuken E3.series | 制御盤・ハーネス電気CAD | 配置+配線 | ダクト経由最短路 + セグメント径パッキング計算 | ダクト充填限界・束径・ピン間経路・釘板自動配線 | 商用CAD | 制御盤〜中規模ハーネス |
| Zuken Harness Builder | ハーネス製造特化CAD | 配線 | バンドル/セグメント径のパッキング + ルールベース付属品付与 | 束径・保護材/ラベル/テープ・長さ・製造整合 | 商用CAD(E3統合) | 量産ハーネス |
| Siemens Capital | 車両E/E配線統合 | 配置+配線 | ルール駆動の配線オブジェクト自動シンセシス + バンドル経路 + 信号分離検証 | 信号分離・デバイス配置・バンドル経路・設計規則 | 商用CAD(協調設計) | 車両全体(大規模) |
| Siemens VeSys | 自動車ハーネス設計 | 配線 | 接続表駆動のワイヤ/端子自動シンセシス + 部品自動選定 | 端子/シール/ワイヤ自動選定・サイズ・帳票 | 商用CAD(ミッドレンジ) | 車両サブ〜全体 |
| CATIA Electrical 3D / Harness | 機械統合3Dハーネス | 配置+配線 | 複数モードの3Dバンドル経路 + FEMで実形状予測 + 論理連動 | 曲げ半径・たるみ・規定長・分岐・保護材・干渉 | 商用CAD(3DEXPERIENCE) | 大規模機体・車両 |
| Siemens NX Routing | MCAD統合3Dハーネス/配管 | 配置+配線 | パスネットワーク自動トラバース + 接続表マッピング + ルール経路 | 経路長・曲げ半径・束体積/質量・過密assembly | 商用CAD(NX) | 複雑assembly・大規模 |
| PTC Creo Cabling/Harness | 3D配線ハーネスCAD | 配線 | 仮想チャネル上のair-line最短路探索 + 自動ルーティング | 経路長・トポロジ・空間計算・平坦化 | 商用CAD(Creo) | 中〜大規模assembly |
| SOLIDWORKS Electrical 3D / Routing | 3D電気ルーティングCAD | 配線 | コネクタ間最短路 + 共有経路の自動バンドル化 + 平坦化 | 最短経路・長さ・電源/信号分離・束化・BOM | 商用CAD | 中規模ハーネス |
| Autodesk Inventor Routed Systems | MCAD統合ハーネスCAD | 配線 | ワイヤ単位の自動経路探索 + 通過ワイヤ径で束径決定 | 経路長・曲げ・干渉/クラッシュ検出・帳票 | 商用CAD(Inventor) | 中規模assembly |
| RapidHarness | ハーネス設計ドキュメント | 配線 | 接続データ駆動のワイヤ自動割付 + 帳票/釘板自動生成 | ワイヤ割付・コネクタ表/カットリスト・製造ドキュメント | 商用SaaS/軽量 | 小〜中規模ハーネス |
| AVEVA E3D Pipe Router | プラント配管3D設計 | 配置+配線 | ルールベース3Dグリッド探索(直交ルート最小化) + クラッシュ検出 + ラックパッキング | クラッシュ回避・エルボ最小・配管長最小・spec選定 | 商用CAD(AVEVA E3D) | 大規模プラント |
| Hexagon Smart 3D Electrical | プラント電気・ケーブルトレイ | 配線 | ケーブルウェイ網上の最短路探索 + トレイフィル検証 | トレイ占有率(NECフィル)・分離・並行ケーブル | 商用CAD(Smart 3D) | 大規模プラント |
| CADMATIC Plant Auto Routing | プラント・造船艤装配管3D | 配線 | コンパートメント情報ベース経路探索 + 距離場法 + レデューサ自動挿入 | 機器接続正当性・レデューサ順序・径変化 | 商用CAD | 大規模プラント・船舶 |
| AutoCAD Plant 3D | プラント配管3D設計 | 配置+配線 | spec駆動の半自動直交ルーティング + エルボ自動挿入 | 配管spec/径・勾配・クリアランス・保守アクセス | 商用CAD(Autodesk) | 中〜大規模プラント |
| Bentley OpenPlant | プラント配管3D設計 | 配線 | 接続点間の最短直交経路 + autofitting + 交差時ジャンパー自動挿入 | 接続点方向・コーナー処理・交差回避・spec | 商用CAD(Bentley) | 中〜大規模プラント |
| CAD Schroer M4 PLANT (Piping) | プラント配管3D設計 | 配線 | 統合オートルーティング高速経路探索 + アイソメ自動生成 | 配管spec/径・経路探索・フィッティング配置 | 商用CAD(M4) | 中〜大規模プラント |
| CAD Schroer M4 PLANT (HVAC/Duct) | プラントHVAC・ダクト3D | 配線 | ダクト経路の高速直交ルーティング | 障害物回避・ダクト断面/接続・HVAC系統 | 商用CAD(M4) | 中〜大規模プラント |
| Hexagon SmartPlant Spoolgen | 配管製作・スプール分割 | 配置 | ISOGEN自動アイソメ + ショップルールでスプール自動分割 | フィールドウェルド位置・最大スプール長・輸送/製作 | 商用CAD(Hexagon) | 大規模プラント製作 |
| 自動ダクト/配管ルーティング研究系 | HVAC自動経路(研究) | 配線 | RBTA走査+FRCM + 蟻コロニー/Prim(接続順) + Dijkstra/A\*(経路) | 圧力バランス・空気抵抗最小・障害物回避・コスト | 研究(Revit Dynamo) | 建物〜中規模設備 |
| Device42 | IT資産発見/DCIM/ADM | 配置+論理配線 | エージェントレス発見 + サービス間通信解析 + Affinityグルーピング + 依存マップ | 資産インベントリ・アプリ依存・サービス間通信 | 商用 | 中〜大(エンタープライズ) |
| Lansweeper | IT資産発見 | 配置+リンク表示 | エージェントレス/エージェント混在スキャン(SNMP/WMI/SSH) + 資産正規化 + マップ | 資産インベントリ・デバイス間リンク | 商用 | 中〜大(数万資産) |
| NetXMS | 監視/トポロジ | 配置+論理配線 | ARP/ルーティング/FDB + CDP/LLDP/SONMPからモデル構築 + seed自動マップ + 状態overlay | L2/L3隣接・OSPF隣接・障害状態 | OSS/商用 | 中〜大 |
| Observium | SNMP監視 | 配置+リンク表示 | SNMP自動発見 + CDP/LLDP隣接 + デバイス/ポートマップ + 帯域グラフ | L2隣接・帯域利用率overlay・資産 | OSS/商用 | 中〜大(数千デバイス) |
| Icinga (Map module) | 監視 | 配置+リンク表示 | 親子(parent-child)依存 + ホスト状態overlay + 障害伝播抑制 | 親子依存・障害影響範囲 | OSS/商用 | 中 |
| Checkmk | 監視 | 配置+論理配線 | Parent scan(traceroute)で親子検出 + L2(LLDP/CDP) + force-directed + 状態overlay | L2隣接・親子依存・障害影響範囲 | OSS/商用 | 中〜大 |
| Cacti (Weathermap) | 監視/可視化 | 配線(帯域) | 手動/半自動ノード配置 + RRD値をリンク色/太さにマッピング | 帯域利用率overlay | OSS | 小〜中 |
| Spiceworks | IT資産発見/ヘルプデスク | 配置+リンク表示 | SNMP/WMIスキャン + L2隣接推定 + 自動マップ + 死活 | 資産・デバイス間リンク・死活 | 無料 | 小〜中(SMB) |
| Faddom | ADM/依存マッピング | 配置+論理配線 | エージェントレス・パッシブトラフィック解析 + サーバ/アプリ/ポート依存発見 | アプリ依存・通信フロー(N-S/E-W)・資産 | 商用 | 中〜大(ハイブリッド) |
| IP Fabric | ネットワーク保証/発見 | 配置+論理配線 | マルチベンダ発見 + L2/L3トポロジ推論 + E2Eパスシミュレーション | L2/L3隣接・経路到達性・intent検証 | 商用 | 大(スナップショット型) |
| Forward Networks | ネットワーク検証/デジタルツイン | 配置+論理配線 | snapshot収集 + デバイス数学モデル + 全経路計算 + トポロジ生成 | L2/L3到達性・全経路・intent/compliance | 商用 | 大(全網) |
| Kentik | フロー/NWインテリジェンス | 配置+論理配線 | SNMPメタデータ + フロー/クラウドAPI相関 + Logical/Kentik Map生成 | 帯域/トラフィックoverlay・クラウド経路 | 商用SaaS | 大(キャリア規模) |
| Nmap / Zenmap (Topology) | スキャナ | 配置+リンク表示 | アクティブスキャン + traceroute(ホップ)からグラフ推定 + radialレイアウト | L3ホップ隣接(経路) | OSS | 小〜中 |
| NeDi | 発見/トポロジ | 配置+論理配線 | seedからARP/ルーティング/CDP/FDP/LLDPでL2クロール + ノード追跡 | L2隣接・接続端末追跡・資産 | OSS | 中 |
| Entuity | 監視/トポロジ | 配置+論理配線 | SNMP自動発見 + L2/L3推論 + 動的マップ + 根本原因/障害抑制 | L2/L3隣接・障害影響範囲・帯域overlay | 商用 | 中〜大 |
| ScienceLogic SL1 | AIOps/監視 | 配置+論理配線 | 自動発見 + CDP/LLDP/L2/L3 + Dynamic Application関係 + 親子自動 | L2/L3隣接・親子依存・障害影響範囲・資産 | 商用 | 大 |
| Cisco Catalyst Center | コントローラ/監視 | 配置+論理配線 | CDP/LLDP/IP発見(ホップ深度) + デバイスロール割当 + 階層トポロジ + Assurance | L2/L3隣接・ロール階層・障害/健全性 | 商用 | 大(Cisco網) |
| Juniper Mist | クラウド管理(AI) | 配置+リンク表示 | クラウド発見 + 有線/無線トポロジ + Marvis AIで関係/根本原因 | デバイス/クライアント関係・障害影響範囲 | 商用SaaS | 中〜大 |
| Cisco Meraki | クラウド管理 | 配置+論理配線 | クラウド管理デバイスのLLDP/CDP隣接 + 自動トポロジ + リンク状態 | L2隣接・デバイス間リンク・死活 | 商用SaaS | 中〜大 |
| Progress WhatsUp Gold | 監視 | 配置+論理配線 | L2/L3発見(SNMP/CDP/LLDP/ARP) + 自動マップ + 親子依存 + 状態 | L2/L3隣接・親子依存・障害影響範囲・帯域 | 商用 | 中〜大 |
| Grafana Node Graph panel | 可視化パネル | 配置+論理配線 | nodes/edgesをforce-directedで描画(発見は外部) + メトリクスをarc/色 | (任意グラフ)依存/トラフィックoverlay | OSS/商用 | データ依存 |
| D2 / Terrastruct | DaC言語(汎用/SW構成) | 配置+配線 | プラグイン選択: dagre / ELK / TALA(独自) | 階層・交差低減・container/group・直交配線 | CLI/Go lib/SaaS | 数十〜数百 |
| TALA | レイアウトエンジン(SWアーキ) | 配置+配線 | 独自・直交レイアウト + 独自ルーティング | 直交・container第一級・cluster/tree自動判別 | 商用バイナリ/D2プラグイン | 中規模 |
| PlantUML | DaC言語(UML/各種) | 配置+配線 | Smetana(Graphviz dotのJava移植) or 外部dot、Sequenceは独自 | 階層・交差低減・sequence・state/component | Java jar/CLI | 中規模(図種依存) |
| nwdiag / blockdiag系 | DaC言語(NW図/ブロック) | 配置+配線 | 独自グリッド配置(出現順, Graphviz風orientation) | グリッド整列・NWセグメント・出現順 | Python/CLI/Kroki | 小〜中規模 |
| nomnoml | DaC言語(UML) | 配置+配線 | graphre(dagre系fork) + ラベル後処理 | 階層・交差低減(network simplex) | JS/Web/CLI | 小〜中規模 |
| Pikchr | DaC言語(PIC系) | 配置+配線 | 相対配置DSL(方向+9アンカー, 自動配置なし) | 相対座標・方向スタック | C lib/Fossil | 小規模 |
| Diagrams (mingrammer) | DaC(クラウド構成) | 配置+配線 | Graphvizバックエンド(rank/cluster) | 階層・cluster/group・ランク整列 | Python lib | 中規模 |
| Structurizr | DaC(C4モデル) | 配置+配線 | autoLayout: Graphviz(旧)/Dagre(新) | 階層・交差低減・エッジ迂回配線 | DSL/Java/SaaS | 中規模 |
| AntV G6 | 汎用グラフ可視化 | 配置 | 内蔵多数: Force/Fruchterman/ForceAtlas2/Dagre/Circular/Grid/Radial(一部WASM) | 力学・階層・放射・circular・grid・combo | JS/TS lib | 数百〜数千 |
| AntV X6 | 図エディタフレームワーク | 配置+配線 | @antv/layout委譲(dagre/grid/circular/mindmap) + manhattan router | 階層・grid・mindmap・直交配線 | JS/TS lib | 中規模 |
| Reaflow | Reactワークフロー図 | 配置+配線 | ELKjs(layered)内蔵 + port/nest対応 | 階層・port・nesting/group・交差低減 | React lib | 中規模 |
| React Flow (layouting) | Reactノードエディタ | 配置 | 自前なし: dagre/elkjs/d3-hierarchy/d3-forceを選択 | 階層・力学・tree(engine依存) | React lib | 中規模 |
| Cytoscape.js 拡張群 | グラフ可視化拡張 | 配置 | fcose(force)/cose-bilkent/klay/dagre/cola(制約) | 力学・階層・制約(cola)・交差低減 | JS拡張 | fcoseで数千可 |
| ngraph (anvaka) | グラフ配置ライブラリ | 配置 | ngraph.forcelayout(独自force 2D/3D) + asyncforce(worker) | 力学・3D配置 | JS lib | 大規模(worker) |
| Graphology layout群 | グラフ配置プラグイン | 配置 | ForceAtlas2/Noverlap/circular/circlepack(Gephi系) | 力学(FA2)・重なり解消・circular/pack | JS lib(sigma併用) | 大規模(FA2) |
| tldraw (layout) | 無限キャンバスSDK | 配置 | 整列系(align/distribute/stack/pack) + cluster、グラフ配置は外部 | 整列・分配・packing・制約binding | React SDK | 手動中心 |
| Autodesk Forma (旧Spacemaker) | 建築・都市計画/初期計画 | 配置+編集 | 制約ベース生成 + 環境シミュレーション + ML | 敷地境界・セットバック・建蔽率・高さ・日照・風・騒音 | クラウドSaaS | 街区〜複数棟 |
| TestFit | 不動産フィージビリティ | 配置+編集 | リアルタイムソルバ + 生成設計(タイポロジ別パッキング) | 敷地形状・ユニットミックス・駐車・コア/廊下動線・採光 | SaaS | 1棟〜敷地 |
| Hypar | 建築・空間計画 | 配置+編集 | 関数合成型ジェネレーティブ + 提案システム | 空間プログラム・構造グリッド・コア・採光・什器 | クラウドSaaS | 1棟〜中規模 |
| Finch3D | 建築・空間計画 | 配置+編集 | グラフベース空間割当 + 反復最適化(制約AI) | 部屋隣接・面積・採光・構造グリッド・動線 | クラウドSaaS | 1棟〜フロア |
| Archistar | 不動産フィージビリティ | 配置 | 反復生成設計(物件/規制データ駆動) | ゾーニング・セットバック・容積・敷地データ | クラウドSaaS | 敷地〜街区 |
| Maket.ai | 住宅間取り生成 | 配置+編集 | 生成AI(ルールベース間取り+ゾーニング) | 部屋数・面積・隣接・最小寸法・建築規制 | Webアプリ | 戸建1戸 |
| Digital Blue Foam | 都市計画・施設マスタープラン | 配置+編集 | AIジェネレーティブ + 空間解析 | 建物タイポロジ・密度・省エネ・日照・風 | クラウド/BIM連携 | 街区〜マスタープラン |
| HouseGAN / HouseGAN++ | 研究/住宅間取り生成 | 配置 | graph-constrained relational GAN | 部屋数・タイプ・spatial adjacency graph | 研究OSS | 住宅1戸 |
| Graph2Plan | 研究/住宅間取り生成 | 配置 | GNN(layout graph) + CNN(境界)ハイブリッド | layout graph(隣接)・境界・部屋面積 | 研究OSS(RPLAN) | 住宅1戸 |
| 矩形双対グラフ法 (RFP) | アルゴリズム/建築・VLSI | 配置 | 平面三角化の矩形双対構成(Bhasker-Sahni) + LP寸法 | 部屋隣接(共有壁)・最小幅・アスペクト比 | 研究・ライブラリ | 数〜数十部屋 |
| スライシングツリー法 | アルゴリズム/VLSI・建築 | 配置 | スライシング木(正規化ポーランド式) + 焼きなまし | モジュール面積・総面積最小・アスペクト比 | 研究・ライブラリ | 数〜数百ブロック |
| Voronoi図ベース間取り生成 | アルゴリズム/建築 | 配置 | 微分可能ボロノイ図 + 勾配最適化 | 部屋面積・連結性(非重複保証) | 研究実装 | 数〜数十部屋 |
| Magicplan | 現況間取り作成(スキャン) | 配置(自動採寸) | ARKit/LiDAR + 深層学習で壁/開口検出 | 実測寸法・壁/窓/ドア検出 | モバイルアプリ | 1部屋〜1住戸 |
| Planner5D (AI) | 住宅インテリア設計 | 配置+編集 | AI間取り認識 + Smart Wizard什器配置提案 | 壁/開口検出・部屋用途・什器レイアウト | Web/モバイル | 1部屋〜1住戸 |
| Cadence Innovus | 商用P&R(ASIC) | 配置+配線 | GigaPlace(解析的配置) + NanoRoute配線, タイミング駆動 | 非重なり/HPWL/タイミング/混雑/DRC | 商用EDA | 数百万〜数十億インスタンス |
| Synopsys ICC2 / Fusion Compiler | 商用P&R(ASIC) | 配置+配線 | 解析的グローバル+詳細配置, タイミング/混雑駆動 | 非重なり/HPWL/タイミング/混雑/DRC | 商用EDA | 数百万〜数十億 |
| Siemens Xpedition (place) | 商用PCB配置 | 配置+配線 | インタラクティブ/自動部品配置 + オートルータ | 部品非重なり/配線長/設計規則 | 商用EDA | 数千部品 |
| Bookshelf format | 配置ベンチ標準 | (交換形式) | 配置交換フォーマット(.nodes/.nets/.pl/.scl) | (表現規約のみ) | オープン仕様/ベンチ | ISPD系〜数百万セル |
| Parquet (UMpack) | フロアプラン(VLSI) | 配置 | B\*-tree表現 + 焼きなまし | 非重なり/面積/アスペクト比/固定外形 | OSS(研究) | 数十〜数千ブロック |
| Sequence-pair SA floorplan | フロアプラン | 配置 | sequence-pair表現 + 焼きなまし | 非重なり/面積/wirelength | 古典手法/各種実装 | 〜数千ブロック |
| Corner Block List (CBL) | フロアプラン | 配置 | コーナーブロックリスト表現 + SA | 非重なり(モザイク)/面積 | 研究実装 | 〜数千ブロック |
| Kraftwerk2 | 解析的配置(VLSI) | 配置 | 力指向(force-directed) + hold/move力分離 | HPWL/密度/非重なり | 研究実装 | 〜数十万セル |
| mPL6 | 解析的配置(VLSI) | 配置 | マルチレベル + 非線形計画(log-sum-exp) | HPWL/密度 | 研究バイナリ | 〜数百万セル |
| NTUplace3/4 | 解析的配置(VLSI) | 配置 | マルチレベル解析的 + 密度ペナルティ | HPWL/密度/混雑 | 研究バイナリ | 数百万セル |
| d3-sankey | サンキー図 | 配置 | 層割当 + 反復緩和でノード縦位置 | フロー保存/交差最小化/帯幅=流量 | OSS(JS) | 数十〜数百ノード |
| markmap | マインドマップ | 配置 | 根付き木の階層放射/水平レイアウト | 木の包含・非重なり | OSS(JS) | 数百ノード |
| OrgChart.js / BALKAN | 組織図 | 配置 | 階層木レイアウト(Reingold-Tilford系) | 親子整列/兄弟非重なり | OSS/商用(JS) | 数百〜数千ノード |
| family-tree (dTree等) | 家系図 | 配置 | 結婚ノード付き世代階層レイアウト | 世代整列/夫婦隣接/非重なり | OSS(JS) | 数百ノード |
| Gantt (frappe-gantt等) | ガント図 | 配置 | 時間軸=X + 行割当 + 依存矢印 | 時間順序/行非重なり/依存 | OSS(JS) | 数百〜数千タスク |
| d3-chord / Circos | 弦・サーキュラ図 | 配置+配線 | 円周配置 + ベジェ弦リボン | 円周分割=量/リボン交差 | OSS(JS/Perl) | 数十〜数百区画 |
| arc diagram | アーク図 | 配置+配線 | 1次元ノード列 + 半円弧エッジ | 線形順序/弧交差最小化 | OSS | 数十〜数百ノード |
| Hive plot | ハイブプロット | 配置+配線 | 軸割当 + 軸上位置 + 曲線エッジ | 軸分類/軸上順序 | OSS(d3-hive) | 数百〜数千ノード |
| Squarified Treemap | 階層可視化/面積割付 | 配置 | 再帰的矩形分割(アスペクト比最適化) | 面積=値/アスペクト比/包含 | OSS(d3-hierarchy) | 数千〜数万葉 |
| d3-cloud | ワードクラウド | 配置 | 螺旋配置 + スプライトマスク衝突判定 | 非重なり/サイズ=頻度 | OSS(JS) | 数百〜数千語 |

> スケール目安は公開資料で明示されないものが多く、実務上のだいたいの適用感。
> 既存と重複する WebCola / Freerouting / yFiles / VivaGraphJS / Arbor.js・Springy / ORCSolver / Paneldes / MagiCAD / SchemCABLING は行を増やさず補足メモで強化。
> 商用CAD/EDA/監視製品は公開資料にアルゴリズム名が無いものが多く、コアアルゴリズム欄は推定（例: 3D graph search + DRC + human-in-the-loop reroute）。

---

## 補足メモ

- **ELK** — 階層レイアウトの堅牢OSS。React Flow / Svelte Flow 公式採用。交差最小はNP困難でバリセンター/メディアン反復。`elk-worker.js` でメインスレッド非ブロック。
- **WebCola** — 単純な力学と違い「重ならない・飛んでいかない」を分離制約として数式保証。境界は左上/右下の固定ダミーノードで表現。VPSCがコアで制約保証が強く、D3.js/Cytoscape.js統合例多数。
- **Libavoid** — Dunnart/Inkscape/JointJS採用。共有セグメントを交差を増やさず平行分離（$O((n+s)\log(n+s))$）。配置/配線の関心分離がクリーン。
- **Cassowary** — Apple Auto Layout 基盤。「違反誤差の大きさ」で評価し自然なレイアウトに収束。
- **tscircuit** — 「HTMLルーティングアリーナ」で A\*/Dijkstra/RRR を並べ速度・完全結線率・トレース長を視覚比較できるベンチ思想。
- **Dagre** — ELKより軽量なWeb向け階層配置の定番。cycle removal → rank assignment → crossing minimization → coordinate assignment。React Flowなどで「まず自動配置を入れたい」基準線。network simplex rank割当とBrandes-Köpf座標割当が明記。([Docs.rs][1])
- **Graphviz / dot** — 静的構造図生成の古典OSS。dot/neato/fdp/sfdp 複数エンジン。対話編集よりCIで図生成・設計資料埋め込み・依存関係描画に強い。([Graphviz][2])
- **OGDF** — 「アルゴリズムの宝庫」。Sugiyama, force-directed, planarization, orthogonal等が揃う。組み込みより比較対象・実装方針のリファレンス。([OGDF][3])
- **GoJS** — 商用diagram UI候補。LayeredDigraphLayoutは cycle removal→layer assignment→crossing reduction→straightening/packing の4段（最適性は非保証）。配置＋編集体験をまとめて買う選択肢。([gojs.net][4])
- **Mermaid layout engines** — 図記法の入口。dagre/ELK/tidy-tree/cose-bilkent を選択可。ELKは複雑・大規模flowchartで重なり低減の選択肢。([mermaid.ai][5])
- **Sprotty + ELK** — DSL/IDE統合diagram。SprottyモデルをELKのElkNode/ElkEdge/ElkPort/ElkLabelへ変換。Graph editor自作ならReact Flowよりモデル駆動・言語サーバ寄り。([sprotty.org][6])
- **OpenROAD RePlAce/gpl** — ASIC配置OSS代表。global placementはRePlAceベース、electrostatic force equationsをNesterov法で解く。「密度制約 + wirelength最小化」の設計思想が参考。([openroad.readthedocs.io][7])
- **DREAMPlace** — 解析的VLSI placementをGPU/PyTorchで高速化。placementをNN訓練相当へ写像したRePlAce/ePlace系GPU加速placer。([NVIDIA][8])
- **VPR / VTR** — FPGA配置配線の研究標準。配置=simulated annealing、配線=PathFinderベースnegotiated congestion routing。混雑コストを上げつつrip-up/rerouteする考え方はPCB/ワイヤ配線にも応用可。([docs.verilogtorouting.org][9])
- **ALIGN** — アナログIC自動レイアウト。SPICE netlist→GDSII、階層検出・parameterized cell・幾何/電気制約付きブロックアセンブリ。対称性・マッチング・DRCを扱う点が重要。([arXiv][10])
- **Android ConstraintLayout / Kiwi** — Cassowary系UI制約配置の現代実装。KiwiはCassowaryベースの高速C++実装、ConstraintLayoutは親子/兄弟制約から複雑UIをフラット階層で作るAndroid標準系。([GitHub][11])
- **OR-Tools CP-SAT** — 「自動配置」を厳密制約問題として解く実用ソルバ。NoOverlap/NoOverlap2Dは矩形packingやスケジューリングに使える。リアルタイムには重いがオフライン最適化・初期配置生成に強い。([developers.google.com][12])
- **VivaGraphJS** — WebGL対応で大規模寄り、レンダラ差し替え可能。力学はカスタム実装前提。
- **yEd / yFiles** — 1ライブラリで Hierarchic(Sugiyama変種)/Organic(力学)/Orthogonal/Circular/Tree を提供。GoJSの競合でインタラクティブ体験が強い。デスクトップ yEd は無料で試せる。
- **SetCoLa** — 高レベルDSLでグループ/整列/フロー制約を書き、WebColaの低レベル制約にコンパイル。「制約を宣言的に書く」流れの代表。
- **ORCSolver** — OR制約（選択的制約）で適応的GUIを解く研究実装。Branch-and-Bound + 前処理。Cassowary/Kiwiの線形制約より柔軟なフロー混在を狙う。
- **Freerouting** — Specctra DSN/SES互換のOSS実装。KiCad統合が活発で、Push-and-Shove系ルータの補完として実用的。
- **Spectral Layout** — グラフラプラシアンの固有ベクトルで大域配置。force-directedの初期配置に好適。Barnes-Hut/Multipole近似はGPU力学加速で併用。
- **d3-force** — ブラウザネイティブの定番。collision forceで重なり回避が比較的簡単。「すぐ試せる」基準線。
- **Sigma.js (+ graphology)** — 大規模描画に強くWebGL寄り。graphology（グラフデータ構造）と組み合わせやすい。レイアウトはForceAtlas2等。
- **mxGraph / draw.io** — draw.io基盤の実務フローチャート定番（Apache 2.0）。自動レイアウト＋コンテナレイアウトが充実。
- **JointJS / JointJS+** — OSSコア＋有償拡張。インタラクティブdiagram・BPMN・カスタム形状。mxGraph系の競合。
- **エンタープライズ商用（Ogma / KeyLines / Tom Sawyer）** — 大規模・分析統合・サポート重視。Ogma/KeyLisはWebGLで数万〜十万規模、Tom Sawyerは「5種先進レイアウト」で複雑業務図に強い。yFiles/GoJSと同格の商用帯。
- **OrthoRoute** — GPU加速の小規模OSS配線（KiCadプラグイン）。Manhattan + PathFinder。Freeroutingの補完的位置づけ。
- **PureLayout** — Cassowary/Kiwi系のiOS/macOS特化簡易API。制約UIの実装例として参考。
- **業務/ノードエディタ小粒OSS** — Nulab `autog`(Go階層配置)、`bpmn-auto-layout`(BPMN図形生成)、Rete Auto Arrange(elkjs委譲)、LiteGraph.js(ComfyUI系)。「すぐ組める」候補。([GitHub][13])
- **地図ラベル配置** — diagramのedge/nodeラベルに転用しやすい領域。Mapbox/MapLibreは collision detection + variable placement、QGIS PALは候補生成+優先度探索、polylabelはポリゴン内最適点(pole of inaccessibility)。([Mapbox][14])
- **2Dネスティング** — 「配置」を歩留まり最適化として解く。SVGnest(irregular bin packing/part-in-part)、Deepnest(no-fit polygon+GA)、sparrow(strip packing/feasibility問題列)。非重なり+回転を扱う点が参考。([SVGnest][15])
- **プラント配管/ケーブル配線（業務）** — 商用はアルゴリズム名非公開が多いが、共通の推定コアは **3D graph search(A\*/Dijkstra) + DRC/rule checking + human-in-the-loop reroute**。Paneldes(tray/raceway+fill+干渉)、MagiCAD(既設tray追従)、PlantStream(設計知識のアルゴリズム化)。文献はGA/PSO/RL/multi-objectiveも。([Elecdes][16], [SpringerLink][17])
- **倉庫/棚割** — Warehouse生成はconstrained beam searchで通路接続・クリアランス・アクセスコストを評価。Planogramは需要予測+ルール/AIで棚面・フェイス・在庫制約を解く。([arXiv][18])
- **交通図/直交描画** — Shape-Guided Metro Map(45/90度整列・形状誘導)、HOLA(手描き風直交・少交差少曲げ)、Orthogonal Drawing Pipeline(初期配置→重なり除去→routing→LP nudging)。ネットワーク図の直交美学に直結。
- **ゲームPCG** — Wave Function Collapseは配置制約を局所隣接ルールに落とす(constraint propagation+entropy最小選択)。ダンジョン2段生成は構造生成とオブジェクト配置を分離。([GitHub][19])
- **AI/生成系** — HyLiMo(自動配置+手動微調整をDSLで両立)、DiagrammerGPT(LLMでplan→監査→生成)、Generative Layout(transformer生成+制約最適化)。「自動と手動の両立」「条件付き生成」が論点。
- **ネットワーク運用監視 / 自動トポロジーマッピング（Shumokuに最も近い）** — discovery(SNMP/LLDP/CDP)→トポロジ推定→自動配置→状態/性能overlay、が共通パイプライン。**配置アルゴリズムより「構成情報から論理図を自動生成・更新する」業務価値**が主眼の製品が多い。
  - **LiveNX/LiveAction** — 監視表でなく「トポロジ上に性能を重ねる運用地図」。Flow/API/SNMP/cloud telemetryから可視性。([LiveAction][20])
  - **NetBrain**（×NetworkBrain）— 自動図というよりDynamic Mapを診断/runbookに接続。構成→論理図の自動生成・更新型。([Domotz][21])
  - **Zabbix** — 公式Mapsは要素を置いてリンクする監視可視化（完全自動配線ではない）。`zabbix-map-creator`等の周辺OSSがLLDP/CDPからL2自動生成。両者は分けて記載。([zabbix.com][22])
  - **netTerrain + Zabbix** — Zabbix=監視DB、netTerrain=図面/資産側。collectorでAPI連携しphysical/logical図を自動生成。([Graphical Networks][23])
  - **LibreNMS Weathermap** — リンク利用率を太さ/色で重み付け表示。Shumokuのutilization overlayと発想が同じ。OSSで実装参照に好適。
  - その他: SolarWinds NTM / Auvik / Domotz / ManageEngine OpManager / PRTG / Netdisco。
  - **NetworkBrain** — NTT-ATが国内展開するNetBrain Technologies製品（「NetworkBrainはNetBrainの登録商標」）。英語のNetBrainだけ調べると国内名を取り逃すので別行で明示。([NTT-AT][24])
  - **ZABICOM / T-View for Zabbix** — Zabbixデータからトポロジー図を自動描画する国内SIソリューション。Zabbix公式Mapsの手動運用を補完。
  - **NetBox Topology Views** — Source-of-truth(NetBox)のdevice/cable関係から図を起こすplugin。Shumokuのnetboxプラグインと同じ発想で直接の比較対象。([GitHub][25])
- **このジャンルの見方（重要）** — 価値の中心は描画アルゴリズムより**トポロジー推定**。製品ページは "layout algorithm" でなく network discovery / dynamic map / observability の語彙で書かれるため、`auto layout/routing` 検索では漏れる。実態に即した記述は **LLDP/CDP/SNMP/ARP/FDB/config/API からの関係抽出 + graph layout + state overlay**。探索語彙: `automatic network topology mapping` / `LLDP CDP topology discovery` / `SNMP topology map` / `NetBox topology plugin` / `network source of truth topology` 等。Zabbix公式は「network topology discoveryは提供しない」と明記（discovery=機器発見まで）。([zabbix.com][26])
  - **弱小OSS（discovery+図面生成が主役）** — natlas(SNMP/CDP/LLDP→Graphviz図), secure_cartography(SSH前提), Network Miner, Scanopy(VLAN scan→interactive)。ELK/Graphvizの一般配置と違い「推定→図化」が価値。([GitHub][27])
  - **OSS NMS自動トポロジー** — OpenNMS(Linkd Topology Provider), The Dude(subnet scan→map→監視, MikroTik), LibreNMS。([MikroTik][28])
  - **NOC/レガシー可視化（監視値overlay）** — NagVis(Nagios), PHP Network Weathermap(Cacti/RRD), Grafana Weathermap Panel。背景図/手動配置と監視値の混在が特徴。
  - **SaaS NPMトポロジー** — Datadog / LogicMonitor(LLDP/CDP+BGP/OSPF/EIGRP→動的依存) / JDisc。ルーティングプロトコルまで使い障害影響範囲を出す。
- **電気設備 / ケーブルトレイ / BIM（業務・3D配線）** — 共通の推定コアは **3D graph search + rule/DRC checking + fill/segregation + waypoint/手動override**。Bentley RCM, Open BIM Cable Routing(CYPE), ESApro Cable Trays, 既出 Paneldes / MagiCAD / SchemCABLING。([Elecdes][16])
- **ハーネス / 産業機器配線** — 研究側は2段階（tray内ケーブル配置 + 3D tray経路）や多目的最適化（長さ・束ね・avoid zone・Pareto）。3D Cable Harness Routing, Industrial Electrical Routing Optimization。([CAD Journal][29])
- **棚割 / 小売planogram** — 「配置」を売上最適化として解く横展開先。OPENCatman(space utilization), Quant(template→店舗別自動生成), RELEX(localized大量自動化)。SKU配置・棚面・需要・店舗別制約。([OPENCatman][30])
- **オフィス座席 / 住宅フロアプラン** — 人間関係グラフ→物理座席の配置問題。Microsoft Workspace Optimizer(collaboration data), BauPlan, Sweet Home 3D, Arcada(React+Pixi.js)。([GitHub][31])
- **文書/地図/特殊図のレイアウト解析** — 既存レイアウトの「抽出」側。LAREX(古書OCR前処理), MapReader(歴史地図CV抽出), MetroSets(集合→metro map/octilinear), OpenMPL(マスク分解=graph coloring)。
- **電気ワイヤハーネスCAD（サブエージェント調査）** — ほぼ全て商用。共通コアは **3Dパス網上のピン間最短路 + バンドル/セグメント径パッキング + 信号分離(segregation)検証 + 釘板平坦化**。Zuken Harness Builderは"packing algorithm"で束径算出→保護材/ラベル自動付与、CATIAはFEMで実形状(たるみ・曲げ半径)予測、Capitalは配線オブジェクトを自動シンセシス。OSSのハーネス自動配線は確認できず。([EPLAN](https://www.eplan.com/us-en/products/eplan-harness-prod/), [Zuken](https://www.zuken.com/en/resource/harness-builder-2025-e3-series/))
- **プラント配管/HVAC 3D（サブエージェント調査）** — AVEVA E3D Pipe Routerはルールベース3Dグリッド探索でクラッシュフリー・エルボ最小・配管長最小、ラックパッキングとPtrac/Pvol/Rplaneで経路ステア。AutoCAD Plant 3D/Bentley OpenPlantは「接続点間の半自動直交+フィッティング自動挿入」型で大域最適化型とはレベルが違う。HVACダクトは RBTA走査+蟻コロニー/Prim+Dijkstra/A* の研究実装あり。([AVEVA](https://docs.aveva.com/bundle/e3d-design/page/980403.html))
- **IT資産発見/NW検証/DCIM（サブエージェント調査）** — discovery系の幅広い層。Faddom/Device42は**L2/L3配線でなくアプリ依存(東西トラフィック)マップ**。IP Fabric/Forward Networksは「発見→数学モデル化→全経路シミュレーション」型でレイアウトより**経路到達性検証**が主目的（snapshot単位の決定論モデル）。Grafana Node Graph/Cacti Weathermapは**発見を持たない可視化レイヤ**（配置/配線は外部供給）。([Forward Networks 数学モデル](https://www.forwardnetworks.com/wp-content/uploads/2021/10/Mathematical-Model-white-paper.pdf))
- **diagram-as-code 自動レイアウト（サブエージェント調査）** — 多くは既存エンジンをバックエンドに委譲: D2(dagre/ELK/独自TALA), PlantUML(Smetana=Graphviz dotのJava移植), nomnoml(graphre=dagre系), Structurizr(Graphviz→Dagre移行), Reaflow(ELKjs内蔵), React Flow(自前なし=利用者がdagre/elk選択), Cytoscape拡張(fcose/cola/dagre)。**TALAだけは独自の直交・container第一級レイアウト**で注目。([D2 layouts](https://d2lang.com/tour/layouts/), [TALA](https://terrastruct.com/tala/))
- **建築/フロアプラン生成（サブエージェント調査）** — 画像学習系(HouseGAN/HouseGAN++=graph-constrained GAN)とグラフ系(Finch3D/Graph2Plan=隣接グラフ→bounding box)に分岐。古典は**矩形双対(RFP, Bhasker-Sahni線形時間)**と**スライシング木+焼きなまし(Wong-Liu)**でVLSIフロアプランと共通理論。微分可能ボロノイ(PG'24)は非重複を構造保証。([Graph2Plan](https://arxiv.org/abs/2004.13204), [RFP](https://arxiv.org/pdf/1910.00081))
- **VLSIフロアプラン/配置 + 特殊図（サブエージェント調査）** — 商用P&R(Innovus=GigaPlace+NanoRoute, ICC2)は解析的配置でタイミング/混雑同時最適化。フロアプラン表現の三系統は **sequence-pair(一般)・B\*-tree/O-tree(コンパクト)・Corner Block List(モザイク)**、いずれも焼きなまし。特殊図(d3-sankey=層割当+反復緩和, Squarified treemap, d3-cloud=螺旋+衝突)は「制約を持つ専用レイアウト」の好例。([Floorplan表現](https://en.wikipedia.org/wiki/Floorplan_(microelectronics)))

[27]: https://github.com/MJL85/natlas "MJL85/natlas — Network Discovery and Auto-Diagramming"
[28]: https://mikrotik.com/thedude "The Dude — MikroTik"
[29]: https://www.cad-journal.net/files/vol_15/CAD_15%285%29_2018_747-756.pdf "Cost optimization of industrial electrical routing"
[30]: https://welcome.opencatman.com/en/home-eng/ "OPENCatman — Planograms Online"
[31]: https://github.com/microsoft/workspace-optimizer "microsoft/workspace-optimizer"

[24]: https://www.ntt-at.co.jp/product/networkbrain/ "NetworkBrain — NTT-AT"
[25]: https://github.com/netbox-community/netbox-topology-views "netbox-topology-views"
[26]: https://www.zabbix.com/documentation/8.0/en/manual/discovery/network_discovery "Zabbix — Network discovery"

[20]: https://www.liveaction.com/products/livenx/ "LiveNX | Enterprise Network Monitoring"
[21]: https://blog.domotz.com/all/best-network-diagram-software-it-teams/ "Best Network Diagram Software for IT Teams"
[22]: https://www.zabbix.com/documentation/8.0/en/manual/config/visualization/maps "Zabbix — Network maps"
[23]: https://graphicalnetworks.com/blog-integrating-zabbix-with-netterrain-for-automated-network-diagram-mapping/ "Integrating Zabbix with netTerrain"

[13]: https://github.com/nulab/autog "nulab/autog: Graph autolayout library in Go"
[14]: https://docs.mapbox.com/help/dive-deeper/optimize-map-label-placement/ "Optimize map label placement | Mapbox"
[15]: https://svgnest.com/ "SVGnest — Open Source nesting for CNC"
[16]: https://elecdes.com/electrical-cad-software/paneldes-raceway-and-cable-routing-software "Paneldes Raceway and Cable Routing"
[17]: https://link.springer.com/article/10.1007/s43069-023-00208-5 "Literature Survey on Automatic Pipe Routing"
[18]: https://arxiv.org/abs/2407.08633 "Automated Warehouse Layout Generation"
[19]: https://github.com/mxgmn/WaveFunctionCollapse "mxgmn/WaveFunctionCollapse"

[1]: https://docs.rs/dagre/latest/dagre/layout/index.html "dagre::layout - Rust"
[2]: https://graphviz.org/ "Graphviz"
[3]: https://ogdf.github.io/doc/ogdf/group__graph-drawing.html "ogdf: Graph Drawing"
[4]: https://gojs.net/latest/api/symbols/LayeredDigraphLayout.html "LayeredDigraphLayout | GoJS API"
[5]: https://mermaid.ai/open-source/intro/syntax-reference.html "Diagram Syntax | Mermaid"
[6]: https://sprotty.org/docs/sprotty-elk/introduction/ "sprotty-elk"
[7]: https://openroad.readthedocs.io/en/latest/main/src/gpl/README.html "Global Placement - OpenROAD documentation"
[8]: https://research.nvidia.com/sites/default/files/pubs/2019-06_DREAMPlace%3A-Deep-Learning/54_1_Lin_DREAMPLACE.pdf "DREAMPlace: Deep Learning Toolkit-Enabled GPU"
[9]: https://docs.verilogtorouting.org/en/latest/vpr/ "VPR — Verilog-to-Routing documentation"
[10]: https://arxiv.org/abs/2008.10682 "ALIGN: A System for Automating Analog Layout"
[11]: https://github.com/nucleic/kiwi "nucleic/kiwi"
[12]: https://developers.google.com/optimization/cp/cp_solver "CP-SAT Solver | OR-Tools"

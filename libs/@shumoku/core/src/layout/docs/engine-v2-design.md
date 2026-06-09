# Layout Engine v2 — アルゴリズム設計仕様（DRAFT）

> Round 2（サブエージェント4本）+ test6実データ検証の統合。**実装可能レベル**の設計。
> 上位: [composite-layout-redesign.md](composite-layout-redesign.md)（骨子）/ [research/network-topology-layout-gap.md](research/network-topology-layout-gap.md)（ギャップ）
> 実証: §7（test6で各detectorを走らせた結果）。プロトタイプ: `tmp-recognizer-proto.ts`（throwaway）。

---

## 1. パイプライン全体

```
NetworkGraph(複合・非木)
  → ① Structure Recognizer   構造を第一級検出
  → ② Constraint Generator   構造→幾何制約(IPSep-CoLa/SetCoLa流)
  → ③ Solver                 自作 VPSC + stress majorization(依存ゼロ)
  → ④ Faithful Router        束ねない配線(LAG=多重度バッジ, mesh=matrixセル)
  → ⑤ Overlay(座標不変)      多重グルーピング(BubbleSets) + weathermap
```

`ResolvedLayout` 契約は固定。既存機構（spacing/port-placement/direction/pin/hull描画/diagnostics/compound）は再利用。

---

## 2. ① Structure Recognizer

共有前処理: 単純化グラフ`nbr`（parallel collapse済）を1度構築。全detectorは連結成分ごとに純関数。**2パス構成**。

**Pass 0**: `buildAdj` + `collapseParallel`（多重度・集約帯域を確定）。
**Pass 1**（tier前提作り）: articulation points（Tarjan O(V+E)）、fabric予備検出。
**Pass 2**（tier確定）: §2.1。
**Pass 3**（tier依存・排他優先順）: MeshCore > FabricBlock > MlagPair > Ring > DualHoming。

### 2.1 Tier（role + betweenness、degree不使用）
- role完全 → `ROLE_TIER`即確定（core/spine=0, dist/agg=1, access/leaf/edge=2, server/host=3）。**test6はrole空→betweennessフォールバックが実際に発火**。
- role不完全 → Brandes betweenness O(VE)（V>2000はk-coreフォールバック）→ 連結成分ごと正規化 → 分位点離散化(p90/p60/p20)で4 tier。
- mixed → 既知roleとbtierを**isotonic regression**で校正（btier番号を現場tier番号に揃える）。
- **default-route-sink ガード（test6で判明した改良）**: betweennessが最大級だが「ほぼ全ノードから1ホップで到達される吸い込み点」(degree高 ∧ 自身の上流が無い ∧ stub的)はコアでなく`sink`としてフラグし、tier0へ自動昇格させない。`srx4300.lastresort`がこれに該当（deg=17,Cb=509だがdefault-route先）。判定: `(到達元ノード割合 > 0.7) ∧ (betweenness寄与が単一経路集中)`。

### 2.2 Parallel-edge / LAG / MLAG
- `multiplicity≥2`で論理1本へ畳む（集約帯域・メンバ保持）。同帯域/同VLANで`isLag`。
- MLAG: child cが2上流u1,u2に接続 ∧ u1-u2間peer link ∧ 共有child≥2。u1,u2を論理ペア化。
- **test6実証**: 9 parallel群（最大x3=800G+400G+400G）。**これがtest6の最太リボンの正体**＝core router間LAG。

### 2.3 Redundancy / dual-homing / articulation
- dual-homing: cが下位tierから2上流へ。symmetric pair（2childが同2上流共有）。
- articulation points（Tarjan反復版）。**test6=2個**（DCポッドのSPOF）。配置でなく強調ヒント＋tierのbottleneckフラグへ。

### 2.4 (Near-)complete bipartite / spine-leaf
- 厳密bicliqueはNP-hard → 共通近傍seed + grow（COVER=0.7, DENSITY_MIN=0.6, MIN_LEAF=3, spine≥2）。
- **test6=該当なし**（backboneなので正しい）。star/mesh誤検出はdensity分母=|S|·|L|とintraRatioで除外。

### 2.5 Ring / 2.6 Mesh-core
- Ring: cycle basis + chordless + 低次数（MIN_RING=4）。
- Mesh-core: tier0候補にk-core分解（O(V+E), MESH_DENSITY=0.6）。**test6実証**: NOCバックボーンルータが部分メッシュ2クラスタを形成 → matrixでなく**mesh-core配置**が適用対象。

出力: `RecognizedStructures{tiers, parallelEdges, mlagPairs, redundancy, articulationPoints, fabricBlocks, rings, meshCore}`、各`confidence`付き。

---

## 3. ② Constraint Generator

低レベル4プリミティブに正規化（全てVPSC separationに還元）: **SEP**(`a+gap≤b`) / **ALIGN**(等式SEP) / **EQ**(pin) / **CONTAIN**(group bbox 4辺SEP)。

### 3.1 制約カタログ
| 構造 | 生成制約 |
|---|---|
| Tier | 隣接tierのみ有向y-SEP（全総当たりしない）+ 同tier band soft ALIGN |
| Subgraph/rack | group containment（bbox + margin）|
| Redundancy pair | y-ALIGN + x-mirror(soft) + x-order(hard, id順) |
| LAG/MLAG | co-location(soft tight) + ペアはredundancy継承 |
| **Spine-leaf block** | **block-local grid**を解いて親へbbox委譲（過剰拘束回避の最重要テク）|
| Ring | soft radial target |
| Mesh-core | cluster cohesion(soft) + 相互non-overlap(hard) |
| **Multi-group(rack∧VLAN)** | **containmentは1系統(物理)のみhard、VLANはsoft cohesion+hull overlay**（交差矩形=almost-always infeasibleを構造回避）|
| Pin(human/prior) | EQ（最上位）|

### 3.2 優先順位lattice（衝突解決）
```
P0 PIN(human) ─ P1 PIN(prior) ─ P2 NON-OVERLAP ─ P3 CONTAIN(primary) ─ P4 TIER ─ P5 block-grid ─ P6 redundancy-order
──── soft境界 ────
P7 mirror(w8) ─ P8 tier-band(w6) ─ P9 LAG(w5) ─ P10 ring(w3) ─ P11 secondary-group(w2) ─ P12 mesh/stress(w1)
```
- hard infeasible → IIS近似で**衝突閉路上の最低priorityを最小集合除去**。P0-P2は不可侵。
- soft → stress目的関数に二次ペナルティ、weightで自動調停。

### 3.3 決定性（D1-D6）
canonical order `(tier, primaryGroupId, nodeId)` → 固定初期化（`y0=tier·GAP, x0=rank·GAP`）→ 制約ソート → 全tie-breakをid → 反復数固定 → 逐次加算。**乱数禁止**。現行エンジンの最大の強み(決定性)を維持。

### 3.4 増分/安定
prior座標をP1 soft-hard pin。変更時は影響半径（同group+隣接tier+直接リンク先）だけ自由化して局所VPSC → 1パスglobal微調整。「全部動く」を防ぐ。

---

## 4. ③ Solver — 自作 VPSC + stress majorization（決定: 自作）

**WebColaは2019年から死蔵**（最終3.4.0、d3-drag依存、ESM非対応、determinism非保証）。ELK/libavoidを重さで外した本プロジェクト方針と一致 → **自作（~700-900行、依存ゼロ）**。

- (a) **stress majorization**（Gansner 2004, ~200行）: APSP(BFS) + 加重Laplacian局所更新。単調収束・決定的。5000ノードはpivot/landmark MDSで O(N·k) 化の余地を型で確保。
- (b) **VPSC**（Dwyer 2006, ~350行）: 1D separation QPのactive-set（block merge/split/project）。x/y軸を交互projection。
- (c) **gradient projection統合**（IPSep-CoLa, ~100行）: majorization各反復後にx-VPSC→y-VPSC。align/contain/page-boundsは全てseparationに還元。
- 移植参照: WebCola `vpsc.ts`/`rectangle.ts`(MIT)を**読んで再実装**（npm依存にしない）。

---

## 5. ④ Faithful Router

配置と分離した独立パス。**束ねない（faithfulness不変条件）**。
- LAG → 多重度バッジ付き1本（meshにしない）。
- spine-leaf block → §6 matrixセル。
- 横断リンク → octilinear soft + lane分離（旧busの「対応喪失」を回避）。
- source→target が常に復元可能。

---

## 6. ④' Mesh→Matrix Hybrid（NodeTrix流, faithful）

密spine-leafを行列ブロックに畳む。**edge bundlingと違い単射（個別リンク復元可）**。
- **判定式**: `matrixify ⟺ L≥3 ∧ S≥2 ∧ ρ≥0.5 ∧ E≥12 ∧ E≥1.5(L+S) ∧ matrixGain = E−1.5(L+S)−γ·E_ext > 0`。
- **肝**: `E_ext`は「row/colに素直に出ない横断エッジのみ」。downlink/uplinkはstubに出るので数えない → 純Closは**spine≥3で必ずmatrix化**、S=2の薄fabricはnode-link維持（直感的挙動）。
- super-node = サイズ固定の通常`Node`、内部メンバはfold。row/col stub = 通常`ResolvedPort`でfaithfulなentry/exit。
- reorder: rack-grouped barycenter既定（決定的）、spectral/OLOオプション。
- collapse/expand = **view-stateのみ**（グラフモデル非侵襲、`hideDisconnected`と同層）。expandedは既存`compound.ts`に委譲。
- 弱点（横断path-tracing）→ cross-highlight/guide-line/path-aware auto-expand/selective overlay（全てfaithfulだから可能）。
- **test6では非発火**（fabric無し）。DC fabricトポロジで効く機能。

---

## 7. test6 実データ検証（研究グラウンディング）

53ノード/104リンク/1サブグラフ。ShowNet/TTDB由来backbone。roleは空（spec.typeのみ）。

| 検出 | 結果 | 設計への含意 |
|---|---|---|
| **betweenness tier** | `mx301.noc` deg=5 → **tier0**(Cb=349)。degree最上位`cisco8711`(deg=10)はbetween4位 | **「低次数コア>高次数アクセス」を実証**。degreeレイアウトは中心化を誤る |
| **default-route sink** | `srx4300.lastresort` deg=17 ∧ Cb=509（両最大） | **armchair設計の穴**。betweennessはsink点で過大評価 → §2.1にsinkガード追加 |
| **parallel/LAG** | 9群、最大x3(800G+400G+400G) | **test6の最太リボン=core間LAG**。collapse+多重度表示が混雑の直接解 |
| **articulation** | 2個（qfx5120, qfx5240-64od.dc）| DCポッドの真のSPOF。強調価値 |
| **fabric** | なし（正しい、backbone） | matrixは非発火 |
| **mesh-core** | NOCルータが部分メッシュ2クラスタ | §6 mesh-core配置が適用対象 |
| 次数分布 | deg=2:14, deg=3:20 ほか少数hub | findings/05の「疎エッジ+密コア」パターンと一致 |

**研究上の主結論**: (1) betweenness-tierは実データで機能し、degreeの誤りを回避する。(2) **default-route-sinkガードという改良が実データから必要と判明**（armchairでは見えなかった）。(3) test6の視覚的混雑の主因は「少数core router間のLAGバンドル(800G)」で、parallel-collapseが直接効く。(4) backboneにmatrixは不要、mesh-core配置が要。

---

## 7.5 Round 3 プロトタイプ実走（test6 で実描画）

`research/findings/proto/layout-proto.ts` でエンドツーエンドを実装し test6 を実描画（現行の毛玉と比較）。

**実装した最小版**: parallel-collapse(集約帯域) → **k-core coreness でバックボーン検出** → tier0=k-core、他=coreからのBFSホップ距離 → tier内barycenter順序 → **tier0をグリッド塊にコンパクト化** → **線幅=log(集約帯域)キャップ(1.5〜8px)** + 帯域で色分け + LAG多重度×N表示。

**結果（現行 vs プロト）**:
| 指標 | 現行エンジン | v2プロト |
|---|---|---|
| 線幅 中央値/最大 | 14 / 64px | **4.7 / 6.6px** |
| 構造 | 毛玉(tier不明) | **4 tier band + コアmesh塊** |
| LAG | 別々のN本 | **1本+×N** |
| 帯域 | 線幅(暴走) | **色分け(400G=ピンク等)** + 細線幅 |

**実証された設計判断**:
1. **k-core tieringが betweenness-percentile より優秀**。degree=10の`cisco8711`/`ptx10002-36qdd`を自然にtier1へ、deg=17の`srx4300.lastresort`(default-route sink)もコアから除外。**§2.1のsink-guardはk-core採用で大部分が自動的に解決**（betweennessは補助に降格して良い）。
2. **線幅log-cap + 帯域色分けが最大の即効**（C-fix）。これ単体で毛玉が解ける。
3. **mesh-coreのグリッド塊化**で横幅短縮（3438→2731px）。

**次の反復で見えた課題**:
- **core-grid → tier1 のエッジが急傾斜で交差**。グリッド内順序を下流barycenterで最適化要。
- **`srx4300.lastresort`が星型ハブ**（全方位fan-in）。sinkは「side rail / 共有サービス」として別配置すべき（tier bandに入れず脇に）。
- tier0が17ノードと多い（maxCoreness=3で広く取れた）。「真のコア」をもっと絞る閾値調整 or coreness階層の活用。

→ **方向性は実証済み**: 構造認識(k-core) + LAG畳み + 線幅cap + mesh塊化 = test6が読める。armchairでなく実物で確認できた。

### 7.5.1 重要な設計修正（依存関係の忠実性）
プロト2版で「上流＞下流／機材の依存が読めるか」を実測:
```
エッジtier差: 隣接|Δ|=1=66, 同tier=28, スキップ=0 / 94   （スキップ0=粗い階層はOK）
非コアノード: 単一上流=23, 冗長多重上流=8, 上流なし横付き=5
```
**粗い上流＞下流は成立（スキップ0、70%隣接、backbone上/pod下）。だが機材ごとの依存は未達**:
- tier内をbarycenter順で置き「親(主上流)の真下」に置いていない → 依存パス(server→access→dist→core)が縦に追えない（斜め交差の原因）。
- 同tierリンク28本(30%)が方向を持たない。冗長8対が対称配置されていない。横付き5ノードが親不明で浮く。

**修正**: v2は構造バンドに寄せすぎて、旧flat-treeの「各ノードを主上流の真下に置く」依存ツリー配置を捨てていた。
**構造認識(k-core/LAG/線幅)を依存ツリー配置の"上に"重ねる** — バンドは構造で決め、**バンド内x位置は主上流の真下(tidy-tree)、冗長対は左右対称**に。旧flat-treeの「親の下」ロジックは活かす。§3の制約系では `primary-upstream alignment(soft)` + `redundancy mirror` として既に定義済み（P7/P8）— プロトに未反映だっただけ。

### 7.5.2 プロト3版: 依存ツリー配置(PAV)を実装
主上流(=lower-tier neighborのうち最大帯域)の真下にchildを置く。配置は **最小1D VPSC（Σ(x-desired)² s.t. 非重なり）を PAV(pool adjacent violators)で厳密解** — greedyの右押し出し偏りを排除し、兄弟群を親の下に**バランス配置**。これは自作VPSCソルバ採用(§4)の小規模検証にもなった。
- **結果**: 依存が縦に読めるようになった。例: DCポッド(.dc機材群)が`qfx5240-64od.dc`の真下に400G束として降りる＝「機材の依存」が視認可能。
- **mean |x-親X|=264px**だが、これは**下層ほど広がる(fan-out)ネットワークの本質**で、親真下に全childは収まらないため。局所のポッド束は読める。
- **残課題**: core mesh grid(tier0)の内部順序がidソートのままで、core→tier1の上部で交差。→ **grid列を下流サブツリーのbarycenterで並べ替え**れば解消見込み（次反復）。mesh自体はpeer(内部上下なし)なのでgrid化は正しい。

### 7.5.3 横（同tier）エッジの分類＝構造診断（test6実測28本）
同tierリンクは「配置バグ」でなく**ネットワーク構造を教える診断信号**。test6の28本を分類:

| 種別 | 例(test6) | 意味 | 配置の正解 |
|---|---|---|---|
| ① 冗長ペアpeer-link | `ce6885.pod3y—pod3u`, `thunder8665s-1—-2` | y/u・-1/-2 の双子＝HA/MLAGペアのkeepalive | **左右対称に隣接配置**(redundancy mirror) |
| ② core間ピアリング | `cisco8711—ptx10002 1600G x3`, `mx304—ne8000` | 上下無しのpeer | mesh塊/同一バンドに収める |
| ③ ポッド内east-west | `cisco8201-32fh.dc—ne8000-f1a.dc`(同.dc) | 同セグメント内の横通信 | ポッド単位で近接 |
| ④ **取りこぼしDCファブリック** | `nexus9164e-ns4.dc` が 800G で4台に横接続 | **east-west fabric**がtier3に平潰れ | **二次密クラスタとして検出**→専用配置/matrix |

**設計修正**:
- **§2.6 mesh-core検出を拡張**: グローバル最大k-coreだけでなく、**二次的な密クラスタ(局所核)も検出**する。④はk-core+BFSが見逃した（最大核でないため）。「intra-tierエッジの連結成分(size≥3, 高帯域)」を fabric/mesh候補として拾う。
- **§2.3 redundancy twin**: 「相互リンク∧共通近傍≥2(∧命名/モデル一致)」で双子検出し隣接・対称配置。①はプロトで未対称だった。
- 横エッジは**描く前に必ず分類**し、①②③④で扱いを変える（一律横線にしない）。

### 7.5.4 プロト4版: グループ連続配置 + core 2パス順序
- 全intra-tierエッジでunion-find → ①②③④を連続グループ化。**twin(thunder8665s-1/-2)とcore peer(cisco8711/ptx10002)が隣接、④fabricも連続**に。下層は整理された。
- **未解決＝core定義が緩すぎる（重要）**: maxCoreness=3（疎ネットなので低い）で「coreness==最大」を取ると**17ノード**＝backbone router(5-7台)＋**ポッドの冗長ペア(ce6885.pod3u等)が混入**。後者のポッドへの降線が上部を横断。
  - **修正方針**: core = `高coreness ∧ 高betweenness ∧ (router/L3 type)` の積、または「coreness最大の中からbetweenness上位N」。単純な k-core==max は疎ネットで過剰。**core tighteningはRecognizerの必須要件**。
  - 補足: betweenness(§2.1)とcoreness(§2.6)は**併用すべき**で、どちらか単独でない。betweenness=橋渡し度、coreness=密度。コア=両方高い。sink(高betweenness低coreness)とpod-pair(低betweenness高coreness?)を両方除外できる。

### 7.5.5 プロト5版: core tightening（最終反復）
`core = coreness最大 ∩ betweenness中央値以上`（さらに上限~√N）で **17→9ノード**に締まった。backbone router中心になり、ポッド対はtier2へ降りて正しくなった。下層・依存・グループ化は読める状態。
- **残る本質課題**: backbone mesh(9ノード)を**node-linkグリッドで描くと内部mesh辺＋降線が必然的に絡む**。これは閾値調整で消えない——**§6 mesh-core専用描画（コンパクトmesh配置 or matrix/small-multiples）が必要**な領域。test6の主問題はここに収束した。

### 7.6 研究の結論（6反復で検証されたこと）
**方向性は実証済み**。test6(実データ)で以下を確認:
1. ✅ **構造認識tiering**（k-core ∩ betweenness）= degree誤り/sink/pod-pairを除外し正しいcore。
2. ✅ **LAG collapse + 線幅log-cap + 帯域色分け**（C-fix）= 毛玉解消の最大の即効（幅14→4.7px）。
3. ✅ **依存ツリー配置(PAV, 親の真下)** = pod依存が縦に読める。
4. ✅ **intra-tierエッジのグループ化(union-find)** = 冗長twin/core peer/fabricが束ねられる。
5. ⏳ **mesh-core専用描画(§6)** = 唯一残る本質課題。backbone meshはnode-linkでなくコンパクトmesh/matrixで描くべき。
6. ⏳ **sink side-rail** = default-route sink(srx4300)は脇配置。

**実装の優先度**: (1)(2)は即効でPhase 0投入可。(3)(4)はコアエンジン。(5)が最難（mesh描画）。
プロト: `research/findings/proto/layout-proto.ts`（throwaway、決定的、自作PAV=VPSC片鱗の検証済み）。

### 7.7 M(mesh描画)の再定義 — backboneは密meshでなく「コア＋ポッド」
Mを掘る前に構造を実測(`backbone-analysis.ts`)した結果、**仮定が覆った**:
- max k-core(17)の内部密度=**0.05**（17ノードで内部7辺）＝**密meshではない**。「core grid」は誤診。
- 真の密コア=**6ルータのみ**（mx301/mx304/ptx10002-60mr/-36qdd/cisco8711/cisco8712, density **0.53**）。`cisco8711`はinternal=9/fanout=1の真ハブ。
- 多数の"router"型(acx7024x.stage等)はinternal=2/fanout=0＝**型はrouterだが位置はポッド内**。
- → **test6の正体＝「小さな6ルータのコア＋多数のポッド/セグメントがぶら下がる」**。Mはmatrix描画でなく**「コア(コンパクト)＋ポッド(サブツリー・クラスタ)」編成**が正解。

**ポッド取得のグルーピング信号**(`pod-signals.ts`):
- ❌ subgraph(1個・空)・hostGroups(全53同一) = **使えない**（データ品質問題、curation未整備）。
- ✅ **metadata.location**（NOC#N-x, NOC#D-x, Pod#x, Stage; 23群, 6-7ノード/群）= 物理ラック。
- ✅ **label suffix**（.noc/.dc/.svc/.stage/.moip/.5g/.podN）= 論理セグメント。
- → **Recognizer要件追加**: 明示subgraphが無い/空のとき、**location/suffixからポッド群を導出**する（§2.4 fabric検出と並ぶ「pod検出」ステージ）。

**M再定義後の配置モデル**: 上位 = {coreブロック, segment1, segment2, ...} を配置、各ブロック内 = ローカル依存ツリー。core小・コンパクト、ポッドは独立クラスタ、**core↔pod uplinkだけが間を跨ぐ**（intra-pod辺は局所＝交差激減）。これは旧flat-treeの「blocks」概念＋構造コアの統合。matrixは「真に密なfabric(spine-leaf)」が出たときだけ(§6)。

### 7.7.1 ポッド・モジュラリティの検証（M結論）
`pod-layout-proto.ts`でポッド編成を実装、cross-segmentエッジを分解:
```
cross内訳: core↔pod=24(想定内uplink)  sink↔各所=14(共有サービス)  真のpod↔pod=7(モジュール破壊)
```
→ **test6は高度にモジュラー**: 87/94辺がローカル(intra-pod or core-uplink)、**真の越境はわずか7辺**。「小さなコア＋独立ポッド群＋1共有sink」モデルが実証された。

**M結論（検証済み）**:
1. backboneは密meshでなく**6ルータの部分メッシュ**（小さく、コンパクトに描ける＝matrix不要）。
2. **ポッド編成が正しい組織原理**（真の越境7/94のみ）。
3. プロトの間延びは**原理でなくジオメトリ**（ポッド横一列＋sink右端放置で長辺発生）。
4. **正しいジオメトリ**: ①core中央上にコンパクト ②ポッドを**2D格子配置**（横一列でなく詰める, bin-pack/treemap） ③**sinkは中央**（全員接続なので端でなく中心の共有サービス） ④各ポッド=ローカル依存ツリー。
   → 残りは「ポッドブロックの2Dパッキング」という枯れたジオメトリ問題。原理は固まった。

**Recognizer要件（確定）**: pod検出ステージを追加。明示subgraphが空/無のとき location/suffix から導出。sink検出（高fanout共有サービス）→中央shared配置。

### 7.7.2 正直な再評価（ポッド版を実描画して判明・要訂正）
2Dパッキング＋sink中央でポッド版を実描画(`tmp-test6-pods.svg`, 1550x816)した結果、**「原理は正しい、ジオメトリだけ」は言い過ぎだった**:
- **core+sinkが全ノードに繋がる以上、中央の交差は構造的に消えない**。2Dパッキングで間延びは消えたが交差は残る。
- **全体の見やすさは tier版(7.5.5)の方が上**。tier版は帯が綺麗で下層依存が縦に読めた。ポッド版は意味グループは見えるが交差で相殺。
- **見やすさの主因はどの版でも C-fix(線幅cap+LAG畳み+帯域色)**。構造組み替え(tier vs pod)は二次的かつグラフ依存。
- **「越境7本＝モジュラー」は事実だが「綺麗な静的レイアウトが作れる」を意味しない**。ハブ過多(共有sink+core fanout)は配置の工夫だけでは限界。findings/01で自分が指摘した「商用は全部interactivityに逃げる」がここで効いてくる。

**訂正後の結論**:
1. **C-fix(線幅cap+LAG+色)＝確定の勝ち**。独立・即効・グラフ非依存。最優先で実装(Phase 0)。
2. **構造レイアウトは tier版ベース**(pod版より綺麗)。**pod-groupingは主ジオメトリでなくオプションのグループ表示(overlay)に格下げ**。
3. **ハブ過多な密度はinteractivityで補う前提**(hover強調・sink/pod折り畳み)。静的レイアウト万能論を捨てる。
4. matrixは真の密fabric(spine-leaf)が出たときのみ(§6)。test6には無い。

→ **Mは「掘り切って原理の限界も見えた」状態。** 教訓: armchairでもプロト主張でもなく、実描画して初めて分かることがある(ポッド版が綺麗にならないこと)。実装(I)はtier版+C-fixベースで。

### 7.8 tier版の磨き込み（上部交差の低減）
ユーザ選択Aでtier版を改良:
1. **コアを真の6ルータmesh(密greedy)に絞り横一列**配置 → 2D gridでなく単段なので core→tier1 の降線が素直、上部交差が減。
2. **sinkをside-rail(右端)に分離 + エッジ破線フェード(opacity 0.18)** → 14本のfan-inが主張しなくなった。sink検出=高fanout共有サービスをtier流から外す。
- **トレードオフ**: コアを6に絞った分tier1が20ノードと横広(依存整列 mean|x-parentX| 290→362px)。上部は綺麗だが全体は横長。
- **次の改良候補**: tier1(20)が広すぎ → (a)BFS距離tierを細かく(skip-level許容)、(b)tier1をpod別にサブグループ化、(c)非連結成分の縦パッキング。
- **C-fix + sink-fadeは確定**。sink-fade(共有サービスの破線化)=横エッジ④分類の発展で新規の有効テク。

### 7.9 硬直tierバンド → 依存ツリーの森（重要な方向転換）
ユーザFB:「整いすぎて逆に依存が見えない＋横長」＝**硬直tierバンドの副作用**(全部を4横帯に押し込む→親が真上の遠くにいて"ぶら下がり"が見えない＋1帯20ノードで横長)。
→ **tierバンドをやめ「各コアルータがrootの依存ツリー(tidy-tree)＋サブツリーを2Dパッキング」**に転換(`tidy-forest-proto.ts`)。これは旧flat-treeの「blocks＋tidy-tree」思想の再評価＝v2がtierに寄り過ぎた揺り戻し。
- **primary-parent forest**: 各ノードの親=core寄り(BFS距離小)かつ最大帯域の隣接。core=root。→ 木分割(各ノード1親)。
- **per-root tidy-tree**(Reingold-Tilford簡易, 葉カーソル)で各コーンをローカル配置 → ブロック化(w,h)。
- **ブロックを2Dシェルフパッキング**(幅TARGET超で折り返し) → 縦を使う。
- **エッジ2層描画**: 実線=tree(親子, 依存), 破線薄=非tree(冗長/mesh/越境), 極薄破線=sink。**ツリー構造が浮く**。
- **結果(test6)**: 横4018→**1602px**、依存が縦に読める(コーンが箱で見える)、ブロックサイズ[17,16,9,8,1,1]。tree-edges 46/94。
- **残課題**: 非tree接続(冗長/mesh/越境/sink 48本)の破線が"もや"になる → **本来interactivityで出し入れすべき**(findings/01の商用の逃げ方が正しい)。静的では破線フェードが落とし所。サブツリー不均衡(17,16の巨大コーン)も要均し。
- **結論の更新**: **配置の本線はtierバンドでなく「依存ツリーの森＋2Dパッキング」**。tierは補助(role/betweennessはforest構築の親選択に使う)。C-fix・sink-fade・tree/non-tree2層描画が確定テク。

### 7.9.1 破線の"もや"の正体＝冗長でなくファブリック＋共有サービス（重要）
ユーザ質問「横の接続は全部冗長?」→ 非ツリー48本を名前で分類して判明:
- **① DC east-westファブリック(最大, 800G)**: `qfx5240-64od.dc`→s9321/nexus9364e, `nexus9164e-ns4.dc`→xh9320/qfx5250 等。**④の取りこぼしfabric**そのもの。**冗長でなくデータ平面の本線**。
- **② 共有サービス(fsax9004g)**: 多数ポッドに100-200Gで接続。**srx4300と同じ「みんなが使う共有」=第2のsink**。冗長でない。
- **③ 本当の冗長は少数(~5本)**: cisco8711—mx304(2nd-uplink), qfx5240のdual-home 等。
- → **もやの大半はfabric+shared-service。冗長はごく一部。**
- **解決策(=次の実装)**: もやを消すには冗長でなく ①**DCファブリックを認識して塊(fabric block/matrix)に** ②**共有サービスを多sink検出して side/shared 扱い**。
- **Recognizer要件追加**: **multi-sink検出**(単一lastresortでなく、高fanout×多segment横断ノードを全部shared扱い)。**fabric検出**(同tier高帯域≥400Gの密連結成分)。

### 7.9.2 multi-sink検出を実装（構造的に成功）
- **判定信号の訂正**: 「多segment横断(suffix spread)」は誤り(srxの近傍は.noc/.podsに集中しspread低)。正解=**「度数高いのに誰のprimary parentでもない＝皆が副リンクで繋ぐ」**。2パス(仮forest→childCount→`deg≥5 ∧ childCount≤0.34·deg`で判定→forest再構築)。
- **結果**: fsax9004g(deg7,child0)とsrx4300(deg17,child1)を**名前マッチなしで両方検出**。下の"shared services"行に分離＋エッジ激薄化 → 24本のもや消失。
- **残課題＝DCファブリック(§6本番)**: qfx5240/nexus9164e系の800G east-westが**ツリーの森と直交**(各.dcノードは別core parentの別ブロックに散在、fabricは横串)。これは「1ノードがツリー所属∧fabric所属」の根本テンション → **fabricを認識して森から抜き、専用クラスタ/matrixに**するのが§6の本番。ここから先は静的の限界＝interactivity領域(hoverで接続強調)。
- **forestアプローチの到達点**: 依存コーン(実線tree)クリア + 共有サービス分離 + LAG/幅/色。残るのはfabric抜き出しとinteractivity。**配置の本線として確立**。

### 7.10 純粋配置の交差削減（極めた結果＝ツリー交差0）
ユーザ方針「グルーピング/fabricは別問題、純粋配置を極める」「交差を」→ multi-sink等の認識機能はbaselineに戻し、**配置ジオメトリの交差削減**に集中。
- **手法**: barycenter反復(6回)。各ノードの子＆各ブロックを**サブツリーの外部リンク先のX重心**で並べ替え→繋がってるもの同士を近くに。決定的。
- **結果**: 交差 **448→313 (−30%)**。内訳が決定的: **tree×tree=0** / tree×nontree=95 / nontree×nontree=218。
- **＝依存ツリー(「何にぶら下がるか」)の交差は完全ゼロ**。残る313は全て**非ツリー(冗長/mesh/fabric/越境)の破線**の交差。
- **結論**: 「交差を極める」観点では**配置側はほぼ完了(tree交差0)**。これ以上の交差削減は**配置でなく配線(直交/bundling)かinteractivity**の領域。純粋配置の到達点として確定。
- 確定テク追加: **外部リンクbarycenter反復**(子＋ブロック順)で非ツリー交差も30%減（決定的）。

### 7.11 配置の駆動＝画面幅でなく依存関係（ユーザ訂正）
ユーザ訂正「画面幅に合わせるのでなく、依存関係＋見やすさで配置すべき」。2Dシェルフパッキング(幅TARGETに詰める)は**screen-fitting＝本末転倒**で、コーンを任意Yに置き「上流＝上」のグローバル一貫性を失っていた。
- **修正**: シェルフパッキング廃止。**全コーンをコアの行に上端揃え**→depth=down がグローバルに一貫(上流が必ず上)。コーンは接続順に横並び、**幅は構造が決める**(画面に詰めない)。
- **結果**: 交差 **313→221**(上端揃えで斜めの長い越境線が減)。各コーン=綺麗な依存ツリー、tree×tree交差=0維持。viewBox 4120×556(横長だが構造的)。
- **原則確定**: 配置は依存(上流→下流の縦の一貫性＋各コーンのtidy-tree)で駆動。幅/アスペクト比をターゲットにしない。幅が問題なら**コーン内をcontourパッキング(Buchheim)で詰める**(screen-fittingでなく構造的圧縮)が次の一手。

### 7.12 「なんで並列?」＝接続があるのに森にしていた誤り（重要修正）
ユーザ指摘「接続がなければ別軸で描くのは分かるが、接続があるのになぜ並列?」。
- **誤り**: primary-parent forestで**コア6台を全部それぞれ独立ツリーのroot(親なし)**にしていた→depth0に6台並列、コア間リンク(=バックボーン本体)が"非ツリー破線"に格下げ。接続があるのに別々に見えた。
- **修正**: **コア=1つの連結構造→1本の木に統合**。最も中心的なコアルータ(内部次数最大=cisco8711)を**唯一のroot**にし、他コアルータはそこへ繋がる形に。BFS/parentを単一rootから計算。
- **結果**: blocks 6→**1**(52ノードの1木)。**コア間リンクが実線tree(バックボーンの背骨=主役)に昇格**。交差 221→**136**、nontree×nontree **218→47**(バックボーン構造化で破線の絡み激減)。tree×tree=0維持。「1つのネットワーク」として読める。
- **原則追加**: **連結成分は1本の木**(最中心ノードをroot)。並列(森)にするのは**非連結のときだけ**。「接続があるなら構造で繋ぐ、破線に逃がさない」。

---

## 8. 次工程（Round 4 候補）

- **default-route-sinkガードの定式化**（到達元割合・経路集中度の閾値を test6 で詰める）。
- **mesh-core配置の具体アルゴリズム**（NOCバックボーン部分メッシュをどう美しく置くか — 円/小格子/制約）。test6の主問題はこれ。
- **プロトタイプ拡張**: 制約生成 + 自作VPSCの最小実装をtest6で回し、実レイアウトを描いて現行と比較。
- **Phase 0（並行・即効）**: 容量を線幅から分離（LAG多重度表示と合わせると効果大）。

# 構成図ディスカバリ: 土台と UX（仮の理想形）

> ステータス: **ドラフト / 仮**。`topology-discovery.md` の探索を経て、
> 観測モデルに収束した時点の「**こう作るのが筋**」のスナップショット。
> 細部はまだ詰めきれていない。実装着手前。

`topology-discovery.md` が議論ログ・選択肢比較なのに対し、本書は
**現時点で固まった輪郭**を最短で見渡せる形に書き起こしたもの。

詳細は分割ドキュメント:
- `topology-foundation-schema.md` — core 型拡張と DB スキーマ
- `topology-foundation-plugin-contract.md` — plugin v2 仕様
- `topology-foundation-identity.md` — identity / ifIndex / bootstrap
- `topology-foundation-resolve.md` — resolve() アルゴリズム
- `topology-foundation-metrics.md` — メトリクスログ永続化
- `topology-foundation-mvp.md` — v1 最小スライス
- `topology-foundation-open-questions.md` — **user 決定待ちの論点**

## 0. 前提

**0.1 後方互換性は考慮しない**。memory「No backcompat for server schemas」に従い、
クリーンに作り直す。既存 `content_json` のデータマイグレーション、プラグイン契約 v1/v2
の並走、editor の段階移行 — 全部不要。

**0.2 `NetworkGraph` JSON が引き続き核**。観測モデルを乗せるために**別の型を作らない**。
core の `Node` / `Link` / `Subgraph` / `NodePort` に optional な `provenance` 1 フィールドを
追加するだけ。スナップショットも authored もすべて `NetworkGraph`。resolve() は
`(NetworkGraph[]) → NetworkGraph` の純粋関数。

**0.3 既存資産の活用**
- `libs/@shumoku/core/src/merge.ts` の `mergeWithOverlays()` を resolver 実装の起点に
- `data_sources.status` / `fail_count` を retraction ゲートに流用
- `topology_data_sources.priority` は廃止予定（merge ポリシー無しなので不要）

---

## 1. 設計の核 — 観測モデル

> **「構成図である以上、正しい情報は一意に定まる」**。
> ゆえに整合性は merge ポリシーの問題ではなく、**観測の問題**。

- 各ソース（authored / NetBox / SNMP-LLDP / Proxmox / k8s / …）は
  **観測 (`{source, value, observedAt}`) を提供する**
- ソースが一致したら `confirmed`、食い違ったら `conflicting`
- システムの仕事は merge ではなく**不一致の検出と提示**。どちらが正しいかは
  ソースの再同期・観測品質・人の判断で*外部的に*決着する
- priority / recency / 所有者ルールは原則消える

### 1.1 フィールドの3分類

観測モデルがそのまま効くのは「事実フィールド」のみ。他は性質が違う：

| 分類 | 例 | 取り扱い |
|---|---|---|
| **事実** | hostname / model / mgmtIp / 結線 | 観測比較。一致=confirmed / 不一致=conflict |
| **選択** | display label / position / subgraph 所属 / 注釈 | reality に値が無い。**人だけが書く**、conflict 原理的に不能 |
| **意図 vs 実態** | intended_rack / observed_rack | **別フィールドに分離**。1つの値に押し込まない |

### 1.2 エンティティ — `NetworkGraph` のまま

スナップショットも authored もすべて `NetworkGraph`。core 型に**最小の拡張**：

- `Node` / `Link` / `Subgraph` / `NodePort` に optional
  `provenance?: { source: string, state?: ..., observedAt?: number }` を追加
- `id` は不透明・安定・更新を跨いで不変（メトリクス bind の必須条件）
- 識別キー集合（mgmtIp / chassisId / sysName / ifIndex / MAC / …）は既存の
  `metadata` ではなく**型付き optional `identity` フィールド**として追加
- フィールド値そのものはフラット（多値で持たない）

**フィールド単位の観測リストは型に住ませない**。snapshot 群を**実行時に走査**して
resolver が比較する。Element inspector の「観測の側並び表示」は別 API
（`GET /topologies/[id]/elements/[id]/observations`）で都度計算して返す。

詳細は `topology-foundation-schema.md`。

### 1.3 resolve = `(NetworkGraph[]) → NetworkGraph`

入力も出力も `NetworkGraph`。純粋関数。

```
resolve(authored: NetworkGraph, snapshots: NetworkGraph[]) → resolved: NetworkGraph

per node/port/link (identity でグループ化):
  per field:
    if all observations agree     → { value, state: 'confirmed' }
    if disagree                   → { value: <authoritative-for-class>, state: 'conflicting' }
    if only one source            → { value, state: 'discovered-only' or 'authored-only' }
    if human-owned                → human value, 他は observed only として表に出さない
```

merge ポリシー無し。priority 不要。純粋に diff 検出。テスト容易。
既存 `libs/@shumoku/core/src/merge.ts` の `mergeWithOverlays()` を出発点に拡張する。

詳細は `topology-foundation-resolve.md`。

### 1.4 retraction

- ソース X は **X 自身が主張した値しか取り消せない**
- 負の観測（「今回見えなかった」）は**ヒステリシス**（N 回欠落で初めて retract）
- **失敗・空スキャンは何も retract しない**ゲート — 既存
  `data_sources.status` / `fail_count` を流用
- consistent snapshot 単位の更新（フィールド逐次反映しない）

### 1.5 構築 = 空状態への更新

build と update は別物に見えて同じ。**単一機構**。最初の取り込みは空グラフへの観測投入。

### 1.6 掴みのフェーズ（identity 確立）

データライフサイクルの一段階。UI ゲートではなく**システム側が達成する到達点**。

1. ソースから node が初観測される（identity キーが付随）
2. resolver は既存 node と identity キーでマッチを試みる
3. マッチした → 同一 node として観測を統合（**掴めた**）
4. マッチしない → 新規 node として追加（**まだ掴めていない**）
5. 次回観測時に同じ identity キーが取れれば「掴み」が確立し継続マッチ

**identity quality indicator** — node ごとに「識別がどれだけ安定するか」を可視化する：

- `stable` … 複数の独立キーが揃う（mgmtIp + chassisId + sysName）
- `weak` … 1 つのキーのみで他ソースとの突合・再スキャン時の再マッチが不安定
- `unbound` … キーがほぼ無く、再スキャンで毎回別 node として見える可能性

ifIndex 不安定問題（再起動で ifIndex が変わる）も「掴みが弱い port」として表面化する。
詳細は `topology-foundation-identity.md`。

---

## 2. ソースとポリシー

### 2.1 全ソースが供給すべきもの

| 観点 | 内容 |
|---|---|
| **identity keys** | node 用 (mgmtIp / chassisId / sysName / …) と port 用 (ifIndex / ifName / MAC) |
| **観測フィールド** | そのソースが知っているフィールドだけ。知らないものは未観測（欠損 ≠ 不一致） |
| **観測時刻** | observedAt は陳腐化判定に必須 |
| **snapshot** | 1スキャン = 1 snapshot として丸ごと提供（途中状態を流さない） |

### 2.2 スコープポリシー（Netdisco 流）

ソース（特に autoscan 系）に対して：

- `include` — CIDR で対象を限定
- `exclude` — CIDR で除外
- `boundary-nodes` — 「この機器の隣接は辿らない」フェンス
- `no-types` — CDP/LLDP の device type 正規表現で除外（IP電話 等）

**「クロールするな」は配置ではなくこの設定で表現**（デーモン必須化を避ける）。

### 2.3 トランスポート — 中央が基本、中継はオプション

- デフォルト: server が直接 SNMP/LLDP を叩く
- 到達不能セグメントには **ステートレス中継 (`shumoku-probe`)** をオプションで
  （Prometheus snmp_exporter 型、登録・heartbeat・DB 無し）
- Scanopy 型の登録デーモン必須にはしない

### 2.4 カタログ駆動の探索能力ヒント

**カタログがそのモデルの対応探索プロトコル/MIB を宣言**しておく。autoscan 系
ソースはまず機器を識別し、カタログを引いて**有効な探索計画**を立てる。総当たりにしない。

#### 探索フロー（autoscan 系）

1. **到達性** — ping / ARP
2. **識別** — SNMP System-MIB（sysObjectID / sysDescr / sysName）。
   HTTP / mDNS / MAC OUI 等のフォールバック
3. **カタログ照会** — sysObjectID をキーに model を引き、対応能力を取得
4. **能力に従った探索だけ実行**

#### 宣言の粒度 — MIB 単位 / YANG モデル単位

「SNMP 対応」は粗すぎる。同じ SNMP でも LLDP-MIB を実装するかは別。

```yaml
# 例: catalog entry
model: catalyst-9300-48p
series: catalyst-9300
discovery:
  snmp:
    versions: [v2c, v3]
    mibs: [system, if, ip, lldp, cdp, entity, bridge, qbridge]
  netconf:
    yang: [openconfig-interfaces, openconfig-lldp, cisco-iosxe-native]
  cli:
    family: ios-xe
```

series で baseline、model で override（catalog の継承モデルそのまま）。

#### 宣言 vs 観測 — 観測モデルに乗る

- **宣言** = カタログが「対応してるはず」と言う集合（探索計画）
- **観測** = 実際に応答したか
- 食い違いは*それ自体が観測*として残る（ファーム差・機能無効化・カタログ陳腐化を示唆）
- 特別機構不要。観測モデルの自然な延長

#### カタログに無いとき

ありふれたケース。戦略：

1. **sysObjectID 外部辞書フォールバック** — enterprise OID は世界的に一意。
   公開データの簡易辞書（オフライン同梱可能）でベンダー + 大まかな model を引ける
2. **probe-all** — 完全に未知なら**標準 MIB だけ**試す（System / IF / IP / LLDP-MIB）。
   応答した能力 = **観測された実能力**として記録
3. **「未知デバイス」を UX に上げる** — Element inspector に
   `model: unknown — [Add to catalog]`。観測された実能力からカタログ草稿を起こす導線
4. SNMP 非対応機器 — HTTP / mDNS / MAC OUI 等で識別フォールバック。
   名前・MAC・IP しか取れないケースも観測モデルではそのまま受けられる

**discovery とカタログは共進化する** — 未知デバイスは catalog エントリ追加の動機になり、
カタログが充実すると次回からの探索が効率化する。editor を持つ shumoku の強み。

#### UX 含意

- カタログ画面の model に **"Discovery capabilities" タブ**（宣言の編集）
- Element inspector で **宣言された能力 vs 観測された実能力** を side-by-side
- `/topologies/[id]` の **"未認識デバイス" フィルタ**（model: unknown の集合）
- ソース個別画面（UX ④）に「**未知デバイスへの probe 戦略**」設定（標準 MIB のみ /
  外部辞書を使う / 完全スキップ）

---

## 3. ストレージ形

すべての観測 / authored は **`NetworkGraph` JSON** として保存される。型は1つ。

- `topologies.content_json` = **authored レイヤー = `NetworkGraph`**。editor 専有、
  discovery は触らない
- 新規 `topology_observations` テーブル: 1 行 = 1 ソースの 1 snapshot
  （`graph_json` も `NetworkGraph`）
  ```sql
  CREATE TABLE topology_observations (
    id TEXT PRIMARY KEY,
    topology_id TEXT NOT NULL REFERENCES topologies(id) ON DELETE CASCADE,
    source_id TEXT NOT NULL REFERENCES data_sources(id) ON DELETE CASCADE,
    captured_at INTEGER NOT NULL,
    status TEXT NOT NULL,   -- 'ok' | 'failed' | 'empty'
    graph_json TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
  ```
  再同期は**行ごと差し替え**（in-place mutation せず clobber 不能）
- `resolved` ビューは**都度 resolve で生成**（初期は materialize しない）
- メトリクス mapping は **port-level identity** で持つ（topology 更新で切れない）
- 廃止: `topology_data_sources.priority`（merge ポリシー無しで不要）

詳細とインデックス / retention は `topology-foundation-schema.md`。

---

## 4. UX — ページ構成

サーバ Web は現状 `topologies / datasources / plugins / dashboards / settings`。
観測モデルが要請するのは **`datasources` を `sources` に昇格して discovery を内包**
することと、**conflicts を topology viewer のタブにする**ことだけ。新規トップレベル
ページは作らない（観測モデルでは「build = update」「conflict は要素のプロパティ」
なので、独立ページにすると二重化する）。

### 4.1 サイドバー

```
Shumoku
─────────────────
🏠 Home
🗺  Topologies
🔌 Sources              ← datasources を昇格（scan 履歴・実行を内包）
📊 Dashboards
🧩 Plugins
⚙  Settings
```

### 4.2 ページ別役割

| パス | 目的 |
|---|---|
| `/topologies` | 一覧。ソース構成・最終同期・state サマリ（conflict 数） |
| `/topologies/[id]` | **ビューア**。タブ: Graph / Conflicts / History。element inspector |
| `/topologies/[id]/settings` | ソース束ね・identity マッピング・topology 単位のスコープ |
| `/topologies/[id]/edit` | authored レイヤーの編集（既存。観測モデルでは「人が書く層」に） |
| `/sources` | ソース一覧 + 直近 run サマリ |
| `/sources/[id]` | 接続設定・scope policy・identity 供給キー・**スケジュール・スキャン履歴・ad-hoc 実行** |
| `/dashboards`, `/plugins`, `/settings` | 既存維持 |

- **「Discovery」は独立ページにしない** — スキャン履歴・ad-hoc 実行・スケジュールは
  すべて `/sources/[id]` 内に置く。クロスソースの稼働状況が要るなら `/sources` 一覧の
  サマリ列か Dashboard ウィジェットで賄う
- **「Conflicts」も独立ページにしない** — conflict は必ず *ある topology の要素*に
  属するので、`/topologies/[id]` の **Conflicts タブ**が居場所。グラフの ⚠ マーカーと
  同じデータのリスト表示

### 4.3 重要な UX モーメント

土台のうち**「観測」「conflict」「identity 突合」「scope」**を見せる箇所が要。
以下は ASCII ワイヤフレームで意図を示す（実装イメージ）。

#### ① トポロジビューア（state を視覚化、Conflicts を内包）

```
┌─Production net──────────────────────────┬─Inspector──────────────┐
│ [Graph*] Conflicts(3)  History          │ Selected: core-rtr-01  │
│ Layer: [L2*] L3  Workloads  Apps        │                        │
│ ┌─[graph]──────────────────────────────┐│ 詳細は ② へ            │
│ │  ●━━━━●         ●(ghost)             ││                        │
│ │  │     │                              ││                        │
│ │  ●─────●(dashed: authored-only)       ││                        │
│ │           ⚠(conflict)                 ││                        │
│ └────────────────────────────────────────┘│                        │
│ Filter: ▣confirmed ▣conflict             │                        │
│         ▣disc-only ▣auth-only            │                        │
│ Overlay: ▣metrics  Snapshot: live ▾      │                        │
└──────────────────────────────────────────┴────────────────────────┘
```

- ビューア上部タブ: **Graph / Conflicts / History**。すべて同じ topology の別の見方
- `confirmed` 実線・通常色 / `discovered-only` ゴースト・破線 / `authored-only` 破線 /
  `conflicting` 警告色 + ⚠

- レイヤースイッチは Scanopy 流（L2/L3/Workloads/Apps）

#### ② Element inspector — 観測の側並び表示

土台の最重要 UI。フィールドごとに**観測を全部見せ**、state を示し、必要なら resolve 操作。

```
core-rtr-01
──────────────────────────────────────────────────
Identity keys                              🟢 stable (3 keys)
  mgmtIp     10.0.0.1
  chassisId  00:11:22:33:44:55
  sysName    core-rtr-01

Fields
  hostname            core-rtr-01           ✓ confirmed
    ├ NetBox          core-rtr-01           5d ago
    └ SNMP sysName    core-rtr-01           2m ago

  model               ⚠ conflicting
    ├ NetBox          ISR 4451              5d ago    [shown as default]
    └ SNMP ENTITY     ISR 4461              2m ago
    [Use SNMP] [Use NetBox] [Re-sync NetBox] [Mark NetBox stale]

  intended_rack       R4U10   (NetBox)
  observed_rack       R4U12   (autoscan)   ← 意図と実態は別フィールド

  position            (240, 180)            you (authored)
  subgraph            Core                  you (authored)

Ports (24)                                  🟡 weak (ifIndex only on 6 ports)
  Gi0/1   eth0    ✓ confirmed
  Gi0/5   eth5    ⚠ MAC observed on two ports
  ...
```

identity quality indicator（🟢 stable / 🟡 weak / 🔴 unbound）は node/port それぞれに
表示する。weak の port は ifIndex 再採番でメトリクス bind が切れるリスクがある旨を
ツールチップで示す。

#### ③ Conflicts タブ（topology viewer 内）

独立ページではなく ① と同じ viewer の中のタブ。同じ conflict を、グラフ上では
要素の ⚠ マーカーとして、ここではフィルタ・ソート可能なリストとして見せる。
クリックで該当要素を選択 → Element inspector へ。

```
Production net   [Graph] [Conflicts(3)*] [History]
──────────────────────────────────────────────────────
Filter: kind ▾   source ▾   age ▾

🟡 core-rtr-01 . model
   NetBox: ISR 4451  ⟷  SNMP: ISR 4461
   [Select in graph]  [Resolve...]

🟡 sw-3 . link.to(core-rtr-01)
   NetBox: cable #42       ⟷  LLDP: not observed (3 scans)
   [Select]  [Resolve...]

🟡 vm-web-01 . subgraph
   manual: "Web tier"      ⟷  k8s: namespace "production"
   [Select]  [Resolve...]
```

横断的に「conflict を抱える topology が何個あるか」を見たい場合は
`/topologies` 一覧の state サマリ列か Dashboard ウィジェットで賄う（独立ページにしない）。

#### ④ ソース詳細（SNMP の例、Netdisco 流ポリシー）

```
SNMP main
──────────────────────────────────────────────────
Connection
  Seeds          10.0.0.1, 10.0.0.2
  Credentials    community: ***  (per-host overrides...)

Scope policy
  ◉ include CIDR     10.0.0.0/16
  ◯ exclude CIDR     10.0.66.0/24
  ◯ boundary nodes   fw-edge-1     (don't crawl past)
  ◯ no-crawl types   "IP Phone", "lightweight AP"

Identity keys supplied
  Node  mgmtIp, chassisId, sysName
  Port  ifIndex, ifName, MAC

Schedule
  Light  every 15m       Deep  every 6h

Recent observations
  2m ago   ✓  142 nodes, 318 ports   (+4, ~2, retract candidates: 1)
  17m ago  ✓  ...
  32m ago  ✗  3 SNMP timeouts        (no retraction applied)
```

#### ⑤ Identity ブートストラップ（初回突合）

手描き図に初めて autoscan を繋いだ瞬間の救済 UI。

```
First-time discovery match — SNMP main
──────────────────────────────────────────────────
Observed 142 devices. 89 auto-matched by mgmtIp.
53 unmatched. Review:

10.0.0.42  (sysName: rtr-edge-1)
  Likely match: "Edge Router 1" you drew    confidence 84%
  Match key would be: mgmtIp = 10.0.0.42
  [Match] [New node] [Skip]

10.0.5.1   (sysName: sw-distri-A)
  No likely candidate in authored
  [New node] [Skip]

[Apply all "New node" for remaining ▾]
```

#### ⑥ Sources 一覧（discovery を内包）

独立 Discovery ページは作らない。`/sources` 一覧で直近 run を見せ、ad-hoc 実行や
履歴詳細はソース個別画面（④）に入る。

```
Sources                                         [Run all] [+ Source]
──────────────────────────────────────────────────────
Name           | Type      | Role     | Last run | Result                | Next
SNMP main      | SNMP/LLDP | topology | 2m ago   | ✓ 4 added / 2 changed | in 13m
NetBox-HQ      | NetBox    | topology | 5d ago   | ✓ no change           | manual
Zabbix metrics | Zabbix    | metrics  | live     | streaming             | -
Proxmox cluster| Proxmox   | topology | 1h ago   | ✗ auth failed         | retry 1h
```

---

## 5. 棚上げ（土台の上で詰める）

土台の*形*は概ね固まったが、以下は土台の制約の中で個別に詰める：

1. **identity キーのスキーマ** — 各ソース種別が何を供給するか（NetBox / LLDP /
   Proxmox / k8s で具体表）
2. **観測品質の権威** — 事実クラスごとに「conflict 時の既定表示」を決める
   小さなテーブル（hostname → device 自身 (SNMP sysName)、model → ENTITY-MIB、
   intended-* → NetBox、…）
3. **retraction ヒステリシス** — 既定 N 回。ソース種別ごとに override 可
4. **意図 vs 実態フィールドの命名規約** — `intended_*` / `observed_*` でいいか
5. **`shumoku-probe`（ステートレス中継）の最小仕様**
6. **realtime プロトコル** — WS で構造変化（add/retract）も流す形（現状はメトリクス値のみ）
7. **混合 layer 描画**（L2 と Workloads の同時表示・スティッチ）の具体
8. **カタログ discovery 宣言の具体スキーマ** — `discovery.snmp.mibs` 等の語彙定義、
   主要ベンダー初期データ（Cisco IOS-XE / NX-OS / Juniper / Arista の baseline 宣言）、
   sysObjectID → model フォールバック辞書の同梱データ
9. **未知デバイスからカタログ草稿を起こす導線** — Element inspector の
   "Add to catalog" を押した時の具体フロー
10. **メトリクスログ persistence 戦略** — 外部 TSDB (Prometheus) 連携 / 内蔵 SQLite TSDB /
    ハイブリッド。詳細は `topology-foundation-metrics.md`
11. **MVP スライスのスコープ確定** — v1 で何を作り何を v2 に回すか。
    詳細は `topology-foundation-mvp.md`

---

## 関連

- `topology-discovery.md` — 探索ログ・選択肢比較
- core 変更想定: `Node` / `Link` / `Subgraph` / `NodePort` への観測フィールド付加
  （memory「Unify over parallel fields」に従い、server 側パラレル化は避ける）
- 既存サーバ DB スキーマに `topology_observations` テーブル追加が必要
  （memory「No backcompat for server schemas」: クリーンに足す）
</content>

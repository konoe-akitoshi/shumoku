# Topology Foundation: スキーマ詳細

> ステータス: ドラフト。`topology-foundation.md` の付属。
> core 型拡張 + DB スキーマの具体形。後方互換は考慮しない。
>
> **一部実装済み・更新あり**: ここで計画した `topology_source_id` /
> `metrics_source_id` の廃止と `mapping_json` の置き換えは composition-store
> リファクタで実施済み（マッピング = `metrics-binding` attachment、ソース = m2m
> 一本化、解決済みグラフ = `topology_resolved_graph` にマテリアライズ）。
> **as-built は `topology-composition-store.md` と `../database.md` を参照。**

## 1. core 型の拡張

`@shumoku/core/src/models/types.ts` への追加。**既存フィールドは触らない、optional な
追加のみ**。memory「Unify over parallel fields」に沿い、server 側のパラレル化はしない。

### 1.1 共通の `Provenance` / `Identity` 型（新規）

```ts
// 新規: 観測モデル用の共通型
export interface Provenance {
  /** 観測したソースの識別子。`Alert.source` と同じ規約で open string。
   *  'intrinsic' は project overlay（人の編集＝最優先 contribution）の由来を示す
   *  予約語。これは **provenance ラベル**であって別の保存層ではない。 */
  source: string

  /** resolver が埋める。snapshot 内では未設定でよい。 */
  state?: 'confirmed' | 'authored-only' | 'discovered-only' | 'conflicting'

  /** Unix ms。ソース側スキャン時刻。 */
  observedAt?: number
}

/** Node / Port を実機にひも付けるキー集合。
 *  resolver はこのキーで複数ソースの観測を同一 entity に集約する。
 *  Node 用: device-identifying。
 *  Port 用: interface-identifying（NodePort.identity として使う）。 */
export interface Identity {
  /** 管理 IP（v4/v6 どちらでも文字列）。Node の最強キー。 */
  mgmtIp?: string

  /** LLDP chassisId（MAC かサブタイプ別文字列）。Node の確実キー。 */
  chassisId?: string

  /** SNMP sysName。Node のフォールバックキー。 */
  sysName?: string

  /** Port の ifIndex（再起動で変わりうる、単独使用は避ける）。 */
  ifIndex?: number

  /** Port の ifName（"GigabitEthernet1/0/1" 等）。Port の最強キー。 */
  ifName?: string

  /** MAC アドレス。Port の補助キー、Node でも shared MAC で識別可能。 */
  mac?: string

  /** その他ベンダー固有 ID（NetBox device-id 等）。 */
  vendorIds?: Record<string, string>
}
```

### 1.2 既存型への追加

`Node`, `Link`, `Subgraph`, `NodePort` それぞれに以下を追加：

```ts
export interface Node {
  // ... 既存フィールド変更なし ...

  /** 観測元（authored / snapshot 由来）。resolved グラフでは resolver が埋める。 */
  provenance?: Provenance

  /** 実機との突合に使う identity キー集合。snapshot を生成するソースが埋める。 */
  identity?: Identity
}

export interface Link {
  // ... 既存フィールド変更なし ...
  provenance?: Provenance
  // Link は identity を持たない（endpoint で識別される）
}

export interface Subgraph {
  // ... 既存フィールド変更なし ...
  provenance?: Provenance
  // Subgraph は identity を持たない（論理グループ、人が作る）
}

export interface NodePort {
  // ... 既存フィールド変更なし ...
  // 注: 既存の `source: 'catalog' | 'custom'` はカタログ由来かを示すフラグで
  //     観測モデルの provenance とは別物。残す。
  provenance?: Provenance
  identity?: Identity
}
```

### 1.3 NetworkGraph 自体は変更しない

ルート `NetworkGraph` には触らない。観測モデルの状態はすべて要素レベルに乗る。
ただし**ソース由来の snapshot を表す NetworkGraph** を整形する慣習を README で明示：

- `name` フィールドにソース ID を入れる（人間可読のため）
- 全要素に `provenance.source = '<sourceId>'` が付いている前提
- `identity` も付くべき

これは型の制約ではなく**プラグイン契約**側で要求する（`topology-foundation-plugin-contract.md`）。

### 1.4 resolver の出力契約

resolver が返す `NetworkGraph` は通常の NetworkGraph と同型だが、以下を満たす：

- 全 Node / Link / Subgraph / Port に `provenance` が**必ず**埋まる
- `provenance.state` が**必ず**埋まる（resolver の責務）
- フィールド値は単一（多値リストにしない）
- conflicting のときの表示既定値は「観測品質の権威」に従う（フィールドクラス別、
  別ドキュメントで定義予定）

renderer / editor は `provenance.state` を読んで描画を変えてもいいし、無視してもいい。
optional な拡張なので既存の renderer は無改修で動く。

## 2. DB スキーマ — 追加と廃止

memory「No backcompat for server schemas」に従い、クリーンに変更する。
既存マイグレーション 001-007 はそのまま、新規 008 として変更を追加する想定。

### 2.1 新規: `topology_observations`

各行が「あるソースのある時点の topology 観測」。`graph_json` は `NetworkGraph` の
シリアライズ。

```sql
-- 008_topology_observations.sql

CREATE TABLE IF NOT EXISTS topology_observations (
  id TEXT PRIMARY KEY,
  topology_id TEXT NOT NULL REFERENCES topologies(id) ON DELETE CASCADE,
  source_id TEXT NOT NULL REFERENCES data_sources(id) ON DELETE CASCADE,

  -- スキャン開始/取得時刻（Unix ms）。snapshot 内の各要素の observedAt と一致する想定。
  captured_at INTEGER NOT NULL,

  -- snapshot のステータス。retraction ゲート判定に使う。
  --   'ok'     : 正常完了。要素の有無は信頼してよい
  --   'failed' : スキャン失敗。retraction には使わない
  --   'empty'  : 正常完了したが要素ゼロ。retraction には使わない（過剰除去防止）
  --   'partial': 一部成功（タイムアウト等）。要素の存在は信頼するが、不在は信頼しない
  status TEXT NOT NULL,

  -- 失敗時の人間可読メッセージ
  status_message TEXT,

  -- NetworkGraph の JSON シリアライズ。
  -- ok/partial のときのみ意味を持つ。failed のとき NULL でもよい。
  graph_json TEXT,

  -- 観測中の集計（UI 表示と debug 用）
  node_count INTEGER NOT NULL DEFAULT 0,
  link_count INTEGER NOT NULL DEFAULT 0,
  port_count INTEGER NOT NULL DEFAULT 0,

  created_at INTEGER NOT NULL
);

CREATE INDEX idx_topology_observations_topology_source
  ON topology_observations(topology_id, source_id, captured_at DESC);

CREATE INDEX idx_topology_observations_captured_at
  ON topology_observations(captured_at);
```

#### retention 方針（既定）

- **同一 (topology_id, source_id) の最新 N 件のみ保持**。既定 N = 10
- それ以外は GC（夜間 job）。`failed` は最新1件のみ保持
- ad-hoc に「全履歴保持」モードに切り替え可能（後述の `settings`）

詳細は `topology-foundation-mvp.md` で v1 のチューニングを定義。

### 2.2 廃止: `topology_data_sources.priority`

merge ポリシーを撤廃したので priority は意味を失う。

```sql
-- 008 内で追加
ALTER TABLE topology_data_sources DROP COLUMN priority;
```

UI 上はソース一覧の表示順だけ意識する（適切な ORDER BY に置き換え）。

### 2.3 廃止: `topologies.topology_source_id` / `metrics_source_id`

migration 003 で junction table が入った以降、これらは legacy になっている
（コード内で「優先される」程度の扱い）。観測モデルではすべて
`topology_data_sources` を介すので不要。

```sql
-- 008 内
ALTER TABLE topologies DROP COLUMN topology_source_id;
ALTER TABLE topologies DROP COLUMN metrics_source_id;
```

### 2.4 既存テーブルへの加筆（追加列）

`data_sources` の `status` / `fail_count` は流用する。追加は無し。

`topology_data_sources` には以下を追加：

```sql
-- 008 内
ALTER TABLE topology_data_sources ADD COLUMN consecutive_failures INTEGER NOT NULL DEFAULT 0;
ALTER TABLE topology_data_sources ADD COLUMN last_ok_captured_at INTEGER;
```

`consecutive_failures` は retraction ヒステリシスの「N 回」判定に使う。
`last_ok_captured_at` は「最後に成功したスキャン時刻」で UI 表示用。

### 2.5 メトリクス mapping — port 単位の identity 化

既存 `topologies.mapping_json` は node 単位 (`{nodes: {nodeId: {hostId?, hostName?}}}`)。
これを port 単位にも拡張する。詳細スキーマは `topology-foundation-metrics.md`。

## 3. データフロー

```
[Source A]  ──→  snapshot A (NetworkGraph)
                  ↓ INSERT
[Source B]  ──→  snapshot B (NetworkGraph)         topology_observations
                  ↓ INSERT                          (1 row per snapshot)

[Authored]  ──→  topologies.content_json            (authored NetworkGraph)
                  ↑ editor の PUT

  ↓ read

resolve(authored, [snapshot A, snapshot B, ...]) → resolved NetworkGraph
                                                     ↓
                                                  renderer / API
```

- 書き込みは authored と snapshot の2系統のみ。互いに干渉しない
- 読み込みは resolve() を必ず通す（直接 content_json を返さない）

## 4. 後方互換性は考慮しない（前提の確認）

memory「No backcompat for server schemas」「Rename cleanly, let old DB rows degrade
to not set」に従い、`priority` / `topology_source_id` / `metrics_source_id` は**削除する**。
既存 DB は migration 008 適用時に列が消える。本番デプロイは DB 再生成で対応。
</content>

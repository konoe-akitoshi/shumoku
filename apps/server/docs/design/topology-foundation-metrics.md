# Topology Foundation: メトリクスログの永続化戦略

> ステータス: ドラフト。`topology-foundation.md` の付属。
> ユーザの感覚「更新情報やメトリクス情報はログとして残る」を実装するための方針。

## 0. 現状の穴

現状の shumoku server：

- メトリクスは WebSocket で realtime push のみ
- **時系列データを persist する仕組みは無い**
- alerts は grafana のみ DB 保存、zabbix/prometheus は live クエリ

ユーザ要件「ログとして残る」を真面目に受けると、time-series store の選定が要る。

## 1. 選択肢の比較

| アプローチ | 自前要素 | 長所 | 短所 |
|---|---|---|---|
| **A. 外部 TSDB 連携（Prometheus）** | 連携コードのみ | 既存 TSDB の信頼性、PromQL 利用可、エコシステム広い | ユーザに別途 Prometheus 運用を強いる |
| **B. 内蔵 SQLite TSDB** | 自前 schema + 集約クエリ | デプロイ1 コンテナで完結、shumoku の売りを維持 | スケールに限界、効率劣る、自前で頑張る |
| **C. 内蔵 軽量 TSDB (Bun-compatible)** | 専用 lib のラッパー | 専用 lib なら効率と容量に優位 | Bun 互換の決定打が無い（調査結果） |
| **D. ハイブリッド (B + 任意 A)** | SQLite default + Prometheus 連携 option | 小規模も大規模もカバー | 二系統の運用負荷 |

## 2. 推奨方針 — D. ハイブリッド

shumoku の「Docker 1 コンテナで完結」という現状の売りを守りつつ、本格運用は
外部 TSDB に渡せる構成。**v1 では B のみ**、外部連携は v2 以降。

### 2.1 v1: 内蔵 SQLite TSDB（最小）

メトリクスは plugin が realtime push してきたものを 1 件ずつ SQLite に追記。
集約クエリで時系列を描画する。

```sql
-- migration 009_metrics_log.sql

CREATE TABLE IF NOT EXISTS metrics_samples (
  -- 識別キー
  topology_id TEXT NOT NULL REFERENCES topologies(id) ON DELETE CASCADE,
  port_id TEXT NOT NULL,       -- resolved port の id（identity ベースで安定）
  metric_name TEXT NOT NULL,   -- 'rx_bps' / 'tx_bps' / 'cpu_pct' / ...

  -- 値
  value REAL NOT NULL,
  observed_at INTEGER NOT NULL,

  -- ソース
  source_id TEXT REFERENCES data_sources(id) ON DELETE SET NULL,

  PRIMARY KEY (topology_id, port_id, metric_name, observed_at)
);

CREATE INDEX idx_metrics_samples_time
  ON metrics_samples(topology_id, observed_at);

CREATE INDEX idx_metrics_samples_port_time
  ON metrics_samples(port_id, metric_name, observed_at);
```

`PRIMARY KEY` は (topology, port, metric, time) の複合。観測重複時は `ON CONFLICT
REPLACE` で最新を保持（同一時刻の重複は想定外）。

#### retention（既定）

- **生サンプル**: 7 日保持
- **5 分集約**: 30 日保持（生から作る）
- **1 時間集約**: 1 年保持（5 分から作る）
- 古いものは夜間 GC で削除

集約テーブルは別途追加：

```sql
CREATE TABLE IF NOT EXISTS metrics_aggregated (
  topology_id TEXT NOT NULL,
  port_id TEXT NOT NULL,
  metric_name TEXT NOT NULL,
  bucket TEXT NOT NULL,        -- '5m' | '1h' | '1d'
  bucket_start INTEGER NOT NULL,
  avg REAL,
  min REAL,
  max REAL,
  count INTEGER,
  PRIMARY KEY (topology_id, port_id, metric_name, bucket, bucket_start)
);
```

#### 想定容量

`1000 ports × 4 metrics × 5 second sampling × 7 days` ≈ **5 億サンプル**。1 サンプル
40 バイトとして 20 GB。これは SQLite で限界に近い。なので **既定の sampling 間隔を
30 秒以上**にする想定（容量 5 GB 以下）。

### 2.2 v2: 外部 Prometheus 連携（追加 option）

shumoku を Prometheus の remote write 先にする、または exporter として
Prometheus に scrape させる。

- shumoku は metrics を `prom-client` 形式の HTTP endpoint で expose
- 既存 Prometheus 運用がある環境ではこちらを使い、内蔵 SQLite は無効化
- Web UI のグラフは Prometheus にクエリして取得

これは v1 では作らない。

### 2.3 メトリクスマッピングの port 単位化

現状 `topologies.mapping_json` は node 単位 (`{nodes: {nodeId: {hostId?, hostName?}}}`)。
v1 では port 単位に拡張：

```ts
// 拡張後の MetricsMapping
interface MetricsMapping {
  nodes?: Record<string, NodeMetricsMapping>      // legacy 互換
  ports?: Record<string, PortMetricsMapping>      // 新規
}

interface PortMetricsMapping {
  /** ソース固有のホスト/インタフェース指定。
   *  zabbix: { hostId, itemKey }
   *  prometheus: { job, instance, labels: {...} }
   *  snmp-lldp: { devTarget, ifName } */
  sourceBinding: Record<string, unknown>
}
```

resolved port の `id` は identity ベースで安定なので、mapping は壊れにくい。

## 3. アラートと観測ログの関係

メトリクスは「数値」、アラートは「閾値突破イベント」。本ドキュメントは数値時系列に
集中。アラートは別 lane（既存の `grafana_alerts` と `getAlerts()` ライブクエリの
組合せ）を維持。将来「アラート発火を時系列として保存」したい場合は
`metrics_samples` ではなく専用テーブルで（既に grafana_alerts が同等機能）。

## 4. UI

- **Element inspector の port 詳細**: その port のメトリクス mini-chart（直近 1h, 24h）
- **トポロジ viewer のレイヤー**: メトリクスオーバーレイ（既存）+ 過去時点切替
  （`Snapshot: live ▾` を `Snapshot: t-1h ▾` に変える）
- **`/topologies/[id]/metrics`** ページ追加（v2 検討）: 時系列横並びダッシュボード

v1 では Element inspector の port mini-chart のみ実装。`/metrics` ページは v2。

## 5. データ取得の経路

```
[snmp-lldp plugin] ──poll──→ ifHCInOctets/Out per port
                              ↓
                       deltaCompute（カウンタ差分 / 時間）
                              ↓
                       rx_bps / tx_bps
                              ↓
                       metrics_samples INSERT
                              ↓
                       WebSocket push（同時）
                              ↓
                       Web UI live update
```

カウンタの差分計算は server 側で行う（plugin は raw counter を返すだけ）。
これで「カウンタリセット検知」を一元化できる。

## 6. ifHCInOctets のカウンタリセット問題

SNMP カウンタは 64bit でラップする/再起動で 0 になる。差分計算で：

```
if curr < prev:
  if (prev - curr) > 2^63:    # 単なるラップ（unlikely on 64bit）
    delta = (2^64 - prev) + curr
  else:                       # リセット or counter wrap
    delta = curr               # 過小評価覚悟で curr をそのまま採用
                               # or: 1 サンプル捨てて次から
```

ここは標準的な対処。実装で詳細を詰める。

## 7. 棚上げ

- 外部 TSDB 連携 (Prometheus / VictoriaMetrics) — v2
- アラート発火の時系列保存（既存 grafana_alerts 拡張）
- 過去時点トポロジ再現（snapshot lineage と組合せ）
- メトリクスダッシュボード（`/topologies/[id]/metrics`）
- バックプレッシャ / sampling 動的調整
</content>

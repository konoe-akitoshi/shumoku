# Signal Streams — 時間軸を持つ図のためのログ基盤

Status: DESIGN (2026-06-12)
Prereq reading: `db-native-persistence.md`（contribution store / observations / resolved artifact の現行モデル）

## 0. 軸の宣言

shumoku の中心は図である。本基盤は NetBrain 的な「運用データベースに図の窓口が付いたもの」ではなく、
**「図が時間を持つ」** ためのデータ基盤である。優先するユースケースは:

1. **タイムスライダー** — 図上でスクラブし、ネットワークの変化を見る
2. **ビジュアル diff** — 2時点の差分を図のオーバーレイで（追加=緑 / 消失=赤 / 変化=琥珀）
3. **時点ピン留めの埋め込み** — 「この設計書が承認された時点の図」を docs / 共有リンクに固定
4. **時点 weathermap 再現と偏差着色** — 「障害時刻の図」をメトリクス込みで再現、「いつもとの差」で着色
5. **意図と実態のずれの可視化** — 人の層（手描き / キュレーション）と観測層のずれを図上で
6. **ダッシュボード** — 上記すべてを widget として配置できる（live / 時点固定 / diff / トレンド）

トラシュー（「3:05 のアラートの直前に何が変わった？」）はこの上に**結果として**成立するが、
入口は常に図である。

## 1. 原則

1. **追記専用ストリームが一次データ、現在状態は射影。**
   現行アーキテクチャは既にこの形に近い（observations は追記、contribution store は最新 fold、
   resolved artifact はそのキャッシュ）。本設計は observations を「デバッグ監査」から
   「一次ストリーム」へ昇格させ、同じ規律で他のシグナルを一般化する。矢印の向きを公式化するだけで、
   既存コードの書き換えは最小。
2. **変化時のみ実体保存（content-hash dedup）。** topology ストリームには既に実装済み
   （`contributionContentHash`）。全ストリームで同じゲートを使う。
3. **保持はポリシーであって定数ではない。** 現行の「ソースあたり10件」のようなハードコード prune を
   廃し、ストリームごとに期間 / 容量ベースの retention を設定化する。
4. **identity が時間軸の相関キー。** ソース横断の identity クラスタリング（mgmtIp / chassisId /
   sysName / ifName …）をそのまま時間方向にも使う。「このノードの履歴」はストリーム横断で
   identity により引ける。
5. **決定論による再現性。** resolve + layout は入力に対して純粋（RESOLVER_VERSION 管理済み）。
   よって「時刻 T までのストリーム + 当時の resolver」→ 同一の図。ピン留め埋め込みの根拠。
6. **共有経路は投影必須。** 履歴 API はデフォルト admin 専用。share 経路に出すのは
   「as-of 描画」だけで、現行 `shareSafeGraph` と同じ投影を通す（過去データは現在より多くの
   情報を含み得る — 削除済みノード等 — ため、履歴の列挙・タイムライン API は share に出さない）。

## 2. ストリーム定義

すべてのストリームは同じ語彙を持つ:
`{ topology_id, source_id, captured_at, content_hash, payload }` ＋ストリーム固有の列。

### 2.1 topology（既存の昇格）

`topology_observations` をそのまま使う。変更は2点のみ:

- **retention**: 「ソースあたり10件」→ 期間ベース（default 90日、設定可）。
  hash ゲートが既にあるため「変化のないスキャン」は実体を持たず、実コストは変化回数に比例する。
- **index**: `(topology_id, captured_at)` を追加（as-of クエリの主経路）。

### 2.2 metrics（新設、2層 — Zabbix history/trends 方式）

図の再現と偏差着色が目的であり、汎用 TSDB は非目標。

```sql
-- 生値: 時点再現用。tick ごとの MetricsData スナップショット1行。
CREATE TABLE metrics_history (
  topology_id TEXT NOT NULL,
  captured_at INTEGER NOT NULL,        -- Unix ms
  payload     BLOB NOT NULL,           -- MetricsData JSON (gzip)
  PRIMARY KEY (topology_id, captured_at)
);
-- 集計: スパークライン・偏差着色用。エンティティ×時間枠。
CREATE TABLE metrics_trends (
  topology_id TEXT NOT NULL,
  entity_kind TEXT NOT NULL,           -- 'node' | 'link'
  entity_id   TEXT NOT NULL,
  hour_start  INTEGER NOT NULL,        -- Unix ms, 時間頭
  samples     INTEGER NOT NULL,
  util_min REAL, util_avg REAL, util_max REAL,
  bps_avg  REAL,
  status_worst TEXT,                   -- 'up' < 'degraded' < 'down' の最悪値
  PRIMARY KEY (topology_id, entity_kind, entity_id, hour_start)
);
```

- 取得: `metrics-hub.publishMetrics()` にフック1点。同 tick で history へ insert、
  RAM の hour バケットに集計し、時間境界で trends へ flush（プロセス再起動時は欠測を許容 —
  補間はしない）。
- retention（設定可、既定値）: history **72h**、trends **400日**。
- 容量試算（nodes≈50 / links≈100 / tick 60s）: history ≈ 4–8KB/tick gzip → 72h ≈ 25–50MB。
  trends ≈ 150 entities × 24h × 400d ≈ 1.4M 行 ≈ 100MB 級。SQLite で問題ない規模。
  パラメータは `settings` で変更可能にし、試算式を docs に残す。
- 「時刻 T の weathermap」= T 以前最近傍の history 1行。「偏差着色」= 現在値 −
  trends の同曜日同時刻 avg。

### 2.3 alert（新設、遷移イベント）

現状は Grafana のみ upsert（履歴が消える）。全プラグイン共通で**状態遷移**を追記する:

```sql
CREATE TABLE alert_events (
  id          TEXT PRIMARY KEY,
  topology_id TEXT,                    -- 対応付け可能な場合
  source_id   TEXT NOT NULL,
  alert_key   TEXT NOT NULL,           -- プラグインの安定キー
  transition  TEXT NOT NULL,           -- 'fired' | 'resolved' | 'changed'
  severity    TEXT NOT NULL,
  node_id     TEXT,                    -- identity 解決済みのノード（可能なら）
  at          INTEGER NOT NULL,
  payload_json TEXT NOT NULL           -- Alert の当該時点スナップショット
);
```

- 取得: alerts のポーリング / webhook 正規化点で前回状態と比較し、遷移のみ追記
  （ポーリングの「変化なし」は書かない）。
- `grafana_alerts` は当面「現在状態の射影」として残し、後続でこのストリームからの導出に置換。
- retention: 180日（設定可）。

### 2.4 config（将来枠 — スキーマ予約のみ）

軸の整理によりコンフィグ運用は Oxidized 等の担当領域とし、shumoku 側は**優先度を下げる**。
将来やる場合の形だけ固定しておく: 内容アドレスの `config_blobs(hash, text)` ＋
`config_events(identity, hash, at, source_id)`（Oxidized 連携プラグインが `ConfigCapable` で供給）。
本設計の他要素に依存しない独立増分。

## 3. 射影とタイムトラベル

- **現在**: contribution store（最新 fold）→ resolve → resolved artifact。現行どおり。
- **as-of(T)**: 各 attached source について「T 以前で最新の ok 観測」を topology ストリームから
  取り、同じ compose + resolve に通す。実装は `getParsedAt(topologyId, t)`。
  キャッシュは (topology, T, resolver_version) キーの短命 LRU（T はスライダー操作で頻発するため
  分単位に量子化してよい）。
- **図 diff(T1, T2)**: 両時点を resolve し、identity でノード / リンクを対応付け、
  `DiffAnnotation { added[], removed[], changed[] }` を ResolvedLayout に併せて返す。
  レイアウトは **T2 の配置を基準**にし、消えた要素は T1 の配置位置に幽霊（破線・赤）で重ねる
  （2図を別々に最適化すると対応が追えなくなるため）。レンダラはオーバーレイ1種の追加で済む。
- **意図と実態**: 同じ diff 機構を「時点ペア」でなく「レイヤペア」（human 層のみ vs 全ソース）に
  適用する。diff エンジンは共通、入力の選び方だけが違う。

## 4. ダッシュボード統合

ダッシュボードは本基盤の第一級の消費者である。

- **widget config に `timeMode` を追加**: `'live' | 'at' | 'diff'`（＋ `at`, `compareTo` の時刻）。
  トポロジ widget は live（現行）/ 時点固定 / diff 表示を切り替えられる。
  ⚠️ share 投影の `PUBLIC_WIDGET_CONFIG_KEYS` への追加を忘れない（allow-list 制）。
- **新 widget**:
  - *trend sparkline* — 選択リンク / ノードの utilization 履歴（metrics_trends から）
  - *changelog feed* — 直近の構成変化（topology ストリームの diff 要約）
  - *availability mini* — alert_events からの uptime / 直近障害
- **共有ダッシュボード**: 時点固定 widget は share 経路でも成立する（as-of 描画は投影を通す）。
  履歴列挙系 widget（changelog feed 等)は share では既定オフ。

## 5. UI 面（本体）

- トポロジページに**タイムスライダー**（topology ストリームの変化点をノッチ表示。
  スライダー操作 → `getParsedAt`）。
- 変化点クリックで **diff モード**（前後比較オーバーレイ）。
- 共有リンクに `?at=T`（投影は現行どおり）。「この時点を共有」ボタン。
- metrics 連動: スライダー位置の weathermap を `metrics_history` から再現。

## 6. 段階計画

- **M0**: 本ドキュメント + retention ポリシー化（observations の prune 置換、settings 追加）
  + `(topology_id, captured_at)` index。挙動変更なし・データが貯まり始める。
- **M1**: `getParsedAt` + タイムスライダー + 図 diff（オーバーレイ）。topology ストリームのみで成立。
- **M2**: metrics 2層 + 時点 weathermap 再現 + 偏差着色 + sparkline widget。
- **M3**: alert_events + changelog feed / availability widget + `?at=` 共有・ピン留め埋め込み
  + widget `timeMode`。
- **M4**（別判断）: config ストリーム（Oxidized プラグイン）。
- **M5**（研究枠）: 意図 vs 実態 diff、レイアウトの時間的安定化（「先週から居るノードは動かさない」）。

## 7. 非目標

- 汎用 TSDB / Prometheus の置換（メトリクスの一次保管は監視系の仕事）
- syslog / フロー（NetFlow 等）/ 経路表の収集
- コンフィグのバックアップ運用そのもの（Oxidized の仕事。shumoku は表示と相関のみ）
- 監査ログ（操作ログ）— 別主題

## 8. リスクと対応

| リスク | 対応 |
|---|---|
| 履歴データの share 漏洩（過去には今より多い情報がある） | 履歴 API は admin 専用。share は as-of 描画のみ、現行投影を必ず通す |
| SQLite 書込負荷（metrics 1Hz/topology） | tick は 60s。1行/tick/topology。試算済み（§2.2）。WAL 前提 |
| as-of 解決のコスト（resolve+layout ~2s） | 分量子化 LRU。スライダーは変化点スナップ移動を既定に |
| trends の肥大 | retention 設定化 + 起動時 housekeeping（Zabbix 方式） |
| 過去 observation の resolver 非互換 | graph_json は生 contribution なので resolver 更新に追従（再 resolve するだけ）。互換破壊時は RESOLVER_VERSION で検知 |

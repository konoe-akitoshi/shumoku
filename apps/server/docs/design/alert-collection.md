---
title: アラートのサーバー側収集とソースごとのポーリング間隔
status: draft
---

# アラートのサーバー側収集とソースごとのポーリング間隔 — 設計メモ

アラートを「見ている画面ごとに監視システムへ取りに行く」形から、「サーバーがソースごとに 1 回
だけ取り、状態を持ち、全画面へ配る」形へ移す。あわせて、ポーリング間隔をデータソースごとに
設定できるようにする。本メモは設計のみで、コードは変えていない。

関連メモ: `signal-streams.md`（`alert_events` の出どころ。本メモが §2.3 を具体化し、一部を
改める）、`performance-scaling.md`（②-A「見ているものだけポーリング」）、
`plugin-contract-unification.md`（core 型は表示契約、ホストに `type` 分岐を置かない）、
`topology-foundation-metrics.md`（§3 アラートと観測ログ）。

## 実装状況（2026-11-20）

- **Phase 1（済）**: `services/alert-collector.ts`、移行 `038`、plugin-kit の `validateAlertsContract`。
  REST と共有はコレクタを読む。収集の状態と即時収集は `GET /api/datasources/:id/alerts/collection`
  と `POST /api/datasources/:id/alerts/refresh`（§5.3 の `/api/alerts/sources` はソース単位に替えた）。
  `alertsMs: 0` やプラグインが読み込めないときは `off`（集めた状態は残す）。消えたデータソースだけ忘れる。
- **Phase 4（済、一部）**: `services/polling.ts`、移行 `039`、Settings ページの Polling と
  データソースの上書き、`PollScheduler` の `cadenceOf`、ソースごとの前回結果の再利用（設定と対応付けの
  版が同じときだけ。失敗も間隔の間は再利用し、失敗中のソースを毎周叩かない）、同期の既定。
  Zabbix の `pollInterval` は削除。
  **未**: プラグインのディスクリプタでの下限の申告（§6.1。今はホストの下限だけ）、トポロジーごとの
  同期間隔の欄（§6.5。今は Settings の既定だけ）。
- **未**: Phase 2（SSE）、3、5、6。`lastError` はサインインした全員が読める（§2.4 は管理者向けとした。
  未対応）。タイムアウトした取得は中断していない（プラグインの `getAlerts` が中断を受け取らないため）。

## 0. 結論（先に）

1. **アラートはサーバーがソースごとに 1 本のループで集める（`AlertCollector`）。** 画面の数に
   関係なく、監視システムへの問い合わせはソースあたり間隔ごとに 1 回。REST も SSE も共有
   ダッシュボードも、すべてこの収集結果を読む。プラグインを画面の要求から直接呼ぶ経路は無くす。
2. **状態は 2 つのテーブルで持つ。** `alert_state`（いまの状態。ソース × アラート id ごとに
   1 行）と、既存の `alert_events`（遷移の追記。履歴）。`alert_events` は作り直さずそのまま
   使うが、いま入っている行は誤り（解決が記録されない）なので移行時に消す。
3. **解決は「成功した全件ポーリングに居なかった」ときだけ記録する。** 失敗したポーリング、
   絞り込んだ問い合わせ、webhook の部分通知は、何も解決しない。ソースに届かない間は、その
   ソースのアラートを凍結し（解決にしない）、ソース自体を「更新できていない」状態として配る。
4. **プラグイン契約は 1 文で決める: 「`getAlerts({ activeOnly: true })` は、そのソースで
   いま開いているアラートの全件を返すか、投げる」。** 空配列でごまかさない。`Alert.id` は
   1 回の発生の間変わらないこと。`Alert` には任意フィールドを足す（`groupKey`、
   `acknowledged`、`suppressed`、`causeId` ほか）。`tags` は足さず既存の `labels` に載せる。
5. **繰り返し（SNMP トラップ）は「発生ごとに 1 レコード、`groupKey` でまとめて数える」。**
   1 レコードにカウンタを持たせる方式（Alerta の `duplicateCount`）は採らない。発生ごとに
   確認・解決の状態が違い、監視システムの画面とも食い違うため。
6. **配信は SSE 1 本（ダッシュボードごと、複数ソースを多重化）。** 接続時にスナップショット、
   以後は差分。イベント id を持ち `Last-Event-ID` で再開、できなければスナップショットを
   送り直す。サインイン側は `GET /api/alerts/stream`、共有側は
   `GET /api/share/dashboards/:token/alerts/stream`（`publicAlert` の許可リストを通す）。
7. **「新着」「古い」「変化の記録」「Not updating」はサーバーのデータから決まる。** 変化の
   記録は `alert_events` から配り、時刻はサーバーの時計（`serverNow`）で数える。画面が自分の
   前回取得と比べて解決を見つける処理は捨てる。再読み込みしても、別の画面でも、同じものが出る。
8. **ポーリング間隔は 2 段で持つ: アプリの Settings ページにサーバー全体の既定、データソースに
   個別の上書き（どちらもサーバーに保存し、サーバーが使う）。** 既定は `settings` テーブル
   （`polling.alertsMs` / `polling.metricsMs` / `polling.syncMs`）、上書きは
   `data_sources.polling_json`（ホストが持つ標準項目。プラグインの `configSchema` には置かない）。
   プラグインはディスクリプタで下限（と既定の目安）を申告する。Zabbix の死んだ `pollInterval` は消す。
   メトリクスはトポロジー単位のループのまま、ソースごとに「間隔が来たものだけ取り直し、
   それ以外は前回の結果を合成に使う」。
9. **最初の PR 群（Phase 1）は web を触らない。** 既存の REST をコレクタの状態から返すだけで、
   「ソースあたり 1 回」「全画面が同じ答え」「正しい解決の記録」が手に入る。SSE は Phase 2。
10. **やらないこと**: Shumoku からの確認（acknowledge）操作と監視システムへの書き戻し、
    トポロジーからの原因推定、通知。監視システムが言った `acknowledged` / `causeId` を
    表示するところまで。

## 1. いまの姿と問題

コードの現状（パスは `apps/server/` から）:

- 画面: Alerts ウィジェットが `autoRefresh` 秒（既定 30）ごとに `DashboardReader.alerts()`
  を呼ぶ（`web/src/lib/dashboard/reader.ts`、`widgets/AlertsWidget.svelte`）。
- API: `app/data-source-operations.ts#getAlerts` → `services/datasource.ts#getAlerts` →
  `plugin.getAlerts(options)` を素通し。キャッシュもサーバー側のポーリングも無い。共有側は
  `app/share.ts#dashboardAlerts` が同じく素通しして `publicAlert` を掛ける。
- 副作用: サインイン側の経路だけが `signalStreams.ingestAlerts(id, null, alerts,
  { fullActiveSet })` を呼ぶ。`fullActiveSet` は `activeOnly` が付くと偽で、ウィジェットは
  既定で `activeOnly` を付けるので、消えたアラートは `resolved` にならない。共有経路は
  ingest しない。`alert_events` を読む API も UI も無い。
- Grafana の webhook は `services/grafana-alerts.ts` が `grafana_alerts` に upsert し、
  プラグインは注入されたストアを読む。`app/webhooks.ts` には `type !== 'grafana'` の分岐がある。
- メトリクス: `services/poll-scheduler.ts` がトポロジー単位で、全ソース同じ間隔
  （見ている 5 秒 / 見ていない 60 秒、`POLL_INTERVAL` / `BACKGROUND_POLL_INTERVAL`）。
- Zabbix の `configSchema` に `pollInterval`（`libs/plugins/zabbix/src/index.ts`）があるが、
  どこも読まない。トポロジー同期の間隔（`RUNTIME_DEFAULT` 30 分）は policy に
  `intervalMs` を持てるが、設定する UI が無い。

問題:

| 問題 | 具体 |
|---|---|
| 負荷が画面数に比例 | interbee: 開いている problem 約 1,014 件、1 回 約 0.6 秒・約 140 KB。画面 N 枚で 30 秒ごとに N 回 |
| 画面どうしが食い違う | 取得の時刻が画面ごとにずれる。解決の検出は各ページが自分の前回と比べるだけで、再読み込みで消える |
| 時刻と履歴が無い | いつ始まり、いつ解決し、誰が確認したかをサーバーが知らない。`alert_events` は誤った行しか入らない |
| 間隔を決められない | Zabbix の項目は多くが 60 秒更新なのに 5 秒で読む。逆にクラウド API は絞りたい。設定欄は死んでいる |

## 2. アラートのレコードと一生

### 2.1 同一性のキー（プラグインへの契約）

サーバーは 2 つのキーだけを使う。どちらもプラグインが `Alert` に載せ、サーバーは
`plugin.type` を見ない。

| キー | 意味 | 無いとき |
|---|---|---|
| `Alert.id`（必須、既存） | **1 回の発生**。開いている間は変わらず、同じデータソースの中で一意 | 契約違反（plugin-kit の検査で落とす） |
| `Alert.groupKey`（任意、新設） | **同じ問題の繰り返し**が共有するキー | サーバーが `host + '\u0000' + title` を使う（いま web の `groupAlerts` がしていること） |

プラグインごとの対応（§3.3 に作業を並べる）:

| ソース | `id` | `groupKey` |
|---|---|---|
| Zabbix | `eventid`（現状どおり） | `objectid`（トリガー id）。「障害イベントを複数生成」のトリガー（SNMP トラップ）が 1 行にまとまる |
| Prometheus / Grafana（Alertmanager 方言） | `fingerprint`（現状どおり） | 省略（fingerprint はラベルの組で決まり、繰り返しは同じ id で戻ってくる） |
| Aruba Instant On | ポータルのアラート id | 省略 |
| Arista CV-CUE | `e.id`。無いときの代替 `startTime-minorType` は端末を含まず衝突しうるので直す | 省略 |
| Huawei NCE | `csn` | 省略 |
| New Relic | issue id（未確認: `issueAlerts` の id の出どころ） | 省略 |

同じ `id` が解決後にまた開いたとき（Alertmanager の fingerprint は再発で同じ値になる）は、
**新しい発生**として扱う（PagerDuty の `dedup_key` と同じ考え方）。`alert_state` の行は上書き
して `occurrence` を 1 増やし、前の発生は `alert_events` に残る。

検討して採らなかった案:

- **サーバーがソース横断で fingerprint を作る（Keep 方式）**: ソースごとにどのフィールドで
  作るかを決める必要があり、それはホスト側に `type` 分岐を置くのと同じ。プラグインが
  キーを言えば済む。
- **Alerta 方式（resource + event で 1 レコード、`duplicateCount`）**: §0 の 5 の理由で採らない。

### 2.2 状態

1 レコードが持つ状態は「主状態 1 つ + 旗 2 つ」。組み合わせを状態名にしない。

- 主状態 `status`: `firing` | `resolved`（core の `AlertStatus` の `active` | `resolved` に
  対応。API とワイヤでは既存の `active` をそのまま使い、名前は増やさない）。
- 旗 `acknowledged`: 監視システムで誰かが確認した。主状態は変えない（確認しても開いたまま）。
- 旗 `suppressed`: 監視システムが抑止している（Zabbix のメンテナンス、Alertmanager の
  silence / inhibition）。一覧では既定で畳み、トポロジーを赤くしない。

「stale」は 2 つの別のものなので、名前を分ける。

| 名前 | 何か | どこで決まる |
|---|---|---|
| **古い（aged）** | 開いているが、長く再発していない行（回復しないトラップのトリガー） | 表示の分類。サーバーが `startTime` と行の最終発生時刻を配り、ウィジェットの `staleAfterHours` と `serverNow` で決める（現行の設定をそのまま使う） |
| **更新できていない（source failing）** | そのソースへのポーリングが失敗している | ソースの状態。サーバーが `alert_source_state` に持ち、配る。アラート自体の状態は凍結 |

### 2.3 解決の検出

規則は 1 つ: **完全な結果だけが解決できる。**

- コレクタのポーリング（`getAlerts({ activeOnly: true })`、絞り込み無し）が**成功**し、
  `alert_state` で開いている `id` がその結果に居なければ、`resolved` にする。解決時刻は
  ポーリング時刻、`resolved_by = 'absent'`。
- 結果に `status: 'resolved'` で入っていれば（プラグインが最近解決したものも返す場合、
  webhook の resolved 通知）、その `endTime` を解決時刻にする。`resolved_by = 'source'`。
- ポーリングが投げた、時間切れになった → **何も変えない**。ソースを `failing` にする。
- webhook の通知は「言及したものだけ」を更新する。言及しなかったものは触らない。

1 回の不在で解決にする（2 回連続を待つ案は採らない）。壁の表示で解決が間隔 1 つ分遅れるのは
目に見える損で、守りたい事故（部分的な結果で全部が解決に見える）は契約と検査で防ぐ:

- プラグインは失敗時に必ず投げる（Prometheus / Grafana は対応済み。Aruba の
  `if (!this.api) return []` などを Phase 1 で直す）。
- 任意の確認手段 `getAlertsById(ids)`（§3.2）を持つプラグインでは、消えた id を問い合わせて
  解決を確かめ、正確な解決時刻も得る（Zabbix: `event.get` の `r_eventid`）。確かめられ
  なかった id は開いたままにする。

### 2.4 ソースに届かないとき

`alert_source_state` に `state`（`ok` | `failing` | `never` | `off`）、`last_success_at`、
`last_attempt_at`、`last_error`、`fail_count` を持つ。

- `failing` の間、そのソースの `alert_state` は最後に成功したときのまま凍結する。
- 画面は一覧を残したまま **Not updating · last HH:MM** を出す（いまの表示と同じ見え方）。
  「All clear」には決してならない。
- 再試行は指数バックオフ（間隔 × 2^n、上限 5 分。`health-checker.ts` と同じ形）。成功したら
  その回の結果で突き合わせ、凍結中に解決したものはその時点で `resolved` になる（解決時刻は
  `getAlertsById` があれば正確、無ければ復旧した時刻）。
- `last_error` の文面は管理者向け API だけに出す。共有側には `failing` と時刻だけ。

### 2.5 繰り返し・ばたつき

- **繰り返し**: 発生ごとに 1 レコード。`group_key` を列に持ち、配るレコードにも載せる。
  数える・まとめるのは `groupKey` 単位（現行 `alert-groups.ts#groupAlerts` のキーを
  `status + host + title` から `status + groupKey` に替えるだけ）。
- **ばたつき（flapping）**: 抑え込まない。開いた・解決したは事実としてそのまま記録する。
  表示側は既にある「近い時刻の変化を 1 行にまとめる」（`changeLines`）で読める量にする。
  ばたつきの判定（一定時間に N 回）を状態として持つのは、必要になってから
  `alert_events` の集計で足せるので、いまは作らない。

### 2.6 テーブル

移行 `038_alert_collection.sql`（番号は実装時点の次番）:

```sql
-- いまの状態。ソース × アラート id ごとに 1 行（現在または直近の発生）
CREATE TABLE alert_state (
  source_id     TEXT NOT NULL REFERENCES data_sources(id) ON DELETE CASCADE,
  alert_key     TEXT NOT NULL,            -- Alert.id
  occurrence    INTEGER NOT NULL DEFAULT 1,
  group_key     TEXT NOT NULL,            -- Alert.groupKey、無ければ host+title
  status        TEXT NOT NULL,            -- 'active' | 'resolved'
  severity      TEXT NOT NULL,
  started_at    INTEGER NOT NULL,         -- 監視システムの言う開始（ms）
  resolved_at   INTEGER,
  resolved_by   TEXT,                     -- 'source' | 'absent'
  first_seen_at INTEGER NOT NULL,         -- Shumoku が最初に見た時刻
  last_seen_at  INTEGER NOT NULL,         -- 最後に結果に居た時刻
  acknowledged  INTEGER NOT NULL DEFAULT 0,
  suppressed    INTEGER NOT NULL DEFAULT 0,
  alert_json    TEXT NOT NULL,            -- 正規化済み Alert の全体（title, host, labels, url …）
  PRIMARY KEY (source_id, alert_key)
);
CREATE INDEX idx_alert_state_open ON alert_state (source_id, status);

-- ソースごとの収集の状態
CREATE TABLE alert_source_state (
  source_id       TEXT PRIMARY KEY REFERENCES data_sources(id) ON DELETE CASCADE,
  state           TEXT NOT NULL,          -- 'ok' | 'failing' | 'never' | 'off'
  last_success_at INTEGER,
  last_attempt_at INTEGER,
  last_error      TEXT,
  fail_count      INTEGER NOT NULL DEFAULT 0
);

-- これまでの alert_events は解決を記録できていないので捨てる（読む者は居ない）
DELETE FROM alert_events;
ALTER TABLE alert_events ADD COLUMN occurrence INTEGER NOT NULL DEFAULT 1;
```

- `alert_events` は既存の列をそのまま使う。`transition` の語彙を増やす:
  `fired` | `resolved` | `changed`（重大度・題名）| `acknowledged` | `unacknowledged` |
  `suppressed` | `unsuppressed`。`topology_id` と `node_id` は `NULL` で書く（収集はソース
  単位で、どのノードかはトポロジーごとの対応付けで読むときに決まる）。列は残す。
- 書くのは変化だけ。「変化なし」のポーリングは `last_seen_at` も書かない（メモリに持ち、
  変化があった行と終了時にだけ書く）。1,000 件開いていても、落ち着いている間の書き込みは 0。
- 真実は SQLite、コレクタは起動時に `alert_state` を読んでメモリに持つ。再起動しても
  「開いていた」ことを覚えているので、再起動中に解決したものも次の成功で正しく `resolved` になる。

### 2.7 保持

- `alert_state` の解決済み行: 解決から 24 時間で消す（ウィジェットの「解決済みも表示」と
  変化の記録に足りる長さ）。開いている行は消さない。
- `alert_events`: 180 日（`signal-streams.ts` の `RETENTION.alertEventsMs` のまま、既存の
  `housekeeping()` が消す）。
- `grafana_alerts`: Phase 5 で `alert_state` に移して落とす（§4.3）。

## 3. プラグイン契約の変更（`@shumoku/core`）

### 3.1 `Alert` に足すフィールド（すべて任意、表示契約として中立）

`libs/@shumoku/core/src/plugin-types.ts`:

```ts
export interface Alert {
  // …既存…
  /** 同じ問題の繰り返しが共有するキー（同じデータソースの中で）。省略時は host + title。 */
  groupKey?: string
  /** 監視システムで確認済み。 */
  acknowledged?: boolean
  /** 確認した人と時刻（表示用。共有ビューには出さない）。 */
  acknowledgedBy?: string
  acknowledgedAt?: number
  /** 監視システムが抑止している（メンテナンス、silence、inhibition）。 */
  suppressed?: boolean
  /** 抑止の理由（表示用の自由な文字列。共有ビューには出さない）。 */
  suppressedReason?: string
  /** このアラートの原因だと監視システムが言っているアラートの id（同じソースの中）。 */
  causeId?: string
}
```

- **`tags` は足さない。** `labels: Record<string, string>` が既にある。Zabbix のタグは
  `labels` に載せる（同じタグ名が複数あるときは値を `,` でつなぐ）。似た入れ物を 2 つ
  持たない。
- `AlertSeverity` と `AlertStatus` は変えない。`acknowledged` / `suppressed` を status の値に
  しないのは、Zabbix でも Alertmanager でも「開いている」ことと独立だから。
- `causeId` は監視システムの申告をそのまま運ぶだけ（Zabbix の `cause_eventid`、Alertmanager
  の `inhibitedBy` の先頭）。Shumoku は推定しない（§7）。

### 3.2 `getAlerts` の意味を決める／任意の拡張

```ts
export interface AlertsCapable {
  /**
   * `{ activeOnly: true }` で、hostIds / minSeverity の指定が無いとき:
   * このソースでいま開いているアラートの全件を返す。全件を得られなければ投げる
   * （空配列や一部だけを返さない）。timeRange は開いているアラートを絞らない。
   */
  getAlerts(options?: AlertQueryOptions): Promise<Alert[]>
}

/** 任意: 見えなくなったアラートのその後を確かめる（解決の確認と正確な解決時刻）。 */
export interface AlertLookupCapable {
  getAlertsById(ids: readonly string[]): Promise<Alert[]>
}

/** 任意: webhook の本文をアラートに訳す。秘密の照合と保存はホストがする。 */
export interface AlertWebhookCapable {
  parseAlertWebhook(payload: unknown): Alert[] | null   // null: この形ではない（400）
}
```

- 型ガードは既存の流儀で `hasAlertLookup` / `hasAlertWebhook`（メソッドの有無で判定。
  `hasConnectionInfo` と同じ）。
- **差分取得（「前回から変わったものだけ」）は契約に入れない。** Zabbix は `problem.get` の
  `eventid_from` / `time_from` で新しい障害は取れるが、解決したものは取れず、結局全件との
  突き合わせが要る。Alertmanager には差分 API が無い。全件 1 回（interbee で 0.6 秒）で足り、
  差分の正しさを各プラグインに負わせる価値が無い。必要になったら
  `getAlerts` の options に足せる。
- `AlertQueryOptions` は残す（REST の絞り込みはサーバーが状態に対して行うので、コレクタは
  `{ activeOnly: true }` しか渡さなくなる。プラグイン側の `minSeverity` / `timeRange` /
  `hostIds` 処理は当面そのまま、使われなくなったら別 PR で削る）。
- plugin-kit に `validateAlertsContract(alerts)` を足す（`id` が空でなく重複しない、
  `startTime` が有限、`status` が語彙の中、`groupKey` があれば空でない）。
  `validateTopologyIdentityContract` と同じく、各アラートプラグインがフィクスチャの出力に
  掛けるテストを持つ。

### 3.3 各プラグインの作業

| プラグイン | Phase 1（契約を満たす） | Phase 3（フィールド） |
|---|---|---|
| zabbix | 現状で満たす（`problem.get` → `event.get`）。`problem.get` に既定の件数上限が無いことの確認（未確認） | `groupKey = objectid`。`problem.get` の出力に `acknowledged` / `suppressed` / `cause_eventid` を足し、`selectTags` → `labels`、`selectAcknowledges` → `acknowledgedBy` / `At`。`getAlertsById`（`event.get` + 回復イベントの時刻。未確認: 1 回で取れるか、回復イベントを別に引くか） |
| prometheus | 現状で満たす | plugin-kit の `parseAlertmanagerAlerts` で `status.state === 'suppressed'` → `suppressed`、`silencedBy` / `inhibitedBy` → `suppressedReason` / `causeId`。いまのパーサが suppressed を落としているかは未確認 |
| grafana | API モードは現状で満たす | 同じパーサ。Phase 5 で `parseAlertWebhook` を実装し、`alertStore` の注入をやめる |
| aruba-instant-on | `if (!this.api) return []` を投げるように | 無し（確認・抑止の概念が API にあるかは未確認） |
| arista-cv-cue | `timeRange` の cutoff が開いているアラートを落としていないか確認（未確認）。代替 id に端末を含める | 無し |
| huawei-nce-campus | 同上（cutoff の確認） | `acknowledged`（NCE のアラームに確認状態があれば。未確認） |
| newrelic | `readIssues` が開いている issue の全件を返すか確認（未確認） | `acknowledged`（issue の状態にあれば。未確認） |

### 3.4 公開パッケージと changeset

- `@shumoku/core`: 任意フィールドと任意インターフェースの追加。**patch** の changeset。
- `shumoku-plugin-zabbix` / `-prometheus` / `-grafana`: `private` ではない。変更する PR では
  changeset を入れる前提で進める（CI の `changeset` ジョブがプラグインも対象にしているかは
  未確認。CLAUDE.md が名指しするのは `libs/@shumoku/*` と `apps/cli`）。
- `shumoku-plugin-aruba-instant-on` / `-arista-cv-cue` / `-huawei-nce-campus` / `-newrelic`:
  `private: true`。changeset 不要。
- ルート `docs/plugin-authoring.md` に §2.1・§3.2 の契約を書く（同じ PR）。

## 4. コレクタ

### 4.1 `services/alert-collector.ts`

- アラート能力を持つデータソースごとに 1 本のループ（再帰 `setTimeout`、`PollScheduler` と
  同じ作り: ソースごとの `inFlight`、全体の同時実行上限 3、再スケジュールにジッタ）。
- 1 周: `plugin.getAlerts({ activeOnly: true })` → `validateAlertsContract` → `alert_state`
  と突き合わせ → 変化を 1 トランザクションで `alert_state` / `alert_events` に書く →
  `alert-hub` に差分を流す → `alert_source_state` を更新。
- 失敗: §2.4。1 回の上限時間は 30 秒（`@shumoku/plugin-sdk` の HTTP クライアントは既定で
  リクエストごと 10 秒。全体の上限はコレクタが持つ）。
- 依存は注入する（`getAlerts`、時計、DB）。`poll-scheduler.test.ts` と同じく、DB と HTTP
  無しでテストできる形にする。
- きっかけ: 起動時（すぐ 1 周）、データソースの作成・更新・削除（ループを作り直す／止めて
  状態を消す）、手動の `POST /api/datasources/:id/alerts/refresh`。
- 単一プロセス前提（`metrics-hub.ts` や WS のクライアント表と同じ姿勢）。

### 4.2 どのソースを集めるか

**アラート能力のあるデータソースすべて**（個別に切れる: §6 の `alertsMs: 0`）。

- 「どこかのウィジェットが参照しているものだけ」「誰かが見ている間だけ」も考えたが採らない。
  履歴（いつ始まりいつ解決したか）は途切れずに集めて初めて意味がある。ソースは多くて
  十数個で、1 個あたり 30 秒に 1 回は、いまの「画面ごとに 30 秒に 1 回」より必ず少ない。
  参照の有無を追う仕組み（ダッシュボードの保存・削除、共有リンク）を持たずに済む。
- 見ている／見ていないで間隔を変えること（メトリクスの 5 秒 / 60 秒）もしない。アラートは
  30 秒が既定で、もう一段遅くする利得が小さい。状態が 1 つ減る。

### 4.3 `PollScheduler`・webhook との関係

- **`PollScheduler` は別のまま。** あちらはトポロジー単位（対応付けがトポロジーごとに違う）、
  こちらはソース単位。仕事の単位が違うものを 1 つのスケジューラにまとめない。同時実行の
  上限もそれぞれが持つ（合わせて最大 6。必要になれば上限の部品だけ共有する）。
- **`health-checker.ts` も別のまま。** コレクタの成否をデータソースの health に流し込むのは
  自然な次の一歩だが、`testConnection` とアラート取得は失敗の理由が違いうる（権限）ので、
  Phase 1 では混ぜない。
- **webhook は同じ入口に入る。** `collector.ingest(sourceId, alerts, { complete: false })`。
  ポーリングは `complete: true` で同じ関数を通る。違いは「居なかったものを解決するか」だけ。
  - `app/webhooks.ts` の `type !== 'grafana'` を `hasAlertWebhook(plugin)` に替える
    （秘密の照合は今のとおりホストが `webhookSecret` で行う）。
  - Grafana の webhook モード: `grafana_alerts` の行を `alert_state` に移し、テーブルと
    `GrafanaAlertService`、プラグインへの `alertStore` 注入を落とす。
  - **webhook があってもポーリングは止めない（照合役）。** Alertmanager の webhook は
    `group_wait` / `group_interval` で遅れ、取りこぼしもある。API に届くソースでは
    ポーリングが真実で、webhook は「早く知る」ための追加。API に届かない webhook 専用の
    構成（Grafana の `useWebhook` でトークン無し）では、解決は resolved 通知だけが頼りに
    なる。通知が来なくなったことは検出できない（リスクとして §9 に置く）。
  - Zabbix のメディアタイプ（`{EVENT.ID}` / `{EVENT.VALUE}` / `{EVENT.RECOVERY.ID}` などを
    JSON で送る）と Alertmanager の receiver は、同じ `parseAlertWebhook` で後から足せる。
    Phase 5 より後。

## 5. 配信

### 5.1 `services/alert-hub.ts`

`metrics-hub.ts` と同じ役の、プロセス内の pub/sub。持つもの:

- ソースごとの現在のスナップショット（コレクタのメモリ上の状態への参照）。
- 全ソース通しの連番 `seq` と、直近の差分イベントのリングバッファ（2,000 件）。
- `epoch`（プロセス起動ごとの乱数）。イベント id は `<epoch>:<seq>`。

### 5.2 SSE

`GET /api/alerts/stream?sources=<id>,<id>`（サインイン必須）。1 ページ 1 接続で複数ソースを
多重化する（ウィジェットごとに接続すると、HTTP/1.1 の同一オリジン 6 接続の上限を、共有
ビューのトポロジーごとの SSE と合わせてすぐ使い切る）。

```
id: 7f3a:1042
event: snapshot
data: {"serverNow":1763539200000,
       "sources":[{"id":"ds1","state":"ok","lastSuccessAt":1763539190000,"intervalMs":30000}],
       "alerts":[ {"sourceId":"ds1", …Alert, "groupKey":"…","firstSeenAt":…,"occurrence":1} ],
       "changes":[ {"kind":"new","at":…,"sourceId":"ds1","alert":{…}} ]}

id: 7f3a:1043
event: delta
data: {"serverNow":…,"sourceId":"ds1",
       "upserts":[…], "removed":["<alert id>"],
       "changes":[{"kind":"resolved","at":…,"alert":{…}}]}

id: 7f3a:1044
event: source
data: {"id":"ds1","state":"failing","lastSuccessAt":…}

: ping            ← 15 秒ごとのコメント行
```

- `snapshot.alerts`: 開いているもの全部と、直近 1 時間に解決したもの。
  `snapshot.changes`: 直近 1 時間の `fired` / `resolved`（`alert_events` から、上限 200）。
- `delta` はコレクタの 1 周で変化があったときだけ。変化が無ければ何も送らず、`source` も
  状態が変わったときだけ（`lastSuccessAt` は 1 分に 1 回まとめて知らせる）。
- **再開**: `Last-Event-ID` の `epoch` が今と同じで `seq` がリングバッファに残っていれば、
  その後の差分だけを送る。そうでなければ（再起動、長い切断）`snapshot` を送り直す。
  クライアントは `snapshot` を受けたら持っているものを丸ごと置き換える。差分の再送に
  失敗しても、スナップショットは常に正しい。
- ヘッダは共有 SSE と同じ（`Cache-Control: no-store`、`X-Accel-Buffering: no`）。
  実装は `modules/share/routes.ts#streamTopologyMetrics` の流儀（`streamSSE`）。
- web 側: `DashboardReader` に `alertStream(sourceIds)` を足す（`liveSource` と同じく、
  サインインか共有かで URL が変わるだけ。ウィジェットはどちらか知らない）。ダッシュボードの
  状態（`dashboard.svelte.ts`）が接続を 1 本持ち、各 Alerts ウィジェットは自分のソースの
  分を読む。

サインイン側も `/ws` ではなく SSE にする（読むだけの流れは SSE、という CLAUDE.md の方針。
`curl` で見られるので、エージェントや外部の表示も同じ口を使える）。

### 5.3 REST

| エンドポイント | 用途 | 誰が |
|---|---|---|
| `GET /api/datasources/:id/alerts`（既存） | 状態からの読み出し。`activeOnly` / `minSeverity` / `timeRange` / `hostIds` はサーバーが絞る。**プラグインは呼ばない** | サインイン |
| `GET /api/share/dashboards/:token/datasources/:id/alerts`（既存） | 同上 + `publicAlert` | 共有 |
| `GET /api/alerts/sources` | 各ソースの収集状態（`state`、時刻、`lastError`、開いている件数、有効な間隔） | サインイン |
| `POST /api/datasources/:id/alerts/refresh` | いますぐ 1 周 | 管理者 |
| `GET /api/alerts/events?sourceId=&alertKey=&host=&from=&to=&limit=&cursor=` | 履歴（`alert_events`） | サインイン（共有には出さない） |

既存 REST の失敗時の意味（Phase 1）: ソースが `failing` または `never` のときは、いまと
同じくエラーを返す（ウィジェットは手元の一覧を残して Not updating を出す、という現行の
動きがそのまま働く）。Phase 2 で SSE に移ると、凍結した一覧と `failing` を一緒に受け取れる
ので、開いたばかりの画面でも最後の一覧が見える。

### 5.4 共有ダッシュボード

`GET /api/share/dashboards/:token/alerts/stream`。対象ソースは、トークンのダッシュボードの
レイアウトが参照する `dataSourceId`（既存の `referencedIds`）のうちアラート能力のあるもの。
クエリでソースを選ばせない。

公開の射影（`modules/share/projections.ts`、許可リスト）:

| 対象 | 出す | 出さない |
|---|---|---|
| アラート（`publicAlert` を拡張） | `id`、`severity`、`status`、`title`、`host`、`nodeId`、`startTime`、`endTime`（既存）＋ `groupKey`（ソース内キーのハッシュに置き換える）、`acknowledged`、`suppressed`、`sourceId`（レイアウトに既に出ている） | `description`、`hostId`、`source`、`url`、`labels`、`receivedAt`、`acknowledgedBy` / `At`、`suppressedReason`、`causeId` |
| ソースの状態 | `id`、`state`（`ok` / `failing`）、`lastSuccessAt` | `lastError`、間隔、`fail_count` |
| 変化 | `kind`、`at`、公開の射影を通したアラート | — |

- 履歴の REST は共有に出さない（`signal-streams.md` §1 の 6: 過去のデータは今より多くを
  含みうる）。共有が見るのは「いま」と直近 1 時間の変化だけ。
- 同時接続の上限は、メトリクスの `MAX_SHARE_METRIC_STREAMS`（200）とは別に数える（同じ値）。
- 射影の単体テストを足す（新フィールドを `Alert` に足しても、許可リストに入れない限り
  共有に出ないこと）。

### 5.5 今週 web に作ったものの行き先

| いま（`alert-groups.ts` / `AlertsWidget.svelte`） | これから |
|---|---|
| まとめ（`status + host + title`） | サーバーが `groupKey` を必ず埋めて配る。まとめる関数は web の純関数のまま、キーを `status + groupKey` に。入力が同じなので全画面で同じ結果 |
| 新着（最初の開始から 10 分、`NEW_MS`） | 計算は同じ。`now` を `serverNow`（イベントごとに届く）から数える。壁の表示機の時計がずれていても揃う |
| 古い（`staleAfterHours`） | 同上。しきい値はウィジェットの設定のまま |
| 変化の記録の「解決」（前回の取得と比べる、再読み込みで消える） | 捨てる。サーバーの `changes`（`alert_events` 由来）を使う。「新規」もそこから。まとめ表示（`changeLines`）は純関数のまま |
| Not updating（取得失敗、または間隔の 3 倍読めていない） | 2 つの原因を区別して同じ帯に出す: ソースが `failing`（サーバーが監視システムに届かない）／ この画面がサーバーに届かない（SSE が切れた、45 秒 ping が無い） |
| 30 秒ごとの `setInterval` と `autoRefresh` 設定 | 無くす。設定キーは読まれなくなる（保存済みのレイアウトに残っても無害。設定欄は外す） |
| トポロジーへの印（`newSince`、Follow new alerts） | 仕組みは変えない。入力がストリームになるだけ |

まとめた行をサーバーが作って配る（1,000 件を 100 行にして送る）形も考えた。スナップショット
は小さくなるが、行を開いて個々の発生を見る口が別に要り、ウィジェットごとの絞り込みを
サーバーが知る必要が出る。接続時の 1 回 約 140 KB は許せるので、レコードを配って画面で
まとめる。件数がさらに一桁増える現場が出たら見直す（§9）。

## 6. ソースごとのポーリング間隔

### 6.1 どこに置くか

**2 段: アプリの Settings ページにサーバー全体の既定、データソースに個別の上書き。** 以前の
Settings の「Update Interval」が効かなかったのは置き場所のせいではなく、値がブラウザにしか
保存されずサーバーが無視していたため。今度はどちらもサーバーに保存し、サーバーが読む。
普段は Settings の既定だけを触り、レート制限の厳しいクラウド API など例外だけをデータソースで
上書きする。上書きはプラグインの `configSchema` には置かない（置くと全プラグインが同じ欄を
書き写すことになり、Zabbix だけにあった今の形を 7 回繰り返す）。

- 既定: `settings` テーブル（既存の `SettingsService`）の `polling.alertsMs`、
  `polling.metricsMs`、`polling.syncMs`（トポロジー同期の既定。§6.5）。Settings ページに
  「Polling」の節（アラート / メトリクス / 構成の同期）。

- DB: `data_sources.polling_json TEXT`（NULL = すべて既定）。
  `{ "alertsMs"?: number, "metricsMs"?: number }`。`alertsMs: 0` はアラート収集を切る。
- API: データソースの作成・更新の本文に `polling` を足す（`modules/data-sources`）。
- UI: データソースの詳細ページ（`web/src/routes/(app)/datasources/[id]/+page.svelte`）に
  「Polling」の節。能力に応じて欄を出す（`alerts` があれば Alerts、`metrics` があれば
  Metrics）。選択肢は 5 秒 / 10 秒 / 30 秒 / 1 分 / 5 分（アラートは 5 秒を出さず、Off を
  足す）。プラグインの下限より短い選択肢は出さない。`type` での分岐は無い。
- 既定と下限はプラグインが申告する。`PluginDescriptor` に任意の欄を足す:

```ts
export interface PluginDescriptor {
  // …既存…
  /** 収集の間隔の既定と下限（ms）。省略時はホストの既定。 */
  polling?: { alertsMs?: number; metricsMs?: number; minMs?: number }
}
```

### 6.2 既定値と下限

| ソースの種類 | アラート | メトリクス | 下限 |
|---|---|---|---|
| ホストの既定（申告なし） | 30 秒 | 30 秒 | アラート 10 秒 / メトリクス 5 秒 |
| Zabbix | 30 秒 | 30 秒（項目の更新は多くが 60 秒。5 秒で読んでも同じ値） | 同上 |
| Prometheus / Grafana | 30 秒 | 15 秒 | 同上 |
| クラウド API（Aruba Instant On、Arista CV-CUE、Huawei NCE、New Relic） | 60 秒 | 60 秒 | 30 秒（各 API のレート制限の実数は未確認） |

有効な値の決まり方（上が勝つ）:

1. データソースの `polling_json`（個別の上書き）。
2. Settings ページの既定（`settings` の `polling.*`）。
3. 環境変数 `POLL_INTERVAL` が**明示されているとき**（メトリクスだけ。既存の調整を壊さない
   ため。非推奨とし、ドキュメントで Settings へ誘導する）。
4. プラグインの申告。
5. ホストの既定。

どの値も下限（ホストの下限とプラグインの `minMs` の大きい方）で切り上げる。

「監視システム側の更新間隔に合わせるのがよい」は筋の通った推論だが、出典のある規則では
ない（調査メモで未確認とした点）。だから既定値として置くだけで、強制はしない。

**挙動の変化として明示すること**: メトリクスの既定が、見ているトポロジーで 5 秒から
ソースごとの値（Zabbix 30 秒）に変わる。図の数字の動きが遅くなったと感じる現場は、
データソースの設定で 5 秒に戻せる。既定を 5 秒のまま据え置く案もあるが、何も設定しない
利用者に無駄な問い合わせを続けさせるので採らない。リリースノートと
`installation.*.mdx` に書く。

### 6.3 メトリクスが間隔を守る方法（1 つのトポロジーに複数ソース）

`PollScheduler` はトポロジー単位のまま。変えるのは 2 点。

- **トポロジーの周期** = そのトポロジーのメトリクスソースの有効な間隔のうち最短（見ている
  とき）。見ていないときは、これと `BACKGROUND_POLL_INTERVAL`（60 秒、サーバー全体の設定
  として残す）の大きい方。`PollScheduler` の `fastInterval` / `slowInterval` を、定数から
  `(topologyId) => number` に替える。
- **周期の中で、ソースごとに間隔が来たものだけ取り直す。** `server.ts` の
  `updateSingleDbTopologyMetrics` は今、全ソースを毎回 `pollMetrics` する。ここに
  「(トポロジー, ソース) ごとの前回の成功結果と時刻」を持ち、間隔が来ていないソースは
  前回の結果を合成（`metrics-merge.ts`）に渡す。合成は毎回すべてのソースを見るので、
  冗長経路の判定や優先度の合成は変わらない。前回の結果を使える上限は間隔の 3 倍
  （それを超えたら、そのソースは今と同じ「失敗した」扱い）。

同じソースを 3 つのトポロジーが使えば 3 回取りに行くのは今のまま（対応付けがトポロジー
ごとに違うため）。ソース単位にまとめるのは別の話で、本メモでは扱わない。

### 6.4 死んでいる設定の片付け

- Zabbix の `configSchema` から `pollInterval` を消す。保存済みの `config_json` に残る値は
  移さない（誰も効かせたことのない値で、フォームの既定 60 秒が入っているだけの可能性が
  高い。未確認: `SchemaForm` が既定値を保存するか）。`validateAgainstSchema` は未知のキーを
  無視するので、残っていても害は無い。`libs/plugins/zabbix/README.md` と
  `src/types.ts` からも消す。
- `web/src/routes/(app)/datasources/+page.svelte` と `[id]/+page.svelte` にある
  `pollInterval` の読み出しを、`polling` の表示に替える。
- `POLL_INTERVAL`: §6.2 の 2。`BACKGROUND_POLL_INTERVAL`: 残す。

### 6.5 トポロジー同期の間隔

仕組みは既にある（`discovery-policy` の `intervalMs`、`PATCH /api/topologies/:id/discovery-policy`、
`sync-scheduler.ts` が下限 5 分で読む）。足りないのは欄だけ。

- トポロジーの Sources ページ（同期の設定がある場所）に「Sync interval」を足す:
  5 分 / 15 分 / 30 分（既定）/ 1 時間 / 6 時間 / 24 時間。トポロジー全体の既定を設定する
  （ノード・サブグラフ単位の上書きは `sync-scheduler.ts` の冒頭が説明するとおり、今は
  意味を持たないので UI に出さない）。
- 次の同期の予定時刻と、バックオフ中ならその旨を同じ場所に出す（`SyncScheduler` の status に
  あるものを使う）。
- これは構造の同期で、アラートやメトリクスの間隔とは別物。データソースの設定ではなく
  トポロジーの設定に置く（同じソースでも、トポロジーごとに頻度を変えたい）。

## 7. 操作と、やらないこと

- **確認（acknowledge）**: 監視システムでの確認を**表示する**ところまで（§3.1）。Shumoku の
  中だけの確認は作らない: 監視システムの画面と食い違う第 2 の真実になる。監視システムへ
  書き戻す操作（Zabbix の `event.acknowledge` など）も今回は作らない: 書き込み権限のある
  トークンが要り、共有ビューの扱いと操作ログ（誰が）が先に要る。やるなら
  `AlertActionsCapable` のような任意の能力として、別メモで。
- **抑止・silence の作成**: 同じ理由でやらない。
- **原因の推定**: トポロジーを使った「上流が落ちたから配下は症状」の判定はしない。
  監視システムが言った `causeId` を運ぶだけ。ただし本メモの状態（ホストごとに、いつから
  開いているか）は、その入力として使える形にしてある。
- **通知**（メール、チャット、音）: やらない。監視システムの仕事。
- **複数ソースのアラートの突き合わせ**（同じ障害を Zabbix と Grafana が言っている）:
  やらない。ソースごとに並べる。
- **アラートの時点再現**（`signal-streams.md` の `?at=T`）: `alert_events` が正しく溜まる
  ようになるので可能になるが、作るのは向こうの M3。

## 8. 移行と段階

各段階は単独で出荷でき、前の段階だけに依存する。

### Phase 1 — ソースあたり 1 回、全画面で共有（web は変えない）

**PR 1a: 契約を満たす**
- plugin-kit に `validateAlertsContract` とテスト。`docs/plugin-authoring.md` に契約。
- 各プラグインの確認と修正（§3.3 の Phase 1 列）、フィクスチャに検査を掛けるテスト。
- changeset: core（patch）、変更したプラグイン。
- リスク: これまで空を返していた失敗が、エラーとして見えるようになる（意図どおり）。

**PR 1b: コレクタと状態**
- 移行 `038`（`alert_state`、`alert_source_state`、`alert_events` の掃除と列）。
- `services/alert-collector.ts`（間隔は 30 秒固定、バックオフ）、`server.ts` で起動・停止、
  データソースの作成・更新・削除に追従。
- `app/data-source-operations.ts#getAlerts` と `app/share.ts#dashboardAlerts` を状態からの
  読み出しに替え、`signalStreams.ingestAlerts` の呼び出しと実装を消す（`housekeeping` の
  `alert_events` 掃除は残し、`alert_state` の解決済み 24 時間を足す）。
- Grafana の webhook モードは当面そのまま動く（プラグインの `getAlerts` がストアを読み、
  それをコレクタが 30 秒ごとに読む。遅れは最大 30 秒増える。Phase 5 で直結する）。
- `GET /api/alerts/sources`、`POST /api/datasources/:id/alerts/refresh`。
- テスト: コレクタ単体（開く／変わる／消えて解決／失敗では解決しない／失敗後の復旧で解決／
  同じ id の再発で `occurrence` が増える／再起動後に開いていたものを覚えている）、REST の
  絞り込み、共有経路が同じ状態を読むこと。
- ドキュメント: `dashboards.ja.mdx` の「解決の記録は、そのページを開いている間に見たもの
  だけです」はまだ正しい（Phase 2 で直す）。この PR では利用者に見える変化は「複数の画面が
  同じ内容になる」だけ。
- リスク: 起動直後の最初の 1 周が終わるまで REST が返すものが無い → 最初の成功まで
  `never` としてエラーを返し、起動時にすぐ 1 周する（凍結した前回の状態が DB にあれば、
  それを `failing` 相当として扱うかは実装時に決める）。

### Phase 2 — SSE と、サーバーが決める変化の記録

- `services/alert-hub.ts`、`GET /api/alerts/stream`、共有の
  `GET /api/share/dashboards/:token/alerts/stream`、公開の射影の拡張とテスト。
- web: `DashboardReader.alertStream`、`dashboard.svelte.ts` に接続 1 本、`AlertsWidget` の
  ポーリングと `resolvedChanges` を削除、`serverNow`、Not updating の 2 原因。
  `autoRefresh` の設定欄を外す。
- テスト: 再開（同じ epoch で差分、違う epoch でスナップショット、リングバッファ切れで
  スナップショット）、共有の射影、`reader.test.ts`、`alert-groups` のテスト更新。
- ドキュメント: `dashboards.ja.mdx`（解決の記録が再読み込みで消えなくなる、更新間隔の設定が
  無くなる、Not updating の意味）、OpenAPI。
- リスク: プロキシが SSE をバッファする（既存の共有 SSE と同じヘッダで対処済みの範囲）。
  スナップショットの大きさ（§9）。

### Phase 3 — 確認・抑止・繰り返しのキー

- core の `Alert` に §3.1 のフィールド、`AlertLookupCapable`。plugin-kit のパーサ
  （Alertmanager 方言）、Zabbix。コレクタが `acknowledged` / `suppressed` の遷移を記録し、
  `getAlertsById` があれば解決を確かめる。
- web: `groupKey` でまとめる、確認済みの印、抑止中は畳む・トポロジーを赤くしない。
  `publicAlert` に `groupKey`（ハッシュ）/ `acknowledged` / `suppressed`。
- changeset: core、zabbix、prometheus、grafana。ドキュメント: `dashboards.ja.mdx`、
  `plugin-authoring.md`。
- リスク: Zabbix の `groupKey` をトリガー id にすると、1 つのトリガーが複数ホストに
  またがる場合（未確認: 複数ホストの式を持つトリガー）に行がまとまりすぎる →
  `objectid + hostid` にするかを実データ（interbee）で確かめてから決める。

### Phase 4 — ソースごとの間隔

- 移行: `data_sources.polling_json`。API とデータソース詳細ページの Polling 節。
  `PluginDescriptor.polling` と各プラグインの申告。
- コレクタが `alertsMs` を読む（`0` で止める → `alert_source_state.state = 'off'`）。
- `PollScheduler` の間隔を関数に、`updateSingleDbTopologyMetrics` にソースごとの再利用
  （§6.3）。Zabbix の `pollInterval` を消す（§6.4）。
- トポロジー同期の間隔の欄（§6.5）は独立した小さな PR にできる。
- テスト: 有効な間隔の決まり方（優先順位と下限）、間隔が違う 2 ソースのトポロジーで
  それぞれの呼び出し回数、前回結果の再利用の上限、`poll-scheduler.test.ts` の更新。
- changeset: core（patch）、zabbix ほか申告を足したプラグイン。ドキュメント:
  データソースのページ、`installation.*.mdx`（`POLL_INTERVAL` の非推奨）、`helm-chart.md`。
- リスク: §6.2 の既定の変化。合成の不変条件（`performance-scaling.md` の「② correctness」）を
  再利用が壊さないこと（前回結果は取り直した結果と同じ形で合成に渡す）。

### Phase 5 — webhook の一般化

- core に `AlertWebhookCapable`、`app/webhooks.ts` の `type` 分岐を外す、Grafana プラグインが
  `parseAlertWebhook` を実装、`grafana_alerts` を `alert_state` に移して落とす、
  `GrafanaAlertService` と `alertStore` 注入の削除。
- その後、別 PR で Zabbix のメディアタイプ、Alertmanager の receiver。
- テスト: webhook は言及したものだけを変える、ポーリングが後から照合する、
  `host-branch-guard.test.ts` が webhook の経路も見るようにする。
- 進行中の PR #942（`fix/grafana-webhook-alerts`）とぶつかるので、その後に行う。

### Phase 6 — 履歴の口

- `GET /api/alerts/events`。使う側（アラートの詳細に「この問題の過去の発生」、
  `signal-streams.md` の availability ウィジェット）は別の設計で。

Phase 3 と Phase 4 は互いに依存しないので、順序は入れ替えられる。

## 9. リスクと未解決

| リスク | 対応 |
|---|---|
| 部分的な結果を全件として返すプラグインが、開いているアラートを一斉に解決してしまう | 契約（投げる）＋検査＋ Phase 1 の監査。`getAlertsById` を持つソースは確かめてから解決。それでも心配なら「2 回連続の不在」を定数 1 つで切り替えられるようにしておく |
| webhook 専用の構成で通知が止まると、開いたまま残る | 検出できない。ソースの状態に「最後に通知を受けた時刻」を出す。可能なら API も設定して照合させる、と文書に書く |
| スナップショットの大きさ（開いている件数が 1 万級） | いまは許す（1,000 件で約 140 KB、接続時のみ）。超えたら「行にまとめて配る」形に替える（§5.5）。SSE の応答が圧縮されるかは未確認 |
| 全ソースを常時ポーリングすることの負荷 | ソースごとに切れる・間隔を伸ばせる（Phase 4）。それまでは 30 秒固定で、今より必ず少ない |
| 単一プロセス前提（複数レプリカでコレクタが重複する） | 既存の `metrics-hub` / WS と同じ制約。レプリカを増やす設計のときに、収集を 1 つに寄せる |
| メトリクスの既定間隔が変わる | §6.2。リリースノートに明記、データソースの設定で戻せる |

未確認として本文に印を付けたもの（実装前に確かめる）:

- Zabbix `problem.get` に API の既定の件数上限があるか。回復イベントの時刻を `event.get`
  1 回で取れるか。複数ホストにまたがるトリガーの `objectid`。
- `parseAlertmanagerAlerts` が suppressed のアラートをいまどう扱っているか。
- Arista CV-CUE / Huawei NCE の `timeRange` の cutoff、New Relic の `readIssues` が、
  開いているアラートを落とさないか。各クラウド API のレート制限と、確認状態の有無。
- CI の `changeset` ジョブが `libs/plugins/*` の公開パッケージを対象にしているか。
- `SchemaForm` が既定値を `config_json` に保存するか（Zabbix の `pollInterval` の残り方）。
- Grafana / Alertmanager が開いているアラートを webhook で再送する間隔。
- 「ポーリング間隔は上流の更新間隔に合わせるのがよい」は推論で、出典のある規則ではない。

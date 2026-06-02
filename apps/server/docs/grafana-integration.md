# Grafana Integration

Shumoku ServerのGrafana連携に関する開発ドキュメント。

## 概要

GrafanaからアラートをWebhookで受信し、ダッシュボードに表示する。

```
Grafana ──(Contact Point Webhook)──> Shumoku Server ──(SQLite保存)──> Dashboard
```

Alertmanager APIポーリングによるフォールバックも可能。

## アラート受信方式

| 方式 | 設定 | 特徴 |
|------|------|------|
| Webhook (推奨) | `useWebhook: true` | リアルタイム、Grafanaからpush |
| Alertmanager API | `useWebhook: false` | ポーリング、APIトークン必須 |

## セットアップ

### 1. Shumoku側

1. **Data Sources > Add Data Source** で Grafana を選択
2. URL と API Token を入力して作成
3. 作成後、編集画面で **Webhook Alerts** トグルを ON にする
4. **Save Changes** すると、接続情報（Connection）に Webhook URL が表示される（secret は保存時に自動生成）
5. 表示された URL をコピーする（例: `/api/webhooks/grafana/<id>?secret=<secret>`）

### 2. Grafana側

#### Contact Point の作成

1. **Alerting > Contact points** を開く
2. **Add contact point** をクリック
3. 名前を入力（例: `Shumoku`）
4. Integration に **Webhook** を選択
5. URL に Shumoku の完全な Webhook URL を入力
   - 例: `http://shumoku-server:8080/api/webhooks/grafana/<id>?secret=<secret>`
6. **Save contact point**

#### Notification Policy の設定（必須）

Contact Point を作成しただけではアラートは送信されない。Notification Policy で紐づけが必要。

1. **Alerting > Notification policies** を開く
2. Default policy の Contact Point を変更する、または新しい policy を追加する
3. 特定のラベルでフィルターしたい場合は Matcher を設定する

> **注意**: Notification Policy を設定しないと、Contact Point は「Unused」「No delivery attempts」のままになる。

## Webhook ペイロード

Grafana から送信される JSON の構造:

```json
{
  "status": "firing",
  "alerts": [
    {
      "status": "firing",
      "labels": {
        "alertname": "HighCPU",
        "severity": "critical",
        "instance": "server01"
      },
      "annotations": {
        "summary": "CPU usage is above 90%",
        "description": "..."
      },
      "startsAt": "2024-01-01T00:00:00Z",
      "endsAt": "0001-01-01T00:00:00Z",
      "generatorURL": "https://grafana.example.com/...",
      "fingerprint": "abc123"
    }
  ]
}
```

## 内部実装

### データフロー

```
POST /api/webhooks/grafana/:id?secret=…   (汎用ルート /api/webhooks/:type/:id)
  → webhooks.ts: id でデータソースを引き、secret を timingSafeEqualStr で定数時間比較
  → isGrafanaWebhookPayload(payload) で形を検証
  → GrafanaAlertService.upsertFromWebhook(): SQLiteにupsert
  → grafana_alerts テーブルに保存

GET /api/datasources/:id/alerts
  → GrafanaPlugin.getAlerts()
    → useWebhook=true: GrafanaAlertService.getAlerts() (DB読み取り)
    → useWebhook=false: fetchAlertsFromApi() (Alertmanager API)
```

### 関連ファイル

| ファイル | 役割 |
|---------|------|
| `libs/plugins/grafana/src/plugin.ts` | プラグイン本体（payload 検証・`getConnectionInfo`・API フォールバック） |
| `libs/@shumoku/core/src/plugin-kit/` | severity / Alertmanager パース等の共通ヘルパー（旧 grafana-alerts.ts から集約） |
| `api/src/services/grafana-alerts.ts` | アラートの SQLite 操作（upsert / クエリ） |
| `api/src/api/webhooks.ts` | 汎用 Webhook エンドポイント `POST /:type/:id`（id 検索＋定数時間 secret 比較） |
| `api/src/lib/webhook-guard.ts` | `timingSafeEqualStr`（定数時間比較） |
| `api/src/db/migrations/007_grafana_alerts.sql` | テーブル定義 |
| `web/src/routes/(app)/datasources/[id]/+page.svelte` | Webhook トグル＋接続情報（URL）UI |

### Severity マッピング

Grafana/Alertmanager の `severity` ラベルを core の中立スケール
（`critical | high | medium | low | info | ok`）に変換する。実体は
`@shumoku/core/plugin-kit` の `mapAlertmanagerSeverity()`（grafana / prometheus が共有する単一の真実）:

| ラベル値 | Shumoku（中立） |
|---------|------|
| critical, disaster | critical |
| high, major, error | high |
| medium, average, moderate | medium |
| warning, warn, minor | low |
| low, info, information | info |
| none, ok | ok |

> Zabbix 由来の `disaster` / `average` / `information` は出力スケールから撤去済み（CLAUDE.md の不変条件）。
> `warning` が `low` なのは Alertmanager 方言（`warning` は page 対象 `critical` の下）に合わせているため。

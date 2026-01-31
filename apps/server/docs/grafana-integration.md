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
4. **Save Changes** すると Webhook URL が生成される
5. 表示された URL をコピーする（例: `/api/webhooks/grafana/xxxxxxxx`）

### 2. Grafana側

#### Contact Point の作成

1. **Alerting > Contact points** を開く
2. **Add contact point** をクリック
3. 名前を入力（例: `Shumoku`）
4. Integration に **Webhook** を選択
5. URL に Shumoku の完全な Webhook URL を入力
   - 例: `http://shumoku-server:8080/api/webhooks/grafana/xxxxxxxx`
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
POST /api/webhooks/grafana/:secret
  → webhooks.ts: secretでデータソース検索
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
| `api/src/services/grafana-alerts.ts` | アラートDB操作、共通ヘルパー |
| `api/src/plugins/grafana.ts` | プラグイン本体、API フォールバック |
| `api/src/api/webhooks.ts` | Webhook エンドポイント |
| `api/src/api/datasources.ts` | Webhook URL 取得エンドポイント |
| `api/src/db/migrations/007_grafana_alerts.sql` | テーブル定義 |
| `web/src/routes/(app)/datasources/[id]/+page.svelte` | Webhook トグル UI |

### Severity マッピング

Grafana のラベル値を内部の severity に変換する:

| Grafana | Shumoku |
|---------|---------|
| critical, disaster | disaster |
| high, major, error | high |
| average, medium | average |
| warning, warn, minor | warning |
| low, info, information | information |
| none, ok | ok |

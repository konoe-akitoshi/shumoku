---
id: server.api-access
title: 認証、API、共有アクセス
description: 管理API、公開共有、Webhook、WebSocketのアクセス境界を説明します。
locale: ja
canonicalLocale: ja
slug: server/api-access
status: stable
audience: operator
owner: server
related:
  - /ja/reference/server
---

通常の管理APIは、ログインで取得した管理者Session Cookieを必要とします。例外はhealth check、tokenでscopeされた共有route、Secretで認証するWebhookです。個々のrequest/responseは[生成Server API](/ja/reference/server)を参照してください。

## 初期認証

外部へbindする新規Serverは、管理者Secretなしでは起動しません。`SHUMOKU_BOOTSTRAP_ADMIN_PASSWORD_FILE`でownerだけが読めるファイルを渡す方法を推奨します。ブラウザからの初期設定を許可する`SHUMOKU_ALLOW_WEB_SETUP`はloopback開発専用です。

`DEMO_MODE`はサンプルデータを投入するだけで、匿名アクセスを許可しません。

## 開発時のAPI操作

`bun run dev:server`はloopback限定の一時credentialを生成します。credentialを表示・転記せず、専用wrapperを使います。

```bash
bun run dev:server:request -- GET /api/topologies
```

この経路はdevelopmentかつloopbackでのみ有効です。本番環境ではSession認証を利用します。

## 共有リンクとWebhook

TopologyまたはDashboardの共有tokenは、対象resourceに限定した読み取り権限です。tokenを持つ利用者は、他の管理resourceを列挙できません。不要になった共有tokenは設定画面で失効させます。

Webhookは`X-Webhook-Secret` headerを推奨し、query parameterはSecretがaccess logへ残る可能性を考慮してください。

## WebSocket

`/ws`は認証済みSession、許可されたOrigin、`workspace:read`権限を要求します。proxy配下ではWebSocket upgradeを転送してください。HTTP API外のmessage contractはServer sourceを基準とし、将来専用referenceへ抽出します。


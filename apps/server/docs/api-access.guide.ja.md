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

保護されたAPIは、ローカルSessionまたは明示的に有効化したプロキシ認証から解決されるprincipalと必要な権限を要求します。workspaceの読み取りは`workspace:read`、変更は`workspace:write`、データソース設定・Settings・管理診断は`admin:manage`が必要です。例外はhealth check、tokenでscopeされた共有route、Secretで認証するWebhookです。個々のrequest/responseは[生成Server API](/ja/reference/server)を参照してください。

## 初期認証

外部へbindする新規Serverは、管理者Secretなしでは起動しません。`SHUMOKU_BOOTSTRAP_ADMIN_PASSWORD_FILE`でownerだけが読めるファイルを渡す方法を推奨します。ブラウザからの初期設定を許可する`SHUMOKU_ALLOW_WEB_SETUP`はloopback開発専用です。

`DEMO_MODE`はサンプルデータを投入するだけで、匿名アクセスを許可しません。

## リバースプロキシSSO

信頼境界と環境変数は[インストール手順](/ja/guides/server/installation)を参照してください。有効な間はローカルのログイン・初期設定・パスワード変更を無効化し、Cookieと開発用Bearerによるアクセスも許可しません。初回起動の管理者Secretは引き続き必要です。

`GET /api/auth/status`は`authMethod: proxy`と`proxy:`を付けたsubjectを返します。ロールヘッダー未設定時は既定で`viewer`、設定時は空・未対応のグループを拒否します。複数グループでは明示的に対応付けた最大のロールを採用します。保護APIで身元・グループが拒否されると401、認証済みでも必要な権限がない場合は403を返します。

ログアウトは組織の認証基盤で行います。Shumokuのlogout endpointが削除するのはローカルSessionだけです。非常用のローカルログインでは接続元を制限し、プロキシ認証を無効にして再起動します。`authMethod`をenumで検証するクライアントは、有効化前に`proxy`へ対応してください。

## 開発時のAPI操作

`bun run dev:server`はloopback限定の一時credentialを生成します。credentialを表示・転記せず、専用wrapperを使います。

```bash
bun run dev:server:request -- GET /api/topologies
```

この経路はdevelopmentかつloopbackでのみ有効です。本番環境ではローカルSessionまたはプロキシ認証を利用します。プロキシ認証中は開発用Bearerを無視します。

## 共有リンクとWebhook

TopologyまたはDashboardの共有tokenは、対象resourceに限定した読み取り権限です。tokenを持つ利用者は、他の管理resourceを列挙できません。不要になった共有tokenは設定画面で失効させます。

Webhookは`X-Webhook-Secret` headerを推奨し、query parameterはSecretがaccess logへ残る可能性を考慮してください。

## WebSocket

`/ws`はローカルSessionまたは信頼済みプロキシの身元、許可されたOrigin、`workspace:read`権限を要求します。プロキシ認証中はHTTPと同じ身元解決を使い、ローカルCookieを無視します。認可は接続時に行い、接続済みsocketは切断までprincipalを保持します。proxy配下ではWebSocket upgradeを転送してください。HTTP API外のmessage contractはServer sourceを基準とし、将来専用referenceへ抽出します。


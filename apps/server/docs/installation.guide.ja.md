---
id: server.installation
title: Serverのインストールと運用
description: Dockerで安全に導入し、TLS、更新、バックアップを構成します。
locale: ja
canonicalLocale: ja
slug: server/installation
status: stable
audience: operator
owner: server
related:
  - /ja/guides/server/api-access
---

本番環境では公開済みコンテナを利用し、正確なバージョンを固定してください。データはSQLiteを含む永続Volumeへ保存し、管理者パスワードはファイルまたはSecretとして渡します。

## Dockerで起動する

```bash
install -d -m 700 .shumoku
openssl rand -base64 32 > .shumoku/admin-password
chmod 600 .shumoku/admin-password
docker run -d --name shumoku -p 8080:8080 -v shumoku-data:/data \
  -v "$PWD/.shumoku/admin-password:/run/secrets/shumoku_admin_password:ro" \
  -e SHUMOKU_BOOTSTRAP_ADMIN_PASSWORD_FILE=/run/secrets/shumoku_admin_password \
  ghcr.io/konoe-akitoshi/shumoku:X.Y.Z
```

`http://localhost:8080/login`を開き、生成した管理者パスワードでログインします。`latest`は将来の再起動時に更新され得るため、本番では`X.Y.Z`へ固定します。

リポジトリからComposeで起動する場合は、`apps/server`へ移動して`.env.example`を`.env`へコピーし、`docker compose up -d`を実行します。利用可能な変数と既定値はこのテンプレートを正とします。

## HTTPS

Server自身はHTTPを提供します。外部公開時はCaddyやnginxでTLSを終端し、`SHUMOKU_SECURE_COOKIES=true`を設定してください。`SHUMOKU_TRUST_PROXY=true`は、信頼するproxyがクライアントIP headerを置換する場合だけ有効にします。

WebSocketの`/ws`にはUpgrade headerが必要です。長時間のSNMP同期をproxyが切断しないよう、read timeoutも十分に確保します。

## リバースプロキシによるSSO（OIDC/SAML）連携

Shumoku自体はOIDC/SSOを内蔵していませんが、認証を行うリバースプロキシ
（[oauth2-proxy](https://github.com/oauth2-proxy/oauth2-proxy)、Authelia、Pomerium など）
を前段に置き、そのプロキシが付与する信頼済みヘッダーで認証を委譲できます。
`SHUMOKU_PROXY_AUTH_ENABLED=true` で有効になります（既定は無効）。

有効化する前に、レスポンスの `authMethod` を enum として検証する API クライアントを
`proxy` に対応させてください。プロキシ認証を無効にした既存環境では従来の値を返します。

プロキシ認証は HTTP API・認証状態 API・WebSocket で共通です。有効な間は
ローカル Cookie と開発用 Bearer 認証を無視し、ローカルの初期設定・ログイン・
パスワード変更も無効にします。古い管理者 Cookie が IdP の権限変更を上書きする
ことを防ぎます。Shumoku のセッションは発行しません。

ロールヘッダー未設定時は、プロキシが認証した全員に
`SHUMOKU_PROXY_AUTH_DEFAULT_ROLE`（既定 `viewer`）を付与します。
利用可能なグループを限定する場合は、次のように設定します。

```bash
SHUMOKU_PROXY_AUTH_ENABLED=true
SHUMOKU_PROXY_AUTH_ROLE_HEADER=X-Auth-Request-Groups
SHUMOKU_PROXY_AUTH_ROLE_MAP=net-admins:admin,viewers:viewer
```

ロールヘッダー設定時は、グループが空・未対応なら拒否し、既定ロールには
フォールバックしません。マップ未設定時はロール名そのものを受け付けます。
カンマ・空白区切りで複数のグループがある場合、ヘッダーの順序によらず明示的に
許可された最大のロール（`admin` > `user` > `viewer`）を採用します。
不正なマップやヘッダー名は起動時の検証でエラーになります。

ユーザーヘッダー（既定 `X-Auth-Request-User`、メールへのフォールバックあり）は
`proxy:` を付けた subject となり、ローカルの身元と区別されます。可能なら IdP の
不変な識別子を設定してください。この subject はリクエスト上の身元であり、永続的な
内部ユーザー ID ではありません。将来のユーザー管理では外部の身元との対応付けを
明示的に追加します。

WebSocket の認可は接続時に行います。接続済みの principal は切断まで保持され、
IdP のログアウトやロール変更だけでは即時失効しません。プロキシで接続寿命を設定し、
即時失効が必要な運用では既存接続も切断してください。

サイドバーはローカルの Logout の代わりに SSO を表示します。セッションの終了は
組織の認証基盤で行ってください。Shumoku の Cookie 削除では終了できません。

> **セキュリティ上の前提**: この方式は、Shumokuが**必ずプロキシ経由でのみ**到達可能で、
> かつプロキシが**毎リクエストでこれらのヘッダーを上書き（外部入力を除去）**する場合に
> だけ安全です。クライアントがShumokuへ直接到達できたり、プロキシが外部由来のヘッダーを
> そのまま転送すると、任意の身元を詐称できます。有効化は認証をプロキシへ完全に委譲する
> ことを意味します。

oauth2-proxy の auth-request 連携では `--set-xauthrequest=true` がレスポンスに
ヘッダーを出力します。前段プロキシでそれを Shumoku 向けリクエストへコピーし、
WebSocket にも適用してください。このフラグだけでは転送されません。
メールのフォールバックも含め、クライアント由来の身元・ロールヘッダーを除去してください。

初回起動には管理者 Secret（`SHUMOKU_BOOTSTRAP_ADMIN_PASSWORD*`）が**引き続き必須**です。
非常用のローカルアクセスでは、接続元を制限してから
`SHUMOKU_PROXY_AUTH_ENABLED=false` に変更して再起動し、管理者パスワードを使います。
プロキシを迂回するだけではローカルログインできません。復旧後はプロキシ経由だけに
接続を制限し、プロキシ認証を再度有効にしてください。


| 変数 | 説明 | 既定値 |
|---|---|---|
| `SHUMOKU_PROXY_AUTH_ENABLED` | リバースプロキシのヘッダー認証を有効化（下記参照） | `false` |
| `SHUMOKU_PROXY_AUTH_USER_HEADER` | ユーザー識別子を運ぶヘッダー名 | `X-Auth-Request-User` |
| `SHUMOKU_PROXY_AUTH_EMAIL_HEADER` | ユーザーヘッダーが無い場合に使うメールヘッダー名 | `X-Auth-Request-Email` |
| `SHUMOKU_PROXY_AUTH_ROLE_HEADER` | ロール／グループを運ぶヘッダー名（任意） | — |
| `SHUMOKU_PROXY_AUTH_DEFAULT_ROLE` | ロールヘッダー未設定時のrole（`viewer`/`user`/`admin`） | `viewer` |
| `SHUMOKU_PROXY_AUTH_ROLE_MAP` | `group:role,group:role` 形式のグループ→role対応 | — |

### コンテナへの設定の渡し方

変数はDockerの`-e`、Composeの`environment` override、またはHelm Chartの`env`リストで
Serverプロセスへ渡します。現在のComposeは列挙した変数だけを転送するため、`.env`に
プロキシ認証の変数を書くだけでは反映されません。上記Docker例を使う場合も、Serverの
公開ポートへクライアントが直接到達できないよう、認証プロキシ経由だけに制限してください。

### 接続できない場合

- 起動できない：初回管理者Secretとロールマップ・ヘッダー名の検証エラーを確認します。
- APIが401：身元ヘッダーと、ロールヘッダー設定時は対応するグループの転送を確認します。ローカルCookieでは迂回できません。
- APIが403：認証済みですが必要な権限がありません。グループとロールの対応を確認します。
- WebSocketだけ失敗：Upgrade時にも身元・グループを転送し、ブラウザのOriginと一致する外部Hostを維持します。

## 更新

更新前にバックアップを取得し、固定したimage versionを変更して再作成します。

```bash
docker compose pull
docker compose up -d
```

Serverのリリースは`server-v*` tagから作成されます。利用できるimage tagとリリース手順はrepositoryの`docs/releasing.md`を参照してください。

## バックアップ

SQLiteはWAL modeを使用するため、動作中の`shumoku.db`だけをコピーしないでください。短時間停止して`/data` Volume全体を保存するか、LitestreamなどSQLite対応の継続バックアップを利用します。

```bash
docker compose stop
docker run --rm -v shumoku-data:/data -v "$PWD":/backup alpine \
  tar czf /backup/shumoku-backup.tgz -C /data .
docker compose start
```

復元手順は本番前に別環境で確認してください。schema変更を含む更新前には必ず復元可能なバックアップを取得します。

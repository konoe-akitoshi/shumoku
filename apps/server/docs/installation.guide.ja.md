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

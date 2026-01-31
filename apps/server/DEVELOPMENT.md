# Shumoku Server 開発ガイド

## 概要

Shumoku Server は Bun ランタイムで動作するリアルタイムネットワークトポロジー可視化サーバーです。

## 技術スタック

| 項目 | 技術 |
|------|------|
| ランタイム | Bun |
| Web フレームワーク | Hono |
| データベース | SQLite (bun:sqlite) |
| フロントエンド | SvelteKit |
| レイアウトエンジン | ELK.js |

## 開発環境セットアップ

```bash
# リポジトリルートから
bun install
bun run build
```

### 開発サーバーの起動

```bash
cd apps/server
bun run dev    # API + Web UI を同時起動
```

- **http://localhost:5173** にアクセス（Web開発サーバー、HMR有効）
- APIリクエストは自動的に localhost:8080 にプロキシされる

**個別に起動する場合**

```bash
# ターミナル1: APIサーバーのみ
cd apps/server/api
bun run dev

# ターミナル2: Web UIのみ
cd apps/server/web
bun run dev
```

**APIのみ開発時**

```bash
cd apps/server/api
bun run dev
```

- **http://localhost:8080** でAPIのみ起動
- 開発モードでは静的ファイル配信はスキップされる

## ディレクトリ構成

```
apps/
├── server/               # API サーバー
│   ├── src/
│   │   ├── index.ts      # エントリーポイント
│   │   ├── server.ts     # Bun.serve() + Hono
│   │   ├── layout.ts     # Bun互換レイアウトラッパー ⚠️
│   │   ├── config.ts     # 設定読み込み
│   │   ├── topology.ts   # ファイルベーストポロジー管理
│   │   ├── db/
│   │   │   ├── index.ts  # bun:sqlite 初期化
│   │   │   └── schema.ts # マイグレーション
│   │   ├── services/
│   │   │   ├── datasource.ts # データソースCRUD
│   │   │   └── topology.ts   # トポロジーCRUD + レイアウト
│   │   ├── api/
│   │   │   └── index.ts  # REST APIルート
│   │   └── zabbix/
│   │       └── ...       # Zabbix連携
│   ├── Dockerfile
│   └── compose.yaml
└── web/                  # SvelteKit フロントエンド（独立パッケージ）
    ├── src/
    │   ├── routes/       # ページコンポーネント
    │   └── lib/          # 共通コンポーネント・ストア
    └── vite.config.ts    # API プロキシ設定
```

## Bun + elkjs 互換性

### 問題

elkjs は内部で Web Worker を使用しますが、Bun の Worker 実装では `elk-worker.min.js` の export が正しく読み込めません。

### 解決策

`src/layout.ts` で Bun 互換のレイアウトラッパーを提供:

```typescript
// web-worker パッケージを使って ELK インスタンスを作成
import ELKApi from 'elkjs/lib/elk-api.js'
import Worker from 'web-worker'

function createBunElk() {
  const elkWorkerPath = require.resolve('elkjs/lib/elk-worker.min.js')
  return new ELKApi({
    workerFactory: () => new Worker(elkWorkerPath),
  })
}

// HierarchicalLayout に Bun 互換 ELK を注入
export class BunHierarchicalLayout {
  constructor(options?) {
    this.layoutInstance = new HierarchicalLayout({
      ...options,
      elk: createBunElk(),
    })
  }
}
```

### 注意点

- `@shumoku/core` の `HierarchicalLayout` を直接使わないこと
- 必ず `BunHierarchicalLayout` を使用する
- `elkjs` と `web-worker` は server の依存関係に必要

## データベース

### 場所

- 開発: `./data/shumoku.db` (存在しない場合は自動作成)
- Docker: `/data/shumoku.db` (ボリュームマウント)

### マイグレーション

`src/db/schema.ts` で自動実行。`schema_version` で管理。

```typescript
// 新しいマイグレーション追加例
if (currentVersion < 2) {
  db.exec(`
    ALTER TABLE topologies ADD COLUMN new_field TEXT;
  `)
  setVersion(2)
}
```

## Docker ビルド

```bash
cd apps/server

# ビルド & 起動
docker compose up -d --build

# ログ確認
docker compose logs -f

# 停止
docker compose down
```

### ビルドの仕組み

1. **ビルドステージ** (oven/bun:1)
   - monorepo の必要パッケージをコピー
   - `bun install` で依存関係インストール
   - TypeScript コンパイル
   - esbuild でバンドル (`dist/bundle.js`)
   - SvelteKit ビルド

2. **本番ステージ** (oven/bun:1-slim)
   - バンドル済み JS をコピー
   - Web UI ビルドをコピー
   - `bun run server.js` で起動

### キャッシュ

BuildKit のキャッシュマウントを使用:

```dockerfile
RUN --mount=type=cache,target=/root/.bun/install/cache \
    bun install
```

## API エンドポイント

| メソッド | パス | 説明 |
|---------|------|------|
| GET | `/api/health` | ヘルスチェック |
| GET | `/api/datasources` | データソース一覧 |
| POST | `/api/datasources` | データソース作成 |
| GET | `/api/datasources/:id` | データソース取得 |
| PUT | `/api/datasources/:id` | データソース更新 |
| DELETE | `/api/datasources/:id` | データソース削除 |
| POST | `/api/datasources/:id/test` | 接続テスト |
| GET | `/api/topologies` | トポロジー一覧 |
| POST | `/api/topologies` | トポロジー作成 |
| GET | `/api/topologies/:id` | トポロジー取得 |
| PUT | `/api/topologies/:id` | トポロジー更新 |
| DELETE | `/api/topologies/:id` | トポロジー削除 |
| GET | `/api/topologies/:id/render` | SVG レンダリング |

## WebSocket

### 接続

```javascript
const ws = new WebSocket('ws://localhost:8080/ws')
```

### メッセージ

**クライアント → サーバー:**

```javascript
// トポロジー購読
{ "type": "subscribe", "topology": "<topology-id>" }

// フィルター設定
{ "type": "filter", "nodes": ["node1"], "links": ["link1"] }
```

**サーバー → クライアント:**

```javascript
// メトリクス更新
{
  "type": "metrics",
  "data": {
    "nodes": { "node1": { "status": "up" } },
    "links": { "link1": { "utilization": 45.2 } },
    "timestamp": 1234567890
  }
}
```

## root スクリプトとの関係

```json
{
  "scripts": {
    "dev": "turbo run dev",                    // 全パッケージ起動
    "dev:server": "turbo run dev --filter=@shumoku/server --filter=@shumoku/web",
    "build": "turbo run build --filter='!@shumoku/server'",
    "build:all": "turbo run build"
  }
}
```

- `bun run dev` - docs を含む全パッケージを起動
- `bun run dev:server` - API + Web UI のみ起動（推奨）
- `bun run build:all` - server を含めてビルド

## トラブルシューティング

### elkjs エラー

```
TypeError: undefined is not a constructor (evaluating 'new _Worker(url)')
```

**原因**: `@shumoku/core` の `HierarchicalLayout` を直接使っている

**解決**: `src/layout.ts` の `BunHierarchicalLayout` を使う

### ポート競合

```
error: Failed to start server. Is port 8080 in use?
```

**解決**:
```bash
# プロセス確認
lsof -i :8080
# または環境変数でポート変更
PORT=9000 bun run dev
```

### データベースロック

```
SQLITE_BUSY: database is locked
```

**原因**: 複数プロセスが同時アクセス

**解決**: 開発サーバーを1つだけ起動する

## 関連ドキュメント

- [README.md](./README.md) - ユーザー向けドキュメント
- [CLAUDE.md](../../CLAUDE.md) - プロジェクト全体の説明
- [docs/grafana-integration.md](./docs/grafana-integration.md) - Grafana連携（Webhook設定手順含む）
- [docs/zabbix-integration.md](./docs/zabbix-integration.md) - Zabbix連携

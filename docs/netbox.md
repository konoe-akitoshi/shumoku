# NetBox Integration

NetBox からネットワーク構成を取得し、Shumoku ダイアグラムを自動生成します。

## インストール

```bash
npm install @shumoku/netbox
```

## CLI での使用

コマンドラインから NetBox データを Shumoku YAML に変換できます。

```bash
# 基本的な使い方
npx netbox-to-shumoku --url https://netbox.example.com --token YOUR_API_TOKEN

# ファイルに出力
npx netbox-to-shumoku --url https://netbox.example.com --token YOUR_API_TOKEN -o network.yaml

# サイトでフィルタリング
npx netbox-to-shumoku --url https://netbox.example.com --token YOUR_API_TOKEN --site tokyo-dc
```

### CLI オプション

| オプション | 説明 |
|-----------|------|
| `--url, -u` | NetBox の URL（必須） |
| `--token, -t` | API トークン（必須） |
| `--output, -o` | 出力ファイル（省略時は標準出力） |
| `--site, -s` | サイトでフィルタリング |
| `--role, -r` | デバイスロールでフィルタリング |
| `--theme` | テーマ: light または dark |
| `--status` | ステータスでフィルタリング |
| `--tag` | タグでフィルタリング |
| `--group-by, -g` | グループ化: tag, site, location, prefix, none |
| `--no-ports` | ポート名を非表示 |
| `--no-colors` | ケーブル種別による色分けを無効化 |
| `--color-by-status` | デバイスをステータスで色分け |
| `--legend` | 凡例を表示（SVG出力時のみ） |

## ライブラリとしての使用

### 基本的な使い方

```typescript
import { NetBoxClient, convertToShumoku } from '@shumoku/netbox'
import { HierarchicalLayoutEngine, SvgRenderer } from '@shumoku/core'

// NetBox クライアントを作成
const client = new NetBoxClient({
  url: 'https://netbox.example.com',
  token: 'your-api-token'
})

// デバイスとケーブルを取得
const devices = await client.getDevices()
const cables = await client.getCables()

// Shumoku NetworkGraph に変換
const graph = convertToShumoku({ devices, cables })

// レイアウトとレンダリング
const engine = new HierarchicalLayoutEngine()
const layout = await engine.layout(graph)

const renderer = new SvgRenderer()
const svg = renderer.render(layout)
```

### サイト情報を含める

```typescript
const devices = await client.getDevices()
const cables = await client.getCables()
const sites = await client.getSites()

const graph = convertToShumoku({
  devices,
  cables,
  sites  // サイトを subgraph として変換
})
```

### フィルタリング

```typescript
// 特定のサイトのデバイスのみ取得
const devices = await client.getDevices({
  site: 'tokyo-dc'
})

// 特定のロールのデバイスのみ取得
const devices = await client.getDevices({
  role: 'core-router'
})

// 複数条件
const devices = await client.getDevices({
  site: 'tokyo-dc',
  role: 'core-router',
  status: 'active'
})
```

## API Reference

### NetBoxClient

```typescript
interface NetBoxClientOptions {
  url: string      // NetBox の URL
  token: string    // API トークン
}

const client = new NetBoxClient(options)
```

#### getDevices

```typescript
interface DeviceFilter {
  site?: string
  role?: string
  status?: 'active' | 'planned' | 'staged' | 'failed' | 'offline'
  manufacturer?: string
  model?: string
}

client.getDevices(filter?: DeviceFilter): Promise<NetBoxDevice[]>
```

#### getCables

```typescript
client.getCables(): Promise<NetBoxCable[]>
```

#### getSites

```typescript
client.getSites(): Promise<NetBoxSite[]>
```

### convertToShumoku

```typescript
interface ConvertOptions {
  devices: NetBoxDevice[]
  cables: NetBoxCable[]
  sites?: NetBoxSite[]
}

convertToShumoku(options: ConvertOptions): NetworkGraph
```

## NetBox のセットアップ

### API トークンの取得

1. NetBox にログイン
2. 右上のユーザーメニュー → **API Tokens**
3. **Add a token** をクリック
4. 必要な権限を設定してトークンを作成

### 必要な権限

読み取り専用の場合、以下の権限が必要です：

- `dcim.view_device`
- `dcim.view_cable`
- `dcim.view_site`
- `dcim.view_interface`

## データマッピング

NetBox のデータは以下のように Shumoku に変換されます：

| NetBox | Shumoku |
|--------|---------|
| Device | Node |
| Cable | Link |
| Site | Subgraph |
| Interface | Port |
| Device Role | type の推測に使用 |

### デバイスタイプの自動推測

NetBox の `device_role` から Shumoku の `type` を自動推測します：

| NetBox Device Role | Shumoku Type |
|-------------------|--------------|
| `router`, `core-router` | `router` |
| `switch`, `access-switch` | `l2-switch` |
| `l3-switch`, `distribution-switch` | `l3-switch` |
| `firewall` | `firewall` |
| `server`, `compute` | `server` |
| `access-point`, `wireless` | `access-point` |
| `load-balancer` | `load-balancer` |

## トラブルシューティング

### 接続エラー

```
Error: Failed to connect to NetBox
```

- URL が正しいか確認
- API トークンが有効か確認
- ネットワーク接続を確認

### 権限エラー

```
Error: 403 Forbidden
```

- API トークンの権限を確認
- 必要な権限が付与されているか確認

### デバイスが表示されない

- デバイスのステータスが `active` か確認
- フィルタ条件を確認
- NetBox でデバイスが正しく登録されているか確認

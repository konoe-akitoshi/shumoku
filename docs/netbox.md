# NetBox Integration

NetBox の DCIM/IPAM からデバイス・ケーブルを取得し、Shumoku のトポロジーを自動生成します。

利用方法は2つあります:

- **サーバー（推奨）** — NetBox をデータソースとして追加すると、トポロジーが自動生成されます。設定は[サーバードキュメント](https://www.shumoku.dev/ja/docs/server)を参照してください。
- **ライブラリ** — `shumoku-plugin-netbox` の API クライアントとコンバーターを直接使います。

## インストール（ライブラリ利用時）

```bash
npm install shumoku-plugin-netbox @shumoku/renderer-svg
```

> サーバーにはこのプラグインがバンドルされているため、別途インストールは不要です。

## ライブラリとしての使用

```typescript
import { NetBoxClient, convertToNetworkGraph } from 'shumoku-plugin-netbox'
import { renderGraphToSvg } from '@shumoku/renderer-svg'

// NetBox クライアントを作成
const client = new NetBoxClient({ url: 'https://netbox.example.com', token: 'your-api-token' })

// デバイス・インターフェース・ケーブルを取得
const devices = await client.fetchDevices()
const interfaces = await client.fetchInterfaces()
const cables = await client.fetchCables()

// Shumoku の NetworkGraph に変換してレンダリング
const graph = convertToNetworkGraph(devices, interfaces, cables, { groupBy: 'site' })
const svg = await renderGraphToSvg(graph)
```

仮想マシンも含める場合は `client.fetchAllWithVMs()` と `convertToNetworkGraphWithVMs()` を使います。クライアントの全メソッド（`fetchSites` / `fetchLocations` / `fetchTags` / `fetchDeviceRoles` / `fetchPrefixes` / `fetchIPAddresses` / `fetchAll` …）やコンバーターのオプションは、[プラグインの README](../libs/plugins/netbox/README.md) を参照してください。

## グループ化とフィルタリング

グループ化（`tag` / `site` / `location` / `prefix` / `none`）とサイト・タグ・ロールによるフィルタリングが指定できます。サーバーではデータソースのオプションとして UI から設定できます。詳細は[プラグイン README](../libs/plugins/netbox/README.md) の「Topology options」を参照してください。

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
| Site / Location / Tag / Prefix | Subgraph（グループ化に応じて） |
| Interface | Port |
| Device Role | `type` の推測に使用 |

### デバイスタイプの自動推測

NetBox の device role から Shumoku の `type` を推測します（`useRoleForType` オプション、既定で有効）。対応は `ROLE_TO_TYPE`（プラグインからエクスポート）で定義されています。代表例:

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

- URL が正しいか確認
- API トークンが有効か確認
- ネットワーク接続を確認（自己署名証明書の場合は `insecure: true` を検討）

### 権限エラー（403 Forbidden）

- API トークンに必要な権限が付与されているか確認

### デバイスが表示されない

- フィルタ条件（サイト・タグ・ロール）を確認
- NetBox 上でデバイスとケーブルが正しく登録されているか確認

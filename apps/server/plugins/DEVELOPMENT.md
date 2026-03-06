# Plugin Development Guide

Shumoku Server のプラグイン開発ガイド。

## プラグインの構成

各プラグインは以下のファイルで構成されます:

```
my-plugin/
├── plugin.json    # マニフェスト（必須）
└── index.ts       # エントリポイント（必須）register() をエクスポート
```

## plugin.json

```json
{
  "id": "my-plugin",
  "name": "My Plugin",
  "version": "0.1.0",
  "description": "何をするプラグインか",
  "capabilities": ["topology", "metrics", "hosts", "auto-mapping", "alerts"],
  "entry": "index.js",
  "configSchema": {
    "type": "object",
    "required": ["url", "token"],
    "properties": {
      "url": { "type": "string", "title": "Server URL" },
      "token": { "type": "string", "title": "API Token", "format": "password" }
    }
  }
}
```

### フィールド

| フィールド | 必須 | 説明 |
|-----------|------|------|
| `id` | Yes | 一意のプラグインID（他と重複不可） |
| `name` | Yes | 表示名 |
| `version` | Yes | semver |
| `description` | No | 説明 |
| `capabilities` | Yes | 対応するケイパビリティの配列 |
| `entry` | No | エントリポイントファイル名（デフォルト: `index.js`） |
| `configSchema` | No | JSON Schema 形式の設定スキーマ（UI自動生成に使用） |

### Capabilities

| Capability | インターフェース | 説明 |
|------------|-----------------|------|
| `topology` | `TopologyCapable` | ネットワークトポロジの取得 |
| `hosts` | `HostsCapable` | ホスト一覧・アイテム取得 |
| `metrics` | `MetricsCapable` | メトリクスポーリング |
| `auto-mapping` | `AutoMappingCapable` | ノード↔ホストの自動マッピング |
| `alerts` | `AlertsCapable` | アラート取得 |

## エントリポイント (index.ts)

`register(pluginRegistry)` 関数をエクスポートします:

```typescript
import type { PluginRegistryInterface } from '../../api/src/plugins/registry.js'
import type {
  DataSourcePlugin,
  DataSourceCapability,
  TopologyCapable,
  ConnectionResult,
} from '../../api/src/plugins/types.js'

class MyPlugin implements DataSourcePlugin, TopologyCapable {
  readonly type = 'my-plugin'
  readonly displayName = 'My Plugin'
  readonly capabilities: readonly DataSourceCapability[] = ['topology']

  private config: { url: string; token: string } | null = null

  initialize(config: unknown): void {
    this.config = config as { url: string; token: string }
  }

  dispose(): void {
    this.config = null
  }

  async testConnection(): Promise<ConnectionResult> {
    if (!this.config) {
      return { success: false, message: 'Not initialized' }
    }
    // 接続テストの実装
    return { success: true, message: 'Connected' }
  }

  async fetchTopology(): Promise<NetworkGraph> {
    // トポロジ取得の実装
  }
}

export function register(registry: PluginRegistryInterface): void {
  registry.register('my-plugin', 'My Plugin', ['topology'], (config) => {
    const plugin = new MyPlugin()
    plugin.initialize(config)
    return plugin
  })
}
```

## DataSourcePlugin インターフェース

すべてのプラグインが実装する基本インターフェース:

```typescript
interface DataSourcePlugin {
  readonly type: string
  readonly displayName: string
  readonly capabilities: readonly DataSourceCapability[]
  initialize(config: unknown): void
  dispose?(): void
  testConnection(): Promise<ConnectionResult>
}
```

## Capability インターフェース

### TopologyCapable

```typescript
interface TopologyCapable {
  fetchTopology(options?: Record<string, unknown>): Promise<NetworkGraph>
}
```

### HostsCapable

```typescript
interface HostsCapable {
  getHosts(): Promise<Host[]>
  getHostItems(hostId: string): Promise<HostItem[]>
  searchHosts?(query: string): Promise<Host[]>
  discoverMetrics?(hostId: string): Promise<DiscoveredMetric[]>
}
```

### MetricsCapable

```typescript
interface MetricsCapable {
  pollMetrics(mapping: MetricsMapping): Promise<MetricsData>
  subscribeMetrics?(mapping: MetricsMapping, onUpdate: (metrics: MetricsData) => void): () => void
}
```

### AutoMappingCapable

```typescript
interface AutoMappingCapable {
  getMappingHints(graph: NetworkGraph): Promise<MappingHint[]>
}
```

### AlertsCapable

```typescript
interface AlertsCapable {
  getAlerts(options?: AlertQueryOptions): Promise<Alert[]>
}
```

## バンドルプラグイン vs 外部プラグイン

| | バンドルプラグイン | 外部プラグイン |
|---|---|---|
| 配置場所 | `apps/server/plugins/` | `plugins.yaml` で指定 |
| 言語 | TypeScript（サーバーと一緒にビルド） | JavaScript（ビルド済み） |
| ロード | `registerBundledPlugins()` で直接 import | 動的 `import()` |
| 削除 | 不可 | API / UI から可能 |
| 例 | NetBox, Zabbix, Prometheus, Grafana | ユーザー作成プラグイン |

## 外部プラグインのインストール

外部プラグインは以下の方法でインストールできます:

- **ZIP アップロード**: `POST /api/plugins` (multipart/form-data)
- **URL 指定**: `POST /api/plugins` `{"url": "https://..."}`
- **パス指定**: `POST /api/plugins` `{"path": "/path/to/plugin"}`
- **Git リポジトリ**: URL に `.git` や GitHub/GitLab ドメインを指定

設定ファイル `plugins.yaml`:

```yaml
plugins:
  - id: my-plugin
    path: ./plugins/my-plugin
    enabled: true
```

## 型のインポートパス

バンドルプラグインからの型インポート:

```typescript
// プラグインの型
import type { PluginRegistryInterface } from '../../api/src/plugins/registry.js'
import type { DataSourcePlugin, ... } from '../../api/src/plugins/types.js'

// サーバーの型（MetricsData など）
import type { MetricsData, MetricsMapping } from '../../api/src/types.js'

// コアの型（NetworkGraph など）
import type { NetworkGraph } from '@shumoku/core'
```

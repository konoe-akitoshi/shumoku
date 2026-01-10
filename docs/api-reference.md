# API Reference

Shumoku の TypeScript API リファレンスです。

## Packages

| パッケージ | 説明 |
|-----------|------|
| `shumoku` | メインパッケージ（全機能を含む） |
| `@shumoku/core` | コアライブラリ（モデル、レイアウト、レンダラー） |
| `@shumoku/parser-yaml` | YAML パーサー |
| `@shumoku/icons` | ベンダーアイコン |

## YamlParser

YAML 文字列を `NetworkGraph` にパースします。

```typescript
import { YamlParser } from 'shumoku'

const parser = new YamlParser()
const graph = parser.parse(yamlString)
```

### Methods

#### `parse(yaml: string): NetworkGraph`

YAML 文字列をパースして `NetworkGraph` を返します。

## HierarchicalLayoutEngine

ネットワークグラフを階層的にレイアウトします。ELK.js を使用。

```typescript
import { HierarchicalLayoutEngine } from 'shumoku'

const engine = new HierarchicalLayoutEngine()
const layout = await engine.layout(graph, options)
```

### Methods

#### `layout(graph: NetworkGraph, options?: LayoutOptions): Promise<LayoutResult>`

グラフをレイアウトして結果を返します。

### LayoutOptions

```typescript
interface LayoutOptions {
  direction?: 'TB' | 'BT' | 'LR' | 'RL'  // レイアウト方向
  nodeWidth?: number                      // ノード幅
  nodeHeight?: number                     // ノード高さ
  spacing?: number                        // ノード間隔
}
```

## SvgRenderer

レイアウト結果を SVG 文字列にレンダリングします。

```typescript
import { SvgRenderer } from 'shumoku'

const renderer = new SvgRenderer()
const svg = renderer.render(layout, options)
```

### Methods

#### `render(layout: LayoutResult, options?: RenderOptions): string`

レイアウト結果を SVG 文字列に変換します。

### RenderOptions

```typescript
interface RenderOptions {
  theme?: Theme           // テーマ設定
  padding?: number        // SVG のパディング
  showPorts?: boolean     // ポートを表示するか
}
```

## Theme

SVG のスタイルをカスタマイズします。

```typescript
import { modernTheme, darkTheme, createTheme } from 'shumoku'

// 組み込みテーマ
const renderer = new SvgRenderer()
renderer.render(layout, { theme: darkTheme })

// カスタムテーマ
const customTheme = createTheme({
  background: '#1a1a2e',
  node: {
    fill: '#16213e',
    stroke: '#0f3460',
    text: '#e94560'
  }
})
```

### Built-in Themes

- `modernTheme` - ライトテーマ（デフォルト）
- `darkTheme` - ダークテーマ

## NetworkGraph

ネットワークトポロジーのデータ構造です。

```typescript
interface NetworkGraph {
  version: string
  name?: string
  devices: Device[]
  ports?: Port[]
  links: Link[]
  modules?: Module[]
  locations?: Location[]
  settings?: NetworkSettings
}
```

## Device

ネットワークデバイスを表します。

```typescript
interface Device {
  id: string
  name?: string
  type?: DeviceType
  role?: DeviceRole
  status?: DeviceStatus
  vendor?: string
  model?: string
  // ...
}
```

### DeviceType

```typescript
enum DeviceType {
  Router = 'router',
  L3Switch = 'l3-switch',
  L2Switch = 'l2-switch',
  Firewall = 'firewall',
  LoadBalancer = 'load-balancer',
  Server = 'server',
  AccessPoint = 'access-point',
  Cloud = 'cloud',
  Internet = 'internet',
  VPN = 'vpn',
  Database = 'database',
  Generic = 'generic'
}
```

## Icons

ベンダーアイコンを登録・取得します。

```typescript
import { registerAllIcons, getVendorIcon } from '@shumoku/icons'

// 全アイコンを登録
registerAllIcons()

// 特定のアイコンを取得
const icon = getVendorIcon('yamaha', 'rtx3510')
```

### Supported Vendors

| ベンダー | アイコン数 |
|---------|----------|
| Yamaha | 103 |
| Aruba | 55 |
| AWS | 477 |
| Juniper | 343 |

# Getting Started

Shumoku を使ってネットワーク図を作成する方法を説明します。

## Installation

```bash
npm install shumoku
```

900+ のベンダーアイコン（Yamaha, Aruba, AWS, Juniper）が含まれています。

### NetBox 連携（オプション）

```bash
npm install shumoku-plugin-netbox
```

## Basic Usage

### 1. YAML でネットワークを定義

```yaml
name: "My Network"

nodes:
  - id: router
    label: "Core Router"
    type: router
    vendor: yamaha
    model: rtx3510

  - id: switch
    label: "Main Switch"
    type: l2-switch

  - id: server
    label: "Web Server"
    type: server

links:
  - from: { node: router }
    to: { node: switch }
    bandwidth: 10G

  - from: { node: switch }
    to: { node: server }
    bandwidth: 1G
```

### 2. TypeScript/JavaScript で図をレンダリング

```typescript
import { YamlParser, renderGraphToHtml } from 'shumoku'

// YAML をパース（parse() は { graph, warnings } を返す）
const { graph } = new YamlParser().parse(yamlString)

// インタラクティブな HTML を生成（パン / ズーム / ツールチップ）
const html = await renderGraphToHtml(graph, { title: 'My Network' })
```

SVG や PNG が必要な場合は専用のレンダラーを使います:

```typescript
import { renderGraphToSvg } from '@shumoku/renderer-svg'
import { renderGraphToPng } from '@shumoku/renderer-png' // Node.js のみ

const svg = await renderGraphToSvg(graph)
const png = await renderGraphToPng(graph, { scale: 2 })
```

アイコンはレンダリング時に CDN から解決され、正しいアスペクト比で描画されます。

## Next Steps

- [YAML Reference](/docs/yaml-reference) - 完全な YAML 記法リファレンス
- [Vendor Icons](/docs/vendor-icons) - 利用可能なベンダーアイコン一覧
- [Examples](/docs/examples) - サンプルネットワーク集
- [API Reference](/docs/api-reference) - TypeScript API リファレンス
- [NetBox](/docs/netbox) - NetBox 連携

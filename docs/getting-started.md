# Getting Started

Shumoku を使ってネットワーク図を作成する方法を説明します。

## Installation

### npm

```bash
# 基本インストール
npm install shumoku

# ベンダーアイコン付き (Yamaha, Aruba, AWS, Juniper)
npm install shumoku @shumoku/icons
```

### 個別パッケージ

必要なパッケージだけインストールすることもできます：

```bash
npm install @shumoku/core @shumoku/parser-yaml
```

## Basic Usage

### 1. YAML でネットワークを定義

```yaml
name: "My Network"

nodes:
  - id: router
    label: "Core Router"
    type: router

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

### 2. TypeScript/JavaScript で SVG を生成

```typescript
import { YamlParser, HierarchicalLayoutEngine, SvgRenderer } from 'shumoku'

// YAML をパース
const parser = new YamlParser()
const graph = parser.parse(yamlString)

// レイアウト計算
const engine = new HierarchicalLayoutEngine()
const layout = await engine.layout(graph)

// SVG 生成
const renderer = new SvgRenderer()
const svg = renderer.render(layout)

// DOM に追加
document.getElementById('diagram').innerHTML = svg
```

### 3. ベンダーアイコンを使用（オプション）

```typescript
import { registerAllIcons } from '@shumoku/icons'

// アイコンを登録
registerAllIcons()

// YAML で vendor と model を指定
const yaml = `
nodes:
  - id: router
    label: "RTX3510"
    type: router
    vendor: yamaha
    model: rtx3510
`
```

## Next Steps

- [YAML Reference](/docs/yaml-reference) - 完全な YAML 記法リファレンス
- [Vendor Icons](/docs/vendor-icons) - 利用可能なベンダーアイコン一覧
- [Examples](/docs/examples) - サンプルネットワーク集
- [API Reference](/docs/api-reference) - TypeScript API リファレンス

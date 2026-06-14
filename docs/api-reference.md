# API Reference

Shumoku の TypeScript API の概要です。各パッケージの詳しい使い方は、それぞれの README とウェブサイトのドキュメントを参照してください。

## Packages

| パッケージ | 説明 |
|-----------|------|
| [`shumoku`](../libs/shumoku/README.md) | メインパッケージ（core + SVG/HTML レンダラーを再エクスポート） |
| [`@shumoku/core`](../libs/@shumoku/core/README.md) | モデル・パーサー・レイアウトエンジン・テーマ・プラグインキット |
| [`@shumoku/renderer-svg`](../libs/@shumoku/renderer-svg/README.md) | SVG レンダーパイプライン |
| [`@shumoku/renderer-html`](../libs/@shumoku/renderer-html/README.md) | インタラクティブ HTML 出力 |
| [`@shumoku/renderer-png`](../libs/@shumoku/renderer-png/README.md) | PNG 出力（Node.js のみ） |
| [`@shumoku/catalog`](../libs/@shumoku/catalog/README.md) | デバイス／サービスカタログ |
| [`@shumoku/plugin-sdk`](../libs/@shumoku/plugin-sdk/README.md) | データソースプラグイン用 HTTP クライアント |

> 旧 API（`HierarchicalLayoutEngine` / `SvgRenderer` クラス、`@shumoku/parser-yaml` パッケージ）は削除されました。現在はパイプライン関数（`prepareRender` → `renderSvg` 等）と `computeNetworkLayout()` を使います。

## パース

```typescript
import { YamlParser } from 'shumoku'

const { graph, warnings } = new YamlParser().parse(yamlString)
```

`parse()` は `{ graph: NetworkGraph, warnings?: ParseWarning[] }` を返します（回復可能な問題では例外を投げず `warnings` に積みます）。複数ファイル（`file:` 参照）には `HierarchicalParser` を使います。

## レイアウト

```typescript
import { computeNetworkLayout } from 'shumoku'

const layout = await computeNetworkLayout(graph)
```

ノード・リンク・サブグラフを配置した `LayoutResult` を返します（Sugiyama 系のタイア化レイアウト）。通常はレンダラーが内部で呼ぶため、直接呼ぶ必要はありません。

## レンダリング

```typescript
import { prepareRender, renderSvg, renderGraphToSvg } from '@shumoku/renderer-svg'
import { renderGraphToHtml } from '@shumoku/renderer-html'
import { renderGraphToPng } from '@shumoku/renderer-png' // Node.js のみ

// 一括
const svg = await renderGraphToSvg(graph)
const html = await renderGraphToHtml(graph, { title: 'My Network' })
const png = await renderGraphToPng(graph, { scale: 2 })

// パイプラインを分割（prepared を複数の出力で再利用）
const prepared = await prepareRender(graph) // アイコン寸法解決 + レイアウト
const svg2 = await renderSvg(prepared)
```

`prepareRender` / `renderSvg` / `renderGraphToSvg` / `renderGraphToHtml` / `renderGraphToPng` はいずれも `async` です（`renderHtml(prepared)` のみ同期）。

## テーマ

```typescript
import { lightTheme, darkTheme, createTheme, mergeTheme } from 'shumoku'
```

組み込みテーマは `lightTheme`（デフォルト）と `darkTheme`。`createTheme()` / `mergeTheme()` でカスタマイズできます。テーマは `NetworkGraph.settings.theme`（`'light' | 'dark'`）でも指定できます。

## NetworkGraph

```typescript
interface NetworkGraph {
  version: string
  name?: string
  description?: string
  nodes: Node[]
  links: Link[]
  subgraphs?: Subgraph[]
  settings?: NetworkSettings
}
```

`Node` / `Link` / `Subgraph` / `NetworkSettings` の完全な型定義は [`@shumoku/core`](../libs/@shumoku/core/README.md)（`@shumoku/core/models`）を参照してください。

## アイコン

ベンダーアイコンは CDN から配信され、レンダラーが寸法を取得して正しいアスペクト比で描画します。利用可能なアイコンは[ベンダーアイコン一覧](https://www.shumoku.dev/docs/npm/vendor-icons)を参照してください。

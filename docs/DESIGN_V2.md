# Shumoku v2 基本設計

## 目標

Mermaidのような表現力を持つネットワーク図ライブラリ。以下を実現する：

1. **階層的なサブグラフ** - 入れ子のロケーション（Cloud > VPC > Subnet）
2. **リッチなノード表現** - 複数行テキスト、様々な形状
3. **多様なリンクスタイル** - 実線、破線、太線、双方向、ラベル付き
4. **方向制御** - TB (上から下), LR (左から右) など

---

## 1. データモデル

### NetworkGraph (ルート)

```typescript
interface NetworkGraph {
  version: string
  name?: string
  description?: string

  // ノード定義（フラットリスト）
  nodes: Node[]

  // リンク定義
  links: Link[]

  // サブグラフ定義（入れ子可能）
  subgraphs: Subgraph[]

  // グローバル設定
  settings?: GraphSettings
}
```

### Node (ノード)

```typescript
interface Node {
  id: string

  // 表示テキスト（複数行対応）
  label: string | string[]  // ["<b>RTX3510-1</b>", "Mgmt: 10.241.0.21", "VRRP VIP: 10.57.0.1"]

  // 形状
  shape: 'rect' | 'rounded' | 'circle' | 'diamond' | 'hexagon' | 'cylinder' | 'stadium'

  // デバイスタイプ（アイコン・デフォルトスタイル決定用）
  type?: DeviceType

  // 所属サブグラフID
  parent?: string

  // スタイル
  style?: NodeStyle
}

interface NodeStyle {
  fill?: string           // 背景色
  stroke?: string         // 枠線色
  strokeWidth?: number    // 枠線太さ
  strokeDasharray?: string // 破線パターン "5 5"
  textColor?: string      // テキスト色
  fontSize?: number
  fontWeight?: 'normal' | 'bold'
}
```

### Link (リンク)

```typescript
interface Link {
  id?: string
  from: string            // ノードID
  to: string              // ノードID

  // ラベル（ポート名、帯域など）
  label?: string | string[]  // "lan2" or ["ae0: LACP Trunk", "(VLAN 1,100,200,201)"]

  // リンクタイプ
  type: 'solid' | 'dashed' | 'thick' | 'double' | 'invisible'

  // 矢印
  arrow?: 'none' | 'forward' | 'back' | 'both'

  // スタイル
  style?: LinkStyle
}

interface LinkStyle {
  stroke?: string         // 線の色
  strokeWidth?: number    // 線の太さ
  strokeDasharray?: string
}
```

### Subgraph (サブグラフ/ロケーション)

```typescript
interface Subgraph {
  id: string
  label: string           // 表示名

  // 所属ノードID（直接の子のみ）
  nodes: string[]

  // 子サブグラフID（入れ子）
  children?: string[]

  // 親サブグラフID
  parent?: string

  // レイアウト方向
  direction?: 'TB' | 'BT' | 'LR' | 'RL'

  // スタイル
  style?: SubgraphStyle
}

interface SubgraphStyle {
  fill?: string
  stroke?: string
  strokeWidth?: number
  strokeDasharray?: string
  labelPosition?: 'top' | 'bottom'
}
```

---

## 2. YAMLスキーマ

```yaml
name: "SRE NEXT Network Diagram"
version: "1.0.0"

settings:
  direction: TB
  theme: modern

# サブグラフ定義（入れ子対応）
subgraphs:
  - id: cloud
    label: "AWS Cloud (Services)"
    style:
      fill: "#f0f8ff"
      stroke: "#0072bc"
      strokeDasharray: "5 5"

  - id: edge
    label: "Sakura DC Edge (RTX3510 HA)"
    style:
      fill: "#fff0f0"
      stroke: "#d4a017"
      strokeWidth: 2

  - id: core
    label: "Core Layer (EX4000-VC)"
    style:
      fill: "#e6f7ff"
      stroke: "#0055a6"

  - id: venue
    label: "Venue: SRE NEXT (TOC Ariake)"
    style:
      fill: "#fffbf0"
      stroke: "#d4a017"

  # 入れ子サブグラフ
  - id: zone-east
    label: "East Wing"
    parent: venue
    direction: TB

  - id: zone-west
    label: "West Wing (Daisy Chain)"
    parent: venue
    direction: TB

# ノード定義
nodes:
  # Cloud Layer
  - id: aws-services
    label:
      - "<b>Shared Services VPC</b>"
      - "CIDR: 172.16.0.0/16"
      - "---"
      - "DNS: 172.16.0.53"
      - "DHCP: 172.16.0.67"
      - "Zabbix: 172.16.0.100"
    shape: rect
    parent: cloud

  - id: vgw
    label:
      - "<b>AWS VGW</b>"
      - "Peer: 169.254.x.x"
    shape: rect
    parent: cloud

  # Edge Layer
  - id: ocx1
    label:
      - "<b>OCX Line #1</b>"
      - "(Primary)"
    shape: rect
    parent: edge

  - id: rt1
    label:
      - "<b>RTX3510-1 (Master)</b>"
      - "Mgmt: 10.241.0.21"
      - "VRRP VIP: 10.57.0.1"
    shape: rounded
    type: router
    parent: edge
    style:
      fill: "#ffcccc"

  # ... more nodes ...

  # Access Points (different shape)
  - id: ap-foyer-01
    label: "AP-Foyer-01"
    shape: circle
    parent: zone-east
    style:
      fill: "#e0ffe0"
      strokeDasharray: "5 5"

# リンク定義
links:
  # Solid line with label
  - from: ocx1
    to: rt1
    label: "lan2"
    type: solid

  # Dashed line (IPsec VPN)
  - from: vgw
    to: rt1
    label:
      - "IPsec VPN"
      - "tun1"
    type: dashed

  # Double line (HA Keepalive)
  - from: rt1
    to: rt2
    label: "lan3: Keepalive"
    type: double

  # Thick line (LACP Trunk)
  - from: ex-vc
    to: venue-agg
    label:
      - "ae0: LACP Trunk"
      - "(VLAN 1,100,200,201)"
    type: thick
```

---

## 3. レイアウトエンジン

### 階層レイアウト (HierarchicalLayout)

1. **トポロジー分析**: リンクからDAGを構築
2. **レイヤー割り当て**: ノードを階層に配置
3. **サブグラフ考慮**: 同じサブグラフ内のノードをグループ化
4. **交差最小化**: 線の交差を減らす
5. **座標計算**: 最終位置を決定

### サブグラフレイアウト

```
1. 最も深い子サブグラフから処理（ボトムアップ）
2. 各サブグラフ内でノードをレイアウト
3. サブグラフのサイズを内容に合わせて決定
4. 親サブグラフ内でサブグラフを配置
5. ルートレベルまで繰り返し
```

---

## 4. レンダラー

### SVGレンダラー（推奨）

- スケーラブル
- CSSスタイリング
- テキスト描画が容易
- エクスポートが簡単

### 描画順序

```
1. サブグラフ背景（深い順に描画）
2. リンク（ノードの下に）
3. ノード
4. ラベル
```

### リンク描画

```typescript
function renderLink(link: Link, from: Position, to: Position): SVGElement {
  const path = calculatePath(from, to)

  switch (link.type) {
    case 'solid':
      return <path d={path} stroke={color} />
    case 'dashed':
      return <path d={path} stroke={color} stroke-dasharray="5 5" />
    case 'thick':
      return <path d={path} stroke={color} stroke-width="3" />
    case 'double':
      return (
        <>
          <path d={path} stroke={color} stroke-width="3" />
          <path d={path} stroke="white" stroke-width="1" />
        </>
      )
  }
}
```

---

## 5. 移行計画

### Phase 1: データモデル刷新
- [ ] 新しい型定義 (`models/v2/`)
- [ ] YAMLパーサー更新
- [ ] 旧モデルからの変換ユーティリティ

### Phase 2: レイアウトエンジン
- [ ] 階層レイアウト実装
- [ ] サブグラフ対応
- [ ] 方向制御 (TB/LR)

### Phase 3: SVGレンダラー
- [ ] 基本描画
- [ ] 複数行テキスト
- [ ] 様々なノード形状
- [ ] リンクスタイル

### Phase 4: インタラクション
- [ ] ズーム/パン
- [ ] ノード選択
- [ ] ホバー情報

---

## 6. 既存機能との差分

| 機能 | 現在 | v2 |
|------|------|-----|
| ロケーション | 1階層のみ | 無制限の入れ子 |
| ノードラベル | 単一行 | 複数行 + HTML |
| ノード形状 | デバイスタイプで固定 | 自由に指定 |
| リンクスタイル | 基本的な線のみ | 破線、太線、二重線 |
| リンクラベル | 帯域のみ | 自由テキスト |
| レイアウト方向 | なし | TB/BT/LR/RL |
| レンダラー | PixiJS (Canvas) | SVG |

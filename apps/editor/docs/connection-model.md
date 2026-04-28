# 接続モデル

ネットワークリンクをどう表現しているか — 物理ハードウェアからエディタに保存するフィールド、そしてそれらをつなぐカスケード UI までを記述します。

メンタルモデルは「ノード側」「リンク側」と、その**接続点**の三つで成り立っています。

- **ノード側** — Device には Port が生えていて、Port は `cage`（物理レセプタクル: RJ45 / SFP+ / QSFP28…）を持つ。カタログから提供されている場合もあれば、ない場合もある。
- **リンク側** — Cable が一本あり、両端に Endpoint。各 Endpoint は **Plug**（ケーブル側 form factor）と **Module**（IEEE standard / トランシーバ）を保持する。ケーブル単位の属性（grade / 長さ / 端コネクタ）は per-link に置く。
- **接続点** — Endpoint の Plug と Port の cage は機械的に同じ form factor。これが噛み合っていることが物理的に成立する条件。

UI ロジック（カスケード絞り込み、cage ロック、バリデーション）は**この構造の中**ではなく、**この構造の上**に乗っています。

## 概念レイヤ

```mermaid
flowchart LR
  subgraph A[Node A]
    direction TB
    PA[Port<br/>cage = sfp+]
  end
  subgraph CABLE[Cable<br/>category · length · connector]
    direction LR
    EA[Endpoint A<br/>Plug · Module]
    EB[Endpoint B<br/>Plug · Module]
    EA --- EB
  end
  subgraph B[Node B]
    direction TB
    PB[Port<br/>cage = sfp+]
  end
  PA -. plug fits cage .- EA
  EB -. plug fits cage .- PB
```

- Plug と cage は機械的に一致する必要がある（standard の `spec.cage` が、`port.cage` が既知ならそれと一致する）。
- Module とケーブル媒体は、その制約の中でユーザーが選ぶ。
- `cable.connector`（LC / MPO / RJ45 plug）はケーブル端の終端形状で、Plug の form factor とは別軸。

## データモデル

「ノード側に入っているもの」と「リンク側に入っているもの」を分けて、入れ子のまま示します。Endpoint は Link の中に二つ（from / to）あり、それぞれが Node と Port を id で参照しつつ、自分の属性として Module を保持する点に注意。

### ノード側

```
Node
├── id: string
├── label?: string
├── ports: NodePort[]
│   └── NodePort
│       ├── id: string
│       ├── label?: string
│       ├── cage?: PortConnector       ← rj45 / sfp+ / sfp28 …
│       ├── poe?: boolean
│       └── faceplateLabel?, interfaceName?, role?, …
└── (position, parent, shape, spec などレイアウト系)
```

Port は完全に Node の所有物。Link 側からは `LinkEndpoint.node` + `LinkEndpoint.port` の id ペアで参照されるだけで、複製はしない。

### リンク側

物理的な階層は **Plug ＞ Module（あれば）＞ Cable**。プラグは「ケーブル端の差し込み形状」で常に存在し、その中にトランシーバ（Module）が入るかどうかは構成次第（RJ45 直結なら無し、SFP+ なら有り）。両端それぞれにこのプラグ／モジュール構造があり、Cable はリンク全体で一本。

```
Link
├── id: string
├── from: LinkEndpoint                          ← 端点 A
│   ├── node, port                              │ Node / NodePort を id 参照
│   ├── Plug (form factor)                      ← 派生: module.standard → spec.cage
│   │                                           │       なければ port.cage にフォールバック
│   │                                           │       例: sfp+ / rj45 / qsfp28
│   │   └── module?: LinkModule                 ← ★ optional
│   │       ├── standard: EthernetStandard      │   10GBASE-SR / 10GBASE-T …
│   │       └── sku?: string                    │   FTLX8571D3BCL …
│   │     ※ RJ45 直結など pluggable でないときは module を持たない
│   └── ip?: string | string[]
├── to: LinkEndpoint                            ← 端点 B（from と同型）
│   ├── node, port
│   ├── Plug
│   │   └── module?
│   └── ip?
├── cable?: LinkCable                           ← ケーブル全体の属性（per-link で一本）
│   ├── category?: string                       │ om4 / cat6a / …
│   ├── length_m?: number
│   └── connector?: string                      │ LC / MPO / RJ45 plug …
└── label?, type?, vlan?, redundancy?, arrow?, …
```

要点：

- **Plug は常に概念として存在する**が、データ上は独立フィールドではなく**派生**。`module.standard` が決まればそれが要求する `spec.cage` がプラグ、未決なら `port.cage` を借りる。
- **Module は Plug の中に optional に入る**。SFP / SFP+ / SFP28 / QSFP+ / QSFP28 など pluggable のときだけ有り、RJ45 直結のような integrated 形態では無し。
- **Module は per-endpoint**。BiDi ペアやメディアコンバータで非対称になるため、各端が独立した standard を持てる必要がある。
- **Cable は per-link**。grade / 長さ / 端コネクタは「ケーブル全体」の属性で、どちらか一端に偏らせない。
- **Endpoint は Link の中の構造**で、Node を所有しない（id で参照するだけ）。

### 関係図

```mermaid
classDiagram
  class Node {
    id: string
    label?: string
    ports: NodePort[]
  }
  class NodePort {
    id: string
    label?: string
    cage?: PortConnector
    poe?: boolean
  }
  class Link {
    id: string
    from: LinkEndpoint
    to: LinkEndpoint
    cable?: LinkCable
  }
  class LinkEndpoint {
    node: string
    port: string
    module?: LinkModule
    ip?: string
  }
  class LinkModule {
    standard: EthernetStandard
    sku?: string
  }
  class LinkCable {
    category?: string
    length_m?: number
    connector?: string
  }

  Node *-- "ports *" NodePort : owns
  Link *-- "from 1" LinkEndpoint
  Link *-- "to 1" LinkEndpoint
  Link *-- "0..1" LinkCable
  LinkEndpoint *-- "0..1" LinkModule
  LinkEndpoint ..> Node : refs node id
  LinkEndpoint ..> NodePort : refs port id
```

実線（◆）は所有（compose）、破線（..>）は id 参照。Node と NodePort はノード側で閉じていて、Link 側から id で指されるだけ。

### フィールド対応

| 物理レイヤ          | モデル位置                       | 型                     | 例               |
| ------------------- | -------------------------------- | ---------------------- | ---------------- |
| Port レセプタクル   | `Node.ports[].cage`              | `PortConnector`        | `sfp+`、`rj45`   |
| Endpoint モジュール | `Link.from/to.module.standard`   | `EthernetStandard`     | `10GBASE-SR`     |
| モジュール SKU      | `Link.from/to.module.sku`        | `string`               | `FTLX8571D3BCL`  |
| ケーブル媒体 grade  | `Link.cable.category`            | `string`               | `om4`、`cat6a`   |
| ケーブル長          | `Link.cable.length_m`            | `number`               | `30`             |
| ケーブル端コネクタ  | `Link.cable.connector`           | `string`（freeform）   | `LC`、`MPO`      |
| Plug form factor    | `module.standard` から派生       | （フィールドなし）     | `sfp+`           |

## UI カスケード

```mermaid
flowchart LR
  N[Node 選択] --> P[Port 選択]
  P -- cage 既知 --> PL[Plug<br/>port.cage でロック]
  P -- cage 未知 --> PU[Plug<br/>ユーザー選択]
  PL --> M[Module 選択<br/>plug で絞り込み]
  PU --> M
  M --> CG[Cable grade<br/>module で絞り込み]
```

Plug select は Port と Module の間に置く。port にカタログ由来の cage が乗っているときは Plug select を disabled にしてその値で固定する（ハードウェアが決めるため）。port に cage 情報がないときは Plug select がユーザーの最初の明示的な選択になり、Module 一覧を絞る。

Plug の値の解決順位：

1. `port.cage`（ハードウェア制約 — 他より優先される）
2. `module.standard` から推論される plug（モジュールが既に選ばれているとき）
3. ユーザーの明示的な plug 選択（上記 1, 2 のどちらも無いときだけ意味を持つ）

Plug を変更すると、既存モジュールの要求 plug が新しい plug と一致しないときは Module を自動クリアする — Module 一覧が再フィルタされ、ユーザーは選び直す。

## バリデーション

`validateLinkCompatibility`（`port-compatibility.ts`）は各端点を独立して、その端の port と module に対して検証する。

| チェック                                                          | 重大度  | 状態  |
| ----------------------------------------------------------------- | ------- | ----- |
| `port.cage` が `module.standard` の要求 cage を受け入れるか       | error   | ✅    |
| `from.standard` と `to.standard` が異なる（非対称リンク）         | warning | ✅    |
| `cable.length_m` が grade 補正後の reach を超えている             | warning | ✅    |
| `port.poe` が non-RJ45 cage に立っている                          | error   | ✅    |
| `cable.connector` が `spec.cableConnector` と一致するか           | —       | ❌ 未実装 |

非対称 standard は警告するだけで許容する — BiDi ペア（例: `10GBASE-BX10-D` ↔ `10GBASE-BX10-U`）やメディアコンバータリンクで意図的に発生するため。

## UI 配置

| 画面                                            | Plug + Module               | Cable grade   | 長さ          | Cable connector  |
| ----------------------------------------------- | --------------------------- | ------------- | ------------- | ---------------- |
| `LinkProperties.svelte`（詳細パネル）           | per-endpoint セクション     | per-link 行   | per-link 行   | per-link 行（テキスト） |
| `connections/+page.svelte` テーブル             | per-endpoint セル内縦並び   | Cable 列      | Length 列     | （なし）         |
| `connections/+page.svelte` 追加フォーム         | per-endpoint ピッカー       | Cable 列      | —             | —                |

`EndpointModulePicker.svelte` が共有コンポーネント — Plug + Module の二段 select で、上記 3 画面すべてが利用する。

## コード上の場所

- `libs/@shumoku/core/src/models/types.ts` — `NodePort` / `Link` / `LinkEndpoint` / `LinkModule` / `LinkCable` / `PortConnector` / `EthernetStandard`。
- `libs/@shumoku/core/src/models/standards.ts` — `STANDARD_SPECS` レジストリ（standard が何を意味するかの真実の源）、`cableVariantsForPlug`、`cableGradesForStandard`、`plugProfilesForCages`、`plugProfileForStandard`。
- `libs/@shumoku/core/src/models/port-compatibility.ts` — `validateLinkCompatibility`、`defaultStandardForCages`。
- `apps/editor/src/lib/components/EndpointModulePicker.svelte` — 共通の二段 select ピッカー。
- `apps/editor/src/lib/components/detail/LinkProperties.svelte` — ピッカーを使う詳細パネル。
- `apps/editor/src/routes/project/[id]/(content)/connections/+page.svelte` — 接続テーブルと追加フォーム。

# BOM ページ

BOM は **Diagram + Connections + Materials の派生 view**。編集面ではなく、必要部材と未確定箇所を見つけて source（Diagram / Materials）に戻るための出力・検証面。

データ構造の前提は [`../design/data-model.md`](../design/data-model.md)、機材を貯める側のフローは [`materials.md`](./materials.md)。

---

## 1. 派生フロー

BOM は保存しない。`Product[]` と `NetworkGraph` から毎回計算する。

```mermaid
flowchart LR
  P[Products<br/>requiredQty?] --> R
  N[Diagram nodes<br/>Node.productId] -->|placedCount| R
  L[Link Module/Cable<br/>productId] -->|placedCount| R
  R[RequirementLine[]] --> G[group by productId / matching key]
  G --> B[BomLine[]]
```

### 1.1 RequirementLine（中間表現）

Diagram + Connections を walk して、配置されている要素ごとに 1 行を生成：

| Source                                         | Requirement                                  |
| ---------------------------------------------- | -------------------------------------------- |
| Node bound to Cisco C9300 Product              | device: Cisco C9300 ×1                       |
| Node spec only（productId なし、spec.type あり）| device: generic <type> ×1                    |
| Link endpoint module `10GBASE-SR`、SKU あり    | module: SKU ×1                               |
| Link endpoint module `10GBASE-SR`、SKU なし    | module: 10GBASE-SR generic ×1                |
| Link cable `category: om4, length_m: 30`       | cable: OM4 run ×1, length 30 m               |
| Link cable `category: cat6a`                   | cable: Cat6A run ×1                          |

### 1.2 Matching key

SKU が無い設計でも BOM を出せるように、requirement は `productId` だけでなく **compatibility key** でも group する：

```text
device: productId ?? kind + deviceRole + portProfile
module: productId ?? standard + connector + media + speed
cable:  productId ?? category + media + lengthClass
```

これにより、最初は `10GBASE-SR generic ×4` として出し、後から Connections で具体 SKU に置き換えられる。

### 1.3 BomLine（集計後）

`requiredQty` が `placedCount` を上回る分は generic として上乗せ。

| 値                | 意味                                                                  |
| ----------------- | --------------------------------------------------------------------- |
| `requiredQty`     | Diagram / Connections から必要と判断された数。<br>Product.requiredQty が set ならそれが上限、それ以下なら placedCount |
| `sources`         | どの Node / Link / Endpoint から出た requirement か                   |
| `status='resolved'`   | Product / SKU まで確定している                                    |
| `status='generic'`    | 互換条件だけ確定している（SKU 未確定）                            |
| `status='incomplete'` | BOM に出すには情報が不足している（spec も無いノード等）            |

---

## 2. UI 構成

```text
BOM
├─ toolbar
│  ├─ search
│  ├─ kind filter
│  ├─ status filter
│  └─ export
├─ BOM table
│  ├─ Item / Kind / Required / Status / Sources
│  └─ row click → Source drawer
└─ Source drawer
   ├─ source list
   ├─ unresolved reasons
   └─ jump to Diagram / Connections / Materials
```

- BOM 上で **直接 Product を編集しない**。行 action は `Open Source` / `Create Product from generic` 程度に限定
- `incomplete` を見つけた → Diagram に戻って spec 補完
- `generic` を見つけた → Connections に戻って SKU 確定 or Materials に戻って Product 追加 → bind

---

## 3. 安全性の保証

[`materials.md` §8](./materials.md#8-安全性の保証) と同じ：

- `requiredQty` 編集は diagram に絶対影響しない
- BOM 上の数値はすべて read-only（編集できない）
- 数値を変えたい場合は **Materials の Library で Required を編集** または **Diagram でノードを増減** する

---

## 4. 関連 doc

- [`../design/data-model.md`](../design/data-model.md) — データ構造（前提）
- [`../design/connection-model.md`](../design/connection-model.md) — Module / Cable の設計
- [`materials.md`](./materials.md) — Materials の操作フロー
- [`connections.md`](./connections.md) — Connections ページ

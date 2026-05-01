# Connections ページ

Link の配線・ポート・module・cable の台帳。Diagram 上のリンクを 1 件ずつ詳細編集する CAM operation table 的な view。データ構造の前提は [`../design/data-model.md`](../design/data-model.md) と [`../design/connection-model.md`](../design/connection-model.md)。

> このページは現状 stub（Module / Cable Product の作成導線が未実装）。Phase B で Connections から直接 Module/Cable Product を追加できる UI を導入予定。

---

## 1. 役割

- Link の `from` / `to` endpoint、`plug.module`、`cable` を編集
- 互換性チェック（`RJ45 に SFP は刺さらない` / `SFP cage は PoE を出さない` / `fiber standard と cable media が合わない` 等）
- Module / Cable に Product を bind（`bindAssignment` の `link-module` / `link-cable` ルート）

## 2. Module / Cable の段階的詳細化

| 段階          | 入力箇所     | 決まること                          | BOM                  |
| ------------- | ------------ | ----------------------------------- | -------------------- |
| 1. 要件のみ   | Connections  | `10GBASE-SR`、`om4`、`cat6a`        | generic requirement  |
| 2. SKU 確定   | Connections  | `SFP-10G-SR-S`、`Cat6A 3m`          | resolved requirement |
| 3. 個体管理   | 将来拡張     | serial / assetTag / install record  | 初期対象外           |

RJ45、SFP+、QSFP28、fiber type、copper、PoE、speed は設計上重要なので snapshot / Product spec に持つ。「この個体の SFP をこのリンクに挿した」という資産管理は初期対象外。

## 3. UI 概観

```text
Connections
├─ Link table
│  ├─ A node / A port / A module
│  ├─ Z node / Z port / Z module
│  ├─ cable
│  ├─ speed / media / PoE
│  └─ diagnostics
└─ Detail sheet
   ├─ endpoints
   ├─ module Product selector（Phase B で Connections から追加可）
   ├─ cable Product selector（同上）
   ├─ compatibility
   └─ source jump to Diagram
```

## 4. 関連 doc

- [`../design/connection-model.md`](../design/connection-model.md) — Port / Link / Module / Cable の正本
- [`../design/data-model.md`](../design/data-model.md) — `LinkModule.productId` / `LinkCable.productId`
- [`materials.md`](./materials.md) — device 軸の Product 管理
- [`bom.md`](./bom.md) — Module / Cable の requirement 派生

# Connections ページ

Link の配線・ポート・module・cable の台帳。Diagram 上のリンクを 1 件ずつ詳細編集する CAM operation table 的な view。データ構造の前提は [`../design/data-model.md`](../design/data-model.md) と [`../design/connection-model.md`](../design/connection-model.md)。

## 基本操作

1. **New Connection** で A end / Z end の機器とポートを選ぶ。リンク種別を先に指定してから端点を選ぶこともできる。
2. 必要に応じて各端のモジュール規格とケーブル種別を指定し、**Add** を押す。
   両端の機器・ポートが揃い、機器が異なるときに追加できる。
3. **Cables** の表で端点、ケーブル、長さ、VLAN、両端の IP、ラベルを編集する。
4. 機器名・ポート・VLAN・規格で検索する。**Issues only** で問題のある配線に絞る。
5. エラー・警告の一覧から対象行を確認し、端点や規格を修正する。行末の削除ボタンで配線を削除できる。
6. **Interfaces** でインターフェース情報を確認する。

現在の主な編集面は追加フォームとインライン編集できる表。
以下の Product 紐付けや詳細パネルに関する設計記述は、すべてが現行の操作導線を表すものではない。
実装：`src/routes/project/[id]/(content)/connections/+page.svelte`。

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

## 3. 設計上の UI 概観（将来の導線を含む）

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

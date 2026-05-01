# Diagram ページ

トポロジー編集の正本。`NetworkGraph` を直接編集するキャンバス。データ構造の前提は [`../design/data-model.md`](../design/data-model.md)、レイアウトは [`../design/layout-model.md`](../design/layout-model.md)、シート分割は [`../design/sheet-model.md`](../design/sheet-model.md)。

> このページは現状 stub。**ノード作成 / Product bind / コピペ**まわりは [`materials.md`](./materials.md) と [`../design/sheet-model.md`](../design/sheet-model.md) に分散して書かれている。今後 UI ガイドや操作モード（Edit / View）の整理を集める想定。

---

## 1. 役割

- ノード / リンク / Subgraph の **構造編集**（追加 / 削除 / 接続 / 親付け替え）
- ノードの **位置決定**（drag / auto-arrange / sheet drill-down）
- 詳細パネルでの Product bind（Materials の DetailPanel 経由 bind）

## 2. UI 概観

```text
Diagram
├─ Canvas（renderer-svg + libavoid）
├─ SideToolbar
│  └─ Edit / View モード切替、Auto-arrange、Sheet 操作
├─ ContextMenu
│  └─ Copy / Paste / Move to group / Delete / Open detail
├─ DetailPanel（Sheet）
│  ├─ Node detail
│  │  ├─ label / shape / parent / Product selector
│  │  └─ ports / connections / PoE budget
│  ├─ Link detail
│  └─ Subgraph detail
└─ SheetBar（KiCad 風 drill-down）
```

## 3. 関連 doc

- [`../design/data-model.md`](../design/data-model.md) — Node / Link / Subgraph の型
- [`../design/layout-model.md`](../design/layout-model.md) — `placeNode` / `layoutNetwork` の使い分け
- [`../design/sheet-model.md`](../design/sheet-model.md) — Sheet drill-down と sheetView
- [`../design/connection-model.md`](../design/connection-model.md) — Port / Link / Module / Cable
- [`materials.md`](./materials.md) — DetailPanel での Product bind フロー

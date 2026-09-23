# Diagram ページ

トポロジー編集の正本。`NetworkGraph` を直接編集するキャンバス。データ構造の前提は [`../design/data-model.md`](../design/data-model.md)、レイアウトは [`../design/layout-model.md`](../design/layout-model.md)、シート分割は [`../design/sheet-model.md`](../design/sheet-model.md)。

## 基本操作

Diagram は `ShumokuRenderer` による論理トポロジー編集画面。平面図の配線は [Scene](./scene.md) を使う。

- 編集するときは Edit モードに切り替える。右クリックのメニューで選択対象への操作を選ぶ。
- **Information** で選択した対象の詳細を開く。製品の紐付けは [Materials](./materials.md) も参照。
- **Auto-arrange** で自動配置する。手動位置を変更する操作なので、必要なら Undo で戻す。
- **Move to group** で選択したノードの所属グループを変更する。
- マウスホイールはズーム、トラックパッドの二本指操作はパン、ピンチはズーム。
  Alt＋左ドラッグ、または中ボタンドラッグでもパンできる。
- **Export → JSON / SVG / Print** で図を出力する。プロジェクト全体の保存は
  [Settings の Export](./projects.md) を使う。

### ショートカット

`Mod` は Mac では Command、それ以外では Ctrl。入力欄の編集中はキャンバス用ショートカットの対象外。

| 操作 | キー | 条件・範囲 |
| --- | --- | --- |
| Undo / Redo | Mod＋Z / Mod＋Shift＋Z | 対応する履歴があるとき |
| Copy / Paste | Mod＋C / Mod＋V | Copy はノードまたはグループの単一選択。複数選択を丸ごとコピーする機能ではない |
| Duplicate | Mod＋D | ノードまたはグループの単一選択 |
| Delete | Delete / Backspace | 選択対象を削除 |
| 全体表示 | Mod＋0 | Diagram の表示範囲を合わせる |
| 拡大 / 縮小 | Mod＋= / Mod＋- | Diagram の表示倍率を変更 |
| コマンド検索 | Mod＋K | コマンドパレットを開く |
| 印刷 | Mod＋P | ブラウザの印刷画面を開く |

実装：`src/lib/actions/builtin.ts`、`keyboard.ts`、`src/routes/project/[id]/diagram/+page.svelte`。
グループのコピーは名前などの情報を使って新しいグループを作る処理で、子ノード・配線の一括複製ではない。

---

## 1. 役割

- ノード / リンク / Subgraph の **構造編集**（追加 / 削除 / 接続 / 親付け替え）
- ノードの **位置決定**（drag / auto-arrange / sheet drill-down）
- 詳細パネルでの Product bind（Materials の DetailPanel 経由 bind）

## 2. UI 概観

```text
Diagram
├─ Canvas（ShumokuRenderer）
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

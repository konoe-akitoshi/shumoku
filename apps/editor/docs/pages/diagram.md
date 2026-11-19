# Diagram ページ

トポロジー編集の正本。`NetworkModel` から描いた `NetworkGraph` を編集するキャンバス。データ構造の前提は [`../design/data-model.md`](../design/data-model.md)。配置は座標を持たず、描画エンジン（`layoutNetwork`）が毎回引き直す。ドラッグは直前の配置（Arrangement）に対して読み、変わったものだけ、所属グループ（構成）と枠内の疎な並び順（`drawing.order`）として残す（設計: [`../design/arrangement.md`](../design/arrangement.md)）。シートは廃止した（履歴: [`../design/sheet-model.md`](../design/sheet-model.md)）。

## 基本操作

Diagram は `ShumokuRenderer` による論理トポロジー編集画面。平面図の配線は [Scene](./scene.md) を使う。

- 編集するときは Edit モードに切り替える。右クリックのメニューで選択対象への操作を選ぶ。
- **Information** で選択した対象の詳細を開く。製品の紐付けは [Materials](./materials.md) も参照。
- **Auto-arrange** で自動配置する。手動位置を変更する操作なので、必要なら Undo で戻す。
- **Move to group** で選択したノードの所属グループを変更する。
- ホイールとトラックパッドの二本指操作は図をスクロール（パン）、ピンチと Ctrl/⌘＋ホイールはカーソル位置へズーム。
  Shift＋ホイールは横スクロール、Alt＋ホイールはスクロールとズームの逆。マウスかトラックパッドかは推測しない
  （ブラウザでは確実に区別できないため）。Settings の「Mouse wheel」を Zoom にすると、素のホイールでズームする。
- Space＋ドラッグ、中ボタンドラッグ、Alt＋左ドラッグでパンできる。View モードでは左ドラッグでもパンする
  （Edit モードの左ドラッグは範囲選択と要素の移動）。
- 編集して図が描き直されても、見ている場所は動かない。
- SpaceMouse（Chrome / Edge、WebHID）はマウスと併用するカメラ。コマンドパレットの **Connect SpaceMouse** で
  一度つなぐと、次からは自動でつながる。キャップを横に押すとパン、引き上げる / 押し込むとズーム（ズームの中心は
  カーソル、図の外なら画面の中心）、Fit ボタンで全体表示、Shift ボタンを押している間はゆっくり動く
  （ボタンは SpaceMouse Pro 系・SpaceExplorer・2 ボタンの機種に対応。他の機種はキャップだけ）。HTTPS か localhost で開く必要がある。
  3DxWare が動いていると入力が届かない（終了する）。Linux では hidraw の udev rule が要る（spacenavd と併用できる。ルールはサーバーの Topologies のドキュメントと同じ）。
  軸の向きは `localStorage['shumoku.spacemouse.invert'] = 'x,y,z'` で反転できる（実機での確認待ち）。
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
- ノード・グループの **並び順と所属** の指定（drag → 並び順のヒントと所属グループ / auto-arrange はヒントを捨てる）
- 詳細パネルでの Product bind（Materials の DetailPanel 経由 bind）

## 2. UI 概観

```text
Diagram
├─ Canvas（ShumokuRenderer）
├─ SideToolbar
│  └─ Edit / View モード切替、Auto-arrange
├─ ContextMenu
│  └─ Copy / Paste / Move to group / Delete / Open detail
├─ DetailPanel
│  ├─ Node detail
│  │  ├─ label / shape / parent / Product selector
│  │  └─ ports / connections / PoE budget
│  ├─ Link detail
│  └─ Subgraph detail
```

## 3. 関連 doc

- [`../design/data-model.md`](../design/data-model.md) — Node / Link / Subgraph の型
- [`../../../../docs/ARCHITECTURE.md`](../../../../docs/ARCHITECTURE.md) — 描画（`drawNetwork`）とエディタの編集の流れ
- [`../design/connection-model.md`](../design/connection-model.md) — Port / Link / Module / Cable
- [`materials.md`](./materials.md) — DetailPanel での Product bind フロー

# neted editor docs

`apps/editor` のエディタ部分の設計ドキュメント。**全体設計**（データ構造・レイアウト・シート）と **各ページ設計**（操作フローと UI）を入れ子で分けている。

```
apps/editor/docs/
├─ README.md                   ← このファイル（索引）
├─ design/                     ← 全体設計（データ・システム）
│  ├─ data-model.md            ← Product / NetworkGraph / .neted.json v2
│  ├─ connection-model.md      ← Port / Link / Module / Cable
│  ├─ icon-model.md            ← icon の流れ：catalog → Product → Node.spec.icon → renderer
│  ├─ layout-model.md          ← Sugiyama pipeline + 配置 API
│  └─ sheet-model.md           ← drill-down / sheetView / sheetCache
└─ pages/                      ← 各ページ設計（UI / 操作フロー）
   ├─ materials.md             ← Materials ページ（Product 管理 + 数量）
   ├─ bom.md                   ← BOM ページ（派生 view）
   ├─ diagram.md               ← Diagram ページ（stub）
   └─ connections.md           ← Connections ページ（stub）
```

---

## どこから読むか

- **データ構造を知りたい** → [`design/data-model.md`](./design/data-model.md) から
- **アイコンの仕組み** → [`design/icon-model.md`](./design/icon-model.md)
- **新しい機能を追加する** → 対応するページの doc を見て、必要なら `design/` の該当 doc を更新
- **Materials ページの操作を変えたい** → [`pages/materials.md`](./pages/materials.md)
- **BOM の派生ロジックを変えたい** → [`pages/bom.md`](./pages/bom.md)
- **リンク（Module / Cable）まわり** → [`design/connection-model.md`](./design/connection-model.md) と [`pages/connections.md`](./pages/connections.md)
- **Sheet 機能（KiCad 風 drill-down）** → [`design/sheet-model.md`](./design/sheet-model.md)
- **配置アルゴリズム** → [`design/layout-model.md`](./design/layout-model.md)

## 命名規則

- `design/*-model.md` — データ・システムの **モデル定義**。複数ページを横断する concern
- `pages/*.md` — **ページ単位の UI と操作フロー**。データ構造の前提は `design/` を参照

各 doc の冒頭に「前提」「スコープ」を書き、別 doc で扱うものは link で示す。

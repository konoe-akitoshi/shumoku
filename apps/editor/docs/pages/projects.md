# プロジェクトと Settings

現行のホーム画面・Settings の基本操作。ファイル構造は
[project-file.md](../design/project-file.md)、保存処理は
[local-cache.md](../design/local-cache.md) を参照。

## 開始・再開

- ホームの新規作成メニューからプロジェクト名を入力して作成する。
- ホームの保存済みプロジェクトをクリックすると Diagram が開く。サンプルもホームから開ける。
- **Import Project** は `.neted.zip` を読み込む。図面・製品・Scene・画像資産を含むプロジェクト用。
- **Import Diagram** は `NetworkGraph` の `.json` を読み込む。プロジェクト全体の復元とは異なる。
- 保存済みプロジェクトの削除ボタンは、そのプロジェクトのブラウザ内データを確認後に削除する。

ホームの Import Diagram は現在 JSON 用。YAML をファイル選択で取り込めるとは案内しない。

## 名前と保存

Settings → Project → **Rename** で名前を編集し、Enter または入力欄からフォーカスを外して確定する。
Settings → Export → **Export** で、プロジェクト全体を `.neted.zip` として保存する。
Diagram の Export → JSON / SVG / Print は図の出力であり、全体のバックアップには Settings の Export を使う。

プロジェクトはブラウザの IndexedDB に保存される。サーバー同期はなく、ブラウザ・プロファイル・
配信元の URL が変わると同じ保存領域にはならない。サイトデータを削除する前や別端末へ移す際は
`.neted.zip` を書き出し、移動先の Import Project で開く。

## Local cache

- **Cache edits in this browser**：編集内容のキャッシュを On / Off に切り替える。
- **Storage**：保存プロジェクト数と、取得できる場合はブラウザのストレージ使用量を表示する。
- **Clear cache**：確認後に、この保存領域の全プロジェクトを削除する。現在のプロジェクトだけの削除ではなく、Undo では戻せない。

実装：`src/routes/+page.svelte`、`src/routes/project/[id]/(content)/settings/+page.svelte`。

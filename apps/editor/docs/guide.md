# Shumoku Editor

[Editorを開く](https://editor.shumoku.dev/)

Shumoku Editor は、ネットワーク構成図と平面図上の配線をブラウザで編集するアプリです。

## はじめる

1. ホームでサンプルを開くか、新しいプロジェクトを作成します。
2. [Materials](./guides/materials.md) で使用する機材を登録します。
3. [Diagram](./pages/diagram.md) で構成を編集し、[Connections](./pages/connections.md) で接続とポートを確認します。
4. 平面図上で検討するときは [Scene](./pages/scene.md) に切り替え、背景画像・縮尺・配置・配線を設定します。
5. [BOM](./guides/bom.md) で部材を確認し、[Settingsからプロジェクトを書き出します](./pages/projects.md)。

途中から始めたり、画面を行き来しながら編集したりできます。

## 保存について

現在はブラウザ内の保存で、サーバー同期はありません。別端末へ移す場合やバックアップには
Settings の Export から `.neted.zip` を保存してください。
ホームの Import Project で、画像資産を含めて読み直せます。

## このガイドについて

操作ガイドは日本語で提供しています。英語ページでも、日本語原文であることを表示します。
開発者向けのモデル・実装設計は [リポジトリの設計文書](./README.md) を参照してください。

---
id: server.overview
title: Shumoku Server概要
description: セルフホスト環境でTopology、監視データ、Dashboardを一つの画面にまとめます。
locale: ja
canonicalLocale: ja
slug: server/overview
status: stable
audience: user
owner: server
related:
  - /ja/guides/server/installation
  - /ja/guides/server/topologies
  - /ja/guides/server/datasources
  - /ja/guides/server/dashboards
---

Shumoku Serverは、ネットワーク構成図と監視システムの観測データを組み合わせるセルフホスト型Webアプリケーションです。Topologyを複数のデータソースから構成し、状態や使用率を画面上で確認できます。

## 主な使い方

- YAMLまたはManualソースからTopologyを作成する
- Plugin経由でインベントリ、メトリクス、アラートを取得する
- 複数のTopologyや状態WidgetをDashboardへ配置する
- 読み取り専用の共有リンクを発行する
- HTTP APIから構成、同期、描画、共有を操作する

Serverは入力形式やPlugin固有のフィールドを独自に再定義しません。YAMLの形式は[YAMLリファレンス](/ja/reference/yaml)、HTTP endpointは[Server API](/ja/reference/server)、Pluginの接続項目は[Pluginリファレンス](/ja/reference/plugins)がコードから生成されます。

## 導入後の流れ

1. [Serverをインストール](/ja/guides/server/installation)して管理者としてログインします。
2. [Data Sourceを追加](/ja/guides/server/datasources)します。
3. [Topologyを作成](/ja/guides/server/topologies)し、必要なソースを接続します。
4. 必要に応じて[Dashboardを作成](/ja/guides/server/dashboards)し、共有範囲を設定します。


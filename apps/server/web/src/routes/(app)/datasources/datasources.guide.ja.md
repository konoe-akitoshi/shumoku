---
id: server.datasources.create
title: Data Sourceを追加する
description: Pluginを選択し、接続設定を検証してTopologyで利用できるようにします。
locale: ja
canonicalLocale: ja
slug: server/datasources
status: stable
audience: user
owner: server-web
journey: createDataSourceJourney
journeyFile: apps/server/web/src/routes/(app)/datasources/datasources.journey.ts
related:
  - /ja/reference/plugins
  - /ja/reference/server/getDatasources
  - /ja/reference/server/postDatasources
---

Data Sourceは外部システムまたはManual入力との接続を表します。Pluginが提供するcapabilityにより、Topology、host、metrics、alerts、Discoveryのどれを利用できるかが決まります。

## 追加手順

1. 管理者として **Data Sources** を開き、**Add Data Source** を選びます。
2. 接続するPluginを選びます。
3. **Name** とPlugin固有の接続項目を入力し、**Create** を選びます。
4. 一覧の **Test** で接続を確認します。
5. Topologyの **Sources** 画面から、作成したData Sourceを接続します。

必須項目、Secret、既定値、選択肢は各Pluginのdescriptorから画面と[Pluginリファレンス](/ja/reference/plugins)へ生成されます。ガイド側に同じ設定表を持ちません。

接続に失敗した場合は、Serverから対象URLへ到達できること、API tokenのscope、TLS証明書、外部サービス側の権限を確認してください。TLS検証の無効化は信頼できるネットワーク内に限定します。


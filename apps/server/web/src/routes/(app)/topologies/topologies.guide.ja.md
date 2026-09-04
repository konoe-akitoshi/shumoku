---
id: server.topologies.create
title: Topologyを作成する
description: Shumoku ServerでTopologyを作り、データソースを追加できる状態にします。
locale: ja
canonicalLocale: ja
slug: server/topologies
status: stable
audience: user
owner: server-web
journey: createTopologyJourney
journeyFile: apps/server/web/src/routes/(app)/topologies/topologies.journey.ts
related:
  - /ja/reference/server/getTopologies
  - /ja/reference/server/postTopologies
---

Topologyは、手動入力や外部サービスなど複数のデータソースをまとめる入れ物です。最初に空のTopologyを作り、その後で必要なソースを追加します。

## 作成手順

1. 管理者としてShumoku Serverへサインインし、サイドバーから **Topologies** を開きます。
2. **Add Topology** を選びます。
3. **Name** に表示名を入力し、**Create** を選びます。
4. 作成後に開く **Sources** 画面で、Manualまたは必要なプラグインのデータソースを追加します。

Topologyの作成時点ではデータソースは自動追加されません。構成図を手で編集する場合も、Sources画面でManualソースを選んでください。

## 関連リファレンス

- [Topology一覧API](/ja/reference/server/getTopologies)
- [Topology作成API](/ja/reference/server/postTopologies)


---
id: server.dashboards.create
title: Dashboardを作成して共有する
description: 複数のTopologyと監視Widgetを一つの運用画面にまとめます。
locale: ja
canonicalLocale: ja
slug: server/dashboards
status: stable
audience: user
owner: server-web
journey: createDashboardJourney
journeyFile: apps/server/web/src/routes/(app)/dashboards/dashboards.journey.ts
related:
  - /ja/reference/server/getDashboards
  - /ja/reference/server/postDashboards
---

Dashboardは、Topology、device status、alertsなどのWidgetを一つの画面へ配置するための入れ物です。先に参照するTopologyやData Sourceを準備してください。

## 作成手順

1. 管理者として **Dashboards** を開き、**New Dashboard** を選びます。
2. **Dashboard Name**を入力し、**Create**を選びます。
3. Dashboard上の追加操作からWidgetを選び、参照するTopologyまたはData Sourceを指定します。
4. Widgetをドラッグまたはresizeして配置します。layoutは自動保存されます。

## 共有

共有操作で発行されるURLは、Dashboard内のWidgetが参照するresourceだけを読み取れるtokenを含みます。管理画面への権限は付与しません。

共有先が不要になった場合やURLが漏えいした可能性がある場合は、共有設定からtokenを失効させてください。公開DashboardへSecretや管理情報を表示するWidgetを追加しないでください。


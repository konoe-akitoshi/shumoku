---
id: server.dashboards.create
title: Create and share a dashboard
description: Combine multiple topologies and monitoring widgets into one operational view.
locale: en
canonicalLocale: ja
slug: server/dashboards
status: stable
audience: user
owner: server-web
journey: createDashboardJourney
journeyFile: apps/server/web/src/routes/(app)/dashboards/dashboards.journey.ts
canonicalDigest: 1f153337ea5512b22eb39e0e96809de736fbeedf41e20953fdb7a86ef4a8aa80
related:
  - /en/reference/server/getDashboards
  - /en/reference/server/postDashboards
---

A dashboard arranges topology, device-status, alert, and other widgets in one view. Prepare the topologies and data sources it will reference first.

## Create a dashboard

1. Sign in as an administrator, open **Dashboards**, and select **New Dashboard**.
2. Enter **Dashboard Name** and select **Create**.
3. Add widgets and choose the topology or data source each one references.
4. Drag or resize widgets into place. The layout is saved automatically.

## Share it

The sharing action issues a URL containing a token that can read only resources referenced by that dashboard's widgets. It does not grant management access.

Revoke the token from sharing settings when the audience no longer needs it or the URL may have leaked. Do not put secrets or administrative information in widgets on a public dashboard.

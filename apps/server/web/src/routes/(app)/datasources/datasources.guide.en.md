---
id: server.datasources.create
title: Add a data source
description: Select a plugin, validate its connection, and make it available to topologies.
locale: en
canonicalLocale: ja
slug: server/datasources
status: stable
audience: user
owner: server-web
journey: createDataSourceJourney
journeyFile: apps/server/web/src/routes/(app)/datasources/datasources.journey.ts
canonicalDigest: 0da5a130844e5c13cfc6333de21ebc1787dace56ce9af0e97c6ebb2948f8ee1e
related:
  - /en/reference/plugins
  - /en/reference/server/getDatasources
  - /en/reference/server/postDatasources
---

A data source represents a connection to an external system or Manual input. Its plugin capabilities determine whether it supplies topology, hosts, metrics, alerts, or discovery.

## Add a source

1. Sign in as an administrator, open **Data Sources**, and select **Add Data Source**.
2. Select the plugin to connect.
3. Enter **Name** and the plugin-specific connection fields, then select **Create**.
4. Use **Test** in the list to verify the connection.
5. Connect the data source from a topology's **Sources** page.

Required fields, secrets, defaults, and choices are generated from each plugin descriptor into both the form and the [plugin reference](/en/reference/plugins). This guide does not duplicate their configuration tables.

If a connection fails, check that the Server can reach the URL, the API token scope, TLS certificates, and permissions in the external service. Disable TLS verification only on a trusted network.

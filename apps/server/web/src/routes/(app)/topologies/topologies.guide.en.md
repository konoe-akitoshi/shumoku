---
id: server.topologies.create
title: Create a topology
description: Create a topology in Shumoku Server and prepare it for data sources.
locale: en
canonicalLocale: ja
slug: server/topologies
status: stable
audience: user
owner: server-web
journey: createTopologyJourney
journeyFile: apps/server/web/src/routes/(app)/topologies/topologies.journey.ts
canonicalDigest: ba54e5edc78e4bbfdafdfabb0e117eedf555aa92a817cdfbf2d386eaa9a0057e
related:
  - /en/reference/server/getTopologies
  - /en/reference/server/postTopologies
---

A topology is a container that combines data sources such as manual input and external services. Create the empty topology first, then add the sources it needs.

## Create the topology

1. Sign in to Shumoku Server as an administrator and open **Topologies** from the sidebar.
2. Select **Add Topology**.
3. Enter a display name in **Name**, then select **Create**.
4. On the **Sources** page that opens, add a Manual source or the plugin data source you need.

Creating a topology does not automatically add a data source. To edit the diagram manually, select a Manual source on the Sources page.

## Related reference

- [List topologies API](/en/reference/server/getTopologies)
- [Create topology API](/en/reference/server/postTopologies)

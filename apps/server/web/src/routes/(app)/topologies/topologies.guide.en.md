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
canonicalDigest: 51fe9ec63615f438a65bb9c78ce351994507da07b7abebb17f8b29c18866c49a
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

## Sources and composition

Use **Sources** to manage topology inputs, priority, synchronization, and scope. When multiple topology sources provide the same data, their priority determines which value wins. Add a corresponding metrics source here when you want to overlay measurements.

Use **Composition** to inspect and adjust the resolved nodes and links, metrics mappings, and final composition. A useful boundary is to keep facts owned by an external service in Sources and make post-merge display adjustments in Composition.

## Display, sharing, and export

Use **Settings** for topology display preferences. **Share** creates read-only links and lets you revoke tokens that are no longer needed. **Export** can download the current sheet as SVG or PNG, or package every sheet as interactive HTML.

## Related reference

- [List topologies API](/en/reference/server/getTopologies)
- [Create topology API](/en/reference/server/postTopologies)

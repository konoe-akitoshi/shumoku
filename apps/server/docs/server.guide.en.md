---
id: server.overview
title: Shumoku Server overview
description: Bring topologies, monitoring data, and dashboards together in a self-hosted environment.
locale: en
canonicalLocale: ja
slug: server/overview
status: stable
audience: user
owner: server
canonicalDigest: 7b6940aefbbcb59f7d3c92bdb83b0c93ea511fb1b84350a060236161b4938d2e
related:
  - /en/guides/server/installation
  - /en/guides/server/topologies
  - /en/guides/server/datasources
  - /en/guides/server/dashboards
---

Shumoku Server is a self-hosted web application that combines network topology diagrams with observations from monitoring systems. A topology can be composed from multiple data sources and display status or utilization in the same interface.

## Common uses

- Create a topology from YAML or a Manual source
- Collect inventory, metrics, and alerts through plugins
- Arrange topologies and status widgets on dashboards
- Issue read-only sharing links
- Automate composition, synchronization, rendering, and sharing through the HTTP API

The Server does not redefine input formats or plugin-specific fields in prose. The [YAML reference](/en/reference/yaml), [Server API](/en/reference/server), and [plugin reference](/en/reference/plugins) are generated from their code contracts.

## After installation

1. [Install the Server](/en/guides/server/installation) and sign in as an administrator.
2. [Add a data source](/en/guides/server/datasources).
3. [Create a topology](/en/guides/server/topologies) and connect the sources it needs.
4. Optionally [create a dashboard](/en/guides/server/dashboards) and configure sharing.

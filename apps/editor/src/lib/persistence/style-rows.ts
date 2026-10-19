// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

import {
  combineLinkPresentation,
  combineSubgraphPresentation,
  type Link,
  type LinkPresentation,
  type Subgraph,
  type SubgraphPresentation,
  separateLinkPresentation,
  separateSubgraphPresentation,
  type TopologyLink,
  type TopologySubgraph,
} from '@shumoku/core'

export interface LinkRow {
  projectId: string
  id: string
  data: TopologyLink
  presentation?: LinkPresentation
}
export interface SubgraphRow {
  projectId: string
  id: string
  data: TopologySubgraph
  presentation?: SubgraphPresentation
}

export function encodeLinkRow(projectId: string, id: string, link: Link): LinkRow {
  if (id !== link.id) throw new Error('Link row ID does not match link')
  const parts = separateLinkPresentation(link)
  return {
    projectId,
    id,
    data: parts.link,
    ...(parts.presentation ? { presentation: parts.presentation } : {}),
  }
}
export function decodeLinkRow(row: LinkRow): Link {
  if (row.id !== row.data.id) throw new Error('Link row ID does not match link')
  return combineLinkPresentation(row.data, row.presentation)
}
export function encodeSubgraphRow(projectId: string, id: string, subgraph: Subgraph): SubgraphRow {
  if (id !== subgraph.id) throw new Error('Subgraph row ID does not match subgraph')
  const parts = separateSubgraphPresentation(subgraph)
  return {
    projectId,
    id,
    data: parts.subgraph,
    ...(parts.presentation ? { presentation: parts.presentation } : {}),
  }
}
export function decodeSubgraphRow(row: SubgraphRow): Subgraph {
  if (row.id !== row.data.id) throw new Error('Subgraph row ID does not match subgraph')
  return combineSubgraphPresentation(row.data, row.presentation)
}

// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

import {
  combineNodePresentation,
  type Node,
  type NodePresentation,
  separateNodePresentation,
  type TopologyNode,
} from '@shumoku/core'

/** Facts and diagram geometry/appearance commit atomically in distinct row payloads. */
export interface NodeRow {
  projectId: string
  id: string
  data: TopologyNode
  presentation?: NodePresentation
}

/** Input is already asset-serialized, so no Svelte proxies or blob URLs are stored. */
export function encodeNodeRow(projectId: string, id: string, node: Node): NodeRow {
  if (id !== node.id) throw new Error('Node row ID does not match node')
  const separated = separateNodePresentation(node)
  return {
    projectId,
    id,
    data: separated.node,
    ...(separated.presentation ? { presentation: separated.presentation } : {}),
  }
}

export function decodeNodeRow(row: NodeRow): Node {
  if (row.id !== row.data.id) throw new Error('Node row ID does not match node')
  return combineNodePresentation(row.data, row.presentation)
}

// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

import {
  combineNodeGeometry,
  type Node,
  type NodeGeometry,
  separateNodeGeometry,
  type TopologyNode,
} from '@shumoku/core'

/** Facts and diagram geometry commit atomically in one row, in distinct payloads. */
export interface NodeRow {
  projectId: string
  id: string
  data: TopologyNode
  presentation?: NodeGeometry
}

/** Input is already asset-serialized, so no Svelte proxies or blob URLs are stored. */
export function encodeNodeRow(projectId: string, id: string, node: Node): NodeRow {
  if (id !== node.id) throw new Error('Node row ID does not match node')
  const separated = separateNodeGeometry(node)
  return {
    projectId,
    id,
    data: separated.node,
    ...(separated.geometry ? { presentation: separated.geometry } : {}),
  }
}

export function decodeNodeRow(row: NodeRow): Node {
  if (row.id !== row.data.id) throw new Error('Node row ID does not match node')
  return combineNodeGeometry(row.data, row.presentation)
}

// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * The lengths the drawing layout works with, taken from the kit: the size of each card, bus and
 * cloud as the kit measures it, and the spaces from the base quantities. The layout names no
 * length of its own.
 */

import {
  DeviceType,
  type DrawingMetrics,
  type inputModel,
  type Node,
  toNetworkGraph,
} from '@shumoku/core'
import { groupInsets, type Kit, nodeSize } from './measure'

export function drawingMetrics(kit: Kit, network: inputModel.Network): DrawingMetrics {
  const graph = toNetworkGraph({ config: network })
  const nodes = new Map(graph.nodes.map((n) => [n.id, n]))
  const groups = new Map((graph.subgraphs ?? []).map((g) => [g.id, g]))
  const { space, hull, card, port } = kit.tokens
  const missing = { width: card.minWidth, height: card.minHeight }
  const cloudNode = (id: string): Node => ({
    id,
    label: network.routingDomains?.find((d) => d.id === id)?.label ?? id,
    spec: { kind: 'hardware', type: DeviceType.Cloud },
  })
  return {
    card: (id) => {
      const node = nodes.get(id)
      return node ? nodeSize(node, kit) : missing
    },
    // A bus is as wide as its lines need to leave it side by side.
    bus: (id, lines) => {
      const node = nodes.get(id)
      const size = node ? nodeSize(node, kit) : missing
      return { width: Math.max(size.width, lines * port.minSlot), height: size.height }
    },
    cloud: (id) => nodeSize(cloudNode(id), kit),
    group: (id) => groupInsets(groups.get(id) ?? { id, label: id }, kit.tokens),
    gap: space.gap,
    memberGap: space.memberGap,
    groupGap: space.groupGap,
    hullPad: hull.pad,
    pitch: space.pitch,
    leadOut: space.leadOut,
  }
}

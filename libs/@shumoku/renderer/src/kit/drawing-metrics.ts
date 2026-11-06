// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * The lengths the drawing layout works with, taken from the kit: the size of each card, bus and
 * cloud as the kit measures it, and the spaces from the base quantities. The layout names no
 * length of its own.
 */

import {
  containedGuests,
  DeviceType,
  type DrawingMetrics,
  drawnInPlace,
  type NetworkModel,
  type Node,
  toNetworkGraph,
} from '@shumoku/core'
import { groupInsets } from './group-look.js'
import { type Kit, nodeSize, portLabelSize, portSlot } from './measure.js'
import { lineWidth, medianWireWidth } from './wire-width.js'

/** A wide screen: the drawing is made no wider than this, a ratio of width to height. */
const TARGET_ASPECT = 16 / 9

export function drawingMetrics(kit: Kit, model: NetworkModel): DrawingMetrics {
  const network = model.config
  const graph = toNetworkGraph(model)
  // A node drawn inside what it runs on is measured as its card is drawn there (see core's hosting).
  const contained = containedGuests(network)
  const nodes = new Map(graph.nodes.map((n) => [n.id, contained.has(n.id) ? drawnInPlace(n) : n]))
  const groups = new Map((graph.subgraphs ?? []).map((g) => [g.id, g]))
  const { space, hull, card, port } = kit.tokens
  const unnamed = medianWireWidth(graph.links, kit)
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
    line: (link) => lineWidth(link, kit, unnamed),
    stroke: kit.tokens.stroke,
    gapApart: space.apart,
    leadOut: space.leadOut,
    portSlot: (labels) =>
      portSlot(
        Math.max(0, ...labels.map((label) => portLabelSize(label, kit)?.width ?? 0)),
        kit.tokens,
      ),
    aspect: TARGET_ASPECT,
  }
}

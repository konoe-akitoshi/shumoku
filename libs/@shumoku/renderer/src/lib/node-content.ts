// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import {
  DIAGRAM_CARD,
  type Node,
  nodeBadgeWidth,
  nodeContentMetrics,
  nodeContentScale,
  nodePresentation,
  resolveIcon,
} from '@shumoku/core'

/** One geometry for Svelte and static SVG, including nodes enlarged to accommodate ports. */
export function nodeContent(node: Node, size: { width: number; height: number }) {
  const presentation = nodePresentation(node)
  const icon = resolveIcon(node.spec)
  const metrics = nodeContentMetrics(presentation, !!icon)
  const cx = node.position?.x ?? 0
  const cy = node.position?.y ?? 0
  const contentWidth = size.width * nodeContentScale(node.shape).x
  const left = cx - contentWidth / 2 + DIAGRAM_CARD.padding
  const top = cy - metrics.height / 2
  const headerX = left + (icon ? DIAGRAM_CARD.iconSize + DIAGRAM_CARD.iconGap : 0)
  const textHeight =
    (presentation.labels.length + (presentation.subtitle ? 1 : 0)) * DIAGRAM_CARD.rowHeight
  const labelY = top + (metrics.headerHeight - textHeight) / 2 + 12
  const right = cx + contentWidth / 2 - DIAGRAM_CARD.padding
  return {
    ...presentation,
    icon,
    iconSize: DIAGRAM_CARD.iconSize,
    iconX: left,
    iconY: top + (metrics.headerHeight - DIAGRAM_CARD.iconSize) / 2,
    left,
    right,
    badgeWidth: nodeBadgeWidth(presentation.badge),
    badgeX: right - nodeBadgeWidth(presentation.badge),
    badgeY: labelY - 12,
    headerX,
    labelY,
    dividerY: top + metrics.headerHeight + DIAGRAM_CARD.sectionGap / 2,
    rowY: top + metrics.headerHeight + DIAGRAM_CARD.sectionGap + 12,
    rowHeight: DIAGRAM_CARD.rowHeight,
  }
}

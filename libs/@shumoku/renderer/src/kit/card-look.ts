// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * What a card looks like: the one place that turns a node's meaning into a spec. The component
 * draws the spec as it is and decides nothing. Everything inside the box is placed here: the
 * content is one block, left-aligned inside so rows read as a table; a box wider than the block
 * (for its ports, or the minimum width) centres it, so the name sits over the middle of the box
 * where the wires meet it. Lines are given by the height of their middle; the text adds its own
 * baseline shift.
 */

import { type Node, resolveIcon, specDeviceType } from '@shumoku/core'
import { sanitizeInlineIcon } from '../lib/sanitize-icon.js'
import type { KitColors } from './colors.js'
import { type LabelRole, nodeContent } from './content.js'
import { cardMetrics, contentWidth, type Kit } from './measure.js'
import { type Part, shapeOf } from './node-shape.js'
import type { Box } from './scene.js'
import { dashOf } from './tokens.js'

/** A text at a place; `shift` is already in `y`. */
export interface Placed {
  text: string
  x: number
  y: number
}

export interface CardLook {
  id: string
  title: string
  deviceType: string
  /** The outline, each part with the attributes it is drawn with. */
  frame: { parts: { tag: Part['tag']; attrs: Record<string, number | string> }[]; dash?: string }
  icon?: {
    x: number
    y: number
    size: number
    label: string
    source: { kind: 'inline'; svg: string } | { kind: 'image'; url: string }
  }
  labels: (Placed & { className: string })[]
  badge?: {
    text: string
    label: string
    box: { x: number; y: number; width: number; height: number; rx: number }
    textX: number
    textY: number
    fill: string
    fillOpacity: number
    stroke: string
    strokeOpacity: number
    strokeWidth: number
  }
  subtitle?: Placed
  /** The divider and the rows beneath the header. */
  facts?: {
    divider: { x1: number; x2: number; y: number; stroke: string; opacity: number; width: number }
    rows: { key: Placed; value: Placed }[]
    more?: Placed
  }
}

const LABEL_CLASS: Record<LabelRole, string> = {
  title: 'node-label',
  strong: 'node-label node-label-bold',
  secondary: 'node-label-secondary',
}

export function cardLook(node: Node, box: Box, kit: Kit, colors: KitColors): CardLook {
  const { tokens } = kit
  const { card } = tokens
  const content = nodeContent(node, kit)
  const icon = resolveIcon(node.spec)
  const metrics = cardMetrics(content, !!icon, tokens)
  const shape = shapeOf(node.shape)

  const cx = box.x + box.width / 2
  const cy = box.y + box.height / 2
  const block = Math.min(
    box.width * shape.inner.x - card.padding * 2,
    contentWidth(content, !!icon, kit),
  )
  const left = cx - block / 2
  const right = cx + block / 2
  const top = cy - metrics.height / 2
  const textHeight = (content.labels.length + (content.subtitle ? 1 : 0)) * card.rowHeight
  const labelCentre = top + (metrics.headerHeight - textHeight) / 2 + card.rowHeight / 2
  const headerX = left + (icon ? card.iconSize + card.iconGap : 0)
  const rowCentre = top + metrics.headerHeight + card.sectionGap + card.rowHeight / 2
  const row = (i: number) => rowCentre + i * card.rowHeight + tokens.text.nodeText.shift

  // The frame: what the user wrote, else the theme's. An assumed card is dashed by its own rule.
  const fill = node.style?.fill ?? colors.card.fill
  const stroke = node.style?.stroke ?? colors.card.stroke
  const strokeWidth = node.style?.strokeWidth ?? tokens.line.base
  const dash =
    node.style?.strokeDasharray ||
    (content.assumed ? dashOf(card.assumedDash, strokeWidth).join(' ') : undefined)
  const paint = {
    body: { fill, stroke, 'stroke-width': strokeWidth },
    fill: { fill, stroke: 'none' },
    edge: { stroke, 'stroke-width': strokeWidth },
  }
  const parts = shape
    .outline(box, card.cornerRadius)
    .map((part) => ({ tag: part.tag, attrs: { ...part.geometry, ...paint[part.paint] } }))

  const badgeWidth = content.badge
    ? kit.text.width(content.badge, 'badge') + card.badgePadding * 2
    : 0
  const badgeX = right - badgeWidth

  return {
    id: node.id,
    title: content.title,
    deviceType: specDeviceType(node.spec) ?? '',
    frame: { parts, ...(dash && { dash }) },
    ...(icon && {
      icon: {
        x: left,
        y: top + (metrics.headerHeight - card.iconSize) / 2,
        size: card.iconSize,
        label: specDeviceType(node.spec) ?? 'icon',
        source:
          icon.kind === 'inline'
            ? { kind: 'inline' as const, svg: sanitizeInlineIcon(icon.svg) }
            : { kind: 'image' as const, url: icon.url },
      },
    }),
    labels: content.labels.map((line, i) => ({
      text: line.text,
      x: headerX,
      y: labelCentre + i * card.rowHeight + tokens.text.nodeTitle.shift,
      className: LABEL_CLASS[line.role],
    })),
    ...(content.badge && {
      badge: {
        text: content.badge,
        label: content.badge === 'VM' ? 'Virtual machine' : content.badge,
        box: {
          x: badgeX,
          y: labelCentre - card.badgeHeight / 2,
          width: badgeWidth,
          height: card.badgeHeight,
          rx: card.badgeRadius,
        },
        textX: badgeX + badgeWidth / 2,
        textY: labelCentre + tokens.text.badge.shift,
        fill: colors.card.textSecondary,
        fillOpacity: tokens.opacity.wash,
        stroke: colors.card.stroke,
        strokeOpacity: tokens.quiet.opacity,
        strokeWidth: tokens.line.hair,
      },
    }),
    ...(content.subtitle && {
      subtitle: {
        text: content.subtitle,
        x: headerX,
        y: labelCentre + content.labels.length * card.rowHeight + tokens.text.nodeText.shift,
      },
    }),
    ...((content.rows.length > 0 || content.more) && {
      facts: {
        divider: {
          x1: left,
          x2: right,
          y: top + metrics.headerHeight + card.sectionGap / 2,
          stroke: colors.card.stroke,
          opacity: tokens.quiet.opacity,
          width: tokens.quiet.width,
        },
        rows: content.rows.map((r, i) => ({
          key: { text: r.label, x: left, y: row(i) },
          value: { text: r.value, x: right, y: row(i) },
        })),
        ...(content.more && {
          more: { text: content.more, x: left, y: row(content.rows.length) },
        }),
      },
    }),
  }
}

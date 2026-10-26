// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * The intrinsic size of each part, with no layout in sight. A part's size follows from its
 * content and its text only; where the part goes is the layout's business.
 */

import {
  type Link,
  labelText,
  linkPresentationLines,
  type Node,
  nodeBadgeWidth,
  nodeContentMetrics,
  nodeContentScale,
  nodePresentation,
  resolveIcon,
  type Subgraph,
} from '@shumoku/core'
import { CAPTION, CARD, GROUP, PORT, TEXT, type TextRole } from './tokens'

export interface Size {
  width: number
  height: number
}

/** Width of a text in the font a role is drawn with. */
export interface TextMetrics {
  width(text: string, role: TextRole): number
}

/** East Asian wide and full-width characters take a whole em. */
const WIDE = /[ᄀ-ᅟ⺀-꓏가-힣豈-﫿︰-﹯＀-｠￠-￦]/

/**
 * A deterministic estimate: the same number in Node and in the browser. A canvas-based
 * measurer can stand in for it wherever the real font is known.
 */
export const estimateText: TextMetrics = {
  width(text, role) {
    const { fontSize, asciiWidth } = TEXT[role]
    let total = 0
    for (const char of text) total += WIDE.test(char) ? fontSize : asciiWidth
    return total
  },
}

/**
 * Width of what a node shows (header and rows), without padding or the floor. A box drawn
 * wider, for its ports or the floor, centres a block of this width.
 */
export function nodeContentWidth(node: Node, text: TextMetrics): number {
  const presentation = nodePresentation(node)
  const iconLane = resolveIcon(node.spec) ? CARD.iconSize + CARD.iconGap : 0
  const headerWidth =
    Math.max(
      ...presentation.labels.map(
        (line, i) =>
          text.width(labelText(line), 'nodeTitle') +
          (i === 0 && presentation.badge ? nodeBadgeWidth(presentation.badge) + CARD.badgeGap : 0),
      ),
      text.width(presentation.subtitle, 'nodeText'),
    ) + iconLane
  const keyWidth = Math.max(0, ...presentation.rows.map((r) => text.width(r.label, 'nodeText')))
  const valueWidth = Math.max(0, ...presentation.rows.map((r) => text.width(r.value, 'nodeText')))
  const footerWidth = Math.max(
    keyWidth + (keyWidth ? CARD.factGap : 0) + valueWidth,
    presentation.hidden ? text.width(`+${presentation.hidden} more`, 'nodeText') : 0,
  )
  return Math.max(headerWidth, footerWidth)
}

/** The card's intrinsic size: icon, title, badge and rows, with no room for ports. */
export function nodeSize(node: Node, text: TextMetrics): Size {
  const metrics = nodeContentMetrics(nodePresentation(node), !!resolveIcon(node.spec))
  const scale = nodeContentScale(node.shape)
  const width = Math.max(CARD.minWidth, nodeContentWidth(node, text) + CARD.padding * 2) / scale.x
  const height = Math.max(CARD.minHeight, metrics.height + CARD.padding * 2) / scale.y
  return node.shape === 'circle'
    ? { width: Math.max(width, height), height: Math.max(width, height) }
    : { width, height }
}

/** The label of a port as a box; `undefined` for a port with no label. */
export function portLabelSize(label: string | undefined, text: TextMetrics): Size | undefined {
  const trimmed = (label ?? '').trim()
  if (!trimmed) return undefined
  return { width: text.width(trimmed, 'portLabel') + PORT.labelPadding, height: PORT.labelHeight }
}

/**
 * Centre-to-centre spacing one port needs along its side, given the widest label there. How
 * many ports a node carries, and so how far it grows for them, is the layout's to decide.
 */
export function portSlot(widestLabel: number): number {
  return Math.max(PORT.minSlot, widestLabel + PORT.labelGap)
}

/** A group frame's insets around its contents: the label band sits above, padding elsewhere. */
export function groupInsets(group: Subgraph) {
  const padding = group.style?.padding ?? GROUP.padding
  return { top: GROUP.labelBand, right: padding, bottom: padding, left: padding }
}

/** Narrowest a group may be so that its label fits. */
export function groupMinWidth(group: Subgraph, text: TextMetrics): number {
  return text.width(group.label, 'groupLabel') + GROUP.labelX * 2
}

/** The caption's text lines for a link; none when the link has nothing to say. */
export function captionLines(link: Link): string[] {
  return linkPresentationLines(link)
}

/** The caption box for a link, or `undefined` when it has no lines. */
export function captionSize(link: Link, text: TextMetrics): Size | undefined {
  const lines = captionLines(link)
  if (lines.length === 0) return undefined
  return {
    width: Math.max(...lines.map((line) => text.width(line, 'linkCaption'))) + CAPTION.paddingX * 2,
    height: lines.length * CAPTION.lineHeight + CAPTION.paddingY * 2,
  }
}

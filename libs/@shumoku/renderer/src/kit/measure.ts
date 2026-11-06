// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * The intrinsic size of each part, with no layout in sight. A part's size follows from its
 * content, its text and the base quantities only; where the part goes is the layout's business.
 */

import { type Link, type Node, resolveIcon } from '@shumoku/core'
import { captionContent, type NodeContent, nodeContent } from './content.js'
import { shapeOf } from './node-shape.js'
import { type Base, resolveTokens, type TextRole, type Tokens } from './tokens.js'

export interface Size {
  width: number
  height: number
}

/** Width of a text in the font a role is drawn with. */
export interface TextMetrics {
  width(text: string, role: TextRole): number
}

/** What every measure needs: the sizes, and a way to measure text in them. */
export interface Kit {
  tokens: Tokens
  text: TextMetrics
}

/** East Asian wide and full-width characters take a whole em. */
const WIDE = /[ᄀ-ᅟ⺀-꓏가-힣豈-﫿︰-﹯＀-｠￠-￦]/

/**
 * A deterministic estimate: the same number in Node and in the browser. A canvas-based
 * measurer can stand in for it wherever the real font is known.
 */
function estimateText(tokens: Tokens): TextMetrics {
  return {
    width(text, role) {
      const { fontSize } = tokens.text[role]
      let total = 0
      for (const char of text) {
        total += fontSize * (WIDE.test(char) ? tokens.glyph.wide : tokens.glyph.ascii)
      }
      return total
    },
  }
}

/** The kit for a base, measuring text by estimate unless a measurer is given. */
export function createKit(base?: Partial<Base>, text?: TextMetrics): Kit {
  const tokens = resolveTokens(base)
  return { tokens, text: text ?? estimateText(tokens) }
}

/** Width of a node's badge: its text and the padding on both sides. */
export function badgeWidth(badge: string, kit: Kit): number {
  return badge ? kit.text.width(badge, 'badge') + kit.tokens.card.badgePadding * 2 : 0
}

/** Heights of a card's header (icon, title lines) and of its fact rows beneath. */
export function cardMetrics(content: NodeContent, hasIcon: boolean, { card }: Tokens) {
  const headerHeight = Math.max(
    hasIcon ? card.iconSize : 0,
    (content.labels.length + (content.subtitle ? 1 : 0)) * card.rowHeight,
  )
  const footerHeight = (content.rows.length + (content.more ? 1 : 0)) * card.rowHeight
  return {
    headerHeight,
    footerHeight,
    height: headerHeight + (footerHeight ? card.sectionGap + footerHeight : 0),
  }
}

/**
 * Width of what a node shows (header and rows), without padding or the floor. A box drawn
 * wider, for its ports or the floor, centres a block of this width.
 */
export function contentWidth(presentation: NodeContent, hasIcon: boolean, kit: Kit): number {
  const { text, tokens } = kit
  const iconLane = hasIcon ? tokens.card.iconSize + tokens.card.iconGap : 0
  const headerWidth =
    Math.max(
      ...presentation.labels.map(
        (line, i) =>
          text.width(line.text, 'nodeTitle') +
          (i === 0 && presentation.badge
            ? badgeWidth(presentation.badge, kit) + tokens.card.badgeGap
            : 0),
      ),
      text.width(presentation.subtitle, 'nodeText'),
    ) + iconLane
  const keyWidth = Math.max(0, ...presentation.rows.map((r) => text.width(r.label, 'nodeText')))
  const valueWidth = Math.max(0, ...presentation.rows.map((r) => text.width(r.value, 'nodeText')))
  const footerWidth = Math.max(
    keyWidth + (keyWidth ? tokens.card.factGap : 0) + valueWidth,
    presentation.more ? text.width(presentation.more, 'nodeText') : 0,
  )
  return Math.max(headerWidth, footerWidth)
}

/** The card's intrinsic size: icon, title, badge and rows, with no room for ports. */
export function nodeSize(node: Node, kit: Kit): Size {
  const { card } = kit.tokens
  const content = nodeContent(node, kit)
  const hasIcon = !!resolveIcon(node.spec)
  const metrics = cardMetrics(content, hasIcon, kit.tokens)
  const shape = shapeOf(node.shape)
  const width =
    Math.max(card.minWidth, contentWidth(content, hasIcon, kit) + card.padding * 2) / shape.inner.x
  const height = Math.max(card.minHeight, metrics.height + card.padding * 2) / shape.inner.y
  return shape.square
    ? { width: Math.max(width, height), height: Math.max(width, height) }
    : { width, height }
}

/** The label of a port as a box; `undefined` for a port with no label. */
export function portLabelSize(label: string | undefined, kit: Kit): Size | undefined {
  const trimmed = (label ?? '').trim()
  if (!trimmed) return undefined
  const { port } = kit.tokens
  return {
    width: kit.text.width(trimmed, 'portLabel') + port.labelPadding,
    height: port.labelHeight,
  }
}

/**
 * Centre-to-centre spacing one port needs along its side, given the widest label there. How
 * many ports a node carries, and so how far it grows for them, is the layout's to decide.
 */
export function portSlot(widestLabel: number, { port }: Tokens): number {
  return Math.max(port.minSlot, widestLabel + port.labelGap)
}

/** The caption box for a link, or `undefined` when it has no lines. */
export function captionSize(link: Link, kit: Kit): Size | undefined {
  const lines = captionContent(link, kit)
  if (lines.length === 0) return undefined
  const { caption } = kit.tokens
  return {
    width:
      Math.max(...lines.map((line) => kit.text.width(line, 'linkCaption'))) + caption.paddingX * 2,
    height: lines.length * caption.lineHeight + caption.paddingY * 2,
  }
}

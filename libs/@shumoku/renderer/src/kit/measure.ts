// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * The intrinsic size of each part, with no layout in sight. A part's size follows from its
 * content, its text and the base quantities only; where the part goes is the layout's business.
 */

import {
  type DrawingPlatformLayout,
  type Link,
  labelText,
  linkPresentationLines,
  type Node,
  nodeContentScale,
  nodePresentation,
  resolveIcon,
  type Subgraph,
  specDeviceType,
} from '@shumoku/core'
import { type Base, resolveTokens, type TextRole, type Tokens } from './tokens'

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
export function estimateText(tokens: Tokens): TextMetrics {
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
export function cardMetrics(
  presentation: ReturnType<typeof nodePresentation>,
  hasIcon: boolean,
  { card }: Tokens,
) {
  const headerHeight = Math.max(
    hasIcon ? card.iconSize : 0,
    (presentation.labels.length + (presentation.subtitle ? 1 : 0)) * card.rowHeight,
  )
  const footerHeight = (presentation.rows.length + (presentation.hidden ? 1 : 0)) * card.rowHeight
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
export function nodeContentWidth(node: Node, kit: Kit): number {
  const { text, tokens } = kit
  const presentation = nodePresentation(node)
  const iconLane = resolveIcon(node.spec) ? tokens.card.iconSize + tokens.card.iconGap : 0
  const headerWidth =
    Math.max(
      ...presentation.labels.map(
        (line, i) =>
          text.width(labelText(line), 'nodeTitle') +
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
    presentation.hidden ? text.width(`+${presentation.hidden} more`, 'nodeText') : 0,
  )
  return Math.max(headerWidth, footerWidth)
}

/** The card's intrinsic size: icon, title, badge and rows, with no room for ports. */
export function nodeSize(node: Node, kit: Kit): Size {
  const { card } = kit.tokens
  const metrics = cardMetrics(nodePresentation(node), !!resolveIcon(node.spec), kit.tokens)
  const scale = nodeContentScale(node.shape)
  const width = Math.max(card.minWidth, nodeContentWidth(node, kit) + card.padding * 2) / scale.x
  const height = Math.max(card.minHeight, metrics.height + card.padding * 2) / scale.y
  return node.shape === 'circle'
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

/** A group frame's insets around its contents: the label band sits above, padding elsewhere. */
export function groupInsets(group: Subgraph, { group: frame }: Tokens) {
  const padding = group.style?.padding ?? frame.padding
  return { top: frame.labelBand, right: padding, bottom: padding, left: padding }
}

/** Narrowest a group may be so that its label fits. */
export function groupMinWidth(group: Subgraph, kit: Kit): number {
  return kit.text.width(group.label, 'groupLabel') + kit.tokens.group.labelX * 2
}

/** The caption's text lines for a link; none when the link has nothing to say. */
export function captionLines(link: Link): string[] {
  return linkPresentationLines(link)
}

/** The caption box for a link, or `undefined` when it has no lines. */
export function captionSize(link: Link, kit: Kit): Size | undefined {
  const lines = captionLines(link)
  if (lines.length === 0) return undefined
  const { caption } = kit.tokens
  return {
    width:
      Math.max(...lines.map((line) => kit.text.width(line, 'linkCaption'))) + caption.paddingX * 2,
    height: lines.length * caption.lineHeight + caption.paddingY * 2,
  }
}

/** A workload's line in a platform: its name, and the software it runs or else its type. */
export interface WorkloadRow {
  name: string
  detail: string
}

/** What a platform lists: the rows shown, and how many workloads (or kinds) are left out. */
export function platformRows(
  workloads: readonly Node[],
  { shown, compact }: { shown: number; compact: boolean },
): { rows: WorkloadRow[]; more: number } {
  const row = (node: Node): WorkloadRow => {
    const software = node.annotations?.find((a) => a.label === 'Software')?.value
    return {
      name: labelText(nodePresentation(node).labels[0] ?? node.id),
      detail: software ?? specDeviceType(node.spec) ?? '',
    }
  }
  const kinds = new Map<string, number>()
  for (const r of workloads.map(row))
    kinds.set(r.detail || r.name, (kinds.get(r.detail || r.name) ?? 0) + 1)
  const all: WorkloadRow[] = compact
    ? [...kinds].map(([name, count]) => ({ name, detail: `x${count}` }))
    : workloads.map(row)
  return { rows: all.slice(0, shown), more: Math.max(0, all.length - shown) }
}

/** Where a platform's chips start, from the frame's top. */
export function platformChipsTop({ platform: p }: Tokens): number {
  return p.pad + p.labelHeight + p.sectionGap
}

/** Where a platform's list starts, from the frame's top. */
export function platformListTop(chipRow: boolean, tokens: Tokens): number {
  const { platform: p } = tokens
  return (chipRow ? platformChipsTop(tokens) + p.chipHeight : p.pad + p.labelHeight) + p.sectionGap
}

/** How a platform is listed. */
export interface PlatformOptions {
  /** Count the workloads per kind instead of listing each. */
  compact?: boolean
}

/**
 * A platform's size and where its chips go. The frame holds its label, a row of chips (the
 * hosts, by name) and the list of what runs on them, each as wide as its text needs; a lone host
 * has no chips, the frame is the host. The list stops at the limit and counts the rest.
 */
export function platformLayout(
  label: string,
  kind: string | undefined,
  hosts: readonly Node[],
  workloads: readonly Node[],
  kit: Kit,
  options: PlatformOptions = {},
): DrawingPlatformLayout {
  const { text, tokens } = kit
  const { platform: p } = tokens
  const compact = options.compact === true
  const chipRow = hosts.length > 1
  const chipWidths = hosts.map(
    (h) => text.width(labelText(nodePresentation(h).labels[0] ?? h.id), 'chip') + p.chipPadding * 2,
  )
  const chipsWidth = chipWidths.reduce((sum, w) => sum + w + p.chipGap, -p.chipGap)
  const kindWidth = kind ? text.width(kind.toUpperCase(), 'hullLabel') + p.columnGap : 0
  const headerWidth = text.width(label, 'platformLabel') + kindWidth

  // The list: names in one column, details in the next.
  const total = platformRows(workloads, { shown: Number.POSITIVE_INFINITY, compact }).rows.length
  const shown = Math.min(total, p.rowLimit)
  const { rows, more } = platformRows(workloads, { shown, compact })
  const nameWidth = Math.max(0, ...rows.map((r) => text.width(r.name, 'workloadName')))
  const detailWidth = Math.max(0, ...rows.map((r) => text.width(r.detail, 'workloadDetail')))
  const listWidth = Math.max(
    nameWidth + (detailWidth ? p.columnGap + detailWidth : 0),
    more > 0 ? text.width(`+${more} more`, 'workloadName') : 0,
  )

  const width = Math.max(headerWidth, chipRow ? chipsWidth : 0, listWidth) + p.pad * 2
  const lines = rows.length + (more > 0 ? 1 : 0)
  const chipsAt = platformChipsTop(tokens)
  const height =
    (lines > 0
      ? platformListTop(chipRow, tokens) + lines * p.rowHeight
      : platformListTop(chipRow, tokens) - p.sectionGap) + p.pad

  // The chips are centred in the width the frame ends up with.
  let x = (width - chipsWidth) / 2
  const chips = chipRow
    ? chipWidths.map((w) => {
        const chip = { x, y: chipsAt, width: w, height: p.chipHeight }
        x += w + p.chipGap
        return chip
      })
    : hosts.map(() => ({ x: 0, y: 0, width, height }))
  return { size: { width, height }, chips, chipRow, shown, compact }
}

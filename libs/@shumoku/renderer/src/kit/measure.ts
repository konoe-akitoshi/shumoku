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

/** How a platform's workloads are drawn. */
export interface PlatformOptions {
  /** `count` tallies them on the card (the physical view); `nested` draws each inside a frame. */
  workloads?: 'count' | 'nested'
  /** How many lines end at the platform: it is wide enough for a port named by host for each. */
  lines?: number
}

const hostName = (host: Node): string => labelText(nodePresentation(host).labels[0] ?? host.id)

/** The host names a nested frame writes under its title; none for a lone host. */
export function platformHosts(hosts: readonly Node[]): string {
  return hosts.length > 1 ? hosts.map(hostName).join(', ') : ''
}

/** How many outlines stand behind a platform's card: none for a lone host. */
export function platformStack(hostCount: number, { platform }: Tokens): number {
  return Math.min(Math.max(0, hostCount - 1), platform.stack)
}

/**
 * The node a platform's card is drawn as: the platform's label with the icon of its first host,
 * a `×N` badge when there are several hosts, and a row for each kind of node that runs on them
 * with how many there are. Past the row limit the rest are counted together.
 */
export function platformNode(
  label: string,
  hosts: readonly Node[],
  workloads: readonly Node[],
  { platform }: Tokens,
): Node {
  const type = specDeviceType(hosts[0]?.spec)
  const counts = new Map<string, number>()
  for (const w of workloads) {
    const kind = w.spec?.kind === 'compute' ? 'VM' : (specDeviceType(w.spec) ?? 'node')
    counts.set(kind, (counts.get(kind) ?? 0) + 1)
  }
  const kinds = [...counts]
  const rows =
    kinds.length > platform.rows
      ? [
          ...kinds.slice(0, platform.rows - 1),
          [
            'other',
            kinds.slice(platform.rows - 1).reduce((sum, [, count]) => sum + count, 0),
          ] as const,
        ]
      : kinds
  return {
    id: label,
    label,
    ...(type === undefined ? {} : { spec: { kind: 'hardware' as const, type } }),
    annotations: [
      ...(hosts.length > 1
        ? [{ kind: 'badge' as const, label: 'hosts', value: `×${hosts.length}` }]
        : []),
      ...rows.map(([kind, count]) => ({
        kind: 'note' as const,
        label: kind,
        value: String(count),
      })),
    ],
  }
}

/** The size a node's card is drawn at inside a nested frame: its own, scaled down. */
export function nestedSize(node: Node, kit: Kit): Size {
  const { width, height } = nodeSize(node, kit)
  const { nestedScale } = kit.tokens.platform
  return { width: width * nestedScale, height: height * nestedScale }
}

/**
 * A platform's size and where things go. Counted (the default), it is a card of the size any
 * node card has, with outlines stacked behind it when there are several hosts. Nested, it is a
 * frame with its label and host names above the nodes that run on the hosts, as small cards in
 * columns.
 */
export function platformLayout(
  label: string,
  hosts: readonly Node[],
  workloads: readonly Node[],
  kit: Kit,
  options: PlatformOptions = {},
): DrawingPlatformLayout {
  const { text, tokens } = kit
  const { platform: p } = tokens
  // A card of several hosts has a port named by host for each line that ends at it.
  const named = Math.max(0, ...hosts.map((h) => portLabelSize(hostName(h), kit)?.width ?? 0))
  const portsWidth = hosts.length > 1 ? (options.lines ?? 0) * portSlot(named, tokens) : 0
  if (options.workloads !== 'nested') {
    const base = nodeSize(platformNode(label, hosts, workloads, tokens), kit)
    const card = { width: Math.max(base.width, portsWidth), height: base.height }
    const count = platformStack(hosts.length, tokens)
    const reach = count * p.stackOffset
    return {
      size: { width: card.width + reach, height: card.height + reach },
      card: { x: 0, y: reach, ...card },
      stack: Array.from({ length: count }, (_, i) => ({
        x: (count - i) * p.stackOffset,
        y: i * p.stackOffset,
        ...card,
      })),
      nested: [],
    }
  }
  const sizes = workloads.map((w) => nestedSize(w, kit))
  const columns = Math.max(1, Math.min(p.columns, sizes.length))
  const cell = Math.max(0, ...sizes.map((s) => s.width))
  const gridWidth = columns * cell + (columns - 1) * p.cardGap
  const hostLine = platformHosts(hosts)
  const header =
    p.pad + p.labelHeight + (hostLine ? p.labelHeight : 0) + (sizes.length > 0 ? p.sectionGap : 0)
  const width =
    Math.max(
      text.width(label, 'platformLabel'),
      hostLine ? text.width(hostLine, 'nodeText') : 0,
      gridWidth,
      portsWidth,
    ) +
    p.pad * 2
  const rowHeights: number[] = []
  for (const [i, size] of sizes.entries()) {
    const row = Math.floor(i / columns)
    rowHeights[row] = Math.max(rowHeights[row] ?? 0, size.height)
  }
  const rowTops = rowHeights.map((_, row) =>
    rowHeights.slice(0, row).reduce((sum, h) => sum + h + p.cardGap, header),
  )
  const nested = sizes.map((size, i) => ({
    x: (width - gridWidth) / 2 + (i % columns) * (cell + p.cardGap) + (cell - size.width) / 2,
    y: rowTops[Math.floor(i / columns)] ?? header,
    ...size,
  }))
  const height =
    header +
    rowHeights.reduce((sum, h) => sum + h, 0) +
    Math.max(0, rowHeights.length - 1) * p.cardGap +
    p.pad
  return { size: { width, height }, card: { x: 0, y: 0, width, height }, stack: [], nested }
}

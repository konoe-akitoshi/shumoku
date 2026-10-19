// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import type { DiagramAnnotation, Link, Node, NodeShape } from './types.js'

/** Shared by layout, static export and the interactive renderer. */
export const DIAGRAM_CARD = {
  padding: 16,
  iconSize: 28,
  iconGap: 12,
  rowHeight: 16,
  sectionGap: 12,
}
export const LINK_LABEL = { lineHeight: 14, paddingX: 8, paddingY: 5, charWidth: 6.6 }

export function nodeBadgeWidth(badge: string): number {
  return badge ? badge.length * 5.5 + 12 : 0
}

/** The safe central rectangle inside each nonrectangular outline. */
export function nodeContentScale(shape?: NodeShape): { x: number; y: number } {
  switch (shape) {
    case 'circle':
      return { x: Math.SQRT1_2, y: Math.SQRT1_2 }
    case 'diamond':
      return { x: 0.5, y: 0.5 }
    case 'hexagon':
      return { x: 0.75, y: 0.85 }
    case 'cylinder':
      return { x: 0.9, y: 0.7 }
    case 'stadium':
      return { x: 0.65, y: 0.8 }
    case 'trapezoid':
      return { x: 0.7, y: 0.85 }
    default:
      return { x: 1, y: 1 }
  }
}

/** A label line as drawn: the bold and line-break markup a label may carry is not text. */
export function labelText(line: string): string {
  return line.replace(/<\/?b>|<\/?strong>|<br\s*\/?>/gi, '')
}

function compact(value: string, limit = 34): string {
  const line = value.replace(/\s+/g, ' ').trim()
  return line.length > limit ? `${line.slice(0, limit - 1)}…` : line
}

function annotationText(a: DiagramAnnotation): string {
  return a.label ? `${a.label}: ${a.value}` : a.value
}

export function diagramTitle(item: Partial<Pick<Node, 'label' | 'annotations'>>): string {
  const label = Array.isArray(item.label) ? item.label.join('\n') : item.label
  return [label, ...(item.annotations ?? []).map(annotationText)].filter(Boolean).join('\n')
}

/** Rows a node shows; the rest are counted as "+N more" and left to the title. */
const MAX_NODE_ROWS = 4

export function nodePresentation(node: Partial<Pick<Node, 'label' | 'annotations' | 'spec'>>) {
  const labels = Array.isArray(node.label) ? node.label : [node.label ?? '']
  const annotations = node.annotations ?? []
  const identity = [
    ...annotations.filter((a) => a.kind === 'status'),
    ...annotations.filter((a) => a.kind === 'identity'),
  ]
  // Relations place the node among others, addresses follow, then what the author wrote.
  // A static drawing has no title to open, so only supplementary details are left to it.
  const ordered = (['relation', 'address', 'note'] as const).flatMap((kind) =>
    annotations.filter((a) => a.kind === kind),
  )
  const visible = ordered.slice(0, MAX_NODE_ROWS)
  const rows = visible.map((a) => ({
    label: compact(a.label, 14),
    value: a.kind === 'address' ? a.value : compact(a.value),
  }))
  const hidden = ordered.length - visible.length
  return {
    labels,
    badge:
      node.spec?.kind === 'compute'
        ? 'VM'
        : (annotations.find((a) => a.kind === 'badge')?.value ?? ''),
    subtitle: compact(identity.map((a) => a.value).join(' · '), 38),
    rows,
    hidden,
    assumed: annotations.some((a) => a.kind === 'status'),
    title: diagramTitle(node),
  }
}

export function linkTitle(link: Link): string {
  return [
    `${link.from.node}${link.from.port ? `:${link.from.port}` : ''} ↔ ${link.to.node}${link.to.port ? `:${link.to.port}` : ''}`,
    link.vlan?.length ? `VLAN ${link.vlan.join(', ')}` : '',
    diagramTitle(link),
  ]
    .filter(Boolean)
    .join('\n')
}

/**
 * At most three short lines keep link text subordinate to the topology: what the link is, what
 * it carries, and what the author wrote about it. Full facts live in the title.
 */
export function linkPresentationLines(link: Pick<Link, 'label' | 'vlan' | 'annotations'>) {
  const label = Array.isArray(link.label) ? link.label.join(' / ') : link.label
  const annotations = link.annotations ?? []
  const values = (kind: DiagramAnnotation['kind']) =>
    annotations.filter((a) => a.kind === kind).map((a) => a.value)
  const vlan = link.vlan?.length ? `VLAN ${link.vlan.join(', ')}` : ''
  return [
    [...new Set([label, ...values('identity')].filter(Boolean))].join(' · '),
    [vlan, ...values('relation')].filter(Boolean).join(' · '),
    values('note').join(' · '),
  ]
    .filter(Boolean)
    .map((s) => compact(s, 40))
}

export function linkLabelSize(lines: readonly string[]) {
  return {
    width:
      Math.max(0, ...lines.map((s) => s.length * LINK_LABEL.charWidth)) + LINK_LABEL.paddingX * 2,
    height: lines.length * LINK_LABEL.lineHeight + LINK_LABEL.paddingY * 2,
  }
}

export function nodeContentMetrics(
  presentation: ReturnType<typeof nodePresentation>,
  hasIcon: boolean,
) {
  const headerHeight = Math.max(
    hasIcon ? DIAGRAM_CARD.iconSize : 0,
    (presentation.labels.length + (presentation.subtitle ? 1 : 0)) * DIAGRAM_CARD.rowHeight,
  )
  const footerHeight =
    (presentation.rows.length + (presentation.hidden ? 1 : 0)) * DIAGRAM_CARD.rowHeight
  return {
    headerHeight,
    footerHeight,
    height: headerHeight + (footerHeight ? DIAGRAM_CARD.sectionGap + footerHeight : 0),
  }
}

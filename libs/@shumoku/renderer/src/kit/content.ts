// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * What a node or a link says, cut to what fits. Every text is cut by its width, not by a count of
 * characters, so a full-width character is not a free ride past the limit.
 */

import {
  type DiagramAnnotation,
  DRAWING_EPS,
  diagramTitle,
  type Link,
  labelText,
  type Node,
} from '@shumoku/core'
import type { Kit } from './measure.js'
import type { TextRole } from './tokens.js'

/** How a title line is set: the first as the name, the rest quieter, any that is marked bold bold. */
export type LabelRole = 'title' | 'strong' | 'secondary'

export interface NodeContent {
  labels: { text: string; role: LabelRole }[]
  badge: string
  subtitle: string
  rows: { label: string; value: string }[]
  /** What stands for the rows the card leaves to its title; empty when there are none. */
  more: string
  /** Whether the card shows what is assumed rather than confirmed. */
  assumed: boolean
  title: string
}

/** A text on one line, cut with an ellipsis where it would be wider than `limit`. */
export function fit(value: string, role: TextRole, limit: number, kit: Kit): string {
  const line = value.replace(/\s+/g, ' ').trim()
  const room = limit + DRAWING_EPS
  if (kit.text.width(line, role) <= room) return line
  let kept = ''
  for (const char of line) {
    if (kit.text.width(`${kept}${char}…`, role) > room) break
    kept += char
  }
  return `${kept}…`
}

const annotationValue = (a: DiagramAnnotation): string => a.value

export function nodeContent(node: Node, kit: Kit): NodeContent {
  const { limit, card } = kit.tokens
  const lines = Array.isArray(node.label) ? node.label : [node.label ?? '']
  const annotations = node.annotations ?? []
  const identity = [
    ...annotations.filter((a) => a.kind === 'status'),
    ...annotations.filter((a) => a.kind === 'identity'),
  ]
  // Relations place the node among others, addresses follow, then what the author wrote.
  const ordered = (['relation', 'address', 'note'] as const).flatMap((kind) =>
    annotations.filter((a) => a.kind === kind),
  )
  const visible = ordered.slice(0, card.maxRows)
  return {
    labels: lines.map((line, i) => ({
      text: labelText(line),
      role: /<b>|<strong>/i.test(line) ? 'strong' : i === 0 ? 'title' : 'secondary',
    })),
    badge:
      node.spec?.kind === 'compute'
        ? 'VM'
        : (annotations.find((a) => a.kind === 'badge')?.value ?? ''),
    subtitle: fit(identity.map(annotationValue).join(' · '), 'nodeText', limit.subtitle, kit),
    rows: visible.map((a) => ({
      label: fit(a.label, 'nodeText', limit.factKey, kit),
      value: a.kind === 'address' ? a.value : fit(a.value, 'nodeText', limit.factValue, kit),
    })),
    more: ordered.length > visible.length ? `+${ordered.length - visible.length} more` : '',
    assumed: annotations.some((a) => a.kind === 'status'),
    title: diagramTitle(node),
  }
}

/**
 * At most three short lines keep a link's text subordinate to the topology: what the link is,
 * what it carries, and what the author wrote about it. The full facts live in the title.
 */
export function captionContent(link: Link, kit: Kit): string[] {
  const label = Array.isArray(link.label) ? link.label.join(' / ') : link.label
  const annotations = link.annotations ?? []
  const values = (kind: DiagramAnnotation['kind']) =>
    annotations.filter((a) => a.kind === kind).map(annotationValue)
  const vlan = link.vlan?.length ? `VLAN ${link.vlan.join(', ')}` : ''
  return [
    [...new Set([label, ...values('identity')].filter(Boolean))].join(' · '),
    [vlan, ...values('relation')].filter(Boolean).join(' · '),
    values('note').join(' · '),
  ]
    .filter(Boolean)
    .map((line) => fit(line, 'linkCaption', kit.tokens.limit.caption, kit))
}

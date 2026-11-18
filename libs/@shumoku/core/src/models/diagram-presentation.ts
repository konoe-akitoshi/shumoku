// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import type { DiagramAnnotation, Link, Node } from './types.js'

/** A label line as drawn: the bold and line-break markup a label may carry is not text. */
export function labelText(line: string): string {
  return line.replace(/<\/?b>|<\/?strong>|<br\s*\/?>/gi, '')
}

function annotationText(a: DiagramAnnotation): string {
  return a.label ? `${a.label}: ${a.value}` : a.value
}

/** Everything a node or link says, one fact a line: what a title (tooltip) shows in full. */
export function diagramTitle(item: Partial<Pick<Node, 'label' | 'annotations'>>): string {
  const label = Array.isArray(item.label) ? item.label.join('\n') : item.label
  return [label, ...(item.annotations ?? []).map(annotationText)].filter(Boolean).join('\n')
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

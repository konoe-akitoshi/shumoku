// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import { linkLabelSize, linkPresentationLines, type ResolvedEdge } from '@shumoku/core'

/** A displaced caption keeps a quiet leader back to the wire it describes. */
export function linkCaptionLeader(edge: ResolvedEdge) {
  const anchor = edge.labelAnchor
  if (!anchor) return null
  const size = linkLabelSize(linkPresentationLines(edge.link))
  const points = edge.route?.points ?? edge.points
  let nearest: { x: number; y: number } | undefined
  let distance = Number.POSITIVE_INFINITY
  for (const [i, b] of points.entries()) {
    const a = points[i - 1]
    if (!a) continue
    const dx = b.x - a.x
    const dy = b.y - a.y
    const lengthSquared = dx * dx + dy * dy
    const t = lengthSquared
      ? Math.max(0, Math.min(1, ((anchor.x - a.x) * dx + (anchor.y - a.y) * dy) / lengthSquared))
      : 0
    const p = { x: a.x + dx * t, y: a.y + dy * t }
    const d = Math.hypot(p.x - anchor.x, p.y - anchor.y)
    if (d < distance) {
      nearest = p
      distance = d
    }
  }
  if (!nearest) return null
  const dx = nearest.x - anchor.x
  const dy = nearest.y - anchor.y
  const scale = Math.max(Math.abs(dx) / (size.width / 2), Math.abs(dy) / (size.height / 2))
  if (scale <= 1.1) return null
  return { from: nearest, to: { x: anchor.x + dx / scale, y: anchor.y + dy / scale } }
}

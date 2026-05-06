// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

import type { Link, Node } from '@shumoku/core'

/**
 * Auto-created outlets carry a stable metadata tag pointing at the
 * (linkId, epsId) pair they were created for, so the inverse op
 * (uncheck → cleanup) can find and remove them without a separate
 * registry. Manually-placed outlets have no such tag and are left
 * alone.
 */
export function autoOutletTag(linkId: string, epsId: string): string {
  return `${linkId}:${epsId}`
}

export function findAutoOutlet(
  nodes: Map<string, Node>,
  linkId: string,
  epsId: string,
): string | null {
  const tag = autoOutletTag(linkId, epsId)
  for (const n of nodes.values()) {
    if (n.termination?.role !== 'outlet') continue
    if (n.metadata?.autoFor === tag) return n.id
  }
  return null
}

/**
 * Pick a sensible position to drop a fresh auto-outlet for a wire
 * routed through `epsPos`. The outlet sits in the device's room, so
 * we bias toward the far-end (the wire's "device" side) and pull
 * back a small margin so the outlet is just shy of the device pin.
 *
 * `farEndPos` may be null when the device end isn't placed in the
 * current scene (cross-scene EPS); in that case we drop the outlet
 * near the EPS as a conservative fallback. The user can drag from
 * either spot to the actual wall location.
 */
export function autoOutletPosition(
  epsPos: { x: number; y: number } | null,
  farEndPos: { x: number; y: number } | null,
): { x: number; y: number } {
  if (farEndPos && epsPos) {
    const dx = farEndPos.x - epsPos.x
    const dy = farEndPos.y - epsPos.y
    const dist = Math.hypot(dx, dy) || 1
    const margin = Math.min(60, dist * 0.25)
    return {
      x: farEndPos.x - (dx / dist) * margin,
      y: farEndPos.y - (dy / dist) * margin,
    }
  }
  if (farEndPos) return { x: farEndPos.x - 40, y: farEndPos.y - 24 }
  if (epsPos) return { x: epsPos.x + 80, y: epsPos.y + 80 }
  return { x: 100, y: 100 }
}

/**
 * Build the post-save `via` list for a single link.
 *
 * `managedIds` is the universe of TP ids the caller knows about and
 * is rewriting — anything in old via that's also in this set is
 * dropped (so the new tail can take its place). `viaTail` is the
 * fresh ordered list of TP ids the wire should now transit.
 *
 * Anything else in old via (manual outlets the user added via the
 * toolbar, future TP types we don't manage) is preserved verbatim
 * before the tail.
 */
export function buildViaForLink(link: Link, managedIds: string[], viaTail: string[]): string[] {
  const oldVia = link.via ?? []
  const managed = new Set<string>([...managedIds, ...viaTail])
  const preserved = oldVia.filter((id) => !managed.has(id))
  return [...preserved, ...viaTail]
}

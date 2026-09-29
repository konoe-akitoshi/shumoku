// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

import { newId } from '@shumoku/core'
import { diagramState } from '$lib/context.svelte'
import { moveWireDrag, planWireDrag, type WirePoint } from '$lib/scene/wire-drag'

export type Waypoint = { x: number; y: number }

/**
 * Build the SVG `d` for a polyline through the given points with
 * rounded corners — each interior waypoint becomes a quadratic
 * Bezier with the corner radius capped at half the adjacent segment
 * length so short segments don't overshoot.
 */
export function polylinePath(points: Waypoint[], radius = 12): string {
  if (points.length === 0) return ''
  const first = points[0]
  if (!first) return ''
  if (points.length === 1) return `M ${first.x} ${first.y}`
  if (points.length === 2) {
    const last = points[1]
    if (!last) return `M ${first.x} ${first.y}`
    return `M ${first.x} ${first.y} L ${last.x} ${last.y}`
  }

  let d = `M ${first.x} ${first.y}`
  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1]
    const curr = points[i]
    const next = points[i + 1]
    if (!prev || !curr || !next) continue
    const v1x = curr.x - prev.x
    const v1y = curr.y - prev.y
    const v2x = next.x - curr.x
    const v2y = next.y - curr.y
    const l1 = Math.hypot(v1x, v1y) || 1
    const l2 = Math.hypot(v2x, v2y) || 1
    const r = Math.min(radius, l1 / 2, l2 / 2)
    const ax = curr.x - (v1x / l1) * r
    const ay = curr.y - (v1y / l1) * r
    const bx = curr.x + (v2x / l2) * r
    const by = curr.y + (v2y / l2) * r
    d += ` L ${ax} ${ay} Q ${curr.x} ${curr.y}, ${bx} ${by}`
  }
  const last = points[points.length - 1]
  if (last) d += ` L ${last.x} ${last.y}`
  return d
}

/** One pointer gesture = one undo entry. Escape, cancellation and blur restore the original route. */
export function bendOnDrag(args: {
  linkId: string
  points: WirePoint[]
  startClient: Waypoint
  toFlow: (x: number, y: number) => Waypoint
  zoom: number
  pointerId: number
  addBend: boolean
}): () => void {
  const { linkId, startClient, toFlow, pointerId } = args
  if (diagramState.inTx) return () => {}
  const link = diagramState.links.find((item) => item.id === linkId)
  if (!link) return () => {}
  const original = link.bends?.map((bend) => ({ ...bend }))
  const plan = planWireDrag(
    args.points,
    original ?? [],
    toFlow(startClient.x, startClient.y),
    args.zoom,
    args.addBend,
    () => newId('bend'),
  )
  if (!plan) return () => {}
  let active = false
  let finished = false
  const onMove = (event: PointerEvent) => {
    if (event.pointerId !== pointerId || finished) return
    const moved = moveWireDrag(plan, toFlow(event.clientX, event.clientY))
    const changed = moved.some((bend, index) => {
      const initial = plan.bends[index]
      return initial && (Math.abs(bend.x - initial.x) > 1e-9 || Math.abs(bend.y - initial.y) > 1e-9)
    })
    if (!active) {
      if (!changed) return
      if (Math.hypot(event.clientX - startClient.x, event.clientY - startClient.y) < 3) return
      if (diagramState.inTx) {
        finish(true)
        return
      }
      diagramState.beginTx(args.addBend ? 'Add wire bend' : 'Move wire')
      active = true
    }
    diagramState.setLinkBends(linkId, changed ? moved : original)
  }
  function finish(restore: boolean) {
    if (finished) return
    finished = true
    document.removeEventListener('pointermove', onMove)
    document.removeEventListener('pointerup', onUp)
    document.removeEventListener('pointercancel', onCancel)
    document.removeEventListener('keydown', onKey, true)
    window.removeEventListener('blur', cancel)
    if (active) {
      if (restore) diagramState.setLinkBends(linkId, original)
      diagramState.endTx()
    }
  }
  const cancel = () => finish(true)
  const onUp = (event: PointerEvent) => {
    if (event.pointerId !== pointerId) return
    if (active) onMove(event)
    finish(false)
  }
  const onCancel = (event: PointerEvent) => {
    if (event.pointerId === pointerId) cancel()
  }
  const onKey = (event: KeyboardEvent) => {
    if (event.key !== 'Escape') return
    event.preventDefault()
    event.stopImmediatePropagation()
    cancel()
  }
  document.addEventListener('pointermove', onMove)
  document.addEventListener('pointerup', onUp)
  document.addEventListener('pointercancel', onCancel)
  document.addEventListener('keydown', onKey, true)
  window.addEventListener('blur', cancel)
  return cancel
}

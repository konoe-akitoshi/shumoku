// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * What a wire looks like: the one place that turns a link's meaning into a spec. The component
 * draws the spec as it is and reads no link field itself.
 */

import { drawingArcs, type Link } from '@shumoku/core'
import type { KitColors } from './colors'
import type { Point } from './scene'
import { dashOf, type Tokens } from './tokens'

export interface WireLook {
  /** The path of the line, each vertex rounded with the radius the scene gave it. */
  d: string
  color: string
  /** The width the line is drawn at. */
  stroke: number
  /** Dash and gap lengths along the line; solid when absent. */
  dash?: number[]
}

/** A polyline as a path, each vertex rounded with the arc `drawingArcs` works out for it. */
export function polylinePath(points: readonly Point[], radii: readonly number[]): string {
  const first = points[0]
  if (!first) return ''
  const arcs = drawingArcs(points, radii)
  let d = `M ${first.x} ${first.y}`
  for (const [i, v] of points.entries()) {
    if (i === 0) continue
    const arc = arcs[i]
    d += arc
      ? ` L ${arc.from.x} ${arc.from.y} A ${arc.r} ${arc.r} 0 0 ${arc.clockwise ? 1 : 0} ${arc.to.x} ${arc.to.y}`
      : ` L ${v.x} ${v.y}`
  }
  return d
}

/** The VLANs a link carries as a key: the same set, in any order, is the same key. */
export function vlanKey(vlan: readonly number[] | undefined): string {
  return [...new Set(vlan ?? [])].sort((a, b) => a - b).join(',')
}

/**
 * A colour for each VLAN that some link of the diagram carries alone. A colour names one VLAN, so
 * the links of that VLAN can be followed by it; a link that carries several (a trunk) has no single
 * VLAN to be coloured by and is drawn plain, its caption listing what it carries. The VLANs take the
 * palette's colours in the order of their ids, so the same diagram always gets the same colours
 * wherever it is drawn, and two VLANs differ in colour for as long as the palette holds.
 */
export function vlanColors(
  links: readonly Pick<Link, 'vlan'>[],
  palette: readonly string[],
): ReadonlyMap<string, string> {
  const alone = new Set<number>()
  for (const { vlan } of links) {
    const ids = new Set(vlan ?? [])
    const [only] = ids
    if (ids.size === 1 && only !== undefined) alone.add(only)
  }
  return new Map(
    [...alone]
      .sort((a, b) => a - b)
      .flatMap((id, i) => {
        const color = palette[i % palette.length]
        return color ? [[vlanKey([id]), color] as const] : []
      }),
  )
}

/** Dashed for a virtual link, dotted for one assumed rather than confirmed. */
function patternOf(link: Link, { wire }: Tokens): readonly number[] | undefined {
  if (link.type === 'dashed') return wire.dashed
  if (link.type === 'dotted') return wire.dotted
  return undefined
}

/**
 * A wire's look. The colour is what the user wrote, else the VLAN's when the link carries one
 * VLAN, else the theme's. Dashes
 * are multiples of the line's own stroke, so a thick line keeps the look of a thin one.
 */
export function wireLook(
  {
    link,
    points,
    radii,
    stroke,
    vlans,
  }: {
    link: Link
    points: readonly Point[]
    radii: readonly number[]
    stroke: number
    vlans: ReadonlyMap<string, string>
  },
  tokens: Tokens,
  colors: KitColors,
): WireLook {
  const color =
    link.style?.stroke ??
    (link.vlan?.length ? vlans.get(vlanKey(link.vlan)) : undefined) ??
    colors.link
  const written = link.style?.strokeDasharray
    ?.split(/[\s,]+/)
    .filter(Boolean)
    .map(Number)
  const pattern = patternOf(link, tokens)
  const dash = pattern ? dashOf(pattern, stroke) : written?.some(Number.isNaN) ? undefined : written
  return {
    d: polylinePath(points, radii),
    color,
    stroke,
    ...(dash && dash.length > 0 ? { dash } : {}),
  }
}

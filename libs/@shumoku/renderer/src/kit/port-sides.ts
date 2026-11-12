// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * How the names of a box's ports are shown, and the room each edge needs for them. The layout
 * hands over the ports of a box edge by edge, in the order they stand along it; this answers with
 * the text of every chip and the distance each neighbouring pair must keep. A pure function of
 * the names and the kit: the same input gives the same answer.
 *
 * Along a top or bottom edge the chips are laid side by side, so two neighbours keep half of each
 * chip's width between their centres. Along a left or right edge the chips run outward, so only
 * their height counts, and a long name widens nothing along the edge.
 *
 * A name is shown in steps, each taken only while the edge asks for more than it may have (its
 * `cap`): the abbreviated name (`port-name.ts`), then the start the names of the edge share
 * written once on a caption chip, then, on a top or bottom edge, chips in two rows, every other
 * one set farther out, so that a chip may be as wide as two ports' spacing, and, as a last
 * resort, the front of the names cut. Whichever step is the last to be taken is the one used. A
 * chip on a left or right edge is held to a fixed length.
 */

import type { DrawingPortBox, DrawingPortLabelSpec, DrawingPortSideLayout } from '@shumoku/core'
import { type Kit, portLabelSize } from './measure.js'
import { commonPrefix, displayPortNames } from './port-name.js'

type Side = 'top' | 'bottom' | 'left' | 'right'
const SIDES: readonly Side[] = ['top', 'bottom', 'left', 'right']

/** How a comfortable spacing compares with the least one. */
const COMFORT = 1.5

/** How many characters, as wide as the widest, a chip on a left or right edge may hold. */
const MAX_LATERAL = 14

/** What is decided for an edge before its distances are worked out. */
interface Plan {
  /** The text of each chip, `''` for a port with no name. */
  texts: readonly string[]
  /** The shared start written once, if the chips leave it out. */
  caption?: string
  /** Chips in two rows, every other one in the outer row (a top or bottom edge only). */
  staggered?: boolean
}

/** The length an edge needs, by the least distances alone: what the steps compare. */
export function needOf(layout: DrawingPortSideLayout): number {
  return (
    layout.leadMargin +
    layout.trailMargin +
    layout.gaps.filter((g) => g.to - g.from === 1).reduce((sum, g) => sum + g.min, 0)
  )
}

/** The layout of one edge for a plan. */
function laid(side: Side, plan: Plan, kit: Kit): DrawingPortSideLayout {
  const horizontal = side === 'top' || side === 'bottom'
  const { port } = kit.tokens
  const labels: DrawingPortLabelSpec[] = plan.texts.map((text) => {
    const size = portLabelSize(text, kit)
    return {
      text: size ? text.trim() : '',
      width: size?.width ?? 0,
      height: size?.height ?? 0,
      row: 0 as const,
    }
  })
  const rows = horizontal && plan.staggered ? 2 : 1
  if (rows === 2)
    for (const [i, l] of labels.entries()) labels[i] = { ...l, row: i % 2 === 0 ? 0 : 1 }
  const gaps = labels.slice(1).map((next, i) => {
    const prev = labels[i]
    const side1 = prev ? prev.width / 2 + next.width / 2 + port.labelGap : 0
    // in two rows a neighbour stands in the other row: only the wire of one passes the chip of the other
    const side2 = prev ? Math.max(prev.width, next.width) / 2 + port.labelGap / 2 : 0
    const tall = prev && (prev.width > 0 || next.width > 0) ? port.labelHeight + port.labelGap : 0
    const wide = rows === 2 ? side2 : side1
    return { from: i, to: i + 1, min: Math.max(port.minSlot, horizontal ? wide : tall) }
  })
  if (rows === 2) {
    // two apart they share a row, and their chips must not touch
    for (let i = 0; i + 2 < labels.length; i++) {
      const [a, b] = [labels[i], labels[i + 2]]
      if (a && b) gaps.push({ from: i, to: i + 2, min: a.width / 2 + b.width / 2 + port.labelGap })
    }
  }
  const caption = plan.caption ? portLabelSize(plan.caption, kit) : undefined
  // the caption chip starts at the corner, a chip's overhang outside it; the first chip follows it
  const clearOfCaption = (first: DrawingPortLabelSpec | undefined): number =>
    caption
      ? (horizontal ? caption.width + (first?.width ?? 0) / 2 : caption.height * 1.5) +
        port.labelGap -
        port.labelOverhang
      : 0
  const reach = (spec: DrawingPortLabelSpec | undefined) =>
    Math.max(
      port.minSlot / 2,
      horizontal ? (spec?.width ?? 0) / 2 - port.labelOverhang : (spec?.height ?? 0) / 2,
    )
  const first = labels[0]
  const last = labels[labels.length - 1]
  const widest = Math.max(0, caption?.width ?? 0, ...labels.map((l) => l.width))
  return {
    labels,
    ...(plan.caption &&
      caption && { caption: { text: plan.caption.trim(), width: caption.width } }),
    gaps,
    leadMargin: Math.max(reach(first), clearOfCaption(first)),
    trailMargin: reach(last),
    // how far the outer edge of the outermost chip stands from the port
    depth: horizontal
      ? port.labelOffset + port.labelHeight / 2 + (rows - 1) * (port.labelHeight + port.labelRowGap)
      : port.labelOffset + widest + port.labelGap,
  }
}

/** What stands for the front of a name that is cut. */
const CUT = '…'

/** The last `k` characters of a name behind a cut, or the name itself if it is no longer. */
const tailOf = (text: string, k: number): string =>
  text.length > k ? CUT + text.slice(text.length - k) : text

/**
 * The names cut at the front, so that every chip fits `budget`: the end of an interface name is
 * what tells it from the others, so the front goes. One length is kept for the whole edge, the
 * longest that fits, and is lengthened while two names would read alike (`Te1/0/52` and
 * `Te2/0/52` are not both `…0/52`): telling the ports apart comes before saving room, and the
 * edge is lengthened for what does not fit.
 */
export function headCut(texts: readonly string[], budget: number, kit: Kit): string[] {
  const widthOf = (t: string) => portLabelSize(t, kit)?.width ?? 0
  if (texts.every((t) => widthOf(t) <= budget)) return [...texts]
  const longest = Math.max(0, ...texts.map((t) => t.length))
  let k = 1
  for (let n = longest - 1; n >= 1; n--) {
    if (texts.every((t) => widthOf(tailOf(t, n)) <= budget)) {
      k = n
      break
    }
  }
  const unique = (n: number) => {
    const cut = texts.filter((t) => t !== '').map((t) => tailOf(t, n))
    return new Set(cut).size === cut.length
  }
  while (k < longest && !unique(k)) k++
  return texts.map((t) => (t === '' ? t : tailOf(t, k)))
}

/** One edge: the shortest ladder step that fits, else the last step taken. */
function sideLayout(
  side: Side,
  names: readonly (string | undefined)[],
  shown: ReadonlyMap<string, string>,
  bodyLength: number,
  kit: Kit,
): DrawingPortSideLayout {
  const horizontal = side === 'top' || side === 'bottom'
  const { port } = kit.tokens
  const texts = names.map((name) => (name === undefined ? '' : (shown.get(name) ?? name).trim()))
  const cap = Math.max(bodyLength, texts.length * COMFORT * port.minSlot)
  let plan: Plan = { texts }
  let best = laid(side, plan, kit)
  const adopt = (next: Plan) => {
    const layout = laid(side, next, kit)
    if (needOf(layout) < needOf(best)) {
      plan = next
      best = layout
    }
  }
  if (needOf(best) > cap) {
    const prefix = commonPrefix(texts)
    if (prefix) {
      adopt({
        texts: texts.map((t) => (t === '' ? t : t.slice(prefix.length))),
        caption: prefix,
      })
    }
  }
  if (horizontal && needOf(best) > cap) adopt({ ...plan, staggered: true })
  // the last resort: the front of the names is cut. A side edge is cut at a fixed length, for it
  // lengthens nothing along the edge but reaches out beside its neighbours
  const rows = plan.staggered ? 2 : 1
  const budget = horizontal
    ? (rows * cap) / Math.max(1, texts.length) - port.labelGap
    : kit.text.width('M'.repeat(MAX_LATERAL), 'portLabel') + port.labelPadding
  if (!horizontal || needOf(best) > cap) {
    const cut = headCut(plan.texts, budget, kit)
    if (cut.some((t, i) => t !== plan.texts[i])) {
      plan = { ...plan, texts: cut }
      best = laid(side, plan, kit)
    }
  }
  return best
}

export function portSides(box: DrawingPortBox, kit: Kit): Record<Side, DrawingPortSideLayout> {
  const all = SIDES.flatMap((side) => box.sides[side].flatMap((p) => p.name ?? []))
  const shown = displayPortNames(all)
  const edge = (side: Side) =>
    sideLayout(
      side,
      box.sides[side].map((p) => p.name),
      shown,
      side === 'top' || side === 'bottom' ? box.bodyWidth : box.bodyHeight,
      kit,
    )
  return { top: edge('top'), bottom: edge('bottom'), left: edge('left'), right: edge('right') }
}

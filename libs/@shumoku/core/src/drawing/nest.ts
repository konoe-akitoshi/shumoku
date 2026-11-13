// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import type { Link } from '../models/types.js'
import { compare, joinKey } from '../structure/keys.js'
import type { Arrangement } from './arrangement.js'
import type { Box, Point, Size } from './metrics.js'
import {
  type Above,
  acyclic,
  type End,
  type FrameId,
  type FrameItem,
  type Item,
  type ItemId,
  type Level,
  type Line,
  lineEnd,
  type PortalItem,
  type Problem,
  ROOT,
  relation,
  type Satellite,
  slotsOf,
} from './problem.js'
import type { Ranks } from './ranks.js'
import type { Scene } from './scene.js'
import { sealedOf, sidesByRank } from './sides.js'
import { EPS } from './tolerance.js'

/**
 * Every group with no group in it is drawn on its own and set in its parent as one box; the
 * parents rank all their boxes together.
 *
 * The group becomes a problem of its own (`localProblemOf`): its boxes, the lines between them,
 * and for each line that leaves it a
 * portal, a point of no size in the first row (the line meets the group's top edge) or the last
 * (its bottom edge) where the line ends. The parent never sees inside: it holds the group as a
 * `FrameItem`, one box with the size the solving came to, whose ports stand where the portals were
 * left. The lines are drawn in pieces, one for each problem they cross, and joined where they meet
 * (`composeScene`).
 *
 * The parent is ranked first, with the group as one box in one rank; which edge a line meets the
 * group by follows from the ranks of its two ends alone (`sidesByRank`, the rule that draws it
 * in the parent), so the group is solved from what the parent settled and the parent is solved
 * from what the group came to; no stage waits on a length.
 */

/** The id a group has as an item of its parent: a key no node can have. */
export const groupItemId = (group: FrameId): ItemId => `\u0001group:${group}`

/** The id of the portal that stands for the outer end of a line in a group's problem. */
export const portalId = (line: string, end: 'a' | 'b'): ItemId => `portal:${lineEnd(line, end)}`

/** A group solved on its own. */
export interface Nested {
  frame: Problem['frames'][number]
  /** Its id as an item of its parent. */
  item: ItemId
  /** The items in it. */
  members: ReadonlySet<ItemId>
}

/**
 * The groups to solve on their own: those with no group in them that hold something and that
 * nothing ties across (a node drawn beside another that stands in a different group would be
 * pulled out of the box). A group that cannot be solved on its own stays in its parent's flat
 * problem.
 */
export function nestedOf(problem: Problem): Nested[] {
  const parentOf = new Map(problem.frames.map((f) => [f.id, f.parent]))
  const members = new Map<FrameId, Set<ItemId>>()
  for (const item of problem.items) {
    for (
      let f: FrameId | undefined = item.frame;
      f !== undefined && f !== ROOT;
      f = parentOf.get(f)
    )
      members.set(f, (members.get(f) ?? new Set()).add(item.id))
  }
  const torn = new Set<FrameId>()
  for (const s of problem.satellites) {
    for (const [id, inside] of members) {
      if (inside.has(s.item) !== inside.has(s.partner)) torn.add(id)
    }
  }
  const parents = new Set(problem.frames.map((f) => f.parent))
  return problem.frames.flatMap((frame): Nested[] => {
    const inside = members.get(frame.id)
    if (!inside || frame.id === ROOT || torn.has(frame.id) || parents.has(frame.id)) return []
    return [{ frame, item: groupItemId(frame.id), members: inside }]
  })
}

const sortedUnique = <T>(list: readonly T[], key: (t: T) => string): T[] => {
  const seen = new Map(list.map((t) => [key(t), t]))
  return [...seen].sort(([p], [q]) => compare(p, q)).map(([, t]) => t)
}

/**
 * The problem with each group as one `FrameItem` in place of the group and what is in it:
 * the directions, levels, satellites and boundary read through it (a direction between two
 * groups, or between a group and a box, is one between their items; one inside a group is the
 * group's own), a line that leaves a group ends at a port of its box, and a line inside a group
 * is the group's.
 */
export function nestFrames(problem: Problem): { outer: Problem; nested: Nested[] } {
  const nested = nestedOf(problem)
  if (nested.length === 0) return { outer: problem, nested }
  const up = new Map<ItemId, ItemId>()
  for (const leaf of nested) for (const m of leaf.members) up.set(m, leaf.item)
  const upOf = (id: ItemId): ItemId => up.get(id) ?? id
  // the groups solved on their own are not the parent's frames
  const gone = new Set(nested.map((l) => l.frame.id))

  const boxes: FrameItem[] = nested.map((leaf) => ({
    id: leaf.item,
    kind: 'frame',
    frame: leaf.frame.parent ?? ROOT,
    size: { width: 0, height: 0 },
    group: leaf.frame.id,
    ...(leaf.frame.group && { subgraph: leaf.frame.group }),
    insets: leaf.frame.insets,
    ports: {},
  }))
  const items: Item[] = [...problem.items.filter((i) => !up.has(i.id)), ...boxes].sort((p, q) =>
    compare(p.id, q.id),
  )

  // A group is entered at its top by what nothing inside it flows into. A direction into
  // something lower inside it (a line from a neighbour to a box deep in the group) is the group's
  // own business: the box already stands below the group's top, so the group as a whole is not put
  // below that neighbour by it. Read as the whole group's, one such line would move everything in
  // the group, its top included, down a rank.
  const fedInside = new Set(
    problem.above
      .filter((e) => up.get(e.upper) === up.get(e.lower) && up.has(e.lower))
      .map((e) => e.lower),
  )
  const edges = sortedUnique(
    problem.above
      .filter(
        (e) => !(up.has(e.lower) && up.get(e.upper) !== up.get(e.lower) && fedInside.has(e.lower)),
      )
      .map((e): Above => ({ upper: upOf(e.upper), lower: upOf(e.lower) }))
      .filter((e) => e.upper !== e.lower),
    (e) => joinKey([e.upper, e.lower]),
  )
  const levels = sortedUnique(
    problem.level
      .map((l): Level => {
        const [a, b] = [upOf(l.a), upOf(l.b)]
        return compare(a, b) <= 0 ? { a, b } : { a: b, b: a }
      })
      .filter((l) => l.a !== l.b),
    (l) => joinKey([l.a, l.b]),
  )
  const { kept, cut } = acyclic(edges, levels)
  const satellites: Satellite[] = problem.satellites.filter((s) => !up.has(s.item))
  const hosted = new Map(satellites.map((s) => [s.item, s.partner]))
  const vertexOf = (id: ItemId): ItemId => hosted.get(id) ?? id
  const relate = relation(kept, levels)

  const lines = problem.lines.flatMap((l): Line[] => {
    const [ua, ub] = [up.get(l.a.item), up.get(l.b.item)]
    if (ua !== undefined && ua === ub) return []
    if (ua === undefined && ub === undefined) {
      if (l.role === 'inside') return [l]
      const how = relate(vertexOf(l.a.item), vertexOf(l.b.item))
      const base = { id: l.id, link: l.link, a: l.a, b: l.b, stroke: l.stroke, family: l.family }
      return [
        how === undefined
          ? { ...base, role: 'unrelated' }
          : { ...base, role: 'oriented', flow: how },
      ]
    }
    const a: End = ua === undefined ? l.a : { item: ua, port: lineEnd(l.id, 'a') }
    const b: End = ub === undefined ? l.b : { item: ub, port: lineEnd(l.id, 'b') }
    const how = relate(vertexOf(a.item), vertexOf(b.item))
    const base = {
      id: l.id,
      link: l.link,
      a,
      b,
      stroke: l.stroke,
      family: joinKey([a.item, b.item].sort(compare)),
    }
    return [
      how === undefined ? { ...base, role: 'unrelated' } : { ...base, role: 'oriented', flow: how },
    ]
  })

  const free = new Set(problem.free)
  const outer: Problem = {
    ...problem,
    frames: problem.frames.filter((f) => !gone.has(f.id)),
    items,
    lines,
    slots: slotsOf(lines, problem.metrics),
    above: kept,
    level: levels,
    satellites,
    // a group holds its place in the flow when anything in it does
    free: [
      ...problem.free.filter((id) => !up.has(id)),
      ...nested.filter((l) => [...l.members].every((m) => free.has(m))).map((l) => l.item),
    ].sort(compare),
    dropped: [
      ...problem.dropped.map((e) => ({ upper: upOf(e.upper), lower: upOf(e.lower) })),
      ...cut,
    ].filter((e) => e.upper !== e.lower),
    boundary: [...new Set(problem.boundary.map(upOf))],
    inner: problem.inner.filter((i) => !up.has(i.host)),
  }
  return { outer, nested }
}

/**
 * The edge each line meets a group by, as the parent draws it: by the line's end, as the
 * `<id>.<a|b>` the port is named. The same rule that routes the line (`sidesByRank`), so the
 * edge the group is solved for is the edge the parent's line comes to.
 */
export function portalSidesOf(outer: Problem, ranks: Ranks): Map<string, 'top' | 'bottom'> {
  const sealed = sealedOf(outer)
  const out = new Map<string, 'top' | 'bottom'>()
  for (const line of outer.lines) {
    const sides = sidesByRank(line, ranks.rank, sealed)
    if (!sides) continue
    for (const which of ['a', 'b'] as const) {
      const end = line[which]
      const side = sides[which][0]
      if (sealed.has(end.item) && (side === 'top' || side === 'bottom'))
        out.set(lineEnd(line.id, which), side)
    }
  }
  return out
}

/**
 * A group as a problem of its own: what is in it and the lines between, the lines that
 * leave it ending at portals in its first or last row. A line that runs down the flow keeps its
 * direction where the edge it meets agrees with it (a line arriving from above meets the top);
 * where it does not, or the structure said nothing, it places nothing and the portal only holds
 * its edge.
 */
export function localProblemOf(
  problem: Problem,
  leaf: Nested,
  sides: ReadonlyMap<string, 'top' | 'bottom'>,
): Problem {
  const inside = leaf.members
  const portals: PortalItem[] = []
  const edges: Above[] = problem.above.filter((e) => inside.has(e.upper) && inside.has(e.lower))
  const partner = new Map(problem.satellites.map((s) => [s.item, s.partner]))
  const lines = problem.lines.flatMap((l): Line[] => {
    const [ai, bi] = [inside.has(l.a.item), inside.has(l.b.item)]
    if (!ai && !bi) return []
    if (ai && bi) return [l]
    const inner = ai ? 'a' : 'b'
    const beyond = ai ? 'b' : 'a'
    const side = sides.get(lineEnd(l.id, inner)) ?? 'bottom'
    const pid = portalId(l.id, beyond)
    portals.push({
      id: pid,
      kind: 'portal',
      frame: ROOT,
      size: { width: 0, height: 0 },
      side,
      line: l.id,
      end: beyond,
    })
    const end: End = { item: pid }
    const base = {
      id: l.id,
      link: l.link,
      a: ai ? l.a : end,
      b: ai ? end : l.b,
      stroke: l.stroke,
      family: l.family,
    }
    // the portal stands above the box it leads to on the top edge, below it on the bottom edge
    const wanted =
      side === 'top'
        ? beyond === 'a'
          ? 'a above b'
          : 'b above a'
        : beyond === 'a'
          ? 'b above a'
          : 'a above b'
    if (l.role !== 'oriented' || l.flow !== wanted) return [{ ...base, role: 'unrelated' }]
    const at = l[inner].item
    const box = partner.get(at) ?? at
    edges.push(side === 'top' ? { upper: pid, lower: box } : { upper: box, lower: pid })
    return [{ ...base, role: 'oriented', flow: wanted }]
  })
  const items: Item[] = [
    ...problem.items.filter((i) => inside.has(i.id)).map((i): Item => ({ ...i, frame: ROOT })),
    ...portals,
  ].sort((p, q) => compare(p.id, q.id))
  const root = problem.frames.find((f) => f.id === ROOT)
  return {
    ...problem,
    frames: [root ?? { id: ROOT, insets: { top: 0, right: 0, bottom: 0, left: 0 } }],
    items,
    lines,
    slots: slotsOf(lines, problem.metrics),
    above: edges,
    level: problem.level.filter((l) => inside.has(l.a) && inside.has(l.b)),
    satellites: problem.satellites.filter((s) => inside.has(s.item)),
    free: problem.free.filter((id) => inside.has(id)),
    dropped: problem.dropped.filter((e) => inside.has(e.upper) && inside.has(e.lower)),
    inner: problem.inner.filter((i) => inside.has(i.host)),
    boundary: problem.boundary.filter((id) => inside.has(id)),
  }
}

/** What a solved group tells its parent: the size of its box and where its ports stand. */
export function interfaceOf(
  leaf: Nested,
  local: Problem,
  scene: Scene,
): { size: Size; ports: FrameItem['ports'] } {
  const { top, right, bottom, left } = leaf.frame.insets
  const at = new Map((scene.ports ?? []).map((p) => [p.id, p]))
  const ports: Record<string, { side: 'top' | 'bottom'; along: number }> = {}
  for (const item of local.items) {
    if (item.kind !== 'portal') continue
    const mark = at.get(`${item.id}#${lineEnd(item.line, item.end)}`)
    const inner = item.end === 'a' ? 'b' : 'a'
    ports[lineEnd(item.line, inner)] = {
      side: item.side,
      along: left + (mark?.at.x ?? scene.bounds.width / 2),
    }
  }
  return {
    size: {
      width: scene.bounds.width + left + right,
      height: scene.bounds.height + top + bottom,
    },
    ports,
  }
}

/** The parent with each group's box given the size and ports its solving came to. */
export function sizeFrames(
  outer: Problem,
  interfaces: ReadonlyMap<FrameId, { size: Size; ports: FrameItem['ports'] }>,
): Problem {
  return {
    ...outer,
    items: outer.items.map((item) => {
      if (item.kind !== 'frame') return item
      const got = interfaces.get(item.group)
      return got ? { ...item, size: got.size, ports: got.ports } : item
    }),
  }
}

// ---- putting the pieces together

interface Wire {
  points: Point[]
  radii: number[]
}

/** Pieces of one line, in the order the line is read, as one polyline. */
function joinPieces(pieces: readonly Wire[]): Wire {
  const points: Point[] = []
  const radii: number[] = []
  for (const piece of pieces) {
    for (const [k, p] of piece.points.entries()) {
      const last = points[points.length - 1]
      if (last && Math.abs(last.x - p.x) < EPS && Math.abs(last.y - p.y) < EPS) {
        radii[radii.length - 1] = Math.max(radii[radii.length - 1] ?? 0, piece.radii[k] ?? 0)
        continue
      }
      points.push(p)
      radii.push(piece.radii[k] ?? 0)
    }
  }
  // where two pieces meet the line runs straight on: the joining points are no vertices
  const keep = points.map((p, i) => {
    const [a, b] = [points[i - 1], points[i + 1]]
    if (!a || !b || (radii[i] ?? 0) > 0) return true
    return Math.abs((p.x - a.x) * (b.y - p.y) - (p.y - a.y) * (b.x - p.x)) > EPS
  })
  return {
    points: points.filter((_, i) => keep[i]),
    radii: radii.filter((_, i) => keep[i]),
  }
}

const middleOf = (points: readonly Point[]): Point => {
  const first = points[0] ?? { x: 0, y: 0 }
  const lengths = points.slice(1).map((b, k) => {
    const a = points[k] ?? b
    return Math.hypot(b.x - a.x, b.y - a.y)
  })
  let left = lengths.reduce((sum, l) => sum + l, 0) / 2
  for (const [k, l] of lengths.entries()) {
    const a = points[k] ?? first
    const b = points[k + 1] ?? a
    if (left <= l && l > 0) {
      const t = left / l
      return { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) }
    }
    left -= l
  }
  return points[points.length - 1] ?? first
}

/**
 * The parent's scene with each group's scene set into the group's box, and every line that
 * crosses a group edge made one polyline of its pieces. `problem` is the whole network as read
 * (the lines in their order), `parent` the parent's parts, `children` the solved groups.
 */
export function composeScene(
  problem: Problem,
  parent: { scene: Scene; problem: Problem },
  children: ReadonlyMap<FrameId, { leaf: Nested; local: Problem; scene: Scene }>,
): Scene {
  const { scene } = parent
  const leafOf = new Map<ItemId, FrameId>()
  for (const { leaf } of children.values())
    for (const m of leaf.members) leafOf.set(m, leaf.frame.id)

  const sealed = sealedOf(parent.problem)
  const origin = new Map<FrameId, Point>()
  for (const [id, { leaf }] of children) {
    const box = scene.groups.find((g) => g.group.id === leaf.frame.id)?.box
    if (box) {
      origin.set(id, { x: box.x + leaf.frame.insets.left, y: box.y + leaf.frame.insets.top })
    }
  }
  const shift = (id: FrameId) => origin.get(id) ?? { x: 0, y: 0 }
  const moveBox = (b: Box, at: Point): Box => ({ ...b, x: b.x + at.x, y: b.y + at.y })
  const movePoint = (p: Point, at: Point): Point => ({ x: p.x + at.x, y: p.y + at.y })

  const wiresIn = (id: FrameId, link: Link): Wire | undefined => {
    const w = children.get(id)?.scene.wires.find((x) => x.link === link)
    const at = shift(id)
    return w && { points: w.points.map((p) => movePoint(p, at)), radii: w.radii }
  }
  const outerWires = new Map(scene.wires.map((w) => [w.link, w]))
  const wires: Scene['wires'] = problem.lines.flatMap((line) => {
    const [la, lb] = [leafOf.get(line.a.item), leafOf.get(line.b.item)]
    const outer = outerWires.get(line.link)
    const pieces =
      la !== undefined && la === lb
        ? [wiresIn(la, line.link)]
        : [
            la === undefined ? undefined : wiresIn(la, line.link),
            outer,
            lb === undefined ? undefined : wiresIn(lb, line.link),
          ]
    const found = pieces.filter((p): p is Wire => p !== undefined)
    if (found.length === 0) return []
    const joined = found.length === 1 ? found[0] : joinPieces(found)
    if (!joined) return []
    return [{ link: line.link, ...joined, stroke: line.stroke, label: middleOf(joined.points) }]
  })

  const portals = new Set(
    [...children.values()].flatMap((c) =>
      c.local.items.flatMap((i) => (i.kind === 'portal' ? [i.id] : [])),
    ),
  )
  const kids = [...children].sort(([p], [q]) => compare(p, q))
  return {
    nodes: [
      ...scene.nodes,
      ...kids.flatMap(([id, c]) =>
        c.scene.nodes.map((n) => ({ ...n, box: moveBox(n.box, shift(id)) })),
      ),
    ],
    groups: [
      ...scene.groups,
      ...kids.flatMap(([id, c]) =>
        c.scene.groups.map((g) => ({ ...g, box: moveBox(g.box, shift(id)) })),
      ),
    ],
    ...(() => {
      const inner = [...(scene.inner ?? []), ...kids.flatMap(([, c]) => c.scene.inner ?? [])]
      return inner.length > 0 ? { inner } : {}
    })(),
    wires,
    ports: [
      ...(scene.ports ?? []).filter((p) => !sealed.has(p.nodeId)),
      ...kids.flatMap(([id, c]) =>
        (c.scene.ports ?? [])
          .filter((p) => !portals.has(p.nodeId))
          .map((p) => ({ ...p, at: movePoint(p.at, shift(id)) })),
      ),
    ],
    ...(() => {
      const captions = [
        ...(scene.captions ?? []),
        ...kids.flatMap(([id, c]) =>
          (c.scene.captions ?? []).map((x) => ({ ...x, at: movePoint(x.at, shift(id)) })),
        ),
      ]
      return captions.length > 0 ? { captions } : {}
    })(),
    hulls: [
      ...(scene.hulls ?? []),
      ...kids.flatMap(([id, c]) =>
        (c.scene.hulls ?? []).map((h) => ({
          ...h,
          boxes: h.boxes.map((b) => moveBox(b, shift(id))),
          seams: h.seams.map((y) => y + shift(id).y),
          ...(h.box && { box: moveBox(h.box, shift(id)) }),
        })),
      ),
    ],
    bounds: scene.bounds,
  }
}

/**
 * The parent's arrangement with each group's own placed under the group's id. The group
 * holds one row in its parent; its children are in the rows of its own solving.
 */
export function composeArrangement(
  parent: Arrangement,
  children: ReadonlyMap<FrameId, Arrangement>,
): Arrangement {
  const frames: Record<FrameId, Arrangement['frames'][FrameId]> = { ...parent.frames }
  const unmet: Record<FrameId, readonly string[]> = { ...parent.unmet }
  for (const [id, a] of children) {
    // what is in it stands in the root of its problem
    for (const [frame, placed] of Object.entries(a.frames))
      frames[frame === ROOT ? id : frame] = placed
    for (const [frame, missed] of Object.entries(a.unmet)) {
      if (missed.length > 0) unmet[frame === ROOT ? id : frame] = missed
    }
    frames[id] ??= []
  }
  return { frames, unmet }
}

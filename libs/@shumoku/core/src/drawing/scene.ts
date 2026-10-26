// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import type * as input from '../input/model.js'
import { toNetworkGraph } from '../models/network-model-graph.js'
import { DeviceType, type Link, type Node, type Subgraph } from '../models/types.js'
import type { Placed } from './coords.js'
import type { Element, ElementId, Elements, Line } from './elements.js'
import type { Fans } from './fans.js'
import type { Box, Point } from './metrics.js'
import type { Ordered } from './order.js'

/**
 * Layer 8. What the renderer's kit draws (`Scene` of `@shumoku/renderer`'s `kit/scene.ts`).
 * Core cannot import the renderer, so this is the same shape written out here: the renderer's
 * `Scene` accepts it as it is. Only the parts the drawing fills are listed.
 */
export interface Scene {
  nodes: { node: Node; box: Box }[]
  /** Outer groups come before the groups inside them. */
  groups: { group: Subgraph; box: Box }[]
  /** A polyline in drawing order. */
  wires: { link: Link; points: Point[]; captionAt?: Point }[]
  /** Node ids drawn inside one outline; `kind` is written on it. */
  hulls: { members: string[]; kind?: string }[]
  bounds: Box
}

type Side = 'top' | 'bottom' | 'left' | 'right'

/** A wire's end before its place along the box's edge is chosen. */
interface Attach {
  box: Box
  boxKey: string
  side: Side
  /** Where the wire heads, which orders the wires that share an edge. */
  toward: Point
}

export function buildScene(
  network: input.Network,
  elements: Elements,
  fans: Fans,
  ordered: Ordered,
  placed: Placed,
): Scene {
  const graph = toNetworkGraph({ config: network })
  const graphNodes = new Map(graph.nodes.map((n) => [n.id, n]))
  const subgraphs = new Map((graph.subgraphs ?? []).map((g) => [g.id, g]))
  // The graph leaves out a link that ends at a routing domain; the rest are in the order written.
  const graphLinks = new Map<number, Link>()
  const drawn = [...graph.links]
  for (const [position, link] of network.links.entries()) {
    if (link.endpoints.some((e) => 'routingDomain' in e)) continue
    const found = drawn.shift()
    if (found) graphLinks.set(position, found)
  }

  const layerOf = new Map(ordered.layers.flatMap((layer) => layer.map((s) => [s.id, s.layer])))
  /** The slot an element stands in: its own, or its fan's block. */
  const slotOf = (id: ElementId): ElementId => fans.fanOf.get(id)?.id ?? id
  const boxes = new Map<ElementId, Box>()
  for (const e of elements.elements) {
    const fan = fans.fanOf.get(e.id)
    const slot = fan?.id ?? e.id
    const size = fan?.size ?? e.size
    const x = placed.x.get(slot) ?? 0
    const y = placed.y[layerOf.get(slot) ?? 0] ?? 0
    const cell = fan?.cells.find((c) => c.element === e.id)
    boxes.set(
      e.id,
      cell
        ? {
            x: x - size.width / 2 + cell.x,
            y: y - size.height / 2 + cell.y,
            width: e.size.width,
            height: e.size.height,
          }
        : { x: x - size.width / 2, y: y - size.height / 2, width: size.width, height: size.height },
    )
  }

  const nodes: Scene['nodes'] = []
  /** The box of each node a wire may end at: a member's card, a bus, a cloud. */
  const nodeBoxes = new Map<string, Box>()
  const hulls: Scene['hulls'] = []
  for (const e of elements.elements) {
    const box = boxes.get(e.id)
    if (!box) continue
    if (e.kind === 'unit') {
      for (const part of e.parts) {
        const node = graphNodes.get(part.node)
        if (!node) continue
        const partBox = {
          x: box.x + part.x,
          y: box.y + part.y,
          width: part.size.width,
          height: part.size.height,
        }
        nodes.push({ node, box: partBox })
        nodeBoxes.set(part.node, partBox)
      }
      if (e.hull) {
        hulls.push({
          members: [...e.members],
          ...(e.hull.kind === undefined ? {} : { kind: e.hull.kind }),
        })
      }
    } else {
      const node = nodeOfBusOrCloud(e, network, graphNodes)
      nodes.push({ node, box })
      nodeBoxes.set(node.id, box)
    }
  }

  const nodeIdOf = (end: Line['ends'][number]): string => {
    if (end.node !== undefined) return end.node
    return end.element.slice(end.element.indexOf(':') + 1)
  }
  const linkOf = (line: Line): Link => {
    const written = line.link === undefined ? undefined : graphLinks.get(line.link)
    if (written) return written
    const [a, b] = line.ends
    return {
      ...(line.linkId === undefined ? {} : { id: line.linkId }),
      from: { node: nodeIdOf(a), port: '' },
      to: { node: nodeIdOf(b), port: '' },
      ...(line.virtual ? { type: 'dashed' as const } : {}),
    }
  }

  // ---- wires: through the dummy points, ending on the boxes' edges ----
  const slotPoint = (id: string): Point => ({
    x: placed.x.get(id) ?? 0,
    y: placed.y[layerOf.get(id) ?? 0] ?? 0,
  })
  const centre = (b: Box): Point => ({ x: b.x + b.width / 2, y: b.y + b.height / 2 })
  const attaches: { line: Line; ends: [Attach, Attach]; between: Point[] }[] = []
  for (const line of elements.lines) {
    if (line.layoutOnly) continue
    const folded = fans.lineOf[line.index]
    const [a, b] = line.ends
    // A fan's member is a leaf one rank from its parent: its wire goes straight there.
    const path = folded === undefined ? [a.element, b.element] : (ordered.paths[folded] ?? [])
    const boxA = nodeBoxes.get(nodeIdOf(a))
    const boxB = nodeBoxes.get(nodeIdOf(b))
    if (!boxA || !boxB) continue
    const between = path.slice(1, -1).map(slotPoint)
    const layerA = layerOf.get(slotOf(a.element)) ?? 0
    const layerB = layerOf.get(slotOf(b.element)) ?? 0
    const towardA = between[0] ?? centre(boxB)
    const towardB = between[between.length - 1] ?? centre(boxA)
    const sideOf = (own: number, other: number, box: Box, toward: Point): Side =>
      own < other ? 'bottom' : own > other ? 'top' : toward.x >= centre(box).x ? 'right' : 'left'
    attaches.push({
      line,
      between,
      ends: [
        {
          box: boxA,
          boxKey: nodeIdOf(a),
          side: sideOf(layerA, layerB, boxA, towardA),
          toward: towardA,
        },
        {
          box: boxB,
          boxKey: nodeIdOf(b),
          side: sideOf(layerB, layerA, boxB, towardB),
          toward: towardB,
        },
      ],
    })
  }
  // Wires that share an edge of a box leave it in the order they head, evenly spread along it.
  const shared = new Map<string, { at: number; end: 0 | 1; toward: number }[]>()
  for (const [at, item] of attaches.entries()) {
    for (const end of [0, 1] as const) {
      const attach = item.ends[end]
      const key = `${attach.boxKey}|${attach.side}`
      const along =
        attach.side === 'top' || attach.side === 'bottom' ? attach.toward.x : attach.toward.y
      shared.set(key, [...(shared.get(key) ?? []), { at, end, toward: along }])
    }
  }
  const anchors = new Map<string, Point>()
  for (const [key, list] of shared) {
    const sorted = [...list].sort((p, q) => p.toward - q.toward || p.at - q.at)
    for (const [i, { at, end }] of sorted.entries()) {
      const attach = attaches[at]?.ends[end]
      if (!attach) continue
      const share = (i + 1) / (sorted.length + 1)
      const { box, side } = attach
      anchors.set(
        `${at}.${end}`,
        side === 'top' || side === 'bottom'
          ? { x: box.x + box.width * share, y: side === 'top' ? box.y : box.y + box.height }
          : { x: side === 'left' ? box.x : box.x + box.width, y: box.y + box.height * share },
      )
    }
    void key
  }
  const wires: Scene['wires'] = attaches.map((item, at) => ({
    link: linkOf(item.line),
    points: [
      anchors.get(`${at}.0`) ?? centre(item.ends[0].box),
      ...item.between,
      anchors.get(`${at}.1`) ?? centre(item.ends[1].box),
    ],
  }))
  // Lines between two members of one element: straight, from the left card to the right.
  for (const line of elements.inner) {
    const [a, b] = line.ends
    const boxA = nodeBoxes.get(nodeIdOf(a))
    const boxB = nodeBoxes.get(nodeIdOf(b))
    if (!boxA || !boxB) continue
    const [from, to] = boxA.x <= boxB.x ? [boxA, boxB] : [boxB, boxA]
    wires.push({
      link: linkOf(line),
      points: [
        { x: from.x + from.width, y: from.y + from.height / 2 },
        { x: to.x, y: to.y + to.height / 2 },
      ],
    })
  }

  // ---- groups, outer first ----
  const depth = new Map<string, number>()
  const parentOf = new Map(elements.groups.map((g) => [g.id, g.parent]))
  for (const g of elements.groups) {
    let d = 0
    for (let p = parentOf.get(g.id); p !== undefined; p = parentOf.get(p)) d++
    depth.set(g.id, d)
  }
  const groups: Scene['groups'] = elements.groups
    .filter((g) => placed.frames.has(g.id))
    .sort((a, b) => (depth.get(a.id) ?? 0) - (depth.get(b.id) ?? 0))
    .flatMap((g) => {
      const box = placed.frames.get(g.id)
      return box
        ? [{ group: subgraphs.get(g.id) ?? { id: g.id, label: g.label ?? g.id }, box }]
        : []
    })

  const all = [
    ...nodes.map((n) => n.box),
    ...groups.map((g) => g.box),
    ...wires.flatMap((w) => w.points.map((p) => ({ x: p.x, y: p.y, width: 0, height: 0 }))),
  ]
  const left = Math.min(...all.map((b) => b.x))
  const top = Math.min(...all.map((b) => b.y))
  const right = Math.max(...all.map((b) => b.x + b.width))
  const bottom = Math.max(...all.map((b) => b.y + b.height))
  return {
    nodes,
    groups,
    wires,
    hulls,
    bounds:
      all.length === 0
        ? { x: 0, y: 0, width: 0, height: 0 }
        : { x: left, y: top, width: right - left, height: bottom - top },
  }
}

/** The node a bus or a cloud is drawn as. */
function nodeOfBusOrCloud(
  element: Element,
  network: input.Network,
  graphNodes: ReadonlyMap<string, Node>,
): Node {
  const id = element.id.slice(element.id.indexOf(':') + 1)
  const known = graphNodes.get(id)
  if (known && element.kind === 'bus') return known
  const domain = network.routingDomains?.find((d) => d.id === id)
  return {
    id,
    label: domain?.label ?? id,
    spec: { kind: 'hardware', type: DeviceType.Cloud },
  }
}

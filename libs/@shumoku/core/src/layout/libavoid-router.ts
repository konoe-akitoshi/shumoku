// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * libavoid-based Edge Routing Engine
 *
 * Uses ShapeConnectionPin for port connections with direction constraints.
 * Pins ensure lines exit/enter ports perpendicularly.
 */

import type { Link, Node, Position } from '../models/types.js'
import { getLinkWidth } from './link-utils.js'
import { computeNodeSize } from './network-layout.js'
import type { ResolvedEdge, ResolvedPort } from './resolved-types.js'

// libavoid ConnDirFlags
const ConnDirUp = 1
const ConnDirDown = 2
const ConnDirLeft = 4
const ConnDirRight = 8

// biome-ignore lint/suspicious/noExplicitAny: libavoid-js types don't match runtime API
let avoidInstance: any = null

/** Create a blob URL from base64-encoded WASM (browser inline loading) */
function base64ToBlobUrl(b64: string, mime = 'application/wasm'): string {
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (const [i] of bytes.entries()) {
    bytes[i] = bin.charCodeAt(i)
  }
  return URL.createObjectURL(new Blob([bytes], { type: mime }))
}

// biome-ignore lint/suspicious/noExplicitAny: libavoid-js dynamic WASM API
export async function ensureLibavoidLoaded(): Promise<any> {
  if (!avoidInstance) {
    const { AvoidLib } = await import('libavoid-js')
    const isBrowser = typeof window !== 'undefined'
    if (isBrowser) {
      // Browser: decode inline base64 WASM → blob URL (no file copy needed)
      const { LIBAVOID_WASM_BASE64 } = await import('./libavoid-wasm-data.js')
      const blobUrl = base64ToBlobUrl(LIBAVOID_WASM_BASE64)
      await AvoidLib.load(blobUrl)
      URL.revokeObjectURL(blobUrl)
    } else if (process.env['LIBAVOID_WASM_PATH']) {
      // Server/Docker: explicit path via environment variable
      await AvoidLib.load(process.env['LIBAVOID_WASM_PATH'])
    } else {
      // Default: libavoid-js resolves from node_modules
      await AvoidLib.load()
    }
    avoidInstance = AvoidLib.getInstance()
  }
  return avoidInstance
}

export interface LibavoidRoutingOptions {
  edgeStyle?: 'orthogonal' | 'polyline' | 'straight'
  shapeBufferDistance?: number
  idealNudgingDistance?: number
}

export async function routeEdges(
  nodes: Map<string, Node>,
  ports: Map<string, ResolvedPort>,
  links: Link[],
  options?: LibavoidRoutingOptions,
): Promise<Map<string, ResolvedEdge>> {
  const Avoid = await ensureLibavoidLoaded()

  const opts = {
    edgeStyle: 'orthogonal' as const,
    shapeBufferDistance: 10,
    idealNudgingDistance: 20,
    ...options,
  }

  const routingFlag =
    opts.edgeStyle === 'polyline'
      ? Avoid['RouterFlag']['PolyLineRouting'].value
      : Avoid['RouterFlag']['OrthogonalRouting'].value

  const router = new Avoid.Router(routingFlag)
  router.setRoutingParameter(
    Avoid['RoutingParameter']['shapeBufferDistance'].value,
    opts.shapeBufferDistance,
  )
  router.setRoutingParameter(
    Avoid['RoutingParameter']['idealNudgingDistance'].value,
    opts.idealNudgingDistance,
  )
  router.setRoutingParameter(Avoid['RoutingParameter']['reverseDirectionPenalty'].value, 500)
  router.setRoutingParameter(Avoid['RoutingParameter']['segmentPenalty'].value, 50)

  // Nudging: separate overlapping/parallel edge segments
  router.setRoutingOption(
    Avoid['RoutingOption']['nudgeOrthogonalSegmentsConnectedToShapes'].value,
    true,
  )
  router.setRoutingOption(
    Avoid['RoutingOption']['nudgeOrthogonalTouchingColinearSegments'].value,
    true,
  )
  router.setRoutingOption(
    Avoid['RoutingOption']['performUnifyingNudgingPreprocessingStep'].value,
    true,
  )
  router.setRoutingOption(Avoid['RoutingOption']['nudgeSharedPathsWithCommonEndPoint'].value, true)

  try {
    return doRoute(Avoid, router, nodes, ports, links, opts.edgeStyle)
  } finally {
    router.delete()
  }
}

function registerObstacles(
  // biome-ignore lint/suspicious/noExplicitAny: libavoid-js
  Avoid: any,
  // biome-ignore lint/suspicious/noExplicitAny: libavoid-js
  router: any,
  nodes: Map<string, Node>,
  // biome-ignore lint/suspicious/noExplicitAny: libavoid ShapeRef instances
): Map<string, any> {
  // biome-ignore lint/suspicious/noExplicitAny: libavoid ShapeRef instances
  const shapeRefs = new Map<string, any>()
  for (const [id, node] of nodes) {
    if (!node.position) continue
    const size = computeNodeSize(node)
    shapeRefs.set(
      id,
      new Avoid.ShapeRef(
        router,
        new Avoid.Rectangle(
          new Avoid.Point(node.position.x, node.position.y),
          size.width,
          size.height,
        ),
      ),
    )
  }
  return shapeRefs
}

function registerPins(
  // biome-ignore lint/suspicious/noExplicitAny: libavoid-js
  Avoid: any,
  // biome-ignore lint/suspicious/noExplicitAny: libavoid ShapeRef instances
  shapeRefs: Map<string, any>,
  nodes: Map<string, Node>,
  ports: Map<string, ResolvedPort>,
): Map<string, number> {
  // Direction = flow direction, not port side.
  // In TB layout: all vertical ports use ConnDirDown (lines always flow down).
  // HA ports (left/right) use their natural horizontal direction.
  const pinIds = new Map<string, number>() // portId → classId
  let nextClassId = 1

  for (const [portId, port] of ports) {
    const shape = shapeRefs.get(port.nodeId)
    const node = nodes.get(port.nodeId)
    if (!shape || !node?.position) continue

    const size = computeNodeSize(node)
    const classId = nextClassId++
    pinIds.set(portId, classId)

    const xProp = (port.absolutePosition.x - (node.position.x - size.width / 2)) / size.width
    const yProp = (port.absolutePosition.y - (node.position.y - size.height / 2)) / size.height

    // ConnDir = direction the segment leaves the pin going OUTWARD
    // from the shape edge. Matches the port's actual side so the
    // pin works for any placement (default OR user-overridden).
    const dir =
      port.side === 'top'
        ? ConnDirUp
        : port.side === 'bottom'
          ? ConnDirDown
          : port.side === 'left'
            ? ConnDirLeft
            : ConnDirRight

    const pin = new Avoid.ShapeConnectionPin(
      shape,
      classId,
      Math.max(0, Math.min(1, xProp)),
      Math.max(0, Math.min(1, yProp)),
      true,
      0,
      dir,
    )
    pin.setExclusive(false)
  }

  return pinIds
}

function createConnectors(
  // biome-ignore lint/suspicious/noExplicitAny: libavoid-js
  Avoid: any,
  // biome-ignore lint/suspicious/noExplicitAny: libavoid-js
  router: any,
  // biome-ignore lint/suspicious/noExplicitAny: libavoid ShapeRef instances
  shapeRefs: Map<string, any>,
  pinIds: Map<string, number>,
  ports: Map<string, ResolvedPort>,
  links: Link[],
  // biome-ignore lint/suspicious/noExplicitAny: libavoid ConnRef instances
): Map<string, any> {
  // biome-ignore lint/suspicious/noExplicitAny: libavoid ConnRef instances
  const connRefs = new Map<string, any>()

  for (const [i, link] of links.entries()) {
    const linkId = link.id ?? `__link_${i}`
    const fromNodeId = link.from.node
    const toNodeId = link.to.node
    if (!shapeRefs.has(fromNodeId) || !shapeRefs.has(toNodeId)) continue

    const fromPortId = `${fromNodeId}:${link.from.port}`
    const toPortId = `${toNodeId}:${link.to.port}`
    const fromPortObj = ports.get(fromPortId)
    const toPortObj = ports.get(toPortId)
    if (!fromPortObj || !toPortObj) continue
    const fromPin = pinIds.get(fromPortId)

    // Source: pin (direction constraint = outward from port side).
    // Destination: Point — pin direction on the receiving end has
    // to point INWARD into the shape (the line approaches the port
    // from outside), which libavoid rejects.
    // biome-ignore lint/suspicious/noExplicitAny: libavoid ConnEnd
    let srcEnd: any
    if (fromPin !== undefined) {
      srcEnd = new Avoid.ConnEnd(shapeRefs.get(fromNodeId), fromPin)
    } else {
      const pos = fromPortObj.absolutePosition
      srcEnd = new Avoid.ConnEnd(new Avoid.Point(pos.x, pos.y))
    }
    const dstPos = toPortObj.absolutePosition
    const dstEnd = new Avoid.ConnEnd(new Avoid.Point(dstPos.x, dstPos.y))

    const conn = new Avoid.ConnRef(router, srcEnd, dstEnd)

    // One checkpoint anchored on the destination port's outward
    // axis, halfway between the dest port and the source port. The
    // earlier version offset by a fixed 20px from the dest port,
    // which pushed the perpendicular bend right next to the
    // destination — fine when the dest sat on the AP row (bend
    // ended up between AP and access-switch layers, looked clean)
    // but wrong when the user's placement override put the dest on
    // a distribution switch's bottom side (bend ended up just
    // under the distribution layer, visibly protruding through
    // switch territory).
    //
    // Using midpoint along the dest's perpendicular axis places
    // the bend in the gap between the two ports, regardless of
    // which side the user pinned the port to.
    if (toPortObj?.side && fromPortObj) {
      const side = toPortObj.side
      const dp = toPortObj.absolutePosition
      const sp = fromPortObj.absolutePosition
      const cp = { x: dp.x, y: dp.y }
      const isVertical = side === 'top' || side === 'bottom'
      if (isVertical) {
        cp.y = (dp.y + sp.y) / 2
      } else {
        cp.x = (dp.x + sp.x) / 2
      }
      const cpVec = new Avoid.CheckpointVector()
      cpVec.push_back(new Avoid.Checkpoint(new Avoid.Point(cp.x, cp.y)))
      conn.setRoutingCheckpoints(cpVec)
    }

    connRefs.set(linkId, conn)
  }

  // Route all connectors
  router.processTransaction()

  // Note: pin-based routing endpoints may not exactly match port positions,
  // but extractEdges snaps route start/end to exact port coordinates.
  // No global fallback needed — each connector's pin is independent.

  return connRefs
}

function extractEdges(
  // biome-ignore lint/suspicious/noExplicitAny: libavoid ConnRef instances
  connRefs: Map<string, any>,
  ports: Map<string, ResolvedPort>,
  links: Link[],
  edgeStyle: string,
): Map<string, ResolvedEdge> {
  const edges = new Map<string, ResolvedEdge>()

  for (const [i, link] of links.entries()) {
    const linkId = link.id ?? `__link_${i}`
    const conn = connRefs.get(linkId)
    if (!conn) continue

    const route = conn.displayRoute()
    const points: Position[] = []
    for (let j = 0; j < route.size(); j++) {
      const pt = route.at(j)
      points.push({ x: pt.x, y: pt.y })
    }

    const fromNodeId = link.from.node
    const toNodeId = link.to.node
    const fromPortId = `${fromNodeId}:${link.from.port}`
    const toPortId = `${toNodeId}:${link.to.port}`
    const fromPortObj = ports.get(fromPortId)
    const toPortObj = ports.get(toPortId)
    // Should not happen in practice — connectors only get created when both
    // ports resolve. Skip defensively if a route survived without them.
    if (!fromPortObj || !toPortObj) continue

    // Snap route endpoints to exact port positions
    if (points.length > 0) {
      points[0] = { x: fromPortObj.absolutePosition.x, y: fromPortObj.absolutePosition.y }
      points[points.length - 1] = {
        x: toPortObj.absolutePosition.x,
        y: toPortObj.absolutePosition.y,
      }
    }

    const first = points[0]
    const last = points[points.length - 1]
    const finalPoints =
      edgeStyle === 'straight' && points.length > 2 && first && last ? [first, last] : points

    edges.set(linkId, {
      id: linkId,
      fromPortId,
      toPortId,
      fromPort: fromPortObj,
      toPort: toPortObj,
      fromNodeId,
      toNodeId,
      fromEndpoint: link.from,
      toEndpoint: link.to,
      points: finalPoints,
      width: getLinkWidth(link),
      link,
    })
  }

  return edges
}

function doRoute(
  // biome-ignore lint/suspicious/noExplicitAny: libavoid-js
  Avoid: any,
  // biome-ignore lint/suspicious/noExplicitAny: libavoid-js
  router: any,
  nodes: Map<string, Node>,
  ports: Map<string, ResolvedPort>,
  links: Link[],
  edgeStyle: string,
): Map<string, ResolvedEdge> {
  const shapeRefs = registerObstacles(Avoid, router, nodes)
  const pinIds = registerPins(Avoid, shapeRefs, nodes, ports)
  const connRefs = createConnectors(Avoid, router, shapeRefs, pinIds, ports, links)
  const edges = extractEdges(connRefs, ports, links, edgeStyle)
  const spread = spreadOverlappingSegments(edges)
  return filletEdgeCorners(spread)
}

// ============================================================================
// Post-processing: spread overlapping segments
// ============================================================================

interface Segment {
  edgeId: string
  pointIndex: number // index of the first point in the segment
  fixed: number // the shared coordinate (Y for horizontal, X for vertical)
  min: number // start of range on the other axis
  max: number // end of range
  width: number // line width
}

/**
 * Detect horizontal/vertical segments that visually overlap (considering line width)
 * and push them apart.
 */
function spreadOverlappingSegments(edges: Map<string, ResolvedEdge>): Map<string, ResolvedEdge> {
  // Deep copy edges so we don't mutate the input
  const result = new Map<string, ResolvedEdge>()
  for (const [id, edge] of edges) {
    result.set(id, {
      ...edge,
      points: edge.points.map((p) => ({ ...p })),
    })
  }

  // Endpoint-touching segments are anchored to ports and must not be
  // shifted: moving their endpoints would drag the port end with
  // them, leaving the edge floating off its actual port. Skip the
  // first and last segment of every edge. Middle segments are safe
  // because their perpendicular neighbours just stretch to match.
  const isPortAnchored = (edge: ResolvedEdge, i: number): boolean =>
    i === 0 || i + 1 === edge.points.length - 1

  // Collect horizontal segments (consecutive points with same Y)
  const hSegs: Segment[] = []
  for (const [edgeId, edge] of result) {
    for (const [i, a] of edge.points.entries()) {
      const b = edge.points[i + 1]
      if (!b) continue
      if (isPortAnchored(edge, i)) continue
      if (Math.abs(a.y - b.y) < 0.5 && Math.abs(a.x - b.x) > 1) {
        hSegs.push({
          edgeId,
          pointIndex: i,
          fixed: a.y,
          min: Math.min(a.x, b.x),
          max: Math.max(a.x, b.x),
          width: edge.width,
        })
      }
    }
  }

  spreadSegments(hSegs, result, 'y')

  // Collect vertical segments (consecutive points with same X)
  const vSegs: Segment[] = []
  for (const [edgeId, edge] of result) {
    for (const [i, a] of edge.points.entries()) {
      const b = edge.points[i + 1]
      if (!b) continue
      if (isPortAnchored(edge, i)) continue
      if (Math.abs(a.x - b.x) < 0.5 && Math.abs(a.y - b.y) > 1) {
        vSegs.push({
          edgeId,
          pointIndex: i,
          fixed: a.x,
          min: Math.min(a.y, b.y),
          max: Math.max(a.y, b.y),
          width: edge.width,
        })
      }
    }
  }

  spreadSegments(vSegs, result, 'x')

  return result
}

/**
 * Visual "lane" gap a viewer needs to read parallel segments as
 * separate routes rather than a single thick band. Sits on top of
 * the geometric line-width clearance.
 */
const LANE_GAP_PX = 12

/**
 * Upper bound on a single cluster's total spread along the fixed
 * axis. Without layer-aware channel detection we can't precisely
 * know how much room is available between adjacent layers, so we
 * cap the spread at a generous estimate of a typical inter-layer
 * gap. Past this the lane gap shrinks proportionally — better to
 * pack tightly than to cross over into a node row.
 */
const MAX_CLUSTER_SPAN_PX = 200

/**
 * Spread out parallel segments that overlap on the range axis so
 * each gets its own lane along the fixed axis. The previous
 * implementation pushed adjacent sorted pairs by (deficit / 2),
 * which had two problems on dense clusters:
 *
 *   1. It only iterated each pair once, so 20+ segments at the same
 *      fixed coordinate ended up in a ~80px band instead of being
 *      spread across the available gap.
 *   2. Pushing s2 right then comparing s2 with s3 broke sort order
 *      and silently double-counted offsets, so the eventual layout
 *      depended on the original sort tie-breaking.
 *
 * The cluster pass below groups all segments whose ranges
 * transitively overlap and then redistributes them around the
 * cluster's centroid with a uniform lane gap. That makes the spread
 * deterministic and proportional to cluster size — dense clusters
 * fan out wider, sparse ones stay compact.
 */
function spreadSegments(segs: Segment[], edges: Map<string, ResolvedEdge>, axis: 'x' | 'y'): void {
  if (segs.length < 2) return

  // Union-Find: any two segments whose ranges overlap (anywhere along
  // the range axis) belong to the same lane cluster, regardless of
  // how their fixed coordinates compare. Walking sort-by-fixed and
  // chaining "overlaps with current cluster" misses pairs where a
  // segment shares an X range with one already pushed past it, so
  // the final result fragmented into small clusters and barely
  // spread anything.
  const parent: number[] = segs.map((_, i) => i)
  const find = (i: number): number => {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i] as number] as number
      i = parent[i] as number
    }
    return i
  }
  const union = (a: number, b: number) => {
    const ra = find(a)
    const rb = find(b)
    if (ra !== rb) parent[ra] = rb
  }
  for (let i = 0; i < segs.length; i++) {
    const a = segs[i]
    if (!a) continue
    for (let j = i + 1; j < segs.length; j++) {
      const b = segs[j]
      if (!b) continue
      if (a.max <= b.min || b.max <= a.min) continue
      union(i, j)
    }
  }

  // Bucket members by root
  const groups = new Map<number, Segment[]>()
  for (let i = 0; i < segs.length; i++) {
    const s = segs[i]
    if (!s) continue
    const root = find(i)
    const list = groups.get(root)
    if (list) list.push(s)
    else groups.set(root, [s])
  }

  for (const cluster of groups.values()) {
    if (cluster.length < 2) continue
    // Order cluster members by their pre-spread fixed coordinate so
    // the rank assignment is stable and matches the natural left-to-
    // right (or top-to-bottom) reading order.
    cluster.sort((a, b) => a.fixed - b.fixed)

    let maxWidth = 0
    for (const s of cluster) if (s.width > maxWidth) maxWidth = s.width
    const desiredLane = maxWidth + LANE_GAP_PX
    const minLane = maxWidth + 2 // never let lines literally touch
    // Cap the cluster's total width so dense clusters don't overflow
    // into adjacent node rows. The "lane" shrinks proportionally;
    // we never compress below `minLane`.
    const lane = Math.max(
      minLane,
      Math.min(desiredLane, MAX_CLUSTER_SPAN_PX / Math.max(1, cluster.length - 1)),
    )
    const totalSpan = (cluster.length - 1) * lane
    const meanFixed = cluster.reduce((sum, s) => sum + s.fixed, 0) / cluster.length
    const start = meanFixed - totalSpan / 2
    for (const [i, s] of cluster.entries()) {
      const newFixed = start + i * lane
      const shift = newFixed - s.fixed
      if (Math.abs(shift) < 0.001) continue
      shiftSegment(edges, s, shift, axis)
      s.fixed = newFixed
    }
  }
}

function shiftSegment(
  edges: Map<string, ResolvedEdge>,
  seg: Segment,
  delta: number,
  axis: 'x' | 'y',
): void {
  const edge = edges.get(seg.edgeId)
  if (!edge) return

  const p1 = edge.points[seg.pointIndex]
  const p2 = edge.points[seg.pointIndex + 1]
  if (!p1 || !p2) return

  if (axis === 'y') {
    p1.y += delta
    p2.y += delta
  } else {
    p1.x += delta
    p2.x += delta
  }
}

// ============================================================================
// Post-processing: fillet edge corners
// ============================================================================

/** Default fillet radius */
const FILLET_RADIUS = 8
/** Number of line segments to approximate a quarter circle */
const ARC_SEGMENTS = 6

/**
 * Replace sharp corners in edge paths with filleted (rounded) corners.
 * Each corner is approximated as a polyline arc.
 */
function filletEdgeCorners(edges: Map<string, ResolvedEdge>): Map<string, ResolvedEdge> {
  const result = new Map<string, ResolvedEdge>()
  for (const [id, edge] of edges) {
    result.set(id, {
      ...edge,
      points: filletPoints(edge.points, FILLET_RADIUS),
    })
  }
  return result
}

/**
 * Insert arc approximation points at each corner of a polyline.
 * The radius is clamped to half the shortest adjacent segment.
 */
function filletPoints(points: Position[], maxRadius: number): Position[] {
  if (points.length < 3) return [...points]

  const result: Position[] = []
  const first = points[0]
  if (!first) return [...points]
  result.push({ ...first })

  for (const [i, curr] of points.entries()) {
    if (i === 0 || i === points.length - 1) continue
    const prev = points[i - 1]
    const next = points[i + 1]
    if (!prev || !next) {
      result.push({ ...curr })
      continue
    }

    const dPrev = Math.hypot(curr.x - prev.x, curr.y - prev.y)
    const dNext = Math.hypot(next.x - curr.x, next.y - curr.y)

    // Clamp radius to half the shortest adjacent segment
    const r = Math.min(maxRadius, dPrev / 2, dNext / 2)
    if (r < 1) {
      result.push({ ...curr })
      continue
    }

    // Direction vectors
    const d0x = (prev.x - curr.x) / dPrev
    const d0y = (prev.y - curr.y) / dPrev
    const d1x = (next.x - curr.x) / dNext
    const d1y = (next.y - curr.y) / dNext

    // Check if collinear (no corner needed)
    const cross = d0x * d1y - d0y * d1x
    if (Math.abs(cross) < 0.001) {
      result.push({ ...curr })
      continue
    }

    // Tangent points (where the arc starts/ends on each segment)
    const t0x = curr.x + d0x * r
    const t0y = curr.y + d0y * r
    const t1x = curr.x + d1x * r
    const t1y = curr.y + d1y * r

    // Approximate the arc between t0 and t1 with line segments
    for (let s = 0; s <= ARC_SEGMENTS; s++) {
      const t = s / ARC_SEGMENTS
      // Quadratic interpolation through the corner point
      // B(t) = (1-t)²·T0 + 2(1-t)t·C + t²·T1 where C is the corner
      const u = 1 - t
      const px = u * u * t0x + 2 * u * t * curr.x + t * t * t1x
      const py = u * u * t0y + 2 * u * t * curr.y + t * t * t1y
      result.push({ x: px, y: py })
    }
  }

  const last = points[points.length - 1]
  if (last) result.push({ ...last })

  return result
}

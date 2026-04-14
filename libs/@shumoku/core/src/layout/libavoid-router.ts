// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * libavoid-based Edge Routing Engine
 *
 * Uses ShapeConnectionPin for port connections with direction constraints.
 * Pins ensure lines exit/enter ports perpendicularly.
 */

import type { Link, LinkEndpoint, Position } from '../models/types.js'
import { getLinkWidth } from './link-utils.js'
import type { ResolvedEdge, ResolvedNode, ResolvedPort } from './resolved-types.js'

// libavoid ConnDirFlags
const ConnDirUp = 1
const ConnDirDown = 2
const ConnDirLeft = 4
const ConnDirRight = 8

function sideToDir(side: 'top' | 'bottom' | 'left' | 'right'): number {
  switch (side) {
    case 'top':
      return ConnDirUp
    case 'bottom':
      return ConnDirDown
    case 'left':
      return ConnDirLeft
    case 'right':
      return ConnDirRight
  }
}

function getNodeId(ep: string | LinkEndpoint): string {
  return typeof ep === 'string' ? ep : ep.node
}
function getPortName(ep: string | LinkEndpoint): string | undefined {
  return typeof ep === 'string' ? undefined : ep.port
}
function toEndpoint(ep: string | LinkEndpoint): LinkEndpoint {
  return typeof ep === 'string' ? { node: ep } : ep
}

/** Check if a point is inside any node's bounding box (with margin) */
function isInsideAnyNode(
  x: number,
  y: number,
  nodes: Map<string, ResolvedNode>,
  margin = 2,
): boolean {
  for (const node of nodes.values()) {
    const hw = node.size.width / 2 + margin
    const hh = node.size.height / 2 + margin
    if (
      x > node.position.x - hw &&
      x < node.position.x + hw &&
      y > node.position.y - hh &&
      y < node.position.y + hh
    ) {
      return true
    }
  }
  return false
}

// biome-ignore lint/suspicious/noExplicitAny: libavoid-js types don't match runtime API
let avoidInstance: any = null

// biome-ignore lint/suspicious/noExplicitAny: libavoid-js dynamic WASM API
export async function ensureLibavoidLoaded(): Promise<any> {
  if (!avoidInstance) {
    const { AvoidLib } = await import('libavoid-js')
    if (process.env['LIBAVOID_WASM_PATH']) {
      // Server/Docker: explicit path via environment variable
      await AvoidLib.load(process.env['LIBAVOID_WASM_PATH'])
    } else {
      // Default: libavoid-js resolves WASM via locateFile (import.meta.url)
      // Works in browser (webpack asyncWebAssembly) and Node.js (node_modules)
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
  nodes: Map<string, ResolvedNode>,
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
    return doRoute(Avoid, router, nodes, ports, links, opts.edgeStyle, opts.shapeBufferDistance)
  } finally {
    router.delete()
  }
}

function registerObstacles(
  // biome-ignore lint/suspicious/noExplicitAny: libavoid-js
  Avoid: any,
  // biome-ignore lint/suspicious/noExplicitAny: libavoid-js
  router: any,
  nodes: Map<string, ResolvedNode>,
  // biome-ignore lint/suspicious/noExplicitAny: libavoid ShapeRef instances
): Map<string, any> {
  // biome-ignore lint/suspicious/noExplicitAny: libavoid ShapeRef instances
  const shapeRefs = new Map<string, any>()
  for (const [id, node] of nodes) {
    shapeRefs.set(
      id,
      new Avoid.ShapeRef(
        router,
        new Avoid.Rectangle(
          new Avoid.Point(node.position.x, node.position.y),
          node.size.width,
          node.size.height,
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
  nodes: Map<string, ResolvedNode>,
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
    if (!shape || !node) continue

    const classId = nextClassId++
    pinIds.set(portId, classId)

    const xProp =
      (port.absolutePosition.x - (node.position.x - node.size.width / 2)) / node.size.width
    const yProp =
      (port.absolutePosition.y - (node.position.y - node.size.height / 2)) / node.size.height

    // Direction = graph flow direction for vertical ports (TB → always down),
    // side direction for horizontal ports (HA).
    const dir = port.side === 'top' || port.side === 'bottom' ? ConnDirDown : sideToDir(port.side)

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
  nodes: Map<string, ResolvedNode>,
  ports: Map<string, ResolvedPort>,
  links: Link[],
  shapeBufferDistance: number,
  // biome-ignore lint/suspicious/noExplicitAny: libavoid ConnRef instances
): Map<string, any> {
  // biome-ignore lint/suspicious/noExplicitAny: libavoid ConnRef instances
  const connRefs = new Map<string, any>()

  for (const [i, link] of links.entries()) {
    const linkId = link.id ?? `__link_${i}`
    const fromNodeId = getNodeId(link.from)
    const toNodeId = getNodeId(link.to)
    if (!shapeRefs.has(fromNodeId) || !shapeRefs.has(toNodeId)) continue

    const fromPort = getPortName(link.from)
    const toPort = getPortName(link.to)
    const fromPortId = fromPort ? `${fromNodeId}:${fromPort}` : null
    const toPortId = toPort ? `${toNodeId}:${toPort}` : null
    const fromPin = fromPortId ? pinIds.get(fromPortId) : undefined

    // Source: use pin (direction constraint → perpendicular exit)
    // biome-ignore lint/suspicious/noExplicitAny: libavoid ConnEnd
    let srcEnd: any
    if (fromPin !== undefined) {
      srcEnd = new Avoid.ConnEnd(shapeRefs.get(fromNodeId), fromPin)
    } else {
      const fromPortObj = fromPortId ? ports.get(fromPortId) : undefined
      const fromNodeObj = nodes.get(fromNodeId)
      const pos = fromPortObj?.absolutePosition ?? fromNodeObj?.position
      if (!pos) continue
      srcEnd = new Avoid.ConnEnd(new Avoid.Point(pos.x, pos.y))
    }

    // Destination: use Point (no direction constraint → natural arrival)
    // Pin direction must be outward, but for destination ports the line
    // approaches from outside → inward direction needed → libavoid rejects it.
    const toPortObj = toPortId ? ports.get(toPortId) : undefined
    const toNodeObj = nodes.get(toNodeId)
    const dstPos = toPortObj?.absolutePosition ?? toNodeObj?.position
    if (!dstPos) continue
    const dstEnd = new Avoid.ConnEnd(new Avoid.Point(dstPos.x, dstPos.y))

    const conn = new Avoid.ConnRef(router, srcEnd, dstEnd)

    // Add checkpoint to force perpendicular arrival at destination port.
    // Only set if the checkpoint doesn't land inside any node obstacle.
    const dstPortObj = toPortId ? ports.get(toPortId) : null
    if (dstPortObj?.side) {
      const portHalf = Math.max(dstPortObj.size.width, dstPortObj.size.height) / 2
      const offset = portHalf + 16
      let cpX = dstPortObj.absolutePosition.x
      let cpY = dstPortObj.absolutePosition.y
      switch (dstPortObj.side) {
        case 'top':
          cpY -= offset
          break
        case 'bottom':
          cpY += offset
          break
        case 'left':
          cpX -= offset
          break
        case 'right':
          cpX += offset
          break
      }
      // Verify checkpoint is not inside any node obstacle (including buffer)
      if (!isInsideAnyNode(cpX, cpY, nodes, shapeBufferDistance)) {
        const checkpoints = new Avoid.CheckpointVector()
        checkpoints.push_back(new Avoid.Checkpoint(new Avoid.Point(cpX, cpY)))
        conn.setRoutingCheckpoints(checkpoints)
      }
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

    const fromNodeId = getNodeId(link.from)
    const toNodeId = getNodeId(link.to)
    const fromPort = getPortName(link.from)
    const toPort = getPortName(link.to)

    // Snap route endpoints to exact port positions
    const fromPortId = fromPort ? `${fromNodeId}:${fromPort}` : null
    const toPortId = toPort ? `${toNodeId}:${toPort}` : null
    const fromPortObj = fromPortId ? ports.get(fromPortId) : undefined
    const toPortObj = toPortId ? ports.get(toPortId) : undefined
    if (fromPortObj && points.length > 0) {
      points[0] = { x: fromPortObj.absolutePosition.x, y: fromPortObj.absolutePosition.y }
    }
    if (toPortObj && points.length > 0) {
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
      fromPortId: fromPort ? `${fromNodeId}:${fromPort}` : null,
      toPortId: toPort ? `${toNodeId}:${toPort}` : null,
      fromNodeId,
      toNodeId,
      fromEndpoint: toEndpoint(link.from),
      toEndpoint: toEndpoint(link.to),
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
  nodes: Map<string, ResolvedNode>,
  ports: Map<string, ResolvedPort>,
  links: Link[],
  edgeStyle: string,
  shapeBufferDistance: number,
): Map<string, ResolvedEdge> {
  const shapeRefs = registerObstacles(Avoid, router, nodes)
  const pinIds = registerPins(Avoid, shapeRefs, nodes, ports)
  const connRefs = createConnectors(
    Avoid,
    router,
    shapeRefs,
    pinIds,
    nodes,
    ports,
    links,
    shapeBufferDistance,
  )
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

  // Collect horizontal segments (consecutive points with same Y)
  const hSegs: Segment[] = []
  for (const [edgeId, edge] of result) {
    for (const [i, a] of edge.points.entries()) {
      const b = edge.points[i + 1]
      if (!b) continue
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

function spreadSegments(segs: Segment[], edges: Map<string, ResolvedEdge>, axis: 'x' | 'y'): void {
  if (segs.length < 2) return

  // Sort by fixed coordinate
  segs.sort((a, b) => a.fixed - b.fixed)

  // Check adjacent pairs for overlap
  for (const [i, s1] of segs.entries()) {
    const s2 = segs[i + 1]
    if (!s2) continue

    // Do they overlap on the range axis?
    if (s1.max <= s2.min || s2.max <= s1.min) continue

    // Minimum center-to-center distance:
    // half-widths (no overlap) + gap equal to the wider line (clearance = line width)
    const minDist = (s1.width + s2.width) / 2 + Math.max(s1.width, s2.width)
    const actualDist = Math.abs(s2.fixed - s1.fixed)

    if (actualDist >= minDist) continue

    // Push apart: move each by half the deficit
    const deficit = minDist - actualDist
    const shift = deficit / 2

    shiftSegment(edges, s1, -shift, axis)
    shiftSegment(edges, s2, shift, axis)

    // Update fixed values for subsequent comparisons
    s1.fixed -= shift
    s2.fixed += shift
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

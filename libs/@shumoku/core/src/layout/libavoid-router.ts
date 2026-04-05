// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * libavoid-based Edge Routing Engine
 *
 * Uses ShapeConnectionPin for port connections with direction constraints.
 * Pins ensure lines exit/enter ports perpendicularly.
 */

import { SMALL_LABEL_CHAR_WIDTH } from '../constants.js'
import type { Link, LinkEndpoint, Position } from '../models/types.js'
import { getLinkWidth } from './resolved-types.js'
import type { ResolvedEdge, ResolvedNode, ResolvedPort } from './resolved-types.js'

// libavoid ConnDirFlags
const ConnDirUp = 1
const ConnDirDown = 2
const ConnDirLeft = 4
const ConnDirRight = 8

function sideToDir(side: 'top' | 'bottom' | 'left' | 'right'): number {
  switch (side) {
    case 'top': return ConnDirUp
    case 'bottom': return ConnDirDown
    case 'left': return ConnDirLeft
    case 'right': return ConnDirRight
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

let avoidInstance: any = null

export async function ensureLibavoidLoaded(): Promise<any> {
  if (!avoidInstance) {
    const { AvoidLib } = await import('libavoid-js')
    const isBrowser = typeof window !== 'undefined'
    if (isBrowser) {
      await AvoidLib.load(`${window.location.origin}/libavoid.wasm`)
    } else {
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

  const routingFlag = opts.edgeStyle === 'polyline'
    ? Avoid['RouterFlag']['PolyLineRouting'].value
    : Avoid['RouterFlag']['OrthogonalRouting'].value

  const router = new Avoid.Router(routingFlag)
  router.setRoutingParameter(Avoid['RoutingParameter']['shapeBufferDistance'].value, opts.shapeBufferDistance)
  router.setRoutingParameter(Avoid['RoutingParameter']['idealNudgingDistance'].value, opts.idealNudgingDistance)
  router.setRoutingParameter(Avoid['RoutingParameter']['reverseDirectionPenalty'].value, 500)
  router.setRoutingParameter(Avoid['RoutingParameter']['segmentPenalty'].value, 50)

  // Nudging: separate overlapping/parallel edge segments
  router.setRoutingOption(Avoid['RoutingOption']['nudgeOrthogonalSegmentsConnectedToShapes'].value, true)
  router.setRoutingOption(Avoid['RoutingOption']['nudgeOrthogonalTouchingColinearSegments'].value, true)
  router.setRoutingOption(Avoid['RoutingOption']['performUnifyingNudgingPreprocessingStep'].value, true)
  router.setRoutingOption(Avoid['RoutingOption']['nudgeSharedPathsWithCommonEndPoint'].value, true)

  try {
    return doRoute(Avoid, router, nodes, ports, links, opts.edgeStyle)
  } finally {
    router.delete()
  }
}

function doRoute(
  Avoid: any,
  router: any,
  nodes: Map<string, ResolvedNode>,
  ports: Map<string, ResolvedPort>,
  links: Link[],
  edgeStyle: string,
): Map<string, ResolvedEdge> {
  // Step 1: Register nodes as obstacles
  const shapeRefs = new Map<string, any>()
  for (const [id, node] of nodes) {
    shapeRefs.set(id, new Avoid.ShapeRef(
      router,
      new Avoid.Rectangle(
        new Avoid.Point(node.position.x, node.position.y),
        node.size.width,
        node.size.height,
      ),
    ))
  }

  // Step 2: Register ports as ShapeConnectionPins
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

    const xProp = (port.absolutePosition.x - (node.position.x - node.size.width / 2)) / node.size.width
    const yProp = (port.absolutePosition.y - (node.position.y - node.size.height / 2)) / node.size.height

    // Direction = graph flow direction for vertical ports (TB → always down),
    // side direction for horizontal ports (HA).
    const dir = (port.side === 'top' || port.side === 'bottom')
      ? ConnDirDown
      : sideToDir(port.side)

    const pin = new Avoid.ShapeConnectionPin(
      shape, classId,
      Math.max(0, Math.min(1, xProp)),
      Math.max(0, Math.min(1, yProp)),
      true, 0, dir,
    )
    pin.setExclusive(false)
  }

  // Step 3: Create connectors
  const connRefs = new Map<string, any>()
  // Track whether pin-based ConnEnd works (checked after first route)
  let pinTestLinkId: string | null = null
  let pinTestPortId: string | null = null

  for (let i = 0; i < links.length; i++) {
    const link = links[i]
    if (!link) continue
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

    // Add checkpoint near destination to force perpendicular arrival.
    // The checkpoint is placed just outside the port in the approach direction.
    const dstPortObj = toPortId ? ports.get(toPortId) : null
    if (dstPortObj) {
      // Offset = port size + label extent (label length * char width + padding)
      // This places the checkpoint just past the port label, ensuring
      // the line approaches perpendicularly through the label area.
      const portHalf = Math.max(dstPortObj.size.width, dstPortObj.size.height) / 2
      const labelExtent = dstPortObj.label.length * SMALL_LABEL_CHAR_WIDTH + 8
      const offset = portHalf + labelExtent
      let cpX = dstPortObj.absolutePosition.x
      let cpY = dstPortObj.absolutePosition.y
      switch (dstPortObj.side) {
        case 'top': cpY -= offset; break
        case 'bottom': cpY += offset; break
        case 'left': cpX -= offset; break
        case 'right': cpX += offset; break
      }
      const checkpoints = new Avoid.CheckpointVector()
      checkpoints.push_back(new Avoid.Checkpoint(new Avoid.Point(cpX, cpY)))
      conn.setRoutingCheckpoints(checkpoints)
    }

    connRefs.set(linkId, conn)

    // Track first pin-based link for verification
    if (pinTestLinkId === null && fromPin !== undefined && fromPortId) {
      pinTestLinkId = linkId
      pinTestPortId = fromPortId
    }
  }

  // Step 4: Route
  router.processTransaction()

  // Step 5: Verify pin-based routing works
  // If the first pin-based endpoint doesn't match the port position,
  // fall back to Point-based routing for all connectors.
  let usePinEndpoints = true
  if (pinTestLinkId && pinTestPortId) {
    const testConn = connRefs.get(pinTestLinkId)
    const testPort = ports.get(pinTestPortId)
    if (testConn && testPort) {
      const route = testConn.displayRoute()
      if (route.size() > 0) {
        const startPt = route.at(0)
        const dx = Math.abs(startPt.x - testPort.absolutePosition.x)
        const dy = Math.abs(startPt.y - testPort.absolutePosition.y)
        if (dx > 2 || dy > 2) {
          console.warn(`[libavoid] Pin-based ConnEnd not working (delta=${dx.toFixed(1)},${dy.toFixed(1)}). Falling back to Point-based.`)
          usePinEndpoints = false
        }
      }
    }
  }

  // If pins don't work, redo with Point-based ConnEnd
  if (!usePinEndpoints) {
    // Clear and redo
    router.processTransaction() // ensure clean state
    connRefs.clear()

    for (let i = 0; i < links.length; i++) {
      const link = links[i]
      if (!link) continue
      const linkId = link.id ?? `__link_${i}`
      const fromNodeId = getNodeId(link.from)
      const toNodeId = getNodeId(link.to)
      if (!shapeRefs.has(fromNodeId) || !shapeRefs.has(toNodeId)) continue

      const fromPort = getPortName(link.from)
      const toPort = getPortName(link.to)
      const fromPortId = fromPort ? `${fromNodeId}:${fromPort}` : null
      const toPortId = toPort ? `${toNodeId}:${toPort}` : null

      const fromPortObj2 = fromPortId ? ports.get(fromPortId) : undefined
      const fromNodeObj2 = nodes.get(fromNodeId)
      const fromPos = fromPortObj2?.absolutePosition ?? fromNodeObj2?.position
      if (!fromPos) continue
      const toPortObj2 = toPortId ? ports.get(toPortId) : undefined
      const toNodeObj2 = nodes.get(toNodeId)
      const toPos = toPortObj2?.absolutePosition ?? toNodeObj2?.position
      if (!toPos) continue

      const conn = new Avoid.ConnRef(router,
        new Avoid.ConnEnd(new Avoid.Point(fromPos.x, fromPos.y)),
        new Avoid.ConnEnd(new Avoid.Point(toPos.x, toPos.y)),
      )
      connRefs.set(linkId, conn)
    }
    router.processTransaction()
  }

  // Step 6: Extract results
  const edges = new Map<string, ResolvedEdge>()

  for (let i = 0; i < links.length; i++) {
    const link = links[i]
    if (!link) continue
    const linkId = link.id ?? `__link_${i}`
    const conn = connRefs.get(linkId)
    if (!conn) continue

    const route = conn.displayRoute()
    const points: Position[] = []
    for (let j = 0; j < route.size(); j++) {
      const pt = route.at(j)
      points.push({ x: pt.x, y: pt.y })
    }

    const first = points[0]
    const last = points[points.length - 1]
    const finalPoints = edgeStyle === 'straight' && points.length > 2 && first && last
      ? [first, last]
      : points

    const fromNodeId = getNodeId(link.from)
    const toNodeId = getNodeId(link.to)
    const fromPort = getPortName(link.from)
    const toPort = getPortName(link.to)

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

  // Post-process: spread overlapping segments considering line width
  spreadOverlappingSegments(edges)

  return edges
}

// ============================================================================
// Post-processing: spread overlapping segments
// ============================================================================

interface Segment {
  edgeId: string
  pointIndex: number // index of the first point in the segment
  fixed: number      // the shared coordinate (Y for horizontal, X for vertical)
  min: number        // start of range on the other axis
  max: number        // end of range
  width: number      // line width
}

/**
 * Detect horizontal/vertical segments that visually overlap (considering line width)
 * and push them apart.
 */
function spreadOverlappingSegments(edges: Map<string, ResolvedEdge>): void {
  // Collect horizontal segments (consecutive points with same Y)
  const hSegs: Segment[] = []
  for (const [edgeId, edge] of edges) {
    for (let i = 0; i < edge.points.length - 1; i++) {
      const a = edge.points[i]
      const b = edge.points[i + 1]
      if (!a || !b) continue
      if (Math.abs(a.y - b.y) < 0.5 && Math.abs(a.x - b.x) > 1) {
        hSegs.push({
          edgeId, pointIndex: i,
          fixed: a.y,
          min: Math.min(a.x, b.x),
          max: Math.max(a.x, b.x),
          width: edge.width,
        })
      }
    }
  }

  spreadSegments(hSegs, edges, 'y')

  // Collect vertical segments (consecutive points with same X)
  const vSegs: Segment[] = []
  for (const [edgeId, edge] of edges) {
    for (let i = 0; i < edge.points.length - 1; i++) {
      const a = edge.points[i]
      const b = edge.points[i + 1]
      if (!a || !b) continue
      if (Math.abs(a.x - b.x) < 0.5 && Math.abs(a.y - b.y) > 1) {
        vSegs.push({
          edgeId, pointIndex: i,
          fixed: a.x,
          min: Math.min(a.y, b.y),
          max: Math.max(a.y, b.y),
          width: edge.width,
        })
      }
    }
  }

  spreadSegments(vSegs, edges, 'x')
}

function spreadSegments(
  segs: Segment[],
  edges: Map<string, ResolvedEdge>,
  axis: 'x' | 'y',
): void {
  if (segs.length < 2) return

  // Sort by fixed coordinate
  segs.sort((a, b) => a.fixed - b.fixed)

  // Check adjacent pairs for overlap
  for (let i = 0; i < segs.length - 1; i++) {
    const s1 = segs[i]
    const s2 = segs[i + 1]
    if (!s1 || !s2) continue

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

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
    idealNudgingDistance: 15,
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
  // Each pin has a unique classId (per shape) and a direction constraint.
  // Pin position is proportional (0-1) on the shape rectangle.
  const pinIds = new Map<string, number>() // portId → classId
  let nextClassId = 1

  for (const [portId, port] of ports) {
    const shape = shapeRefs.get(port.nodeId)
    const node = nodes.get(port.nodeId)
    if (!shape || !node) continue

    const classId = nextClassId++
    pinIds.set(portId, classId)

    // Convert absolute position → proportional on rectangle
    const xProp = (port.absolutePosition.x - (node.position.x - node.size.width / 2)) / node.size.width
    const yProp = (port.absolutePosition.y - (node.position.y - node.size.height / 2)) / node.size.height

    const pin = new Avoid.ShapeConnectionPin(
      shape, classId,
      Math.max(0, Math.min(1, xProp)),
      Math.max(0, Math.min(1, yProp)),
      true, 0, sideToDir(port.side),
    )
    pin.setExclusive(false)
  }

  // Step 3: Create connectors
  const connRefs = new Map<string, any>()
  // Track whether pin-based ConnEnd works (checked after first route)
  let pinTestLinkId: string | null = null
  let pinTestPortId: string | null = null

  for (let i = 0; i < links.length; i++) {
    const link = links[i]!
    const linkId = link.id ?? `__link_${i}`
    const fromNodeId = getNodeId(link.from)
    const toNodeId = getNodeId(link.to)
    if (!shapeRefs.has(fromNodeId) || !shapeRefs.has(toNodeId)) continue

    const fromPort = getPortName(link.from)
    const toPort = getPortName(link.to)
    const fromPortId = fromPort ? `${fromNodeId}:${fromPort}` : null
    const toPortId = toPort ? `${toNodeId}:${toPort}` : null
    const fromPin = fromPortId ? pinIds.get(fromPortId) : undefined
    const toPin = toPortId ? pinIds.get(toPortId) : undefined

    // Use pin-based ConnEnd when available, Point fallback otherwise
    let srcEnd: any
    if (fromPin !== undefined) {
      srcEnd = new Avoid.ConnEnd(shapeRefs.get(fromNodeId), fromPin)
    } else {
      const pos = fromPortId && ports.has(fromPortId) ? ports.get(fromPortId)!.absolutePosition : nodes.get(fromNodeId)!.position
      srcEnd = new Avoid.ConnEnd(new Avoid.Point(pos.x, pos.y))
    }

    let dstEnd: any
    if (toPin !== undefined) {
      dstEnd = new Avoid.ConnEnd(shapeRefs.get(toNodeId), toPin)
    } else {
      const pos = toPortId && ports.has(toPortId) ? ports.get(toPortId)!.absolutePosition : nodes.get(toNodeId)!.position
      dstEnd = new Avoid.ConnEnd(new Avoid.Point(pos.x, pos.y))
    }

    const conn = new Avoid.ConnRef(router, srcEnd, dstEnd)
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
      const link = links[i]!
      const linkId = link.id ?? `__link_${i}`
      const fromNodeId = getNodeId(link.from)
      const toNodeId = getNodeId(link.to)
      if (!shapeRefs.has(fromNodeId) || !shapeRefs.has(toNodeId)) continue

      const fromPort = getPortName(link.from)
      const toPort = getPortName(link.to)
      const fromPortId = fromPort ? `${fromNodeId}:${fromPort}` : null
      const toPortId = toPort ? `${toNodeId}:${toPort}` : null

      const fromPos = fromPortId && ports.has(fromPortId)
        ? ports.get(fromPortId)!.absolutePosition
        : nodes.get(fromNodeId)!.position
      const toPos = toPortId && ports.has(toPortId)
        ? ports.get(toPortId)!.absolutePosition
        : nodes.get(toNodeId)!.position

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
    const link = links[i]!
    const linkId = link.id ?? `__link_${i}`
    const conn = connRefs.get(linkId)
    if (!conn) continue

    const route = conn.displayRoute()
    const points: Position[] = []
    for (let j = 0; j < route.size(); j++) {
      const pt = route.at(j)
      points.push({ x: pt.x, y: pt.y })
    }

    const finalPoints = edgeStyle === 'straight' && points.length > 2
      ? [points[0]!, points[points.length - 1]!]
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
      link,
    })
  }

  return edges
}

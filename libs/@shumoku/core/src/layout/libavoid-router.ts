// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * libavoid-based Edge Routing Engine
 *
 * Uses libavoid (WASM) for high-quality orthogonal/polyline edge routing
 * with obstacle avoidance and automatic parallel edge nudging.
 *
 * Accepts ResolvedNode/ResolvedPort with absolute coordinates — no coordinate
 * conversion needed. Port absolute positions are used directly as connection pins.
 */

import type { Link, LinkEndpoint, Position } from '../models/types.js'
import type { ResolvedEdge, ResolvedNode, ResolvedPort } from './resolved-types.js'

// libavoid direction flags (from C++ source)
const ConnDirUp = 1
const ConnDirDown = 2
const ConnDirLeft = 4
const ConnDirRight = 8

/** Map port side to libavoid direction flag */
function sideToConnDir(side: 'top' | 'bottom' | 'left' | 'right'): number {
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

function getNodeId(endpoint: string | LinkEndpoint): string {
  return typeof endpoint === 'string' ? endpoint : endpoint.node
}

function getPortName(endpoint: string | LinkEndpoint): string | undefined {
  return typeof endpoint === 'string' ? undefined : endpoint.port
}

function toEndpoint(endpoint: string | LinkEndpoint): LinkEndpoint {
  if (typeof endpoint === 'string') {
    return { node: endpoint }
  }
  return endpoint
}

let avoidInstance: any = null

/**
 * Ensure libavoid WASM is loaded (idempotent).
 * Uses dynamic import to avoid loading WASM at module evaluation time,
 * which would fail in SSR/SSG environments (Vercel, etc.).
 */
export async function ensureLibavoidLoaded(): Promise<any> {
  if (!avoidInstance) {
    const { AvoidLib } = await import('libavoid-js')
    const isBrowser = typeof window !== 'undefined'
    if (isBrowser) {
      const wasmUrl = `${window.location.origin}/libavoid.wasm`
      await AvoidLib.load(wasmUrl)
    } else {
      await AvoidLib.load()
    }
    avoidInstance = AvoidLib.getInstance()
  }
  return avoidInstance
}

/** Options for edge routing */
export interface LibavoidRoutingOptions {
  edgeStyle?: 'orthogonal' | 'polyline' | 'straight'
  shapeBufferDistance?: number
  idealNudgingDistance?: number
  nudgeConnectedSegments?: boolean
}

/**
 * Route edges using libavoid with absolute coordinates.
 *
 * Takes ResolvedNode (for obstacles) and ResolvedPort (for connection pins)
 * directly — no coordinate conversion needed.
 *
 * @param nodes - Positioned nodes (obstacles for routing)
 * @param ports - Positioned ports with absolute coordinates (connection pins)
 * @param links - Link definitions
 * @param options - Routing options
 * @returns Map of edge ID → ResolvedEdge
 */
export async function routeEdges(
  nodes: Map<string, ResolvedNode>,
  ports: Map<string, ResolvedPort>,
  links: Link[],
  options?: LibavoidRoutingOptions,
): Promise<Map<string, ResolvedEdge>> {
  const Avoid = await ensureLibavoidLoaded()

  const opts: Required<LibavoidRoutingOptions> = {
    edgeStyle: 'orthogonal',
    shapeBufferDistance: 10,
    idealNudgingDistance: 15,
    nudgeConnectedSegments: true,
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
  // Heavily penalize routes that reverse direction (e.g., going up in a TB layout)
  router.setRoutingParameter(
    Avoid['RoutingParameter']['reverseDirectionPenalty'].value,
    500,
  )
  // Penalize unnecessary segments to prefer simpler routes
  router.setRoutingParameter(
    Avoid['RoutingParameter']['segmentPenalty'].value,
    50,
  )
  if (opts.nudgeConnectedSegments) {
    router.setRoutingOption(
      Avoid['RoutingOption']['nudgeOrthogonalSegmentsConnectedToShapes'].value,
      true,
    )
  }

  try {
    return doRoute(Avoid, router, nodes, ports, links, opts)
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
  opts: Required<LibavoidRoutingOptions>,
): Map<string, ResolvedEdge> {
  // Step 1: Register nodes as obstacles
  // Avoid.Rectangle(centre, width, height) — ResolvedNode.position is center
  const shapeRefs = new Map<string, any>()
  for (const [id, node] of nodes) {
    const shape = new Avoid.ShapeRef(
      router,
      new Avoid.Rectangle(
        new Avoid.Point(node.position.x, node.position.y),
        node.size.width,
        node.size.height,
      ),
    )
    shapeRefs.set(id, shape)
  }

  // Step 2: Register ports as ShapeConnectionPins using ABSOLUTE coordinates
  // No proportional conversion — use absolute offsets from shape center
  let pinClassId = 1
  const pinClassIds = new Map<string, number>() // portId → classId

  for (const [portId, port] of ports) {
    const shape = shapeRefs.get(port.nodeId)
    if (!shape) continue

    const node = nodes.get(port.nodeId)
    if (!node) continue

    const classId = pinClassId++
    pinClassIds.set(portId, classId)

    // Absolute offset from node center → proportional on shape
    // This is safe because we control both the Rectangle center and port position
    const xOffset = port.absolutePosition.x - (node.position.x - node.size.width / 2)
    const yOffset = port.absolutePosition.y - (node.position.y - node.size.height / 2)
    const xProp = xOffset / node.size.width
    const yProp = yOffset / node.size.height

    const connDir = sideToConnDir(port.side)

    const pin = new Avoid.ShapeConnectionPin(
      shape,
      classId,
      Math.max(0, Math.min(1, xProp)),
      Math.max(0, Math.min(1, yProp)),
      true, // proportional
      0, // insideOffset
      connDir,
    )
    pin.setExclusive(false)
  }

  // Step 3: Create connectors
  const connRefs = new Map<string, any>()

  for (let i = 0; i < links.length; i++) {
    const link = links[i]!
    const linkId = link.id ?? `__link_${i}`
    const fromNodeId = getNodeId(link.from)
    const toNodeId = getNodeId(link.to)
    const fromPort = getPortName(link.from)
    const toPort = getPortName(link.to)

    if (!shapeRefs.has(fromNodeId) || !shapeRefs.has(toNodeId)) continue

    // Look up port by "nodeId:portName"
    const fromPortId = fromPort ? `${fromNodeId}:${fromPort}` : null
    const toPortId = toPort ? `${toNodeId}:${toPort}` : null
    const fromClassId = fromPortId ? pinClassIds.get(fromPortId) : undefined
    const toClassId = toPortId ? pinClassIds.get(toPortId) : undefined

    let srcEnd: any
    if (fromClassId !== undefined) {
      srcEnd = new Avoid.ConnEnd(shapeRefs.get(fromNodeId), fromClassId)
    } else {
      // Fallback: node center
      const node = nodes.get(fromNodeId)!
      srcEnd = new Avoid.ConnEnd(new Avoid.Point(node.position.x, node.position.y))
    }

    let dstEnd: any
    if (toClassId !== undefined) {
      dstEnd = new Avoid.ConnEnd(shapeRefs.get(toNodeId), toClassId)
    } else {
      const node = nodes.get(toNodeId)!
      dstEnd = new Avoid.ConnEnd(new Avoid.Point(node.position.x, node.position.y))
    }

    const conn = new Avoid.ConnRef(router, srcEnd, dstEnd)
    connRefs.set(linkId, conn)
  }

  // Step 4: Route
  router.processTransaction()

  // Step 5: Extract results
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

    const finalPoints =
      opts.edgeStyle === 'straight' && points.length > 2
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

// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * libavoid-based Edge Routing Engine
 *
 * Uses libavoid (WASM) for high-quality orthogonal/polyline edge routing
 * with obstacle avoidance and automatic parallel edge nudging.
 *
 * Features:
 * - Port-based connections via ShapeConnectionPin
 * - Parallel edge separation via idealNudgingDistance
 * - Obstacle-aware routing (nodes as obstacles)
 * - Incremental re-routing support (for future interactive use)
 */

import type { Link, LinkEndpoint, Position } from '../models/types.js'
import type {
  EdgeRoutingEngine,
  EdgeRoutingResult,
  NodePlacementResult,
  RoutedEdge,
  RoutingOptions,
} from './types.js'

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

/** Resolve a LinkEndpoint to a node ID */
function getNodeId(endpoint: string | LinkEndpoint): string {
  return typeof endpoint === 'string' ? endpoint : endpoint.node
}

/** Resolve a LinkEndpoint to a port name (if any) */
function getPortName(endpoint: string | LinkEndpoint): string | undefined {
  return typeof endpoint === 'string' ? undefined : endpoint.port
}

/** Convert LinkEndpoint to normalized form */
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
 *
 * In browser environments, the WASM file is served from /libavoid.wasm
 * (must be placed in the app's public directory).
 * In Node.js/Bun, libavoid-js resolves the WASM path automatically.
 */
export async function ensureLibavoidLoaded(): Promise<any> {
  if (!avoidInstance) {
    const { AvoidLib } = await import('libavoid-js')
    // In browser, provide path to public WASM file
    const isBrowser = typeof window !== 'undefined'
    await AvoidLib.load(isBrowser ? '/libavoid.wasm' : undefined)
    avoidInstance = AvoidLib.getInstance()
  }
  return avoidInstance
}

export class LibavoidEdgeRouter implements EdgeRoutingEngine {
  private defaultOptions: RoutingOptions

  constructor(options?: RoutingOptions) {
    this.defaultOptions = {
      edgeStyle: 'orthogonal',
      shapeBufferDistance: 10,
      idealNudgingDistance: 15,
      nudgeConnectedSegments: true,
      ...options,
    }
  }

  async route(
    placement: NodePlacementResult,
    links: Link[],
    options?: RoutingOptions,
  ): Promise<EdgeRoutingResult> {
    // Dynamic import + lazy init to avoid WASM loading at module evaluation time
    const Avoid = await ensureLibavoidLoaded()

    const opts = { ...this.defaultOptions, ...options }

    // Select routing type
    // libavoid-js enum values are objects with .value property
    const routingFlag =
      opts.edgeStyle === 'polyline'
        ? Avoid['RouterFlag']['PolyLineRouting'].value
        : Avoid['RouterFlag']['OrthogonalRouting'].value

    const router = new Avoid.Router(routingFlag)

    // Configure routing parameters
    router.setRoutingParameter(
      Avoid['RoutingParameter']['shapeBufferDistance'].value,
      opts.shapeBufferDistance ?? 10,
    )
    router.setRoutingParameter(
      Avoid['RoutingParameter']['idealNudgingDistance'].value,
      opts.idealNudgingDistance ?? 15,
    )
    if (opts.nudgeConnectedSegments) {
      router.setRoutingOption(
        Avoid['RoutingOption']['nudgeOrthogonalSegmentsConnectedToShapes'].value,
        true,
      )
    }

    try {
      return this.routeWithRouter(Avoid, router, placement, links, opts)
    } finally {
      router.delete()
    }
  }

  private routeWithRouter(
    Avoid: any,
    router: any,
    placement: NodePlacementResult,
    links: Link[],
    opts: RoutingOptions,
  ): EdgeRoutingResult {
    // Step 1: Register nodes as obstacles
    const shapeRefs = new Map<string, any>()
    for (const [id, node] of placement.nodes) {
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

    // Step 2: Register ports as ShapeConnectionPins
    // Pin classId scheme: we use a counter to ensure uniqueness
    let pinClassId = 1
    // Map: "nodeId:portName" → classId
    const pinClassIds = new Map<string, number>()

    for (const [nodeId, node] of placement.nodes) {
      const shape = shapeRefs.get(nodeId)
      if (!shape) continue

      for (const [portName, port] of node.ports) {
        const classId = pinClassId++
        const key = `${nodeId}:${portName}`
        pinClassIds.set(key, classId)

        // Convert port position (relative to node center) to proportional (0-1)
        // port.position is relative to node center, need to convert to proportion
        const xProp = (port.position.x + node.size.width / 2) / node.size.width
        const yProp = (port.position.y + node.size.height / 2) / node.size.height

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
    }

    // Step 3: Create connectors for each link
    const connRefs = new Map<string, any>()

    for (let i = 0; i < links.length; i++) {
      const link = links[i]!
      const linkId = link.id ?? `__link_${i}`
      const fromNodeId = getNodeId(link.from)
      const toNodeId = getNodeId(link.to)
      const fromPort = getPortName(link.from)
      const toPort = getPortName(link.to)

      // Skip links to/from nodes not in placement (e.g., filtered out)
      if (!shapeRefs.has(fromNodeId) || !shapeRefs.has(toNodeId)) continue

      let srcEnd: any
      let dstEnd: any

      // Use port-based connection if ports are defined and registered
      const fromKey = fromPort ? `${fromNodeId}:${fromPort}` : null
      const toKey = toPort ? `${toNodeId}:${toPort}` : null
      const fromClassId = fromKey ? pinClassIds.get(fromKey) : undefined
      const toClassId = toKey ? pinClassIds.get(toKey) : undefined

      if (fromClassId !== undefined) {
        srcEnd = new Avoid.ConnEnd(shapeRefs.get(fromNodeId), fromClassId)
      } else {
        // Fallback: connect to node center
        const node = placement.nodes.get(fromNodeId)!
        srcEnd = new Avoid.ConnEnd(new Avoid.Point(node.position.x, node.position.y))
      }

      if (toClassId !== undefined) {
        dstEnd = new Avoid.ConnEnd(shapeRefs.get(toNodeId), toClassId)
      } else {
        const node = placement.nodes.get(toNodeId)!
        dstEnd = new Avoid.ConnEnd(new Avoid.Point(node.position.x, node.position.y))
      }

      const conn = new Avoid.ConnRef(router, srcEnd, dstEnd)
      connRefs.set(linkId, conn)
    }

    // Step 4: Process all routes
    router.processTransaction()

    // Step 5: Extract routed paths
    const edges = new Map<string, RoutedEdge>()

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

      // For 'straight' style, only keep first and last point
      const finalPoints =
        opts.edgeStyle === 'straight' && points.length > 2
          ? [points[0]!, points[points.length - 1]!]
          : points

      edges.set(linkId, {
        id: linkId,
        from: getNodeId(link.from),
        to: getNodeId(link.to),
        fromEndpoint: toEndpoint(link.from),
        toEndpoint: toEndpoint(link.to),
        points: finalPoints,
        link,
      })
    }

    return { edges }
  }
}

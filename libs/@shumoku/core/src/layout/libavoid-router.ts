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
  // Do NOT enable nudgeOrthogonalSegmentsConnectedToShapes — it moves
  // edge endpoints away from pin positions, breaking port-edge alignment.
  // Parallel edge separation is handled by distinct pin positions instead.

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

  // Step 2: Create connectors using port absolute positions directly.
  // Uses ConnEnd(Point) instead of ConnEnd(ShapeRef, classId) because
  // the pin-based approach has unreliable constructor overload resolution
  // in bundled browser environments (Emscripten WebIDL binding issue).
  // Since we already have port absolute coordinates, this is simpler and correct.
  const connRefs = new Map<string, any>()

  for (let i = 0; i < links.length; i++) {
    const link = links[i]!
    const linkId = link.id ?? `__link_${i}`
    const fromNodeId = getNodeId(link.from)
    const toNodeId = getNodeId(link.to)
    const fromPort = getPortName(link.from)
    const toPort = getPortName(link.to)

    if (!shapeRefs.has(fromNodeId) || !shapeRefs.has(toNodeId)) continue

    // Source: port absolute position or node center
    const fromPortId = fromPort ? `${fromNodeId}:${fromPort}` : null
    const fromPortObj = fromPortId ? ports.get(fromPortId) : null
    const fromPos = fromPortObj ? fromPortObj.absolutePosition : nodes.get(fromNodeId)!.position
    const srcEnd = new Avoid.ConnEnd(new Avoid.Point(fromPos.x, fromPos.y))

    // Destination: port absolute position or node center
    const toPortId = toPort ? `${toNodeId}:${toPort}` : null
    const toPortObj = toPortId ? ports.get(toPortId) : null
    const toPos = toPortObj ? toPortObj.absolutePosition : nodes.get(toNodeId)!.position
    const dstEnd = new Avoid.ConnEnd(new Avoid.Point(toPos.x, toPos.y))

    const conn = new Avoid.ConnRef(router, srcEnd, dstEnd)
    connRefs.set(linkId, conn)
  }

  // Step 4: Route
  router.processTransaction()

  // Step 4: Extract results
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

    let finalPoints =
      opts.edgeStyle === 'straight' && points.length > 2
        ? [points[0]!, points[points.length - 1]!]
        : points

    const fromNodeId = getNodeId(link.from)
    const toNodeId = getNodeId(link.to)
    const fromPort = getPortName(link.from)
    const toPort = getPortName(link.to)

    const fromPortId = fromPort ? `${fromNodeId}:${fromPort}` : null
    const toPortId = toPort ? `${toNodeId}:${toPort}` : null

    edges.set(linkId, {
      id: linkId,
      fromPortId,
      toPortId,
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

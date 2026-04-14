import type { LibavoidRoutingOptions, Link, ResolvedNode, ResolvedPort } from '@shumoku/core'
import { routeEdges } from '@shumoku/core'

export async function POST(request: Request): Promise<Response> {
  const body = (await request.json()) as {
    nodes: Record<string, ResolvedNode>
    ports: Record<string, ResolvedPort>
    links: Link[]
    options?: LibavoidRoutingOptions
  }

  const nodes = new Map(Object.entries(body.nodes))
  const ports = new Map(Object.entries(body.ports))
  const edges = await routeEdges(nodes, ports, body.links, body.options)

  return Response.json({ edges: Object.fromEntries(edges) })
}

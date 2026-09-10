import { computeNetworkLayout, type NetworkGraph } from '@shumoku/core'
import type { RequestHandler } from './$types'

/** Legacy API contract retained independently of the client-only Playground. */
export const POST: RequestHandler = async ({ request }) => {
  let graph: NetworkGraph
  try {
    const payload = await request.json()
    if (
      !payload?.graph ||
      !Array.isArray(payload.graph.nodes) ||
      !Array.isArray(payload.graph.links)
    ) {
      return Response.json({ error: 'Expected graph with nodes and links arrays' }, { status: 400 })
    }
    graph = payload.graph
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  try {
    const { resolved } = await computeNetworkLayout(graph)
    return Response.json({
      resolved: {
        nodes: Object.fromEntries(resolved.nodes),
        ports: Object.fromEntries(resolved.ports),
        edges: Object.fromEntries(resolved.edges),
        subgraphs: Object.fromEntries(resolved.subgraphs),
        bounds: resolved.bounds,
        metadata: resolved.metadata,
      },
    })
  } catch {
    return Response.json({ error: 'Unable to compute graph layout' }, { status: 400 })
  }
}

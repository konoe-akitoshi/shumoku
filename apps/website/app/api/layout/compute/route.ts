import type { NetworkGraph } from '@shumoku/core'
import { computeNetworkLayout } from '@shumoku/core'

export async function POST(request: Request): Promise<Response> {
  const { graph } = (await request.json()) as { graph: NetworkGraph }
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
}

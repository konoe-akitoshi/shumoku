// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

/**
 * HTTP client for server-side layout computation.
 *
 * Browser consumers use these functions instead of direct WASM calls.
 * The API URL must be set before use via setLayoutApiUrl().
 */

import type { Link, NetworkGraph } from '../models/types.js'
import type { LibavoidRoutingOptions } from './libavoid-router.js'
import type {
  ResolvedEdge,
  ResolvedLayout,
  ResolvedNode,
  ResolvedPort,
  ResolvedSubgraph,
} from './resolved-types.js'

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

let apiBaseUrl: string | null = null

/** Set the base URL for layout API calls (e.g. '' for same-origin, or 'https://example.com'). */
export function setLayoutApiUrl(url: string): void {
  apiBaseUrl = url
}

export function getLayoutApiUrl(): string | null {
  return apiBaseUrl
}

// ---------------------------------------------------------------------------
// Remote routeEdges
// ---------------------------------------------------------------------------

/** HTTP-based replacement for routeEdges — same signature, calls server API. */
export async function routeEdgesRemote(
  nodes: Map<string, ResolvedNode>,
  ports: Map<string, ResolvedPort>,
  links: Link[],
  options?: LibavoidRoutingOptions,
): Promise<Map<string, ResolvedEdge>> {
  if (apiBaseUrl === null) throw new Error('Layout API URL not set. Call setLayoutApiUrl() first.')

  const res = await fetch(`${apiBaseUrl}/api/layout/route-edges`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      nodes: Object.fromEntries(nodes),
      ports: Object.fromEntries(ports),
      links,
      options,
    }),
  })
  if (!res.ok) throw new Error(`routeEdges API failed: ${res.status}`)

  const data = (await res.json()) as { edges: Record<string, ResolvedEdge> }
  return new Map(Object.entries(data.edges))
}

// ---------------------------------------------------------------------------
// Remote computeNetworkLayout
// ---------------------------------------------------------------------------

/** HTTP-based replacement for computeNetworkLayout — calls server API. */
export async function computeNetworkLayoutRemote(
  graph: NetworkGraph,
): Promise<{ resolved: ResolvedLayout }> {
  if (apiBaseUrl === null) throw new Error('Layout API URL not set. Call setLayoutApiUrl() first.')

  const res = await fetch(`${apiBaseUrl}/api/layout/compute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ graph }),
  })
  if (!res.ok) throw new Error(`computeNetworkLayout API failed: ${res.status}`)

  const data = (await res.json()) as {
    resolved: {
      nodes: Record<string, ResolvedNode>
      ports: Record<string, ResolvedPort>
      edges: Record<string, ResolvedEdge>
      subgraphs: Record<string, ResolvedSubgraph>
      bounds: ResolvedLayout['bounds']
      metadata?: ResolvedLayout['metadata']
    }
  }

  return {
    resolved: {
      nodes: new Map(Object.entries(data.resolved.nodes)),
      ports: new Map(Object.entries(data.resolved.ports)),
      edges: new Map(Object.entries(data.resolved.edges)),
      subgraphs: new Map(Object.entries(data.resolved.subgraphs)),
      bounds: data.resolved.bounds,
      metadata: data.resolved.metadata,
    },
  }
}

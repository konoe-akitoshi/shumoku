/**
 * Discovery-policy API
 *
 * Reads and mutates the per-node / per-subgraph / topology-default
 * discovery configuration that drives the scheduler and the Discovery
 * tab UI.
 *
 *   GET   /api/topologies/:id/discovery-policy
 *     → full view: topology default + effective policy for every node
 *       and subgraph in the resolved graph.
 *
 *   PATCH /api/topologies/:id/discovery-policy
 *     body: { scope: 'topology' | 'node' | 'subgraph',
 *             id?: string,           // required for node / subgraph
 *             discovery: DiscoveryPolicy | null }  // null clears the override
 *     → { effective: EffectiveDiscoveryPolicy }
 *
 * The override lives on the authored (Manual) layer. PATCH auto-attaches
 * a Manual source on first use so the operator doesn 't have to do it
 * manually from the data-sources tab — same affordance the editor uses.
 *
 * Per-node overrides on a node that exists ONLY in a discovered snapshot
 * (no authored entry yet) return 409 — "adoption" semantics are tracked
 * separately and intentionally out of scope here.
 */

import {
  computeEffectivePolicy,
  type DiscoveryMode,
  type DiscoveryPolicy,
  type EffectiveDiscoveryPolicy,
  RUNTIME_DEFAULT,
} from '@shumoku/core'
import { Hono } from 'hono'
import { getTopologyService } from './topologies.js'

const VALID_MODES: ReadonlySet<DiscoveryMode> = new Set(['auto', 'observe', 'disabled'])

interface PatchBody {
  scope?: string
  id?: string
  discovery?: DiscoveryPolicy | null
}

/** Validate the discovery patch body. Returns the parsed policy on
 *  success, or a string with the reason on failure. */
function parseDiscoveryPolicy(
  raw: DiscoveryPolicy | null | undefined,
): { policy: DiscoveryPolicy | null } | { error: string } {
  if (raw === null) return { policy: null }
  if (raw === undefined || typeof raw !== 'object') {
    return { error: 'discovery must be an object or null' }
  }
  const policy: DiscoveryPolicy = {}
  if (raw.mode !== undefined) {
    if (!VALID_MODES.has(raw.mode as DiscoveryMode)) {
      return { error: `mode must be one of ${[...VALID_MODES].join(', ')}` }
    }
    policy.mode = raw.mode as DiscoveryMode
  }
  if (raw.intervalMs !== undefined) {
    if (
      typeof raw.intervalMs !== 'number' ||
      !Number.isFinite(raw.intervalMs) ||
      raw.intervalMs < 0
    ) {
      return { error: 'intervalMs must be a non-negative number' }
    }
    policy.intervalMs = raw.intervalMs
  }
  return { policy }
}

export function createDiscoveryPolicyApi(): Hono {
  const app = new Hono()
  const service = getTopologyService()

  app.get('/:id/discovery-policy', async (c) => {
    const id = c.req.param('id')
    const parsed = await service.getParsed(id)
    if (!parsed) return c.json({ error: 'Topology not found' }, 404)

    const graph = parsed.graph
    const subgraphLookup = new Map(
      (graph.subgraphs ?? []).map((sg) => [sg.id, { parent: sg.parent, discovery: sg.discovery }]),
    )

    const nodes: Record<string, EffectiveDiscoveryPolicy> = {}
    for (const node of graph.nodes) {
      nodes[node.id] = computeEffectivePolicy({
        node: { discovery: node.discovery, parent: node.parent },
        subgraphs: subgraphLookup,
        topologyDefault: graph.discovery,
      })
    }

    const subgraphs: Record<string, EffectiveDiscoveryPolicy> = {}
    for (const sg of graph.subgraphs ?? []) {
      // Effective at the subgraph itself: walk *its* parent chain.
      subgraphs[sg.id] = computeEffectivePolicy({
        node: { discovery: sg.discovery, parent: sg.parent },
        subgraphs: subgraphLookup,
        topologyDefault: graph.discovery,
      })
    }

    return c.json({
      topologyDefault: graph.discovery ?? null,
      runtimeDefault: RUNTIME_DEFAULT,
      nodes,
      subgraphs,
    })
  })

  app.patch('/:id/discovery-policy', async (c) => {
    const topologyId = c.req.param('id')
    const body = (await c.req.json()) as PatchBody

    if (body.scope !== 'topology' && body.scope !== 'node' && body.scope !== 'subgraph') {
      return c.json({ error: "scope must be 'topology', 'node', or 'subgraph'" }, 400)
    }
    if ((body.scope === 'node' || body.scope === 'subgraph') && !body.id) {
      return c.json({ error: `id is required when scope is '${body.scope}'` }, 400)
    }

    const parsedBody = parseDiscoveryPolicy(body.discovery)
    if ('error' in parsedBody) return c.json({ error: parsedBody.error }, 400)
    const newPolicy = parsedBody.policy

    const topology = service.get(topologyId)
    if (!topology) return c.json({ error: 'Topology not found' }, 404)

    // The override has to land on the authored Manual graph. If no Manual
    // source is attached yet, auto-attach one — same affordance the editor
    // would have used on first edit.
    const manualId = await service.ensureManualSource(topologyId)
    const authored = service.readManualGraph(manualId) ?? {
      version: '1' as const,
      name: topology.name,
      nodes: [],
      links: [],
    }

    // Apply the mutation. We copy the graph (and the touched array) so we
    // never mutate the JSON we 'll round-trip back into config_json.
    const next = { ...authored }

    if (body.scope === 'topology') {
      if (newPolicy === null) delete next.discovery
      else next.discovery = newPolicy
    } else if (body.scope === 'subgraph') {
      const id = body.id as string
      const subgraphs = [...(next.subgraphs ?? [])]
      const idx = subgraphs.findIndex((sg) => sg.id === id)
      if (idx === -1) {
        return c.json(
          { error: `subgraph '${id}' is not in the authored graph`, reason: 'discovered-only' },
          409,
        )
      }
      const current = subgraphs[idx]
      if (!current) return c.json({ error: 'subgraph index lost' }, 500)
      const target = { ...current }
      if (newPolicy === null) delete target.discovery
      else target.discovery = newPolicy
      subgraphs[idx] = target
      next.subgraphs = subgraphs
    } else {
      // scope === 'node'
      const id = body.id as string
      const nodes = [...next.nodes]
      const idx = nodes.findIndex((n) => n.id === id)
      if (idx === -1) {
        return c.json(
          {
            error: `node '${id}' is not in the authored graph — pin it to Manual before overriding discovery`,
            reason: 'discovered-only',
          },
          409,
        )
      }
      const current = nodes[idx]
      if (!current) return c.json({ error: 'node index lost' }, 500)
      const target = { ...current }
      if (newPolicy === null) delete target.discovery
      else target.discovery = newPolicy
      nodes[idx] = target
      next.nodes = nodes
    }

    service.writeManualGraph(manualId, next)
    service.clearCacheEntry(topologyId)

    // Recompute the affected effective policy for the response.
    const subgraphLookup = new Map(
      (next.subgraphs ?? []).map((sg) => [sg.id, { parent: sg.parent, discovery: sg.discovery }]),
    )
    let effective: EffectiveDiscoveryPolicy
    if (body.scope === 'topology') {
      effective = computeEffectivePolicy({
        node: { discovery: undefined, parent: undefined },
        subgraphs: subgraphLookup,
        topologyDefault: next.discovery,
      })
    } else if (body.scope === 'subgraph') {
      const sg = next.subgraphs?.find((s) => s.id === body.id)
      effective = computeEffectivePolicy({
        node: { discovery: sg?.discovery, parent: sg?.parent },
        subgraphs: subgraphLookup,
        topologyDefault: next.discovery,
      })
    } else {
      const node = next.nodes.find((n) => n.id === body.id)
      effective = computeEffectivePolicy({
        node: { discovery: node?.discovery, parent: node?.parent },
        subgraphs: subgraphLookup,
        topologyDefault: next.discovery,
      })
    }

    return c.json({ effective })
  })

  return app
}

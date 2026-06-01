/**
 * Discovery-policy API — the authored overlay (access / policy
 * attachments) per node / subgraph / topology default.
 *
 *   GET   /api/topologies/:id/discovery-policy
 *     → topology default + effective policy (mode / interval / community)
 *       for every node and subgraph in the resolved graph. The raw
 *       attachments themselves live on the resolved graph (GET /graph).
 *
 *   PATCH /api/topologies/:id/discovery-policy
 *     body: { scope: 'topology' | 'node' | 'subgraph',
 *             id?: string,                       // node / subgraph
 *             attachments?: Attachment[] | null, // replace; null/[] clears
 *             label?: string | null }            // node scope: name override
 *     → { effective: EffectiveDiscoveryPolicy }
 *
 * The overlay lives on the authored (Manual) layer; PATCH auto-attaches a
 * Manual source on first use. A node that exists ONLY in a discovered
 * snapshot just works — detection already grabbed it, so we materialize a
 * minimal authored entry from its resolved identity and apply the
 * attachments. (Subgraph scope still 409s — a discovered-only subgraph has
 * no identity to materialize from.)
 */

import {
  type Attachment,
  computeEffectivePolicy,
  type DiscoveryMode,
  type EffectiveDiscoveryPolicy,
  type Node,
  RUNTIME_DEFAULT,
} from '@shumoku/core'
import { Hono } from 'hono'
import { getTopologyService } from './topologies.js'

const VALID_MODES: ReadonlySet<string> = new Set<DiscoveryMode>(['auto', 'observe', 'disabled'])
const VALID_PROTOCOLS: ReadonlySet<string> = new Set(['snmp', 'ssh', 'netconf', 'http'])

interface PatchBody {
  scope?: string
  id?: string
  /** Replace the scope's attachments. `null` or `[]` clears them. */
  attachments?: unknown
  /** Node scope only: authored name override. `null` / '' reverts to observed. */
  label?: unknown
}

/** Validate + normalize the attachments array from a PATCH body. */
function parseAttachments(raw: unknown): { attachments: Attachment[] } | { error: string } {
  if (raw === null || raw === undefined) return { attachments: [] }
  if (!Array.isArray(raw)) return { error: 'attachments must be an array or null' }
  const out: Attachment[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') return { error: 'each attachment must be an object' }
    const a = item as Record<string, unknown>
    const kind = a['kind']
    if (kind === 'policy') {
      const mode = a['mode']
      const intervalMs = a['intervalMs']
      if (mode !== undefined && !VALID_MODES.has(mode as string)) {
        return { error: `mode must be one of ${[...VALID_MODES].join(', ')}` }
      }
      if (
        intervalMs !== undefined &&
        (typeof intervalMs !== 'number' || !Number.isFinite(intervalMs) || intervalMs < 0)
      ) {
        return { error: 'intervalMs must be a non-negative number' }
      }
      out.push({
        kind: 'policy',
        ...(mode !== undefined ? { mode: mode as DiscoveryMode } : {}),
        ...(intervalMs !== undefined ? { intervalMs: intervalMs as number } : {}),
      })
    } else if (kind === 'access') {
      const protocol = a['protocol']
      if (typeof protocol !== 'string' || !VALID_PROTOCOLS.has(protocol)) {
        return { error: `access.protocol must be one of ${[...VALID_PROTOCOLS].join(', ')}` }
      }
      if (protocol === 'snmp') {
        const community = a['community']
        const version = a['version']
        if (community !== undefined && community !== '' && typeof community !== 'string') {
          return { error: 'community must be a string' }
        }
        if (version !== undefined && version !== '2c' && version !== '3') {
          return { error: "version must be '2c' or '3'" }
        }
        out.push({
          kind: 'access',
          protocol: 'snmp',
          ...(typeof community === 'string' && community !== '' ? { community } : {}),
          ...(version === '2c' || version === '3' ? { version } : {}),
        })
      } else if (protocol === 'ssh') {
        const username = a['username']
        const port = a['port']
        out.push({
          kind: 'access',
          protocol: 'ssh',
          ...(typeof username === 'string' ? { username } : {}),
          ...(typeof port === 'number' ? { port } : {}),
        })
      } else {
        out.push({ kind: 'access', protocol: protocol as 'netconf' | 'http' })
      }
    } else {
      return { error: `unknown attachment kind: ${String(kind)}` }
    }
  }
  return { attachments: out }
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
      (graph.subgraphs ?? []).map((sg) => [
        sg.id,
        { parent: sg.parent, attachments: sg.attachments },
      ]),
    )

    const nodes: Record<string, EffectiveDiscoveryPolicy> = {}
    for (const node of graph.nodes) {
      nodes[node.id] = computeEffectivePolicy({
        node: { attachments: node.attachments, parent: node.parent },
        subgraphs: subgraphLookup,
        topologyDefault: graph.attachments,
      })
    }

    const subgraphs: Record<string, EffectiveDiscoveryPolicy> = {}
    for (const sg of graph.subgraphs ?? []) {
      subgraphs[sg.id] = computeEffectivePolicy({
        node: { attachments: sg.attachments, parent: sg.parent },
        subgraphs: subgraphLookup,
        topologyDefault: graph.attachments,
      })
    }

    return c.json({
      topologyDefault: graph.attachments ?? null,
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

    // Attachments are mutated only when the key is present; a label-only
    // PATCH must not wipe a node's existing access/policy overlay.
    const attachmentsProvided = body.attachments !== undefined
    let attachments: Attachment[] | undefined
    if (attachmentsProvided) {
      const parsedBody = parseAttachments(body.attachments)
      if ('error' in parsedBody) return c.json({ error: parsedBody.error }, 400)
      // Empty array means "no overlay" — store as undefined so the field is absent.
      attachments = parsedBody.attachments.length > 0 ? parsedBody.attachments : undefined
    }

    // `label` is a node-scope authored name override (a fact, not an
    // attachment). `null` / '' reverts to the observed name.
    const labelProvided = body.scope === 'node' && body.label !== undefined
    let labelTrimmed = ''
    if (labelProvided) {
      if (body.label !== null && typeof body.label !== 'string') {
        return c.json({ error: 'label must be a string or null' }, 400)
      }
      labelTrimmed = typeof body.label === 'string' ? body.label.trim() : ''
    }

    if (!attachmentsProvided && !labelProvided) {
      return c.json({ error: 'nothing to update: provide attachments or label' }, 400)
    }

    const topology = service.get(topologyId)
    if (!topology) return c.json({ error: 'Topology not found' }, 404)

    const manualId = await service.ensureManualSource(topologyId)
    const authored = service.readManualGraph(manualId) ?? {
      version: '1' as const,
      name: topology.name,
      nodes: [],
      links: [],
    }
    const next = { ...authored }

    if (body.scope === 'topology') {
      if (attachments) next.attachments = attachments
      else delete next.attachments
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
      if (attachments) target.attachments = attachments
      else delete target.attachments
      subgraphs[idx] = target
      next.subgraphs = subgraphs
    } else {
      // scope === 'node' — attachments and/or an authored label override.
      const id = body.id as string
      const nodes = [...next.nodes]
      const idx = nodes.findIndex((n) => n.id === id)

      // Resolved (observed) node — needed to materialize a discovered-only
      // entry and to revert a cleared label to the observed name. Loaded once.
      let discoveredNode: Node | undefined
      let discoveredLoaded = false
      const loadDiscovered = async (): Promise<Node | undefined> => {
        if (!discoveredLoaded) {
          const resolved = await service.getParsed(topologyId)
          discoveredNode = resolved?.graph.nodes.find((n) => n.id === id)
          discoveredLoaded = true
        }
        return discoveredNode
      }

      if (idx === -1) {
        // Discovered-only node: detection already grabbed it. Store a THIN
        // authored overlay — identity (so resolve clusters it onto the observed
        // node by mgmtIp/chassisId/sysName) plus only what the operator set.
        // We deliberately do NOT copy the observed label / parent / ports: the
        // overlay isn't a node, it's a few fields layered on top. resolve()
        // overlays observed facts under the authored fields, so the device's
        // details show through and the entry doesn't ghost when a re-scan
        // changes the ephemeral node id. `label` is included only when it's an
        // actual rename. Clearing on a node with no authored entry is a no-op.
        const wantAttach = attachmentsProvided && attachments
        const wantLabel = labelProvided && labelTrimmed !== ''
        if (wantAttach || wantLabel) {
          const discovered = await loadDiscovered()
          if (!discovered) return c.json({ error: `node '${id}' not found` }, 404)
          if (!discovered.identity) {
            return c.json(
              { error: `node '${id}' has no identity to anchor an overlay`, reason: 'no-identity' },
              409,
            )
          }
          nodes.push({
            id,
            // Node.label is required, but an attach-only overlay isn't a
            // rename: store '' as the "no override" sentinel so resolve lets
            // the observed name (and future source renames) show through. A
            // real rename stores the trimmed value.
            label: wantLabel ? labelTrimmed : '',
            identity: discovered.identity,
            ...(wantAttach ? { attachments } : {}),
          })
          next.nodes = nodes
        }
      } else {
        const current = nodes[idx]
        if (!current) return c.json({ error: 'node index lost' }, 500)
        const target = { ...current }

        if (attachmentsProvided) {
          if (attachments) target.attachments = attachments
          else delete target.attachments
        }

        let removed = false
        if (labelProvided) {
          if (labelTrimmed !== '') {
            target.label = labelTrimmed
          } else {
            // Revert the name. Dropping the authored entry only restores a
            // sensible name when a real observation backs this node (it then
            // re-resolves as discovered-only with the observed name). For an
            // authored-only node there is nothing to fall back to, so deleting
            // it would destroy real data — never do that. Same when the entry
            // still carries attachments: keep it, leave the label as-is.
            const hasAttach = Array.isArray(target.attachments) && target.attachments.length > 0
            const discovered = await loadDiscovered()
            const observationBacked = discovered?.provenance?.state === 'confirmed'
            if (observationBacked && !hasAttach) {
              nodes.splice(idx, 1)
              removed = true
            }
            // else: authored-only or still has attachments → keep node + label.
          }
        }

        if (!removed) nodes[idx] = target
        next.nodes = nodes
      }
    }

    service.writeManualGraph(manualId, next)
    service.clearCacheEntry(topologyId)

    // Recompute the affected effective policy for the response.
    const subgraphLookup = new Map(
      (next.subgraphs ?? []).map((sg) => [
        sg.id,
        { parent: sg.parent, attachments: sg.attachments },
      ]),
    )
    let effective: EffectiveDiscoveryPolicy
    if (body.scope === 'topology') {
      effective = computeEffectivePolicy({
        node: { attachments: undefined, parent: undefined },
        subgraphs: subgraphLookup,
        topologyDefault: next.attachments,
      })
    } else if (body.scope === 'subgraph') {
      const sg = next.subgraphs?.find((s) => s.id === body.id)
      effective = computeEffectivePolicy({
        node: { attachments: sg?.attachments, parent: sg?.parent },
        subgraphs: subgraphLookup,
        topologyDefault: next.attachments,
      })
    } else {
      const node = next.nodes.find((n) => n.id === body.id)
      effective = computeEffectivePolicy({
        node: { attachments: node?.attachments, parent: node?.parent },
        subgraphs: subgraphLookup,
        topologyDefault: next.attachments,
      })
    }

    return c.json({ effective })
  })

  return app
}

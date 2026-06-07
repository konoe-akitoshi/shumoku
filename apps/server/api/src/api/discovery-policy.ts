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
 *             id?: string,                          // node / subgraph
 *             attachments?: Attachment[] | null,    // replace; null/[] clears
 *             label?: string | null,                // node scope: name override
 *             suppressedAttachments?: string[]|null } // node: keys to remove
 *     → { effective: EffectiveDiscoveryPolicy }
 *
 * The overlay lives on the PROJECT OVERLAY — the project's own top-priority
 * contribution (`attachment_id` NULL, `source_id='intrinsic'`). It is NOT a data
 * source: writing it never creates/attaches a Manual source. A node that exists
 * ONLY in a discovered snapshot just works — detection already grabbed it, so we
 * materialize a minimal overlay entry from its resolved identity and apply the
 * attachments. (Subgraph scope still 409s — a discovered-only subgraph has
 * no identity to materialize from.)
 *
 *   POST   /discovery-policy/exclusions   body { mgmtIp?|chassisId?|sysName? }
 *     → Hide a node: add an identity-keyed exclusion. resolve() drops any
 *       cluster that matches, so a "junk" discovered node stops showing
 *       without being deleted (it can't be — the source keeps seeing it).
 *   DELETE /discovery-policy/exclusions   (same body) → Unhide.
 *
 *   POST   /discovery-policy/rebuild
 *     → Discard the WHOLE authored overlay (every node/subgraph/topology-
 *       default attachment + all exclusions). Pair with a Sync-all to refresh
 *       observed afterwards. Destructive; the UI confirms first.
 *
 * Reset (drop one node's human contribution) reuses PATCH with
 * attachments=null, label=null, suppressedAttachments=null — no dedicated
 * route. A node with any remaining human claim (attachment OR suppression) is
 * kept; only an observation-backed node with nothing left is dropped entirely.
 */

import {
  type Attachment,
  computeEffectivePolicy,
  type DiscoveryMode,
  type EffectiveDiscoveryPolicy,
  type Node,
  type NodeExclusion,
  RUNTIME_DEFAULT,
} from '@shumoku/core'
import type { Context } from 'hono'
import { Hono } from 'hono'
import { getTopologyService } from './topologies.js'

const VALID_MODES: ReadonlySet<string> = new Set<DiscoveryMode>(['auto', 'observe', 'disabled'])
const VALID_PROTOCOLS: ReadonlySet<string> = new Set(['snmp', 'ssh', 'netconf', 'http'])
// Attachment keys the human may suppress (mirror of core's `attachmentKey`).
// `metrics-binding:<sourceId>` keys are dynamic (per metrics source), so they're
// validated by prefix in `isValidAttachmentKey` rather than enumerated here.
const VALID_ATTACHMENT_KEYS: ReadonlySet<string> = new Set([
  'access:snmp',
  'access:ssh',
  'access:netconf',
  'access:http',
  'policy',
])

function isValidAttachmentKey(k: string): boolean {
  return VALID_ATTACHMENT_KEYS.has(k) || k.startsWith('metrics-binding:')
}

interface PatchBody {
  scope?: string
  id?: string
  /** Replace the scope's attachments. `null` or `[]` clears them. */
  attachments?: unknown
  /** Node scope only: authored name override. `null` / '' reverts to observed. */
  label?: unknown
  /**
   * Node scope only: attachment keys the human removed — the negative
   * counterpart to `attachments` (see core `attachmentKey`). `null` / `[]`
   * clears the suppression. A deleted access stays gone across re-scans until
   * Reset drops the whole entry.
   */
  suppressedAttachments?: unknown
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

    // `suppressedAttachments` is a node-scope negative assertion: keys the
    // human removed. `null` / `[]` clears it.
    const suppressedProvided = body.scope === 'node' && body.suppressedAttachments !== undefined
    let suppressed: string[] | undefined
    if (suppressedProvided) {
      const raw = body.suppressedAttachments
      if (raw !== null && !Array.isArray(raw)) {
        return c.json({ error: 'suppressedAttachments must be an array or null' }, 400)
      }
      const keys = Array.isArray(raw) ? raw : []
      for (const k of keys) {
        if (typeof k !== 'string' || !isValidAttachmentKey(k)) {
          return c.json({ error: `invalid attachment key: ${String(k)}` }, 400)
        }
      }
      suppressed = keys.length > 0 ? (keys as string[]) : undefined
    }

    if (!attachmentsProvided && !labelProvided && !suppressedProvided) {
      return c.json(
        { error: 'nothing to update: provide attachments, label, or suppressedAttachments' },
        400,
      )
    }

    const topology = service.get(topologyId)
    if (!topology) return c.json({ error: 'Topology not found' }, 404)

    const authored = service.readProjectOverlay(topologyId) ?? {
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
        const wantSuppress = suppressedProvided && suppressed
        if (wantAttach || wantLabel || wantSuppress) {
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
            // Node.label is required, so an attach-only entry must carry SOME
            // label — we store ''. That is NOT a special sentinel: resolve's
            // generic "empty = no value" rule (hasValue) means an empty label
            // makes no name claim, so the observed name and any future source
            // rename show through. A real rename stores the trimmed value (the
            // human's claim wins by top priority).
            label: wantLabel ? labelTrimmed : '',
            identity: discovered.identity,
            ...(wantAttach ? { attachments } : {}),
            ...(wantSuppress ? { suppressedAttachments: suppressed } : {}),
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
        if (suppressedProvided) {
          if (suppressed) target.suppressedAttachments = suppressed
          else delete target.suppressedAttachments
        }

        let removed = false
        if (labelProvided) {
          if (labelTrimmed !== '') {
            target.label = labelTrimmed
          } else {
            // Revert the name. If the entry still carries a human claim
            // (attachments OR a suppression) we KEEP it but drop the name claim
            // — store '' which resolve reads as "no name claim" (hasValue), so
            // the observed name shows through. Only when there's nothing left
            // to author (no attachments, no suppression) AND a real observation
            // backs the node do we drop the entry entirely (a full Reset =
            // remove the project's own contribution), so it re-resolves to the
            // bare observed state. For an intrinsic-only node with nothing left,
            // deleting would destroy real data — so keep it (with '' label).
            const hasAttach = Array.isArray(target.attachments) && target.attachments.length > 0
            const hasSuppress =
              Array.isArray(target.suppressedAttachments) && target.suppressedAttachments.length > 0
            const discovered = await loadDiscovered()
            const observationBacked = discovered?.provenance?.state === 'confirmed'
            if (!hasAttach && !hasSuppress && observationBacked) {
              nodes.splice(idx, 1)
              removed = true
            } else {
              target.label = '' // clear the name claim, keep the entry
            }
          }
        }

        if (!removed) nodes[idx] = target
        next.nodes = nodes
      }
    }

    await service.writeProjectOverlay(topologyId, next)
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

  // Hide / Unhide a node: add or remove an identity-keyed exclusion on the
  // authored graph. `resolve()` drops any cluster matching an exclusion, so a
  // "junk" discovered node stops showing without being deleted (it can't be —
  // the source keeps seeing it). Identity-keyed so it survives re-scans.
  //   POST   body { mgmtIp?, chassisId?, sysName? }  → hide
  //   DELETE body { mgmtIp?, chassisId?, sysName? }  → unhide
  const exclusionKey = (e: NodeExclusion): string =>
    `${e.mgmtIp ?? ''}|${e.chassisId ?? ''}|${e.sysName ?? ''}`

  const readExclusionBody = async (c: Context): Promise<NodeExclusion | null> => {
    const body = (await c.req.json().catch(() => null)) as Record<string, unknown> | null
    if (!body) return null
    const pick = (k: string): string | undefined =>
      typeof body[k] === 'string' && (body[k] as string).length > 0
        ? (body[k] as string)
        : undefined
    const ex: NodeExclusion = {
      ...(pick('mgmtIp') ? { mgmtIp: pick('mgmtIp') } : {}),
      ...(pick('chassisId') ? { chassisId: pick('chassisId') } : {}),
      ...(pick('sysName') ? { sysName: pick('sysName') } : {}),
    }
    return exclusionKey(ex) === '||' ? null : ex
  }

  app.post('/:id/discovery-policy/exclusions', async (c) => {
    const topologyId = c.req.param('id')
    const ex = await readExclusionBody(c)
    if (!ex) return c.json({ error: 'body must include mgmtIp, chassisId, or sysName' }, 400)
    const topology = service.get(topologyId)
    if (!topology) return c.json({ error: 'Topology not found' }, 404)
    const authored = service.readProjectOverlay(topologyId) ?? {
      version: '1' as const,
      name: topology.name,
      nodes: [],
      links: [],
    }
    const exclusions = [...(authored.exclusions ?? [])]
    if (!exclusions.some((e) => exclusionKey(e) === exclusionKey(ex))) exclusions.push(ex)
    await service.writeProjectOverlay(topologyId, { ...authored, exclusions })
    service.clearCacheEntry(topologyId)
    return c.json({ exclusions })
  })

  app.delete('/:id/discovery-policy/exclusions', async (c) => {
    const topologyId = c.req.param('id')
    const ex = await readExclusionBody(c)
    if (!ex) return c.json({ error: 'body must include mgmtIp, chassisId, or sysName' }, 400)
    const topology = service.get(topologyId)
    if (!topology) return c.json({ error: 'Topology not found' }, 404)
    const authored = service.readProjectOverlay(topologyId)
    if (!authored) return c.json({ exclusions: [] })
    const exclusions = (authored.exclusions ?? []).filter(
      (e) => exclusionKey(e) !== exclusionKey(ex),
    )
    await service.writeProjectOverlay(topologyId, { ...authored, exclusions })
    service.clearCacheEntry(topologyId)
    return c.json({ exclusions })
  })

  // Rebuild: discard the entire authored overlay — every node's attachments,
  // the topology-default attachments, and all exclusions — so the topology
  // falls back to "purely what the sources observed". Callers pair this with a
  // Sync-all to refresh observed afterwards. Destructive; UI confirms first.
  app.post('/:id/discovery-policy/rebuild', async (c) => {
    const topologyId = c.req.param('id')
    const topology = service.get(topologyId)
    if (!topology) return c.json({ error: 'Topology not found' }, 404)
    const authored = service.readProjectOverlay(topologyId)
    if (!authored) return c.json({ cleared: false, reason: 'no authored graph' })
    // Strip overlay: drop attachments from every node/subgraph, the topology
    // default, and all exclusions. Keep the nodes themselves out entirely —
    // a node that exists only as an overlay has nothing to keep once cleared,
    // and observation-backed ones re-resolve from their snapshots.
    const cleared = {
      ...authored,
      nodes: [],
      subgraphs: (authored.subgraphs ?? []).map(({ attachments: _a, ...sg }) => sg),
      attachments: undefined,
      exclusions: undefined,
    }
    await service.writeProjectOverlay(topologyId, cleared)
    service.clearCacheEntry(topologyId)
    return c.json({ cleared: true })
  })

  return app
}

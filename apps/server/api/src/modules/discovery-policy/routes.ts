/**
 * Discovery-policy API — per-node Discovery settings (SNMP access +
 * scheduler policy) plus the operator's authored bits (rename, hide).
 *
 * Two homes, deliberately separate:
 *
 *   - Access / policy live in the Discovery feature's OWN table
 *     (`deep_read_config`, one row per node entity — see
 *     services/deep-read-config.ts). They are feature configuration, not
 *     graph authorship: no overlay anchoring, no inheritance, no topology
 *     default. Bulk assignment is one SQL statement.
 *
 *   - Label overrides, suppressions, and exclusions (hide) stay on the
 *     PROJECT OVERLAY (`source_id='intrinsic'`) — they are the operator's
 *     claims about the graph itself.
 *
 * Routes:
 *   GET   /api/topologies/:id/discovery-policy
 *     → runtimeDefault + per-node effective policy + per-node raw config
 *       (attachment-shaped, for the edit panel).
 *
 *   PATCH /api/topologies/:id/discovery-policy
 *     body: { scope: 'topology' | 'node',
 *             id?: string,                          // node scope
 *             attachments?: Attachment[] | null,    // access/policy → config row
 *             label?: string | null,                // node: overlay name override
 *             suppressedAttachments?: string[]|null } // node: overlay removals
 *     scope 'topology' bulk-applies the attachments to EVERY node entity.
 *     → { effective: EffectiveDiscoveryPolicy }
 *
 *   POST / DELETE /discovery-policy/exclusions  — hide / unhide (overlay).
 */

import { createRoute, type OpenAPIHono, z } from '@hono/zod-openapi'
import {
  type Attachment,
  type DiscoveryMode,
  type EffectiveDiscoveryPolicy,
  type NodeExclusion,
  RUNTIME_DEFAULT,
} from '@shumoku/core'
import { nodeIdentitiesMatch } from '../../app/node-identity.js'
import type {
  AppServices,
  DeepReadConfigPatchView,
  DeepReadConfigView,
} from '../../app/services.js'
import {
  badRequestResponse,
  createOpenAPIApp,
  ErrorSchema,
  protectedRouteSecurity,
} from '../../openapi/common.js'

const VALID_MODES: ReadonlySet<string> = new Set<DiscoveryMode>(['auto', 'observe', 'disabled'])
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
  /** Replace the node's Discovery config. `null` or `[]` clears it. */
  attachments?: unknown
  /** Node scope only: authored name override. `null` / '' reverts to observed. */
  label?: unknown
  /** Node scope only: attachment keys the human removed. `null` / `[]` clears. */
  suppressedAttachments?: unknown
}

const TopologyParamsSchema = z.object({
  id: z
    .string()
    .min(1)
    .openapi({ param: { name: 'id', in: 'path' } }),
})
const DiscoveryAttachmentSchema = z.union([
  z.object({
    kind: z.literal('access'),
    protocol: z.literal('snmp'),
    community: z.string().optional(),
  }),
  z.object({
    kind: z.literal('policy'),
    mode: z.enum(['auto', 'observe', 'disabled']).optional(),
    intervalMs: z.number().nonnegative().optional(),
  }),
])
const EffectivePolicySchema = z.object({
  mode: z.enum(['auto', 'observe', 'disabled']),
  intervalMs: z.number().nonnegative(),
  community: z.string().optional(),
  source: z.object({
    mode: z.enum(['node', 'subgraph', 'topology', 'default']),
    intervalMs: z.enum(['node', 'subgraph', 'topology', 'default']),
    community: z.enum(['node', 'subgraph', 'topology', 'default']),
  }),
})
const DiscoveryPolicySchema = z
  .object({
    topologyDefault: z.null(),
    runtimeDefault: z.object({
      mode: z.enum(['auto', 'observe', 'disabled']),
      intervalMs: z.number().nonnegative(),
    }),
    nodes: z.record(z.string(), EffectivePolicySchema),
    configs: z.record(z.string(), z.array(DiscoveryAttachmentSchema)),
    subgraphs: z.record(z.string(), z.array(DiscoveryAttachmentSchema)),
  })
  .openapi('DiscoveryPolicy')
const PatchDiscoveryPolicySchema = z
  .object({
    scope: z.enum(['topology', 'node']),
    id: z.string().min(1).optional(),
    attachments: z.array(DiscoveryAttachmentSchema).nullable().optional(),
    label: z.string().nullable().optional(),
    suppressedAttachments: z.array(z.string()).nullable().optional(),
  })
  .refine(
    (input: { scope: 'topology' | 'node'; id?: string }) =>
      input.scope !== 'node' || input.id !== undefined,
    {
      message: "id is required when scope is 'node'",
    },
  )
const DiscoveryPolicyResultSchema = z.object({ effective: EffectivePolicySchema })
const NodeExclusionSchema = z
  .object({
    mgmtIp: z.string().min(1).optional(),
    chassisId: z.string().min(1).optional(),
    sysName: z.string().min(1).optional(),
  })
  .refine(
    (input: { mgmtIp?: string; chassisId?: string; sysName?: string }) =>
      input.mgmtIp || input.chassisId || input.sysName,
    {
      message: 'At least one identity key is required',
    },
  )
const ExclusionsResultSchema = z.object({ exclusions: z.array(NodeExclusionSchema) })
const notFoundResponse = {
  description: 'Topology or node not found',
  content: { 'application/json': { schema: ErrorSchema } },
} as const
const conflictResponse = {
  description: 'The node cannot be safely updated',
  content: { 'application/json': { schema: ErrorSchema } },
} as const
const internalErrorResponse = {
  description: 'Discovery policy operation failed',
  content: { 'application/json': { schema: ErrorSchema } },
} as const

const getPolicyRoute = createRoute({
  method: 'get',
  path: '/{id}/discovery-policy',
  tags: ['Discovery Policy'],
  summary: 'Get effective per-node discovery policy',
  security: protectedRouteSecurity,
  request: { params: TopologyParamsSchema },
  responses: {
    200: {
      description: 'Discovery policy',
      content: { 'application/json': { schema: DiscoveryPolicySchema } },
    },
    404: notFoundResponse,
  },
})
const patchPolicyRoute = createRoute({
  method: 'patch',
  path: '/{id}/discovery-policy',
  tags: ['Discovery Policy'],
  summary: 'Update topology or node discovery policy',
  security: protectedRouteSecurity,
  request: {
    params: TopologyParamsSchema,
    body: {
      required: true,
      content: { 'application/json': { schema: PatchDiscoveryPolicySchema } },
    },
  },
  responses: {
    200: {
      description: 'Effective policy after update',
      content: { 'application/json': { schema: DiscoveryPolicyResultSchema } },
    },
    400: badRequestResponse,
    404: notFoundResponse,
    409: conflictResponse,
    500: internalErrorResponse,
  },
})
const addExclusionRoute = createRoute({
  method: 'post',
  path: '/{id}/discovery-policy/exclusions',
  tags: ['Discovery Policy'],
  summary: 'Exclude a node identity from discovery',
  security: protectedRouteSecurity,
  request: {
    params: TopologyParamsSchema,
    body: { required: true, content: { 'application/json': { schema: NodeExclusionSchema } } },
  },
  responses: {
    200: {
      description: 'Current exclusions',
      content: { 'application/json': { schema: ExclusionsResultSchema } },
    },
    400: badRequestResponse,
    404: notFoundResponse,
  },
})
const removeExclusionRoute = createRoute({
  method: 'delete',
  path: '/{id}/discovery-policy/exclusions',
  tags: ['Discovery Policy'],
  summary: 'Remove a node identity exclusion',
  security: protectedRouteSecurity,
  request: {
    params: TopologyParamsSchema,
    body: { required: true, content: { 'application/json': { schema: NodeExclusionSchema } } },
  },
  responses: {
    200: {
      description: 'Current exclusions',
      content: { 'application/json': { schema: ExclusionsResultSchema } },
    },
    400: badRequestResponse,
    404: notFoundResponse,
  },
})

/**
 * Translate the wire-format attachments array into a full-replace config
 * patch. Only `access:snmp` and `policy` carry stored fields today — other
 * protocols are rejected rather than silently dropped.
 */
function attachmentsToConfigPatch(
  raw: unknown,
): { patch: DeepReadConfigPatchView } | { error: string } {
  // null / [] = clear everything.
  const cleared: DeepReadConfigPatchView = { community: null, mode: null, intervalMs: null }
  if (raw === null || raw === undefined) return { patch: cleared }
  if (!Array.isArray(raw)) return { error: 'attachments must be an array or null' }

  const patch: DeepReadConfigPatchView = { ...cleared }
  for (const item of raw) {
    if (!item || typeof item !== 'object') return { error: 'each attachment must be an object' }
    const a = item as Record<string, unknown>
    if (a['kind'] === 'policy') {
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
      if (mode !== undefined) patch.mode = mode as DiscoveryMode
      if (intervalMs !== undefined) patch.intervalMs = intervalMs as number
    } else if (a['kind'] === 'access') {
      if (a['protocol'] !== 'snmp') {
        return { error: 'only access:snmp is stored today — other protocols are not read yet' }
      }
      const community = a['community']
      if (community !== undefined && community !== '' && typeof community !== 'string') {
        return { error: 'community must be a string' }
      }
      if (typeof community === 'string' && community !== '') patch.community = community
    } else {
      return { error: `unknown attachment kind: ${String(a['kind'])}` }
    }
  }
  return { patch }
}

/** The effective policy a config row yields — row value or runtime default. */
function effectiveOf(cfg: DeepReadConfigView | undefined): EffectiveDiscoveryPolicy {
  return {
    mode: cfg?.mode ?? RUNTIME_DEFAULT.mode,
    intervalMs: cfg?.intervalMs ?? RUNTIME_DEFAULT.intervalMs,
    ...(cfg?.community !== undefined ? { community: cfg.community } : {}),
    source: {
      mode: cfg?.mode !== undefined ? 'node' : 'default',
      intervalMs: cfg?.intervalMs !== undefined ? 'node' : 'default',
      community: cfg?.community !== undefined ? 'node' : 'default',
    },
  }
}

/** Attachment-shaped rendering of a config row, for the edit panel. */
function configToAttachments(cfg: DeepReadConfigView): Attachment[] {
  const out: Attachment[] = []
  if (cfg.community !== undefined) {
    out.push({ kind: 'access', protocol: 'snmp', community: cfg.community })
  }
  if (cfg.mode !== undefined || cfg.intervalMs !== undefined) {
    out.push({
      kind: 'policy',
      ...(cfg.mode !== undefined ? { mode: cfg.mode } : {}),
      ...(cfg.intervalMs !== undefined ? { intervalMs: cfg.intervalMs } : {}),
    })
  }
  return out
}

export function createDiscoveryPolicyApi(
  services: Pick<AppServices, 'discoveryPolicy'>,
): OpenAPIHono {
  const app = createOpenAPIApp()
  const service = services.discoveryPolicy

  app.openapi(getPolicyRoute, async (c) => {
    const id = c.req.param('id')
    const graph = await service.getParsedGraph(id)
    if (!graph) return c.json({ error: 'Topology not found' }, 404)

    const configRows = service.listConfigs(id)
    const nodes: Record<string, EffectiveDiscoveryPolicy> = {}
    const configs: Record<string, Attachment[]> = {}
    for (const node of graph.nodes) {
      const cfg = configRows.get(node.id)
      nodes[node.id] = effectiveOf(cfg)
      if (cfg) configs[node.id] = configToAttachments(cfg)
    }

    return c.json({
      // Shape kept for the UI: there is no topology default any more — every
      // node's config is its own row (bulk-set writes them all).
      topologyDefault: null,
      runtimeDefault: RUNTIME_DEFAULT,
      nodes,
      configs,
      subgraphs: {},
    })
  })

  app.openapi(patchPolicyRoute, async (c) => {
    const topologyId = c.req.param('id')
    const body: PatchBody = c.req.valid('json')

    if (body.scope !== 'topology' && body.scope !== 'node') {
      return c.json({ error: "scope must be 'topology' or 'node'" }, 400)
    }
    if (body.scope === 'node' && !body.id) {
      return c.json({ error: "id is required when scope is 'node'" }, 400)
    }

    const topology = service.getTopology(topologyId)
    if (!topology) return c.json({ error: 'Topology not found' }, 404)

    // ── Access / policy → deep_read_config ──────────────────────────────
    const attachmentsProvided = body.attachments !== undefined
    let configPatch: DeepReadConfigPatchView | undefined
    if (attachmentsProvided) {
      const parsedPatch = attachmentsToConfigPatch(body.attachments)
      if ('error' in parsedPatch) return c.json({ error: parsedPatch.error }, 400)
      configPatch = parsedPatch.patch
    }

    if (body.scope === 'topology') {
      if (!configPatch) {
        return c.json({ error: 'nothing to update: provide attachments' }, 400)
      }
      service.bulkSetConfig(topologyId, configPatch)
      service.clearCache(topologyId)
      return c.json({
        effective: effectiveOf({
          entityId: '*',
          ...(configPatch.community != null ? { community: configPatch.community } : {}),
          ...(configPatch.mode != null ? { mode: configPatch.mode } : {}),
          ...(configPatch.intervalMs != null ? { intervalMs: configPatch.intervalMs } : {}),
        }),
      })
    }

    // ── scope === 'node' ────────────────────────────────────────────────
    const nodeId = body.id as string

    const labelProvided = body.label !== undefined
    let labelTrimmed = ''
    if (labelProvided) {
      if (body.label !== null && typeof body.label !== 'string') {
        return c.json({ error: 'label must be a string or null' }, 400)
      }
      labelTrimmed = typeof body.label === 'string' ? body.label.trim() : ''
    }

    const suppressedProvided = body.suppressedAttachments !== undefined
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

    if (!configPatch && !labelProvided && !suppressedProvided) {
      return c.json(
        { error: 'nothing to update: provide attachments, label, or suppressedAttachments' },
        400,
      )
    }

    let resultCfg: DeepReadConfigView | null = null
    if (configPatch) {
      const upserted = service.upsertConfig(topologyId, nodeId, configPatch)
      if (upserted === 'not-a-node') {
        return c.json({ error: `node '${nodeId}' is not a node entity of this topology` }, 409)
      }
      resultCfg = upserted
    } else {
      const configs = service.listConfigs(topologyId)
      resultCfg = configs.get(nodeId) ?? null
    }

    // ── Label / suppression → project overlay (authored) ────────────────
    if (labelProvided || suppressedProvided) {
      const overlayError = await patchOverlayNode(topologyId, nodeId, {
        labelProvided,
        labelTrimmed,
        suppressedProvided,
        suppressed,
      })
      if (overlayError) return c.json({ error: overlayError.error }, overlayError.status)
      service.clearCache(topologyId)
    }

    return c.json({ effective: effectiveOf(resultCfg ?? undefined) })
  })

  /**
   * Apply a label override and/or suppression set to the node's authored
   * overlay entry — materializing a thin identity-anchored entry when needed,
   * and dropping the entry when nothing authored remains on an
   * observation-backed node. Returns an error Response, or null on success.
   */
  async function patchOverlayNode(
    topologyId: string,
    nodeId: string,
    opts: {
      labelProvided: boolean
      labelTrimmed: string
      suppressedProvided: boolean
      suppressed: string[] | undefined
    },
  ): Promise<{ status: 404 | 409 | 500; error: string } | null> {
    const topology = service.getTopology(topologyId)
    if (!topology) return { status: 404, error: 'Topology not found' }
    const authored = service.readOverlay(topologyId) ?? {
      version: '1' as const,
      name: topology.name,
      nodes: [],
      links: [],
    }
    const next = { ...authored }
    const nodes = [...next.nodes]

    const resolved = await service.getParsedGraph(topologyId)
    const discoveredNode = resolved?.nodes.find((node) => node.id === nodeId)

    let idx = nodes.findIndex((n) => n.id === nodeId)
    if (idx === -1 && discoveredNode?.identity) {
      idx = nodes.findIndex((n) => nodeIdentitiesMatch(n.identity, discoveredNode.identity))
    }

    if (idx === -1) {
      // Discovered-only node: materialize a THIN authored entry only when the
      // operator actually authored something (a rename or a suppression).
      const wantLabel = opts.labelProvided && opts.labelTrimmed !== ''
      const wantSuppress = opts.suppressedProvided && opts.suppressed
      if (wantLabel || wantSuppress) {
        if (!discoveredNode) {
          return { status: 404, error: `node '${nodeId}' not found` }
        }
        if (!discoveredNode.identity) {
          return {
            status: 409,
            error: `node '${nodeId}' has no identity to anchor an overlay`,
          }
        }
        nodes.push({
          id: nodeId,
          // '' = no name claim (resolve's hasValue rule); observed name shows.
          label: wantLabel ? opts.labelTrimmed : '',
          identity: discoveredNode.identity,
          ...(wantSuppress ? { suppressedAttachments: opts.suppressed } : {}),
        })
        next.nodes = nodes
        await service.writeOverlay(topologyId, next)
      }
      return null
    }

    const current = nodes[idx]
    if (!current) return { status: 500, error: 'node index lost' }
    const target = { ...current }

    if (opts.suppressedProvided) {
      if (opts.suppressed) target.suppressedAttachments = opts.suppressed
      else delete target.suppressedAttachments
    }

    let removed = false
    if (opts.labelProvided) {
      if (opts.labelTrimmed !== '') {
        target.label = opts.labelTrimmed
      } else {
        // Revert the name. Drop the whole entry when nothing authored remains
        // and a real observation backs the node; otherwise keep it label-less.
        const hasSuppress =
          Array.isArray(target.suppressedAttachments) && target.suppressedAttachments.length > 0
        const observationBacked = discoveredNode?.provenance?.state === 'confirmed'
        if (!hasSuppress && observationBacked) {
          nodes.splice(idx, 1)
          removed = true
        } else {
          target.label = ''
        }
      }
    }

    if (!removed) nodes[idx] = target
    next.nodes = nodes
    await service.writeOverlay(topologyId, next)
    return null
  }

  // Hide / Unhide a node: identity-keyed exclusion on the authored graph.
  const exclusionKey = (e: NodeExclusion): string =>
    `${e.mgmtIp ?? ''}|${e.chassisId ?? ''}|${e.sysName ?? ''}`

  app.openapi(addExclusionRoute, async (c) => {
    const topologyId = c.req.param('id')
    const ex: NodeExclusion = c.req.valid('json')
    const topology = service.getTopology(topologyId)
    if (!topology) return c.json({ error: 'Topology not found' }, 404)
    const authored = service.readOverlay(topologyId) ?? {
      version: '1' as const,
      name: topology.name,
      nodes: [],
      links: [],
    }
    const exclusions = [...(authored.exclusions ?? [])]
    if (!exclusions.some((e) => exclusionKey(e) === exclusionKey(ex))) exclusions.push(ex)
    await service.writeOverlay(topologyId, { ...authored, exclusions })
    service.clearCache(topologyId)
    return c.json({ exclusions })
  })

  app.openapi(removeExclusionRoute, async (c) => {
    const topologyId = c.req.param('id')
    const ex: NodeExclusion = c.req.valid('json')
    const topology = service.getTopology(topologyId)
    if (!topology) return c.json({ error: 'Topology not found' }, 404)
    const authored = service.readOverlay(topologyId)
    if (!authored) return c.json({ exclusions: [] })
    const exclusions = (authored.exclusions ?? []).filter(
      (e) => exclusionKey(e) !== exclusionKey(ex),
    )
    await service.writeOverlay(topologyId, { ...authored, exclusions })
    service.clearCache(topologyId)
    return c.json({ exclusions })
  })

  return app
}

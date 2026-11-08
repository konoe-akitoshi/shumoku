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
 *   - Label overrides, suppressions, and exclusions (hide) used to be written to
 *     the hidden project overlay. That overlay is gone: a rename and a hide are
 *     nodes of a Manual source now (`{ id, label }`, `{ id, absent: true }`). Until
 *     the editing API for that lands, these three calls answer 410 Gone.
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
 *             label?: string | null,                // 410 Gone (see above)
 *             suppressedAttachments?: string[]|null } // 410 Gone (see above)
 *     scope 'topology' bulk-applies the attachments to EVERY node entity.
 *     → { effective: EffectiveDiscoveryPolicy }
 *
 *   POST / DELETE /discovery-policy/exclusions  — hide / unhide: 410 Gone.
 */

import { createRoute, type OpenAPIHono, z } from '@hono/zod-openapi'
import { type DiscoveryMode, type EffectiveDiscoveryPolicy, RUNTIME_DEFAULT } from '@shumoku/core'
import type {
  AppServices,
  DeepReadConfigPatchView,
  DeepReadConfigView,
} from '../../app/services.js'
import {
  apiErrorPayload,
  badRequestResponse,
  createOpenAPIApp,
  ErrorSchema,
  protectedRouteSecurity,
} from '../../openapi/common.js'

const VALID_MODES: ReadonlySet<string> = new Set<DiscoveryMode>(['auto', 'observe', 'disabled'])

interface PatchBody {
  scope?: string
  id?: string
  /** Replace the node's Discovery config. `null` or `[]` clears it. */
  attachments?: unknown
  /** Node scope only: answers 410 Gone, a rename is a node of a Manual source now. */
  label?: unknown
  /** Node scope only: answers 410 Gone, the overlay it removed from is gone. */
  suppressedAttachments?: unknown
}

const GONE_MESSAGE =
  'Renaming and hiding a node moved into a Manual source ("<topology> edits"); ' +
  'edit that source instead. This call no longer writes anything.'

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
const notFoundResponse = {
  description: 'Topology or node not found',
  content: { 'application/json': { schema: ErrorSchema } },
} as const
const conflictResponse = {
  description: 'The node cannot be safely updated',
  content: { 'application/json': { schema: ErrorSchema } },
} as const
const goneResponse = {
  description: 'Rename / hide moved into a Manual source; this call no longer writes anything',
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
    410: goneResponse,
    500: internalErrorResponse,
  },
})
const addExclusionRoute = createRoute({
  method: 'post',
  path: '/{id}/discovery-policy/exclusions',
  tags: ['Discovery Policy'],
  summary: 'Exclude a node identity from discovery (gone: use a Manual source)',
  security: protectedRouteSecurity,
  request: {
    params: TopologyParamsSchema,
    body: { required: true, content: { 'application/json': { schema: NodeExclusionSchema } } },
  },
  responses: {
    400: badRequestResponse,
    404: notFoundResponse,
    410: goneResponse,
  },
})
const removeExclusionRoute = createRoute({
  method: 'delete',
  path: '/{id}/discovery-policy/exclusions',
  tags: ['Discovery Policy'],
  summary: 'Remove a node identity exclusion (gone: use a Manual source)',
  security: protectedRouteSecurity,
  request: {
    params: TopologyParamsSchema,
    body: { required: true, content: { 'application/json': { schema: NodeExclusionSchema } } },
  },
  responses: {
    400: badRequestResponse,
    404: notFoundResponse,
    410: goneResponse,
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
function configToAttachments(cfg: DeepReadConfigView): z.infer<typeof DiscoveryAttachmentSchema>[] {
  const out: z.infer<typeof DiscoveryAttachmentSchema>[] = []
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
    if (!graph) return c.json(apiErrorPayload(c, 'Topology not found', 404), 404)

    const configRows = service.listConfigs(id)
    const nodes: Record<string, EffectiveDiscoveryPolicy> = {}
    const configs: Record<string, z.infer<typeof DiscoveryAttachmentSchema>[]> = {}
    for (const node of graph.nodes) {
      const cfg = configRows.get(node.id)
      nodes[node.id] = effectiveOf(cfg)
      if (cfg) configs[node.id] = configToAttachments(cfg)
    }

    return c.json(
      {
        // Shape kept for the UI: there is no topology default any more — every
        // node's config is its own row (bulk-set writes them all).
        topologyDefault: null,
        runtimeDefault: RUNTIME_DEFAULT,
        nodes,
        configs,
        subgraphs: {},
      },
      200,
    )
  })

  app.openapi(patchPolicyRoute, async (c) => {
    const topologyId = c.req.param('id')
    const body: PatchBody = c.req.valid('json')

    if (body.scope !== 'topology' && body.scope !== 'node') {
      return c.json(apiErrorPayload(c, "scope must be 'topology' or 'node'", 400), 400)
    }
    if (body.scope === 'node' && !body.id) {
      return c.json(apiErrorPayload(c, "id is required when scope is 'node'", 400), 400)
    }

    // A rename or a suppression used to be written to the overlay; it is gone. Refuse the whole
    // request rather than apply half of it.
    if (body.label !== undefined || body.suppressedAttachments !== undefined) {
      return c.json(apiErrorPayload(c, GONE_MESSAGE, 410), 410)
    }

    const topology = service.getTopology(topologyId)
    if (!topology) return c.json(apiErrorPayload(c, 'Topology not found', 404), 404)

    // ── Access / policy → deep_read_config ──────────────────────────────
    const attachmentsProvided = body.attachments !== undefined
    let configPatch: DeepReadConfigPatchView | undefined
    if (attachmentsProvided) {
      const parsedPatch = attachmentsToConfigPatch(body.attachments)
      if ('error' in parsedPatch) return c.json(apiErrorPayload(c, parsedPatch.error, 400), 400)
      configPatch = parsedPatch.patch
    }

    if (body.scope === 'topology') {
      if (!configPatch) {
        return c.json(apiErrorPayload(c, 'nothing to update: provide attachments', 400), 400)
      }
      service.bulkSetConfig(topologyId, configPatch)
      service.clearCache(topologyId)
      return c.json(
        {
          effective: effectiveOf({
            entityId: '*',
            ...(configPatch.community != null ? { community: configPatch.community } : {}),
            ...(configPatch.mode != null ? { mode: configPatch.mode } : {}),
            ...(configPatch.intervalMs != null ? { intervalMs: configPatch.intervalMs } : {}),
          }),
        },
        200,
      )
    }

    // ── scope === 'node' ────────────────────────────────────────────────
    const nodeId = body.id as string

    if (!configPatch) {
      return c.json(apiErrorPayload(c, 'nothing to update: provide attachments', 400), 400)
    }

    let resultCfg: DeepReadConfigView | null = null
    if (configPatch) {
      const upserted = service.upsertConfig(topologyId, nodeId, configPatch)
      if (upserted === 'not-a-node') {
        return c.json(
          apiErrorPayload(c, `node '${nodeId}' is not a node entity of this topology`, 409),
          409,
        )
      }
      resultCfg = upserted
    } else {
      const configs = service.listConfigs(topologyId)
      resultCfg = configs.get(nodeId) ?? null
    }

    return c.json({ effective: effectiveOf(resultCfg ?? undefined) }, 200)
  })

  // Hide / unhide a node: an exclusion on the overlay used to carry it. The overlay is gone and
  // a hide is a Manual node marked `absent`, so these answer 410 until that editing API lands.
  app.openapi(addExclusionRoute, (c) => c.json(apiErrorPayload(c, GONE_MESSAGE, 410), 410))
  app.openapi(removeExclusionRoute, (c) => c.json(apiErrorPayload(c, GONE_MESSAGE, 410), 410))

  return app
}

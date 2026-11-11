/**
 * Discovery-policy API — the operator's authored bits on a discovered node:
 * rename, remove an attachment, and hide.
 *
 * These stay on the PROJECT OVERLAY (`source_id='intrinsic'`): they are the
 * operator's claims about the graph itself. How a device is READ (credential
 * profile, enabled, last outcome) is not here — that is feature configuration
 * with its own home, see modules/devices.
 *
 * Routes:
 *   PATCH /api/topologies/:id/discovery-policy
 *     body: { id: string,                              // node entity id
 *             label?: string | null,                   // overlay name override
 *             suppressedAttachments?: string[] | null } // overlay removals
 *     → { success: true }
 *
 *   POST / DELETE /discovery-policy/exclusions  — hide / unhide (overlay).
 */

import { createRoute, type OpenAPIHono, z } from '@hono/zod-openapi'
import type { NodeExclusion, SourceNetwork } from '@shumoku/core'
import { nodeIdentitiesMatch } from '../../app/node-identity.js'
import type { AppServices } from '../../app/services.js'
import {
  apiErrorPayload,
  badRequestResponse,
  createOpenAPIApp,
  ErrorSchema,
  protectedRouteSecurity,
} from '../../openapi/common.js'

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
  id: string
  /** Authored name override. `null` / '' reverts to observed. */
  label?: unknown
  /** Attachment keys the human removed. `null` / `[]` clears. */
  suppressedAttachments?: unknown
}

const TopologyParamsSchema = z.object({
  id: z
    .string()
    .min(1)
    .openapi({ param: { name: 'id', in: 'path' } }),
})
const PatchDiscoveryPolicySchema = z.object({
  id: z.string().min(1),
  label: z.string().nullable().optional(),
  suppressedAttachments: z.array(z.string()).nullable().optional(),
})
const DiscoveryPolicyResultSchema = z.object({ success: z.literal(true) })
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

const patchPolicyRoute = createRoute({
  method: 'patch',
  path: '/{id}/discovery-policy',
  tags: ['Discovery Policy'],
  summary: 'Rename or remove an attachment on a discovered node',
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
      description: 'Node updated',
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

export function createDiscoveryPolicyApi(
  services: Pick<AppServices, 'discoveryPolicy'>,
): OpenAPIHono {
  const app = createOpenAPIApp()
  const service = services.discoveryPolicy

  app.openapi(patchPolicyRoute, async (c) => {
    const topologyId = c.req.param('id')
    const body: PatchBody = c.req.valid('json')

    const topology = service.getTopology(topologyId)
    if (!topology) return c.json(apiErrorPayload(c, 'Topology not found', 404), 404)

    const nodeId = body.id

    const labelProvided = body.label !== undefined
    let labelTrimmed = ''
    if (labelProvided) {
      if (body.label !== null && typeof body.label !== 'string') {
        return c.json(apiErrorPayload(c, 'label must be a string or null', 400), 400)
      }
      labelTrimmed = typeof body.label === 'string' ? body.label.trim() : ''
    }

    const suppressedProvided = body.suppressedAttachments !== undefined
    let suppressed: string[] | undefined
    if (suppressedProvided) {
      const raw = body.suppressedAttachments
      if (raw !== null && !Array.isArray(raw)) {
        return c.json(
          apiErrorPayload(c, 'suppressedAttachments must be an array or null', 400),
          400,
        )
      }
      const keys = Array.isArray(raw) ? raw : []
      for (const k of keys) {
        if (typeof k !== 'string' || !isValidAttachmentKey(k)) {
          return c.json(apiErrorPayload(c, `invalid attachment key: ${String(k)}`, 400), 400)
        }
      }
      suppressed = keys.length > 0 ? (keys as string[]) : undefined
    }

    if (!labelProvided && !suppressedProvided) {
      return c.json(
        apiErrorPayload(c, 'nothing to update: provide label or suppressedAttachments', 400),
        400,
      )
    }

    const overlayError = await patchOverlayNode(topologyId, nodeId, {
      labelProvided,
      labelTrimmed,
      suppressedProvided,
      suppressed,
    })
    if (overlayError) {
      return c.json(
        apiErrorPayload(c, overlayError.error, overlayError.status),
        overlayError.status,
      )
    }
    service.clearCache(topologyId)
    return c.json({ success: true as const }, 200)
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
    const authored: SourceNetwork = service.readOverlay(topologyId) ?? {
      network: { name: topology.name, nodes: [], links: [] },
    }
    const nodes = [...authored.network.nodes]
    const observed = { ...authored.observation?.nodes }
    const write = () =>
      service.writeOverlay(topologyId, {
        ...authored,
        network: { ...authored.network, nodes },
        observation: { ...authored.observation, nodes: observed },
      })

    const resolved = await service.getParsed(topologyId)
    const discoveredNode = resolved?.graph.nodes.find((node) => node.id === nodeId)
    // What the merged node is recognized by: the record's attributes, never the graph.
    const discovered = resolved?.record.attributes[nodeId]
    const anchored = discovered && Object.keys(discovered).length > 0 ? discovered : undefined

    let idx = nodes.findIndex((n) => n.id === nodeId)
    if (idx === -1 && anchored) {
      idx = nodes.findIndex((n) => nodeIdentitiesMatch(n, anchored))
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
        if (!anchored) {
          return {
            status: 409,
            error: `node '${nodeId}' has no address, chassisId, sysName or mac to anchor an overlay`,
          }
        }
        // The overlay node writes the attributes that anchor it to the device, as configuration.
        // No label = no name claim; the observed name shows.
        const { addresses: _held, ...attributes } = anchored
        nodes.push({ id: nodeId, ...attributes, ...(wantLabel && { label: opts.labelTrimmed }) })
        if (wantSuppress) observed[nodeId] = { suppressedAttachments: opts.suppressed }
        await write()
      }
      return null
    }

    const current = nodes[idx]
    if (!current) return { status: 500, error: 'node index lost' }
    const target = { ...current }
    const targetObserved = { ...observed[current.id] }

    if (opts.suppressedProvided) {
      if (opts.suppressed) targetObserved.suppressedAttachments = opts.suppressed
      else delete targetObserved.suppressedAttachments
    }

    let removed = false
    if (opts.labelProvided) {
      if (opts.labelTrimmed !== '') {
        target.label = opts.labelTrimmed
      } else {
        // Revert the name. Drop the whole entry when nothing authored remains
        // and a real observation backs the node; otherwise keep it label-less.
        const hasSuppress = (targetObserved.suppressedAttachments?.length ?? 0) > 0
        const observationBacked =
          resolved?.record.observation.nodes?.[nodeId]?.provenance?.state === 'confirmed'
        if (!hasSuppress && observationBacked) {
          nodes.splice(idx, 1)
          delete observed[current.id]
          removed = true
        } else {
          delete target.label
        }
      }
    }

    if (!removed) {
      nodes[idx] = target
      observed[current.id] = targetObserved
    }
    await write()
    return null
  }

  // Hide / Unhide a node: an exclusion by the node's attributes, on the project's record.
  const exclusionKey = (e: NodeExclusion): string =>
    `${e.mgmtIp ?? ''}|${e.chassisId ?? ''}|${e.sysName ?? ''}`

  app.openapi(addExclusionRoute, async (c) => {
    const topologyId = c.req.param('id')
    const ex: NodeExclusion = c.req.valid('json')
    const topology = service.getTopology(topologyId)
    if (!topology) return c.json(apiErrorPayload(c, 'Topology not found', 404), 404)
    const authored: SourceNetwork = service.readOverlay(topologyId) ?? {
      network: { name: topology.name, nodes: [], links: [] },
    }
    const exclusions = [...(authored.observation?.exclusions ?? [])]
    if (!exclusions.some((e) => exclusionKey(e) === exclusionKey(ex))) exclusions.push(ex)
    await service.writeOverlay(topologyId, {
      ...authored,
      observation: { ...authored.observation, exclusions },
    })
    service.clearCache(topologyId)
    return c.json({ exclusions }, 200)
  })

  app.openapi(removeExclusionRoute, async (c) => {
    const topologyId = c.req.param('id')
    const ex: NodeExclusion = c.req.valid('json')
    const topology = service.getTopology(topologyId)
    if (!topology) return c.json(apiErrorPayload(c, 'Topology not found', 404), 404)
    const authored = service.readOverlay(topologyId)
    if (!authored) return c.json({ exclusions: [] }, 200)
    const exclusions = (authored.observation?.exclusions ?? []).filter(
      (e) => exclusionKey(e) !== exclusionKey(ex),
    )
    await service.writeOverlay(topologyId, {
      ...authored,
      observation: { ...authored.observation, exclusions },
    })
    service.clearCache(topologyId)
    return c.json({ exclusions }, 200)
  })

  return app
}

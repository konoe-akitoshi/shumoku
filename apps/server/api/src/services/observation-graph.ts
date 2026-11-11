// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * The boundary a source's observation crosses before it may replace canonical state: a
 * `SourceNetwork` — the network in the configuration's shape, what the source says of it beside
 * it, and how the source would draw it. Loose objects keep upstream extensions; malformed known
 * fields fail the whole observation (never silently delete nodes); untrusted inline icons are
 * sanitized.
 */

import {
  type AccessAttachment,
  type Attachment,
  type AttachmentMeta,
  asEntityId,
  type CanvasSettings,
  type ComputeSpec,
  DeviceType,
  type Direction,
  type DiscoveryMode,
  type EntityId,
  type GraphSettings,
  type HardwareSpec,
  type Identity,
  type LegendSettings,
  type LinkStyle,
  type MetricsBindingAttachment,
  type NodeExclusion,
  type NodeShape,
  type NodeSpec,
  type NodeStyle,
  type PaperOrientation,
  type PaperSize,
  type PolicyAttachment,
  type Provenance,
  type RegionIdentity,
  type ServiceSpec,
  type SourceNetwork,
  type SubgraphStyle,
  type ThemeType,
} from '@shumoku/core'
import { z } from 'zod'
import { sanitizeObservationIcon } from './sanitize-icon.js'

// Require every model key, including optional keys, so a core model addition
// cannot silently bypass validation. `satisfies ZodType<T>` also checks outputs.
function modelObject<T>() {
  return <S extends z.ZodRawShape & Record<keyof T, z.ZodType>>(shape: S) => z.looseObject(shape)
}

const nodeShapeSchema = z.enum([
  'rect',
  'rounded',
  'circle',
  'diamond',
  'hexagon',
  'cylinder',
  'stadium',
  'trapezoid',
]) satisfies z.ZodType<NodeShape>

const nodeStyleSchema = modelObject<NodeStyle>()({
  fill: z.string().optional(),
  stroke: z.string().optional(),
  strokeWidth: z.number().optional(),
  strokeDasharray: z.string().optional(),
  textColor: z.string().optional(),
  fontSize: z.number().optional(),
  fontWeight: z.enum(['normal', 'bold']).optional(),
  opacity: z.number().optional(),
}) satisfies z.ZodType<NodeStyle>

const deviceTypeSchema = z.enum(DeviceType) satisfies z.ZodType<DeviceType>

// Strip script/handlers from an untrusted inline icon at ingestion.
const iconFieldSchema = z
  .string()
  .transform((icon) => sanitizeObservationIcon(icon))
  .optional()

const hardwareSpecSchema = modelObject<HardwareSpec>()({
  icon: iconFieldSchema,
  vendor: z.string().optional(),
  kind: z.literal('hardware'),
  type: deviceTypeSchema.optional(),
  model: z.string().optional(),
}) satisfies z.ZodType<HardwareSpec>

const computeSpecSchema = modelObject<ComputeSpec>()({
  icon: iconFieldSchema,
  vendor: z.string().optional(),
  kind: z.literal('compute'),
  type: deviceTypeSchema.optional(),
  platform: z.string().optional(),
}) satisfies z.ZodType<ComputeSpec>

const serviceSpecSchema = modelObject<ServiceSpec>()({
  icon: iconFieldSchema,
  vendor: z.string().optional(),
  kind: z.literal('service'),
  service: z.string(),
  resource: z.string().optional(),
}) satisfies z.ZodType<ServiceSpec>

const nodeSpecSchema = z.union([
  hardwareSpecSchema,
  computeSpecSchema,
  serviceSpecSchema,
]) satisfies z.ZodType<NodeSpec>

const provenanceSchema = modelObject<Provenance>()({
  source: z.string(),
  state: z.enum(['confirmed', 'intrinsic-only', 'discovered-only', 'conflicting']).optional(),
  observedAt: z.number().optional(),
}) satisfies z.ZodType<Provenance>

/** The keys a hosts / metrics source reports (a metrics binding's `interfaceIdentity`). */
const identitySchema = modelObject<Identity>()({
  mgmtIp: z.string().optional(),
  chassisId: z.string().optional(),
  sysName: z.string().optional(),
  ifIndex: z.number().optional(),
  ifName: z.string().optional(),
  mac: z.string().optional(),
  vendorIds: z.record(z.string(), z.string()).optional(),
}) satisfies z.ZodType<Identity>

const attachmentMetaSchema = modelObject<AttachmentMeta>()({
  provenance: provenanceSchema.optional(),
}) satisfies z.ZodType<AttachmentMeta>

const accessAttachmentSchema = z.intersection(
  z.union([
    z.looseObject({
      kind: z.literal('access'),
      protocol: z.literal('snmp'),
      community: z.string().optional(),
      version: z.enum(['2c', '3']).optional(),
    }),
    z.looseObject({
      kind: z.literal('access'),
      protocol: z.literal('ssh'),
      username: z.string().optional(),
      port: z.number().optional(),
    }),
    z.looseObject({
      kind: z.literal('access'),
      protocol: z.enum(['netconf', 'http']),
    }),
  ]),
  attachmentMetaSchema,
) satisfies z.ZodType<AccessAttachment>

const discoveryModeSchema = z.enum([
  'auto',
  'observe',
  'disabled',
]) satisfies z.ZodType<DiscoveryMode>

const policyAttachmentSchema = modelObject<PolicyAttachment>()({
  provenance: provenanceSchema.optional(),
  kind: z.literal('policy'),
  mode: discoveryModeSchema.optional(),
  intervalMs: z.number().optional(),
}) satisfies z.ZodType<PolicyAttachment>

const metricsBindingAttachmentSchema = modelObject<MetricsBindingAttachment>()({
  provenance: provenanceSchema.optional(),
  kind: z.literal('metrics-binding'),
  sourceId: z.string(),
  hostId: z.string().optional(),
  hostName: z.string().optional(),
  interfaceIdentity: identitySchema.optional(),
  interfaceName: z.string().optional(),
  bandwidth: z.number().optional(),
}) satisfies z.ZodType<MetricsBindingAttachment>

const attachmentSchema = z.union([
  accessAttachmentSchema,
  policyAttachmentSchema,
  metricsBindingAttachmentSchema,
]) satisfies z.ZodType<Attachment>

const entityIdSchema = z.string().transform(asEntityId) satisfies z.ZodType<EntityId>

const linkStyleSchema = modelObject<LinkStyle>()({
  stroke: z.string().optional(),
  strokeWidth: z.number().optional(),
  strokeDasharray: z.string().optional(),
  opacity: z.number().optional(),
  minLength: z.number().optional(),
}) satisfies z.ZodType<LinkStyle>

const regionIdentitySchema = modelObject<RegionIdentity>()({
  name: z.string().optional(),
  keys: z.record(z.string(), z.string()).optional(),
}) satisfies z.ZodType<RegionIdentity>

const directionSchema = z.enum(['TB', 'BT', 'LR', 'RL']) satisfies z.ZodType<Direction>

const subgraphStyleSchema = modelObject<SubgraphStyle>()({
  fill: z.string().optional(),
  stroke: z.string().optional(),
  strokeWidth: z.number().optional(),
  strokeDasharray: z.string().optional(),
  labelPosition: z.enum(['top', 'bottom', 'left', 'right']).optional(),
  labelFontSize: z.number().optional(),
  padding: z.number().optional(),
  nodeSpacing: z.number().optional(),
  rankSpacing: z.number().optional(),
}) satisfies z.ZodType<SubgraphStyle>

const themeTypeSchema = z.enum(['light', 'dark']) satisfies z.ZodType<ThemeType>

const paperSizeSchema = z.enum([
  'A0',
  'A1',
  'A2',
  'A3',
  'A4',
  'B0',
  'B1',
  'B2',
  'B3',
  'B4',
  'letter',
  'legal',
  'tabloid',
]) satisfies z.ZodType<PaperSize>

const paperOrientationSchema = z.enum([
  'portrait',
  'landscape',
]) satisfies z.ZodType<PaperOrientation>

const canvasSettingsSchema = modelObject<CanvasSettings>()({
  preset: paperSizeSchema.optional(),
  orientation: paperOrientationSchema.optional(),
  width: z.number().optional(),
  height: z.number().optional(),
  dpi: z.number().optional(),
  fit: z.boolean().optional(),
  padding: z.number().optional(),
}) satisfies z.ZodType<CanvasSettings>

const legendSettingsSchema = modelObject<LegendSettings>()({
  enabled: z.boolean().optional(),
  position: z.enum(['top-left', 'top-right', 'bottom-left', 'bottom-right']).optional(),
  showDeviceTypes: z.boolean().optional(),
  showBandwidth: z.boolean().optional(),
  showCableTypes: z.boolean().optional(),
  showVlans: z.boolean().optional(),
}) satisfies z.ZodType<LegendSettings>

const graphSettingsSchema = modelObject<GraphSettings>()({
  direction: directionSchema.optional(),
  theme: themeTypeSchema.optional(),
  nodeSpacing: z.number().optional(),
  rankSpacing: z.number().optional(),
  subgraphPadding: z.number().optional(),
  canvas: canvasSettingsSchema.optional(),
  legend: z.union([z.boolean(), legendSettingsSchema]).optional(),
  hideDisconnected: z.boolean().optional(),
  boundary: z.array(z.string()).optional(),
}) satisfies z.ZodType<GraphSettings>

const nodeExclusionSchema = modelObject<NodeExclusion>()({
  mgmtIp: z.string().optional(),
  chassisId: z.string().optional(),
  sysName: z.string().optional(),
}) satisfies z.ZodType<NodeExclusion>

// --- What a source observed, in the network model's shape -------------------

const oneOrMore = z.union([z.string(), z.array(z.string())])

const inputPlugSchema = z.looseObject({
  cage: z.string().optional(),
  module: z
    .looseObject({
      standard: z.string(),
      sku: z.string().optional(),
      productId: z.string().optional(),
    })
    .optional(),
})

const inputEndpointSchema = z.union([
  z.looseObject({
    node: z.string().min(1),
    port: z.string().optional(),
    plug: inputPlugSchema.optional(),
  }),
  z.looseObject({ segment: z.string().min(1) }),
  z.looseObject({ routingDomain: z.string().min(1) }),
])

const inputPortSchema = z.looseObject({
  name: z.string().min(1),
  label: z.string().optional(),
  interfaceName: z.string().optional(),
  aliases: z.array(z.string()).optional(),
  role: z.string().optional(),
  faceplateLabel: z.string().optional(),
  speed: z.string().optional(),
  connectors: z.array(z.string()).optional(),
  poe: z.boolean().optional(),
  source: z.enum(['catalog', 'custom']).optional(),
  mac: z.string().optional(),
  notes: z.string().optional(),
})

const inputNodeSchema = z.looseObject({
  id: z.string().min(1),
  label: z.string().optional(),
  type: z.string().optional(),
  product: z.string().optional(),
  productId: z.string().optional(),
  platform: z.string().optional(),
  service: z.string().optional(),
  resource: z.string().optional(),
  software: z.string().optional(),
  address: z.string().optional(),
  sysName: z.string().optional(),
  chassisId: z.string().optional(),
  mac: z.string().optional(),
  asn: z.number().optional(),
  description: z.string().optional(),
  group: z.string().optional(),
  assumed: z.literal(true).optional(),
  host: z.string().optional(),
  members: z.array(z.string()).optional(),
  ports: z.array(inputPortSchema).optional(),
})

const inputCableSchema = z.union([
  z.string(),
  z.looseObject({ type: z.string().optional(), productId: z.string().optional() }),
])

const inputLinkSchema = z.looseObject({
  id: z.string().optional(),
  endpoints: z.tuple([inputEndpointSchema, inputEndpointSchema]),
  speed: z.string().optional(),
  bandwidth: z.string().optional(),
  cable: inputCableSchema.optional(),
  length: z.string().optional(),
  via: z.array(z.string()).optional(),
  segments: z.array(z.string()).optional(),
  description: z.string().optional(),
  connection: z.string().optional(),
  assumed: z.literal(true).optional(),
  virtual: z.literal(true).optional(),
})

const inputTerminationSchema = z.looseObject({
  id: z.string().min(1),
  label: z.string().optional(),
  role: z.enum(['outlet', 'eps', 'panel']),
  autoFor: z.string().optional(),
})

interface InputGroupShape {
  id: string
  label?: string | undefined
  groups?: InputGroupShape[] | undefined
}
const inputGroupSchema: z.ZodType<InputGroupShape> = z.looseObject({
  id: z.string().min(1),
  label: z.string().optional(),
  get groups() {
    return z.array(inputGroupSchema).optional()
  },
})

const inputNetworkSchema = z.looseObject({
  name: z.string().optional(),
  description: z.string().optional(),
  groups: z.array(inputGroupSchema).optional(),
  routingDomains: z
    .array(
      z.looseObject({
        id: z.string().min(1),
        label: z.string().optional(),
        prefix: oneOrMore.optional(),
      }),
    )
    .optional(),
  connections: z
    .array(z.looseObject({ id: z.string().min(1), label: z.string().optional() }))
    .optional(),
  segments: z
    .array(
      z.looseObject({
        id: z.string().min(1),
        label: z.string().optional(),
        vlan: z.number().optional(),
        prefix: oneOrMore.optional(),
        routingDomain: z.string().optional(),
        group: z.string().optional(),
        addresses: z.record(z.string(), oneOrMore).optional(),
      }),
    )
    .optional(),
  redundancy: z
    .array(
      z.looseObject({
        id: z.string().min(1),
        label: z.string().optional(),
        nodes: z.array(z.string()),
        assumed: z.literal(true).optional(),
      }),
    )
    .optional(),
  nodes: z.array(inputNodeSchema),
  links: z.array(inputLinkSchema),
  terminations: z.array(inputTerminationSchema).optional(),
})

/**
 * What identifies a device is written on the node (`address`, `chassisId`, `sysName`, `mac`) and
 * on the port (its name, `mac`), not in the observation. An observation that still carries the
 * `identity` field of the shape sources had until 2026-11 is refused with that message, rather
 * than stored with keys nothing reads: a source that sends it must write the attributes on the
 * node and port, and its own ids in `vendorIds`.
 */
const movedIdentity = z
  .undefined({
    error:
      'identity moved into the configuration: write address / chassisId / sysName / mac on the node, mac on the port, and the source’s own ids in vendorIds',
  })
  .optional()

const portObservationSchema = z.looseObject({
  provenance: provenanceSchema.optional(),
  ifIndex: z.number().optional(),
  attachments: z.array(attachmentSchema).optional(),
  suppressedAttachments: z.array(z.string()).optional(),
  entityId: entityIdSchema.optional(),
  identity: movedIdentity,
})

const observationLayerSchema = z.looseObject({
  nodes: z
    .record(
      z.string(),
      z.looseObject({
        presence: z.enum(['scoop', 'anchor']).optional(),
        provenance: provenanceSchema.optional(),
        vendorIds: z.record(z.string(), z.string()).optional(),
        attachments: z.array(attachmentSchema).optional(),
        suppressedAttachments: z.array(z.string()).optional(),
        entityId: entityIdSchema.optional(),
        metadata: z.record(z.string(), z.unknown()).optional(),
        ports: z.record(z.string(), portObservationSchema).optional(),
        identity: movedIdentity,
      }),
    )
    .optional(),
  links: z
    .record(
      z.string(),
      z.looseObject({
        presence: z.enum(['scoop', 'anchor']).optional(),
        provenance: provenanceSchema.optional(),
        entityId: entityIdSchema.optional(),
        metadata: z.record(z.string(), z.unknown()).optional(),
      }),
    )
    .optional(),
  groups: z
    .record(
      z.string(),
      z.looseObject({
        identity: regionIdentitySchema.optional(),
        scope: z.literal('closed').optional(),
        provenance: provenanceSchema.optional(),
        attachments: z.array(attachmentSchema).optional(),
      }),
    )
    .optional(),
  attachments: z.array(attachmentSchema).optional(),
  exclusions: z.array(nodeExclusionSchema).optional(),
})

const drawingLayerSchema = z.looseObject({
  nodes: z
    .record(
      z.string(),
      z.looseObject({
        // Strip script/handlers from an untrusted inline icon at ingestion.
        icon: iconFieldSchema,
        shape: nodeShapeSchema.optional(),
        style: nodeStyleSchema.optional(),
      }),
    )
    .optional(),
  links: z.record(z.string(), z.looseObject({ style: linkStyleSchema.optional() })).optional(),
  groups: z
    .record(
      z.string(),
      z.looseObject({
        spec: nodeSpecSchema.optional(),
        style: subgraphStyleSchema.optional(),
      }),
    )
    .optional(),
  settings: graphSettingsSchema.optional(),
})

const sourceNetworkSchema = z.looseObject({
  network: inputNetworkSchema,
  observation: observationLayerSchema.optional(),
  drawing: drawingLayerSchema.optional(),
})

/**
 * Validate what a source observed before it may replace canonical state. Loose objects keep
 * upstream extensions; malformed known fields fail the whole observation, and untrusted inline
 * icons are sanitized.
 */
export function normalizeObservationSource(
  input: unknown,
): { success: true; data: SourceNetwork } | { success: false; error: z.ZodError } {
  const result = sourceNetworkSchema.safeParse(input)
  return result.success
    ? { success: true, data: result.data as unknown as SourceNetwork }
    : { success: false, error: result.error }
}

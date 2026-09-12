// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

import {
  type AccessAttachment,
  type ArrowType,
  type Attachment,
  type AttachmentMeta,
  asEntityId,
  type Bounds,
  type CableGrade,
  type CableMedium,
  type CanvasSettings,
  type ComputeSpec,
  DeviceType,
  type Direction,
  type DiscoveryMode,
  type EdgeStyle,
  type EntityId,
  type EthernetStandard,
  type GraphSettings,
  type HardwareSpec,
  type Identity,
  type LegendSettings,
  type Link,
  type LinkCable,
  type LinkEndpoint,
  type LinkModule,
  type LinkPlug,
  type LinkStyle,
  type LinkType,
  type MembershipCriterion,
  type MetricsBindingAttachment,
  type NetworkGraph,
  type Node,
  type NodeExclusion,
  type NodePort,
  type NodeShape,
  type NodeSpec,
  type NodeStyle,
  type PaperOrientation,
  type PaperSize,
  type Pin,
  type PolicyAttachment,
  type PortConnector,
  type PortRole,
  type Position,
  type Provenance,
  type RegionIdentity,
  type ServiceSpec,
  type Size,
  type SplineMode,
  type Subgraph,
  type SubgraphStyle,
  type Termination,
  type ThemeType,
} from '@shumoku/core'
import { z } from 'zod'

// Require every model key, including optional keys, so a core model addition
// cannot silently bypass validation. `satisfies ZodType<T>` also checks outputs.
function modelObject<T>() {
  return <S extends z.ZodRawShape & Record<keyof T, z.ZodType>>(shape: S) => z.looseObject(shape)
}

/** Runtime graph contract for observations, not the narrower YAML authoring format.
 * Loose objects retain upstream extensions. Only absent legacy defaults are filled;
 * malformed known fields fail the entire snapshot, never silently delete nodes. */
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

const hardwareSpecSchema = modelObject<HardwareSpec>()({
  icon: z.string().optional(),
  vendor: z.string().optional(),
  kind: z.literal('hardware'),
  type: deviceTypeSchema.optional(),
  model: z.string().optional(),
}) satisfies z.ZodType<HardwareSpec>

const computeSpecSchema = modelObject<ComputeSpec>()({
  icon: z.string().optional(),
  vendor: z.string().optional(),
  kind: z.literal('compute'),
  type: deviceTypeSchema.optional(),
  platform: z.string().optional(),
}) satisfies z.ZodType<ComputeSpec>

const serviceSpecSchema = modelObject<ServiceSpec>()({
  icon: z.string().optional(),
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

const portRoleSchema = z.enum([
  'downlink',
  'uplink',
  'wan',
  'lan',
  'management',
  'power',
  'console',
]) satisfies z.ZodType<PortRole>

const portConnectorSchema = z.union([
  z.literal('rj45'),
  z.literal('sfp'),
  z.literal('sfp+'),
  z.literal('sfp28'),
  z.literal('qsfp+'),
  z.literal('qsfp28'),
  z.string(),
]) satisfies z.ZodType<PortConnector>

const provenanceSchema = modelObject<Provenance>()({
  source: z.string(),
  state: z.enum(['confirmed', 'intrinsic-only', 'discovered-only', 'conflicting']).optional(),
  observedAt: z.number().optional(),
}) satisfies z.ZodType<Provenance>

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

const nodePortSchema = modelObject<NodePort>()({
  id: z
    .string()
    .min(1)
    .refine((id) => !id.includes('\u001f'), 'Reserved identifier separator'),
  label: z.string().optional(),
  faceplateLabel: z.string().optional(),
  interfaceName: z.string().optional(),
  aliases: z.array(z.string()).optional(),
  role: z.union([portRoleSchema, z.string()]).optional(),
  speed: z.string().optional(),
  connectors: z.array(portConnectorSchema).default([]),
  poe: z.boolean().optional(),
  source: z.enum(['catalog', 'custom']).optional(),
  disabled: z.boolean().optional(),
  notes: z.string().optional(),
  placement: z
    .looseObject({
      side: z.enum(['top', 'bottom', 'left', 'right']).optional(),
      order: z.number().optional(),
    })
    .optional(),
  provenance: provenanceSchema.optional(),
  identity: identitySchema.optional(),
  attachments: z.array(attachmentSchema).optional(),
  suppressedAttachments: z.array(z.string()).optional(),
  entityId: entityIdSchema.optional(),
}).transform((value) => ({
  ...value,
  label: value.label ?? value.id,
})) satisfies z.ZodType<NodePort>

const positionSchema = modelObject<Position>()({
  x: z.number(),
  y: z.number(),
}) satisfies z.ZodType<Position>

const sizeSchema = modelObject<Size>()({
  width: z.number(),
  height: z.number(),
}) satisfies z.ZodType<Size>

const nodeSchema = modelObject<Node>()({
  id: z
    .string()
    .min(1)
    .refine((id) => !id.includes('\u001f'), 'Reserved identifier separator'),
  label: z.union([z.string(), z.array(z.string())]).optional(),
  shape: nodeShapeSchema.optional(),
  parent: z.string().optional(),
  presence: z.enum(['scoop', 'anchor']).optional(),
  rank: z.union([z.number(), z.string()]).optional(),
  style: nodeStyleSchema.optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  spec: nodeSpecSchema.optional(),
  productId: z.string().optional(),
  ports: z.array(nodePortSchema).optional(),
  position: positionSchema.optional(),
  size: sizeSchema.optional(),
  termination: z
    .looseObject({
      role: z.enum(['outlet', 'eps', 'panel', 'bend']),
    })
    .optional(),
  provenance: provenanceSchema.optional(),
  identity: identitySchema.optional(),
  attachments: z.array(attachmentSchema).optional(),
  fieldSources: z.record(z.string(), z.string()).optional(),
  suppressedAttachments: z.array(z.string()).optional(),
  entityId: entityIdSchema.optional(),
}).transform((value) => ({ ...value, label: value.label ?? value.id })) satisfies z.ZodType<Node>

const ethernetStandardSchema = z.union([
  z.literal('10BASE-T'),
  z.literal('100BASE-TX'),
  z.literal('1000BASE-T'),
  z.literal('2.5GBASE-T'),
  z.literal('5GBASE-T'),
  z.literal('10GBASE-T'),
  z.literal('1000BASE-SX'),
  z.literal('10GBASE-SR'),
  z.literal('25GBASE-SR'),
  z.literal('40GBASE-SR4'),
  z.literal('100GBASE-SR4'),
  z.literal('1000BASE-LX'),
  z.literal('10GBASE-LR'),
  z.literal('25GBASE-LR'),
  z.literal('40GBASE-LR4'),
  z.literal('100GBASE-LR4'),
  z.literal('10GBASE-CR'),
  z.literal('25GBASE-CR'),
  z.literal('40GBASE-CR4'),
  z.literal('100GBASE-CR4'),
  z.literal('10G-AOC'),
  z.literal('25G-AOC'),
  z.literal('40G-AOC'),
  z.literal('100G-AOC'),
  z.string(),
]) satisfies z.ZodType<EthernetStandard>

const linkModuleSchema = modelObject<LinkModule>()({
  standard: ethernetStandardSchema,
  sku: z.string().optional(),
  productId: z.string().optional(),
}) satisfies z.ZodType<LinkModule>

const linkPlugSchema = modelObject<LinkPlug>()({
  cage: portConnectorSchema.optional(),
  module: linkModuleSchema.optional(),
}) satisfies z.ZodType<LinkPlug>

const linkEndpointSchema = modelObject<LinkEndpoint>()({
  node: z.string(),
  port: z.string().default(''),
  plug: linkPlugSchema.optional(),
  ip: z.string().optional(),
  pin: z.string().optional(),
}) satisfies z.ZodType<LinkEndpoint>

const linkTypeSchema = z.enum([
  'solid',
  'dashed',
  'thick',
  'double',
  'invisible',
]) satisfies z.ZodType<LinkType>

const arrowTypeSchema = z.enum(['none', 'forward', 'back', 'both']) satisfies z.ZodType<ArrowType>

const cableMediumSchema = z.enum([
  'twisted-pair',
  'fiber-mm',
  'fiber-sm',
  'dac',
  'aoc',
]) satisfies z.ZodType<CableMedium>

const cableGradeSchema = z.enum([
  'cat5e',
  'cat6',
  'cat6a',
  'cat7',
  'cat8',
  'om3',
  'om4',
  'om5',
  'os1',
  'os2',
  'dac',
  'aoc',
]) satisfies z.ZodType<CableGrade>

const linkCableSchema = modelObject<LinkCable>()({
  medium: cableMediumSchema.optional(),
  category: cableGradeSchema.optional(),
  length_m: z.number().optional(),
  productId: z.string().optional(),
}) satisfies z.ZodType<LinkCable>

const linkStyleSchema = modelObject<LinkStyle>()({
  stroke: z.string().optional(),
  strokeWidth: z.number().optional(),
  strokeDasharray: z.string().optional(),
  opacity: z.number().optional(),
  minLength: z.number().optional(),
}) satisfies z.ZodType<LinkStyle>

const linkSchema = modelObject<Link>()({
  id: z.string().optional(),
  from: linkEndpointSchema,
  to: linkEndpointSchema,
  via: z.array(z.string()).optional(),
  bends: z
    .array(
      z.looseObject({
        id: z.string(),
        x: z.number(),
        y: z.number(),
        afterIndex: z.number(),
      }),
    )
    .optional(),
  label: z.union([z.string(), z.array(z.string())]).optional(),
  type: linkTypeSchema.optional(),
  arrow: arrowTypeSchema.optional(),
  cable: linkCableSchema.optional(),
  rateBps: z.number().optional(),
  redundancy: z.enum(['ha', 'vc', 'vss', 'vpc', 'mlag', 'stack']).optional(),
  vlan: z.array(z.number()).optional(),
  style: linkStyleSchema.optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  presence: z.enum(['scoop', 'anchor']).optional(),
  provenance: provenanceSchema.optional(),
  entityId: entityIdSchema.optional(),
}) satisfies z.ZodType<Link>

const regionIdentitySchema = modelObject<RegionIdentity>()({
  name: z.string().optional(),
  keys: z.record(z.string(), z.string()).optional(),
}) satisfies z.ZodType<RegionIdentity>

const membershipCriterionSchema = modelObject<MembershipCriterion>()({
  attr: z.enum(['name', 'subnet', 'metadata']),
  value: z.string(),
  key: z.string().optional(),
}) satisfies z.ZodType<MembershipCriterion>

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

const pinSchema = modelObject<Pin>()({
  id: z.string(),
  label: z.string().optional(),
  device: z.string().optional(),
  port: z.string().optional(),
  direction: z.enum(['in', 'out', 'bidirectional']).optional(),
  position: z.enum(['top', 'bottom', 'left', 'right']).optional(),
}) satisfies z.ZodType<Pin>

const boundsSchema = modelObject<Bounds>()({
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
}) satisfies z.ZodType<Bounds>

const subgraphSchema = modelObject<Subgraph>()({
  id: z
    .string()
    .min(1)
    .refine((id) => !id.includes('\u001f'), 'Reserved identifier separator'),
  label: z.string().optional(),
  identity: regionIdentitySchema.optional(),
  membership: z.array(membershipCriterionSchema).optional(),
  scope: z.literal('closed').optional(),
  children: z.array(z.string()).optional(),
  parent: z.string().optional(),
  direction: directionSchema.optional(),
  style: subgraphStyleSchema.optional(),
  spec: nodeSpecSchema.optional(),
  file: z.string().optional(),
  pins: z.array(pinSchema).optional(),
  bounds: boundsSchema.optional(),
  provenance: provenanceSchema.optional(),
  attachments: z.array(attachmentSchema).optional(),
}).transform((value) => ({
  ...value,
  label: value.label ?? value.id,
})) satisfies z.ZodType<Subgraph>

const terminationSchema = modelObject<Termination>()({
  id: z
    .string()
    .min(1)
    .refine((id) => !id.includes('\u001f'), 'Reserved identifier separator'),
  label: z.string(),
  role: z.enum(['eps', 'outlet', 'panel']),
  position: z
    .looseObject({
      x: z.number(),
      y: z.number(),
    })
    .optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
}) satisfies z.ZodType<Termination>

const themeTypeSchema = z.enum(['light', 'dark']) satisfies z.ZodType<ThemeType>

const edgeStyleSchema = z.enum([
  'polyline',
  'orthogonal',
  'splines',
  'straight',
]) satisfies z.ZodType<EdgeStyle>

const splineModeSchema = z.enum([
  'sloppy',
  'conservative',
  'conservative_soft',
]) satisfies z.ZodType<SplineMode>

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
  edgeStyle: edgeStyleSchema.optional(),
  splineMode: splineModeSchema.optional(),
  nodeSpacing: z.number().optional(),
  rankSpacing: z.number().optional(),
  subgraphPadding: z.number().optional(),
  canvas: canvasSettingsSchema.optional(),
  legend: z.union([z.boolean(), legendSettingsSchema]).optional(),
  hideDisconnected: z.boolean().optional(),
}) satisfies z.ZodType<GraphSettings>

const nodeExclusionSchema = modelObject<NodeExclusion>()({
  mgmtIp: z.string().optional(),
  chassisId: z.string().optional(),
  sysName: z.string().optional(),
}) satisfies z.ZodType<NodeExclusion>

const networkGraphSchema = modelObject<NetworkGraph>()({
  version: z.string().default('1'),
  name: z.string().optional(),
  description: z.string().optional(),
  nodes: z.array(nodeSchema),
  links: z.array(linkSchema),
  subgraphs: z.array(subgraphSchema).optional(),
  terminations: z.array(terminationSchema).optional(),
  settings: graphSettingsSchema.optional(),
  pins: z.array(pinSchema).optional(),
  attachments: z.array(attachmentSchema).optional(),
  exclusions: z.array(nodeExclusionSchema).optional(),
}) satisfies z.ZodType<NetworkGraph>

/** Wire/audit data deliberately permits opaque upstream records. */
export const observationGraphInputSchema = z.looseObject({
  version: z.string().optional(),
  name: z.string().optional(),
  nodes: z.array(z.record(z.string(), z.unknown())),
  links: z.array(z.record(z.string(), z.unknown())),
  subgraphs: z.array(z.record(z.string(), z.unknown())).optional(),
  settings: z.record(z.string(), z.unknown()).optional(),
})

export type ObservationGraphInput = z.infer<typeof observationGraphInputSchema>

const contributionGraphSchema = networkGraphSchema.superRefine((graph, ctx) => {
  const ids = new Set<string>()
  for (const [kind, elements] of [
    ['nodes', graph.nodes],
    ['subgraphs', graph.subgraphs ?? []],
    ['terminations', graph.terminations ?? []],
  ] as const) {
    for (const [index, element] of elements.entries()) {
      if (ids.has(element.id) || element.id.startsWith('__exclusion_')) {
        ctx.addIssue({
          code: 'custom',
          path: [kind, index, 'id'],
          message: 'Duplicate or reserved element ID',
        })
      }
      ids.add(element.id)
    }
  }
  const parents = new Map((graph.subgraphs ?? []).map((group) => [group.id, group.parent]))
  for (const [kind, elements] of [
    ['nodes', graph.nodes],
    ['subgraphs', graph.subgraphs ?? []],
  ] as const) {
    for (const [index, element] of elements.entries()) {
      const visited = new Set<string>([element.id])
      let parent = element.parent
      while (parent !== undefined) {
        if (!parents.has(parent) || visited.has(parent)) {
          ctx.addIssue({
            code: 'custom',
            path: [kind, index, 'parent'],
            message: 'Missing or cyclic parent',
          })
          break
        }
        visited.add(parent)
        parent = parents.get(parent)
      }
    }
  }
  for (const [index, node] of graph.nodes.entries()) {
    const ports = new Set<string>()
    for (const [portIndex, port] of (node.ports ?? []).entries()) {
      if (ports.has(port.id))
        ctx.addIssue({
          code: 'custom',
          path: ['nodes', index, 'ports', portIndex, 'id'],
          message: 'Duplicate port ID',
        })
      ports.add(port.id)
    }
  }
  for (const [index, link] of graph.links.entries()) {
    for (const [viaIndex, id] of (link.via ?? []).entries()) {
      if (!ids.has(id))
        ctx.addIssue({
          code: 'custom',
          path: ['links', index, 'via', viaIndex],
          message: 'Missing termination',
        })
    }
  }
})

export function normalizeObservationGraph(input: unknown) {
  return contributionGraphSchema.safeParse(input)
}

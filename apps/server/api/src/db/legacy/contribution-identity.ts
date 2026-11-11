// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * The contribution rows as they were stored between the fold of the design layer (035) and the
 * move of the device attributes into the configuration (036): each node's and port's identity
 * (`mgmtIp`, `chassisId`, `sysName`, `mac`, `ifName`, `ifIndex`, `vendorId:<ns>`) as
 * `contribution_identity` rows that built back into `observation.nodes[id].identity` and
 * `observation.nodes[id].ports[name].identity`. Read only by migration 036, which lifts each
 * contribution into today's shape and writes it again with the live codec; nothing else reads
 * this format. A frozen copy of the pre-036 codec's read side.
 */

import type { Database } from 'bun:sqlite'
import type { Attachment, DrawingLayer, Identity, inputModel, NodeExclusion } from '@shumoku/core'

type Network = inputModel.Network

/** A node's observation as the pre-036 store built it: identity beside the rest. */
export type IdentityNodeEntry = {
  presence?: 'scoop' | 'anchor'
  identity?: Identity
  attachments?: Attachment[]
  suppressedAttachments?: string[]
  metadata?: Record<string, unknown>
  ports?: Record<string, IdentityPortEntry>
  [key: string]: unknown
}
export type IdentityPortEntry = {
  identity?: Identity
  attachments?: Attachment[]
  suppressedAttachments?: string[]
  [key: string]: unknown
}
/** A contribution as the pre-036 store built it. */
export interface IdentityNetwork {
  network: Network
  observation?: {
    nodes?: Record<string, IdentityNodeEntry>
    links?: Record<string, Record<string, unknown>>
    groups?: Record<string, Record<string, unknown>>
    attachments?: Attachment[]
    exclusions?: NodeExclusion[]
  }
  drawing?: DrawingLayer
}
type NodeObservationEntry = IdentityNodeEntry
type PortObservationEntry = IdentityPortEntry
type ObservationLayer = NonNullable<IdentityNetwork['observation']>
type SourceNetwork = IdentityNetwork

// --- helpers ---------------------------------------------------------------

const IDENTITY_SCALARS = ['mgmtIp', 'chassisId', 'sysName', 'ifIndex', 'ifName', 'mac'] as const
const VENDOR_PREFIX = 'vendorId:'

type IdRow = { key_type: string; key_value: string }

function identityFromRows(rows: IdRow[]): Identity | undefined {
  if (rows.length === 0) return undefined
  const id: Identity = {}
  for (const { key_type, key_value } of rows) {
    if (key_type === 'ifIndex') id.ifIndex = Number(key_value)
    // A row the live codec writes, read back after a partial run: the same attribute.
    else if (key_type === 'address') id.mgmtIp = key_value
    else if (key_type.startsWith(VENDOR_PREFIX)) {
      id.vendorIds = id.vendorIds ?? {}
      id.vendorIds[key_type.slice(VENDOR_PREFIX.length)] = key_value
    } else if ((IDENTITY_SCALARS as readonly string[]).includes(key_type)) {
      ;(id as Record<string, unknown>)[key_type] = key_value
    }
  }
  return id
}

/** Keeps the entries that hold something; undefined when none does. */
function compact(record: Record<string, unknown>): Record<string, unknown> | undefined {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(record)) {
    if (v === undefined) continue
    if (Array.isArray(v) && v.length === 0) continue
    if (v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 0) continue
    out[k] = v
  }
  return Object.keys(out).length > 0 ? out : undefined
}

const parse = (s: string | null | undefined): Record<string, unknown> =>
  s ? (JSON.parse(s) as Record<string, unknown>) : {}

const PORT_SEP = '\u001f'
const stripPortLocalId = (localId: string, nodeId: string | null): string =>
  nodeId && localId.startsWith(`${nodeId}${PORT_SEP}`)
    ? localId.slice(nodeId.length + PORT_SEP.length)
    : localId

// --- build -----------------------------------------------------------------

interface ElementRow {
  id: number
  local_id: string
  kind: string
  parent_local_id: string | null
  presence: string | null
  payload_json: string | null
}

type Layered = {
  config?: Record<string, unknown>
  observation?: Record<string, unknown>
  drawing?: Record<string, unknown>
}

/** Project `(topologyId, sourceId)`'s pre-036 rows back to the contribution they held. */
export function buildIdentityNetwork(
  topologyId: string,
  sourceId: string,
  db: Database,
): SourceNetwork | null {
  const src = db
    .query(
      'SELECT graph_payload_json FROM contribution_source WHERE topology_id = ? AND source_id = ?',
    )
    .get(topologyId, sourceId) as { graph_payload_json: string | null } | undefined
  if (!src) return null

  const elements = db
    .query(
      'SELECT id, local_id, kind, parent_local_id, presence, payload_json FROM contribution_element WHERE topology_id = ? AND source_id = ? ORDER BY id',
    )
    .all(topologyId, sourceId) as ElementRow[]

  const identityByElement = new Map<number, IdRow[]>()
  for (const r of db
    .query(
      'SELECT element_id, key_type, key_value FROM contribution_identity WHERE topology_id = ? AND source_id = ? ORDER BY element_id, key_type, key_value',
    )
    .all(topologyId, sourceId) as { element_id: number; key_type: string; key_value: string }[]) {
    const list = identityByElement.get(r.element_id) ?? []
    list.push({ key_type: r.key_type, key_value: r.key_value })
    identityByElement.set(r.element_id, list)
  }
  const identityOf = (eid: number) => identityFromRows(identityByElement.get(eid) ?? [])

  // negate=0 → asserted attachments; negate=1 → suppressed attachment KEYS.
  const attByElement = new Map<number | null, Attachment[]>()
  const suppByElement = new Map<number, string[]>()
  for (const r of db
    .query(
      'SELECT element_id, kind, attachment_key, target_source_id, negate, payload_json FROM contribution_attachment WHERE topology_id = ? AND source_id = ? ORDER BY id',
    )
    .all(topologyId, sourceId) as {
    element_id: number | null
    kind: string
    attachment_key: string
    target_source_id: string | null
    negate: number
    payload_json: string | null
  }[]) {
    if (r.negate === 1) {
      if (r.element_id == null) continue
      const list = suppByElement.get(r.element_id) ?? []
      list.push(r.attachment_key)
      suppByElement.set(r.element_id, list)
      continue
    }
    const payload = parse(r.payload_json)
    const att =
      r.kind === 'metrics-binding'
        ? ({ kind: 'metrics-binding', sourceId: r.target_source_id, ...payload } as Attachment)
        : ({ kind: r.kind, ...payload } as Attachment)
    const list = attByElement.get(r.element_id) ?? []
    list.push(att)
    attByElement.set(r.element_id, list)
  }
  const attsOf = (eid: number | null) => {
    const list = attByElement.get(eid)
    return list && list.length > 0 ? list : undefined
  }
  const suppOf = (eid: number) => {
    const list = suppByElement.get(eid)
    return list && list.length > 0 ? list : undefined
  }

  const document = parse(src.graph_payload_json) as Layered & { network?: Partial<Network> }
  const nodes: inputModel.Node[] = []
  const flatGroups: Array<{ id: string; parent?: string; config: Record<string, unknown> }> = []
  const terminations: inputModel.Termination[] = []
  const exclusions: NodeExclusion[] = []
  const observedNodes: Record<string, NodeObservationEntry> = {}
  const drawnNodes: Record<string, NonNullable<DrawingLayer['nodes']>[string]> = {}
  const observedGroups: Record<string, NonNullable<ObservationLayer['groups']>[string]> = {}
  const drawnGroups: Record<string, NonNullable<DrawingLayer['groups']>[string]> = {}

  // Ports first, grouped by their node.
  const portsByNode = new Map<
    string,
    Array<{ name: string; config?: Record<string, unknown>; observation?: PortObservationEntry }>
  >()
  for (const el of elements) {
    if (el.kind !== 'port' || !el.parent_local_id) continue
    const payload = parse(el.payload_json) as Layered
    const observation = compact({
      ...payload.observation,
      identity: identityOf(el.id) ?? (payload.observation?.['identity'] as Identity | undefined),
      attachments: attsOf(el.id),
      suppressedAttachments: suppOf(el.id),
    }) as PortObservationEntry | undefined
    const list = portsByNode.get(el.parent_local_id) ?? []
    list.push({
      name: stripPortLocalId(el.local_id, el.parent_local_id),
      ...(payload.config && { config: payload.config }),
      ...(observation && { observation }),
    })
    portsByNode.set(el.parent_local_id, list)
  }

  for (const el of elements) {
    const payload = parse(el.payload_json) as Layered
    if (el.kind === 'node' && el.presence === 'hide') {
      const id = identityOf(el.id)
      if (id) exclusions.push(id as NodeExclusion)
    } else if (el.kind === 'node') {
      const ports = portsByNode.get(el.local_id) ?? []
      // A port the configuration describes is written back on the node; one only a link end
      // named, or a source only saw, is known by its observation.
      const written = ports.flatMap((p) =>
        p.config ? [{ name: p.name, ...p.config } as inputModel.Port] : [],
      )
      nodes.push({
        id: el.local_id,
        ...payload.config,
        ...(el.parent_local_id && { group: el.parent_local_id }),
        ...(written.length > 0 && { ports: written }),
      })
      const observed = compact({
        ...payload.observation,
        // NULL presence = anchor; 'present' = scoop, left unset.
        presence: el.presence === null ? 'anchor' : undefined,
        identity: identityOf(el.id) ?? (payload.observation?.['identity'] as Identity | undefined),
        attachments: attsOf(el.id),
        suppressedAttachments: suppOf(el.id),
        // Every stored port has an identity, so the observation layer names them all.
        ports: compact(Object.fromEntries(ports.map((p) => [p.name, p.observation ?? {}]))),
      })
      if (observed) observedNodes[el.local_id] = observed as NodeObservationEntry
      if (payload.drawing)
        drawnNodes[el.local_id] = payload.drawing as NonNullable<DrawingLayer['nodes']>[string]
    } else if (el.kind === 'subgraph') {
      flatGroups.push({
        id: el.local_id,
        ...(el.parent_local_id && { parent: el.parent_local_id }),
        config: payload.config ?? {},
      })
      const observed = compact({ ...payload.observation, attachments: attsOf(el.id) })
      if (observed) observedGroups[el.local_id] = observed
      if (payload.drawing) drawnGroups[el.local_id] = payload.drawing
    } else if (el.kind === 'termination') {
      terminations.push({
        id: el.local_id,
        ...(payload as Record<string, unknown>),
      } as inputModel.Termination)
    }
  }

  // Links between two nodes.
  const viaByLink = new Map<number, { seq: number; t: string }[]>()
  for (const r of db
    .query(
      'SELECT link_id, seq, termination_local_id FROM contribution_link_via WHERE topology_id = ? AND source_id = ?',
    )
    .all(topologyId, sourceId) as {
    link_id: number
    seq: number
    termination_local_id: string
  }[]) {
    const list = viaByLink.get(r.link_id) ?? []
    list.push({ seq: r.seq, t: r.termination_local_id })
    viaByLink.set(r.link_id, list)
  }
  const links: inputModel.Link[] = []
  const observedLinks: Record<string, unknown> = { ...(document.observation?.['links'] as object) }
  const drawnLinks: Record<string, unknown> = { ...(document.drawing?.['links'] as object) }
  for (const r of db
    .query(
      'SELECT id, local_id, from_node_local_id, from_port_local_id, to_node_local_id, to_port_local_id, payload_json FROM contribution_link WHERE topology_id = ? AND source_id = ? ORDER BY id',
    )
    .all(topologyId, sourceId) as {
    id: number
    local_id: string | null
    from_node_local_id: string
    from_port_local_id: string | null
    to_node_local_id: string
    to_port_local_id: string | null
    payload_json: string | null
  }[]) {
    const payload = parse(r.payload_json) as Layered & {
      plugs?: [inputModel.Plug | null, inputModel.Plug | null]
    }
    const end = (node: string, port: string | null, side: 0 | 1): inputModel.NodeEnd => {
      const plug = payload.plugs?.[side]
      return {
        node,
        ...(port != null && { port: stripPortLocalId(port, node) }),
        ...(plug && { plug }),
      }
    }
    const via = (viaByLink.get(r.id) ?? []).sort((a, b) => a.seq - b.seq).map((v) => v.t)
    links.push({
      ...(r.local_id != null && { id: r.local_id }),
      ...payload.config,
      endpoints: [
        end(r.from_node_local_id, r.from_port_local_id, 0),
        end(r.to_node_local_id, r.to_port_local_id, 1),
      ],
      ...(via.length > 0 && { via }),
    })
    if (r.local_id == null) continue
    if (payload.observation) observedLinks[r.local_id] = payload.observation
    if (payload.drawing) drawnLinks[r.local_id] = payload.drawing
  }

  const childrenOf = (parent: string | undefined): inputModel.Group[] =>
    flatGroups
      .filter((g) => g.parent === parent)
      .map((g) => {
        const groups = childrenOf(g.id)
        return {
          id: g.id,
          ...g.config,
          ...(groups.length > 0 && { groups }),
        } as inputModel.Group
      })
  const groups = childrenOf(undefined)

  const network: Network = {
    ...document.network,
    ...(groups.length > 0 && { groups }),
    nodes,
    links: [...links, ...(document.network?.links ?? [])],
    ...(terminations.length > 0 && { terminations }),
  }
  const observation = compact({
    nodes: compact(observedNodes),
    links: compact(observedLinks),
    groups: compact(observedGroups),
    attachments: attsOf(null),
    exclusions,
  }) as ObservationLayer | undefined
  const drawing = compact({
    nodes: compact(drawnNodes),
    links: compact(drawnLinks),
    groups: compact(drawnGroups),
    settings: document.drawing?.['settings'],
    order: document.drawing?.['order'],
  }) as DrawingLayer | undefined
  return {
    network,
    ...(observation && { observation }),
    ...(drawing && { drawing }),
  }
}

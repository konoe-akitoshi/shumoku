// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * The contribution rows as they were stored before the network model: one NetworkGraph per
 * source, decomposed into rows. Read only by the migration that rewrites them in the network
 * model's shape (see ../code-migrations.ts); nothing else reads this format.
 */

import type { Database } from 'bun:sqlite'
import type {
  Attachment,
  Identity,
  Link,
  NetworkGraph,
  Node,
  NodeExclusion,
  NodePort,
  Subgraph,
  Termination,
} from '@shumoku/core'

// --- helpers ---------------------------------------------------------------

/** Identity scalar keys (vendorIds is a nested record, handled separately). */
const IDENTITY_SCALARS = ['mgmtIp', 'chassisId', 'sysName', 'ifIndex', 'ifName', 'mac'] as const
const VENDOR_PREFIX = 'vendorId:'

type IdRow = { key_type: string; key_value: string }

function identityFromRows(rows: IdRow[]): Identity | undefined {
  if (rows.length === 0) return undefined
  const id: Identity = {}
  for (const { key_type, key_value } of rows) {
    if (key_type === 'ifIndex') id.ifIndex = Number(key_value)
    else if (key_type.startsWith(VENDOR_PREFIX)) {
      id.vendorIds = id.vendorIds ?? {}
      id.vendorIds[key_type.slice(VENDOR_PREFIX.length)] = key_value
    } else if ((IDENTITY_SCALARS as readonly string[]).includes(key_type)) {
      ;(id as Record<string, unknown>)[key_type] = key_value
    }
  }
  return id
}

/**
 * Port ids are only node-scoped in `NetworkGraph` (two switches may both have port
 * `eth0`), but `contribution_element.local_id` is unique per source. So a port's stored
 * local_id is composed with its owning node id; the original port id round-trips by
 * stripping the prefix on read. The separator (unit separator) won't occur in real ids.
 */
const PORT_SEP = ''
const stripPortLocalId = (localId: string, nodeId: string | null): string =>
  nodeId && localId.startsWith(`${nodeId}${PORT_SEP}`)
    ? localId.slice(nodeId.length + PORT_SEP.length)
    : localId
const parse = (s: string | null | undefined): Record<string, unknown> =>
  s ? (JSON.parse(s) as Record<string, unknown>) : {}

// --- build -----------------------------------------------------------------

interface ElementRow {
  id: number
  local_id: string
  kind: string
  parent_local_id: string | null
  presence: string | null
  payload_json: string | null
}

/** Project `(topologyId, sourceId)`'s rows back to a NetworkGraph. */
export function buildLegacyGraph(
  topologyId: string,
  sourceId: string,
  db: Database,
): NetworkGraph | null {
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

  // negate=0 → asserted Attachment objects; negate=1 → suppressed attachment KEYS (strings).
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
  const attsOf = (eid: number | null): Attachment[] | undefined => {
    const list = attByElement.get(eid)
    return list && list.length > 0 ? list : undefined
  }
  const suppOf = (eid: number): string[] | undefined => {
    const list = suppByElement.get(eid)
    return list && list.length > 0 ? list : undefined
  }

  const nodes: Node[] = []
  const subgraphs: Subgraph[] = []
  const terminations: Termination[] = []
  const exclusions: NodeExclusion[] = []
  const portsByParent = new Map<string, NodePort[]>()
  const elementByLocalId = new Map<string, ElementRow>()
  for (const el of elements) elementByLocalId.set(el.local_id, el)

  // Ports first (so nodes can attach them).
  for (const el of elements) {
    if (el.kind !== 'port' || !el.parent_local_id) continue
    const port: NodePort = {
      id: stripPortLocalId(el.local_id, el.parent_local_id),
      ...parse(el.payload_json),
    } as NodePort
    const identity = identityFromRows(identityByElement.get(el.id) ?? [])
    if (identity) port.identity = identity
    const a = attsOf(el.id)
    if (a) port.attachments = a
    const sp = suppOf(el.id)
    if (sp) port.suppressedAttachments = sp
    const list = portsByParent.get(el.parent_local_id) ?? []
    list.push(port)
    portsByParent.set(el.parent_local_id, list)
  }

  for (const el of elements) {
    const payload = parse(el.payload_json)
    if (el.kind === 'node' && el.presence === 'hide') {
      const id = identityFromRows(identityByElement.get(el.id) ?? [])
      if (id) exclusions.push(id as NodeExclusion)
    } else if (el.kind === 'node') {
      const node: Node = { id: el.local_id, ...payload } as Node
      if (el.parent_local_id) node.parent = el.parent_local_id
      // NULL presence = anchor (no presence claim). 'present' = scoop (default;
      // left unset so it round-trips with nodes that never carried `presence`).
      if (el.presence === null) node.presence = 'anchor'
      const identity = identityFromRows(identityByElement.get(el.id) ?? [])
      if (identity) node.identity = identity
      const a = attsOf(el.id)
      if (a) node.attachments = a
      const s = suppOf(el.id)
      if (s) node.suppressedAttachments = s
      const ports = portsByParent.get(el.local_id)
      if (ports) node.ports = ports
      nodes.push(node)
    } else if (el.kind === 'subgraph') {
      const sg: Subgraph = { id: el.local_id, ...payload } as Subgraph
      if (el.parent_local_id) sg.parent = el.parent_local_id
      const a = attsOf(el.id)
      if (a) sg.attachments = a
      subgraphs.push(sg)
    } else if (el.kind === 'termination') {
      terminations.push({ id: el.local_id, ...payload } as Termination)
    }
  }

  // Links (+ via).
  const links: Link[] = []
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
    const payload = parse(r.payload_json) as Record<string, unknown>
    const fromExtra = (payload['from'] as Record<string, unknown>) ?? {}
    const toExtra = (payload['to'] as Record<string, unknown>) ?? {}
    delete payload['from']
    delete payload['to']
    const link: Link = {
      ...payload,
      from: {
        node: r.from_node_local_id,
        port:
          r.from_port_local_id != null
            ? stripPortLocalId(r.from_port_local_id, r.from_node_local_id)
            : undefined,
        ...fromExtra,
      },
      to: {
        node: r.to_node_local_id,
        port:
          r.to_port_local_id != null
            ? stripPortLocalId(r.to_port_local_id, r.to_node_local_id)
            : undefined,
        ...toExtra,
      },
    } as Link
    // local_id is the source Link.id (NULL when the source link had none).
    if (r.local_id != null) link.id = r.local_id
    const via = (viaByLink.get(r.id) ?? []).sort((a, b) => a.seq - b.seq).map((v) => v.t)
    if (via.length > 0) link.via = via
    links.push(link)
  }

  const graphPayload = parse(src.graph_payload_json)
  const graph: NetworkGraph = { ...graphPayload, nodes, links } as NetworkGraph
  if (subgraphs.length > 0) graph.subgraphs = subgraphs
  if (terminations.length > 0) graph.terminations = terminations
  if (exclusions.length > 0) graph.exclusions = exclusions
  const topoDefault = attsOf(null)
  if (topoDefault) graph.attachments = topoDefault
  return graph
}

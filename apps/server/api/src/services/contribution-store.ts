// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Contribution-store codec (stage 1 of the DB-native persistence refactor — see
 * apps/server/docs/design/db-native-persistence.md).
 *
 * `ingestGraph` decomposes a `NetworkGraph` (one source's contribution) into the
 * uniform `contribution_*` rows; `buildGraph` projects those rows back to a
 * `NetworkGraph`. The pair is **lossless by construction**: `payload_json` is the
 * catch-all for every field NOT promoted to a column, so `buildGraph(ingestGraph(g))`
 * equals `g` (modulo array order / key order — assert with a normalized comparison).
 *
 * Nodes round-trip as `presence='present'`, `exclusions` as `presence='hide'`.
 *
 * Two defined equivalences (the round-trip is lossless modulo these, matching how
 * every consumer already treats them):
 *  - **empty collection ≡ absent** — an empty `ports`/`attachments`/`via`/… is stored
 *    as zero rows and rebuilt as an absent key (no consumer distinguishes `[]` from
 *    undefined).
 *  - **`Subgraph.children` is derived, not stored** — membership has one source of
 *    truth (the parent edge, `parent_local_id`); `children[]` is recomputed by
 *    consumers, never persisted (it is not part of the round-trip, like `provenance`).
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
import { getDatabase } from '../db/index.js'

// --- helpers ---------------------------------------------------------------

/** Identity scalar keys (vendorIds is a nested record, handled separately). */
const IDENTITY_SCALARS = ['mgmtIp', 'chassisId', 'sysName', 'ifIndex', 'ifName', 'mac'] as const
const VENDOR_PREFIX = 'vendorId:'

type IdRow = { key_type: string; key_value: string }

function identityToRows(identity: Identity | undefined): IdRow[] {
  if (!identity) return []
  const rows: IdRow[] = []
  for (const k of IDENTITY_SCALARS) {
    const v = identity[k]
    if (v !== undefined && v !== null) rows.push({ key_type: k, key_value: String(v) })
  }
  for (const [ns, v] of Object.entries(identity.vendorIds ?? {})) {
    rows.push({ key_type: `${VENDOR_PREFIX}${ns}`, key_value: v })
  }
  return rows
}

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

/** A shallow copy of `obj` without `keys` — becomes the payload document. */
function payloadWithout<T extends object>(obj: T, keys: string[]): Record<string, unknown> {
  const out: Record<string, unknown> = { ...(obj as Record<string, unknown>) }
  for (const k of keys) delete out[k]
  return out
}

const j = (v: unknown): string | null => {
  const o = v as Record<string, unknown>
  return o && Object.keys(o).length > 0 ? JSON.stringify(o) : null
}
const parse = (s: string | null | undefined): Record<string, unknown> =>
  s ? (JSON.parse(s) as Record<string, unknown>) : {}

function attachmentKeyOf(a: Attachment): string {
  if (a.kind === 'access') return `access:${a.protocol}`
  if (a.kind === 'metrics-binding') return `metrics-binding:${a.sourceId}`
  return a.kind
}

/**
 * Port ids are only node-scoped in `NetworkGraph` (two switches may both have port
 * `eth0`), but `contribution_element.local_id` is unique per source. So a port's stored
 * local_id is composed with its owning node id; the original port id round-trips by
 * stripping the prefix on read. The separator (unit separator) won't occur in real ids.
 */
const PORT_SEP = ''
const portLocalId = (nodeId: string, portId: string): string => `${nodeId}${PORT_SEP}${portId}`
const stripPortLocalId = (localId: string, nodeId: string | null): string =>
  nodeId && localId.startsWith(`${nodeId}${PORT_SEP}`)
    ? localId.slice(nodeId.length + PORT_SEP.length)
    : localId

/** Recover an attachment kind from a suppression key (the column needs a kind). */
function kindFromKey(key: string): string {
  if (key.startsWith('access:')) return 'access'
  if (key.startsWith('metrics-binding:')) return 'metrics-binding'
  return key
}

type Scope = 'node' | 'port' | 'subgraph' | 'topology-default'

// --- ingest ----------------------------------------------------------------

export interface IngestOptions {
  /** The owning topology_data_sources.id; null/undefined ⇒ the intrinsic contribution. */
  attachmentId?: string | null
  lastStatus?: string
  lastOkAt?: number
}

/**
 * Replace `(topologyId, sourceId)`'s contribution with `graph`, in one transaction.
 */
export function ingestGraph(
  topologyId: string,
  sourceId: string,
  graph: NetworkGraph,
  opts: IngestOptions = {},
  db: Database = getDatabase(),
): void {
  const run = db.transaction(() => {
    // Defer FK checks to COMMIT so intra-import forward refs are fine (a node's
    // `parent` subgraph, or link endpoints, may be inserted after the referrer).
    db.exec('PRAGMA defer_foreign_keys = ON')
    // Replace the contribution_source row (cascade wipes its children first).
    db.query('DELETE FROM contribution_source WHERE topology_id = ? AND source_id = ?').run(
      topologyId,
      sourceId,
    )
    const graphPayload = payloadWithout(graph, [
      'nodes',
      'links',
      'subgraphs',
      'terminations',
      'attachments',
      'exclusions',
    ])
    db.query(
      `INSERT INTO contribution_source (topology_id, source_id, attachment_id, last_status, last_ok_at, graph_payload_json)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(
      topologyId,
      sourceId,
      opts.attachmentId ?? null,
      opts.lastStatus ?? null,
      opts.lastOkAt ?? null,
      j(graphPayload),
    )

    const insElement = db.query(
      `INSERT INTO contribution_element (topology_id, source_id, local_id, kind, parent_local_id, presence, payload_json)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    const insIdentity = db.query(
      `INSERT INTO contribution_identity (element_id, topology_id, source_id, key_type, key_value)
       VALUES (?, ?, ?, ?, ?)`,
    )
    const insAttachment = db.query(
      `INSERT INTO contribution_attachment
         (topology_id, source_id, element_id, scope, kind, attachment_key, target_source_id, negate, payload_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    const insLink = db.query(
      `INSERT INTO contribution_link
         (topology_id, source_id, local_id, from_node_local_id, from_port_local_id, to_node_local_id, to_port_local_id, presence, payload_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    const insVia = db.query(
      `INSERT INTO contribution_link_via (link_id, topology_id, source_id, seq, termination_local_id)
       VALUES (?, ?, ?, ?, ?)`,
    )

    const elementId = (
      localId: string,
      kind: string,
      parent: string | null,
      presence: string | null,
      payload: Record<string, unknown>,
    ): number => {
      const r = insElement.run(topologyId, sourceId, localId, kind, parent, presence, j(payload))
      return Number(r.lastInsertRowid)
    }
    const writeIdentity = (eid: number, identity: Identity | undefined) => {
      for (const row of identityToRows(identity))
        insIdentity.run(eid, topologyId, sourceId, row.key_type, row.key_value)
    }
    const writeAttachments = (eid: number | null, scope: Scope, atts: Attachment[] | undefined) => {
      for (const a of atts ?? []) {
        const target = a.kind === 'metrics-binding' ? a.sourceId : null
        const payload = payloadWithout(
          a,
          a.kind === 'metrics-binding' ? ['kind', 'sourceId'] : ['kind'],
        )
        insAttachment.run(
          topologyId,
          sourceId,
          eid,
          scope,
          a.kind,
          attachmentKeyOf(a),
          target,
          0,
          j(payload),
        )
      }
    }
    // suppressedAttachments are attachment KEYS (strings) the human negated, not objects.
    const writeSuppressions = (eid: number, scope: Scope, keys: string[] | undefined) => {
      for (const key of keys ?? [])
        insAttachment.run(topologyId, sourceId, eid, scope, kindFromKey(key), key, null, 1, null)
    }

    // Nodes (+ ports, identity, attachments, suppressions).
    for (const node of graph.nodes ?? []) {
      const nodePayload = payloadWithout(node, [
        'id',
        'parent',
        'identity',
        'attachments',
        'suppressedAttachments',
        'ports',
      ])
      const eid = elementId(node.id, 'node', node.parent ?? null, 'present', nodePayload)
      writeIdentity(eid, node.identity)
      writeAttachments(eid, 'node', node.attachments)
      writeSuppressions(eid, 'node', node.suppressedAttachments)
      for (const port of node.ports ?? []) {
        const portPayload = payloadWithout(port, [
          'id',
          'identity',
          'attachments',
          'suppressedAttachments',
        ])
        // Port local_id is node-scoped (two nodes may share a port id like 'eth0').
        const pid = elementId(
          portLocalId(node.id, port.id),
          'port',
          node.id,
          'present',
          portPayload,
        )
        writeIdentity(pid, port.identity)
        writeAttachments(pid, 'port', port.attachments)
        writeSuppressions(pid, 'port', port.suppressedAttachments)
      }
    }

    // Subgraphs (+ attachments). children[] is derived from parent edges, not stored.
    for (const sg of graph.subgraphs ?? []) {
      const sgPayload = payloadWithout(sg, ['id', 'parent', 'attachments', 'children'])
      const eid = elementId(sg.id, 'subgraph', sg.parent ?? null, 'present', sgPayload)
      writeAttachments(eid, 'subgraph', sg.attachments)
    }

    // Terminations.
    for (const term of graph.terminations ?? []) {
      elementId(term.id, 'termination', null, 'present', payloadWithout(term, ['id']))
    }

    // Exclusions → identity-only `presence='hide'` elements.
    for (const [i, ex] of (graph.exclusions ?? []).entries()) {
      const eid = elementId(`__exclusion_${i}`, 'node', null, 'hide', {})
      writeIdentity(eid, ex as Identity)
    }

    // Topology-default attachments (graph.attachments).
    writeAttachments(null, 'topology-default', graph.attachments)

    // Links (+ via).
    for (const link of graph.links ?? []) {
      const from = link.from
      const to = link.to
      const linkPayload = payloadWithout(link, ['id', 'from', 'to', 'via'])
      // Per-endpoint non-structural fields (plug/ip/pin) ride in payload.
      linkPayload['from'] = payloadWithout(from, ['node', 'port'])
      linkPayload['to'] = payloadWithout(to, ['node', 'port'])
      const r = insLink.run(
        topologyId,
        sourceId,
        link.id ?? null,
        from.node,
        from.port != null ? portLocalId(from.node, from.port) : null,
        to.node,
        to.port != null ? portLocalId(to.node, to.port) : null,
        'present',
        j(linkPayload),
      )
      const linkId = Number(r.lastInsertRowid)
      for (const [seq, termId] of (link.via ?? []).entries()) {
        insVia.run(linkId, topologyId, sourceId, seq, termId)
      }
    }
  })
  run()
}

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
export function buildGraph(
  topologyId: string,
  sourceId: string,
  db: Database = getDatabase(),
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

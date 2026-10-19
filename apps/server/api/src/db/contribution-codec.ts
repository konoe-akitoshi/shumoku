// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Contribution-store codec: one source's contribution — or the project's own — kept in the
 * network model's shape (a `SourceNetwork`: the network as the YAML writes it, plus its
 * observation, design and drawing layers). See
 * apps/server/docs/design/db-native-persistence.md.
 *
 * `ingestNetwork` decomposes it into the `contribution_*` rows; `buildNetwork` projects them
 * back. What the entity registry and resolve look elements up by is promoted to rows: nodes,
 * ports, groups and terminations (`contribution_element`), their identity keys
 * (`contribution_identity`), attachments and suppressions (`contribution_attachment`), and
 * links between two nodes (`contribution_link` + `contribution_link_via`). Each row's
 * `payload_json` holds the rest of its element, layer by layer. Segments, routing domains,
 * connections, redundancy sets and links to a segment or a routing domain need no lookup, so
 * they stay in the source's document (`contribution_source.graph_payload_json`).
 *
 * The pair round-trips modulo these equivalences:
 *  - **empty collection ≡ absent**.
 *  - **`provenance` / `fieldSources` are derived, not stored** — resolve stamps them on its
 *    output; a contribution is an input.
 *  - **a port with no port-identity key gains `identity.ifName = <port name>`** — port names
 *    ARE interface names, so a metrics binding can anchor to it.
 *  - **a port a link end names but no layer describes is stored as an empty port**, so the
 *    link's foreign keys resolve; it builds back as a port with that identity only.
 */

import type { Database } from 'bun:sqlite'
import type {
  Attachment,
  DesignLayer,
  DrawingLayer,
  Identity,
  inputModel,
  NodeExclusion,
  ObservationLayer,
  SourceNetwork,
  Termination,
} from '@shumoku/core'

type Network = inputModel.Network
type NodeObservationEntry = NonNullable<ObservationLayer['nodes']>[string]
type PortObservationEntry = NonNullable<NodeObservationEntry['ports']>[string]

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

/**
 * A port with no port-identity key gets its name as `ifName`, so the entity registry can mint a
 * port entity for it and a metrics binding can anchor to it. A source's own key always wins.
 */
function portIdentityWithIfNameFallback(
  identity: Identity | undefined,
  portName: string,
): Identity {
  if (identity && (identity.ifName || identity.ifIndex !== undefined || identity.mac)) {
    return identity
  }
  return { ...identity, ifName: portName }
}

/** A shallow copy of `obj` without `keys`. */
function without<T extends object>(obj: T | undefined, keys: string[]): Record<string, unknown> {
  const out: Record<string, unknown> = { ...(obj as Record<string, unknown>) }
  for (const k of keys) delete out[k]
  return out
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

const j = (v: Record<string, unknown> | undefined): string | null => {
  const o = v && compact(v)
  return o ? JSON.stringify(o) : null
}
const parse = (s: string | null | undefined): Record<string, unknown> =>
  s ? (JSON.parse(s) as Record<string, unknown>) : {}

function attachmentKeyOf(a: Attachment): string {
  if (a.kind === 'access') return `access:${a.protocol}`
  if (a.kind === 'metrics-binding') return `metrics-binding:${a.sourceId}`
  return a.kind
}

/** Recover an attachment kind from a suppression key (the column needs a kind). */
function kindFromKey(key: string): string {
  if (key.startsWith('access:')) return 'access'
  if (key.startsWith('metrics-binding:')) return 'metrics-binding'
  return key
}

/**
 * Port names are only node-scoped (two switches may both have `eth0`), but
 * `contribution_element.local_id` is unique per source, so a port's local_id is composed with
 * its node's id. The separator (unit separator) won't occur in real ids.
 */
const PORT_SEP = '\u001f'
const portLocalId = (nodeId: string, portName: string): string => `${nodeId}${PORT_SEP}${portName}`
const stripPortLocalId = (localId: string, nodeId: string | null): string =>
  nodeId && localId.startsWith(`${nodeId}${PORT_SEP}`)
    ? localId.slice(nodeId.length + PORT_SEP.length)
    : localId

type Scope = 'node' | 'port' | 'subgraph' | 'topology-default'

/** Observation fields that live in rows or are derived; never in a payload. */
const OBSERVATION_IN_ROWS = [
  'identity',
  'attachments',
  'suppressedAttachments',
  'presence',
  'provenance',
  'fieldSources',
  'ports',
]

function flattenGroups(
  groups: readonly inputModel.Group[],
  parent?: string,
): Array<{ group: inputModel.Group; parent?: string }> {
  return groups.flatMap((group) => [
    { group, ...(parent && { parent }) },
    ...flattenGroups(group.groups ?? [], group.id),
  ])
}

const isNodeEnd = (e: inputModel.Endpoint): e is inputModel.NodeEnd => 'node' in e

// --- ingest ----------------------------------------------------------------

export interface IngestOptions {
  /** The owning topology_data_sources.id; null/undefined ⇒ the project's own contribution. */
  attachmentId?: string | null
  lastStatus?: string
  lastOkAt?: number
  /** Structural content hash (volatile fields stripped) for the no-change gate. */
  contentHash?: string | null
}

/** Replace `(topologyId, sourceId)`'s contribution with `contribution`, in one transaction. */
export function ingestNetwork(
  topologyId: string,
  sourceId: string,
  contribution: SourceNetwork,
  opts: IngestOptions,
  db: Database,
): void {
  const { network, observation, design, drawing } = contribution
  const nodeIds = new Set(network.nodes.map((n) => n.id))
  const betweenNodes = (l: inputModel.Link) =>
    l.endpoints.every((e) => isNodeEnd(e) && nodeIds.has(e.node))
  const sharedLinks = network.links.filter((l) => !betweenNodes(l))
  const layersOf = <T>(record: Readonly<Record<string, T>> | undefined) =>
    record &&
    compact(
      Object.fromEntries(
        sharedLinks.flatMap((l) => (l.id && record[l.id] ? [[l.id, record[l.id]]] : [])),
      ),
    )

  const run = db.transaction(() => {
    // Defer FK checks to COMMIT so forward references within one import are fine.
    db.exec('PRAGMA defer_foreign_keys = ON')
    db.query('DELETE FROM contribution_source WHERE topology_id = ? AND source_id = ?').run(
      topologyId,
      sourceId,
    )
    // The document: what no row needs to look up.
    const document = {
      network: compact({
        name: network.name,
        description: network.description,
        routingDomains: network.routingDomains,
        connections: network.connections,
        segments: network.segments,
        redundancy: network.redundancy,
        links: sharedLinks,
      }),
      observation: compact({ links: layersOf(observation?.links) }),
      design: compact({ links: layersOf(design?.links) }),
      drawing: compact({ links: layersOf(drawing?.links), settings: drawing?.settings }),
    }
    db.query(
      `INSERT INTO contribution_source (topology_id, source_id, attachment_id, last_status, last_ok_at, graph_payload_json, content_hash)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      topologyId,
      sourceId,
      opts.attachmentId ?? null,
      opts.lastStatus ?? null,
      opts.lastOkAt ?? null,
      j(document),
      opts.contentHash ?? null,
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

    const element = (
      localId: string,
      kind: string,
      parent: string | null,
      presence: string | null,
      payload: Record<string, unknown>,
    ): number =>
      Number(
        insElement.run(topologyId, sourceId, localId, kind, parent, presence, j(payload))
          .lastInsertRowid,
      )
    const writeIdentity = (eid: number, identity: Identity | undefined) => {
      for (const row of identityToRows(identity))
        insIdentity.run(eid, topologyId, sourceId, row.key_type, row.key_value)
    }
    const writeAttachments = (
      eid: number | null,
      scope: Scope,
      atts: readonly Attachment[] | undefined,
    ) => {
      for (const a of atts ?? []) {
        const target = a.kind === 'metrics-binding' ? a.sourceId : null
        const payload = without(a, a.kind === 'metrics-binding' ? ['kind', 'sourceId'] : ['kind'])
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
    // Suppressions are attachment KEYS the human negated, not objects.
    const writeSuppressions = (eid: number, scope: Scope, keys: readonly string[] | undefined) => {
      for (const key of keys ?? [])
        insAttachment.run(topologyId, sourceId, eid, scope, kindFromKey(key), key, null, 1, null)
    }

    // Nodes and their ports.
    const portLocalIds = new Set<string>()
    for (const node of network.nodes) {
      const observed = observation?.nodes?.[node.id]
      const designed = design?.nodes?.[node.id]
      const drawn = drawing?.nodes?.[node.id]
      // anchor → NULL presence: the node makes no presence claim.
      const presence = observed?.presence === 'anchor' ? null : 'present'
      const eid = element(node.id, 'node', node.group ?? null, presence, {
        config: without(node, ['id', 'group']),
        observation: without(observed, OBSERVATION_IN_ROWS),
        design: without(designed, ['ports']),
        drawing: without(drawn, ['ports']),
      })
      writeIdentity(eid, observed?.identity)
      writeAttachments(eid, 'node', observed?.attachments)
      writeSuppressions(eid, 'node', observed?.suppressedAttachments)

      const portNames = new Set([
        ...Object.keys(observed?.ports ?? {}),
        ...Object.keys(designed?.ports ?? {}),
        ...Object.keys(drawn?.ports ?? {}),
      ])
      for (const name of portNames) {
        const seen = observed?.ports?.[name]
        const lid = portLocalId(node.id, name)
        const pid = element(lid, 'port', node.id, 'present', {
          observation: without(seen, [
            'identity',
            'attachments',
            'suppressedAttachments',
            'provenance',
          ]),
          design: designed?.ports?.[name],
          drawing: drawn?.ports?.[name],
        })
        portLocalIds.add(lid)
        writeIdentity(pid, portIdentityWithIfNameFallback(seen?.identity, name))
        writeAttachments(pid, 'port', seen?.attachments)
        writeSuppressions(pid, 'port', seen?.suppressedAttachments)
      }
    }
    // A port a link end names but no layer describes: an empty port, so the FK resolves.
    const ensurePort = (nodeId: string, name: string): string => {
      const lid = portLocalId(nodeId, name)
      if (!portLocalIds.has(lid)) {
        const pid = element(lid, 'port', nodeId, 'present', {})
        writeIdentity(pid, portIdentityWithIfNameFallback(undefined, name))
        portLocalIds.add(lid)
      }
      return lid
    }

    // Groups, stored as `subgraph` elements under their parent group.
    for (const { group, parent } of flattenGroups(network.groups ?? [])) {
      const observed = observation?.groups?.[group.id]
      const eid = element(group.id, 'subgraph', parent ?? null, 'present', {
        config: without(group, ['id', 'groups']),
        observation: without(observed, ['attachments', 'provenance']),
        drawing: drawing?.groups?.[group.id],
      })
      writeAttachments(eid, 'subgraph', observed?.attachments)
    }

    for (const term of design?.terminations ?? []) {
      element(term.id, 'termination', null, 'present', without(term, ['id']))
    }

    // Exclusions → identity-only `presence='hide'` node elements.
    for (const [i, ex] of (observation?.exclusions ?? []).entries()) {
      const eid = element(`__exclusion_${i}`, 'node', null, 'hide', {})
      writeIdentity(eid, ex as Identity)
    }

    writeAttachments(null, 'topology-default', observation?.attachments)

    // Links between two nodes.
    for (const link of network.links) {
      if (!betweenNodes(link)) continue
      const [a, b] = link.endpoints as [inputModel.NodeEnd, inputModel.NodeEnd]
      const designed = link.id ? design?.links?.[link.id] : undefined
      const r = insLink.run(
        topologyId,
        sourceId,
        link.id ?? null,
        a.node,
        a.port ? ensurePort(a.node, a.port) : null,
        b.node,
        b.port ? ensurePort(b.node, b.port) : null,
        'present',
        j({
          config: without(link, ['id', 'endpoints']),
          observation: link.id ? without(observation?.links?.[link.id], ['provenance']) : undefined,
          design: without(designed, ['via']),
          drawing: link.id ? drawing?.links?.[link.id] : undefined,
        }),
      )
      const linkRowId = Number(r.lastInsertRowid)
      for (const [seq, termId] of (designed?.via ?? []).entries()) {
        insVia.run(linkRowId, topologyId, sourceId, seq, termId)
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

type Layered = {
  config?: Record<string, unknown>
  observation?: Record<string, unknown>
  design?: Record<string, unknown>
  drawing?: Record<string, unknown>
}

/** Project `(topologyId, sourceId)`'s rows back to its contribution. */
export function buildNetwork(
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
  const terminations: Termination[] = []
  const exclusions: NodeExclusion[] = []
  const observedNodes: Record<string, NodeObservationEntry> = {}
  const designedNodes: Record<string, NonNullable<DesignLayer['nodes']>[string]> = {}
  const drawnNodes: Record<string, NonNullable<DrawingLayer['nodes']>[string]> = {}
  const observedGroups: Record<string, NonNullable<ObservationLayer['groups']>[string]> = {}
  const drawnGroups: Record<string, NonNullable<DrawingLayer['groups']>[string]> = {}

  // Ports first, grouped by their node.
  const portsByNode = new Map<
    string,
    Array<{ name: string; observation?: PortObservationEntry; design?: unknown; drawing?: unknown }>
  >()
  for (const el of elements) {
    if (el.kind !== 'port' || !el.parent_local_id) continue
    const payload = parse(el.payload_json) as Layered
    const observation = compact({
      ...payload.observation,
      identity: identityOf(el.id),
      attachments: attsOf(el.id),
      suppressedAttachments: suppOf(el.id),
    }) as PortObservationEntry | undefined
    const list = portsByNode.get(el.parent_local_id) ?? []
    list.push({
      name: stripPortLocalId(el.local_id, el.parent_local_id),
      ...(observation && { observation }),
      ...(payload.design && { design: payload.design }),
      ...(payload.drawing && { drawing: payload.drawing }),
    })
    portsByNode.set(el.parent_local_id, list)
  }

  for (const el of elements) {
    const payload = parse(el.payload_json) as Layered
    if (el.kind === 'node' && el.presence === 'hide') {
      const id = identityOf(el.id)
      if (id) exclusions.push(id as NodeExclusion)
    } else if (el.kind === 'node') {
      nodes.push({
        id: el.local_id,
        ...payload.config,
        ...(el.parent_local_id && { group: el.parent_local_id }),
      })
      const ports = portsByNode.get(el.local_id) ?? []
      const byName = <T>(layer: 'observation' | 'design' | 'drawing') =>
        compact(Object.fromEntries(ports.map((p) => [p.name, p[layer]]))) as
          | Record<string, T>
          | undefined
      const observed = compact({
        ...payload.observation,
        // NULL presence = anchor; 'present' = scoop, left unset.
        presence: el.presence === null ? 'anchor' : undefined,
        identity: identityOf(el.id),
        attachments: attsOf(el.id),
        suppressedAttachments: suppOf(el.id),
        // Every stored port has an identity, so the observation layer names them all.
        ports: compact(Object.fromEntries(ports.map((p) => [p.name, p.observation ?? {}]))),
      })
      if (observed) observedNodes[el.local_id] = observed as NodeObservationEntry
      const designed = compact({ ...payload.design, ports: byName('design') })
      if (designed)
        designedNodes[el.local_id] = designed as NonNullable<DesignLayer['nodes']>[string]
      const drawn = compact({ ...payload.drawing, ports: byName('drawing') })
      if (drawn) drawnNodes[el.local_id] = drawn as NonNullable<DrawingLayer['nodes']>[string]
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
      terminations.push({ id: el.local_id, ...(payload as Record<string, unknown>) } as Termination)
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
  const designedLinks: Record<string, unknown> = { ...(document.design?.['links'] as object) }
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
    const payload = parse(r.payload_json) as Layered
    const end = (node: string, port: string | null): inputModel.NodeEnd => ({
      node,
      ...(port != null && { port: stripPortLocalId(port, node) }),
    })
    links.push({
      ...(r.local_id != null && { id: r.local_id }),
      ...payload.config,
      endpoints: [
        end(r.from_node_local_id, r.from_port_local_id),
        end(r.to_node_local_id, r.to_port_local_id),
      ],
    })
    if (r.local_id == null) continue
    const via = (viaByLink.get(r.id) ?? []).sort((a, b) => a.seq - b.seq).map((v) => v.t)
    if (payload.observation) observedLinks[r.local_id] = payload.observation
    const designed = compact({ ...payload.design, via })
    if (designed) designedLinks[r.local_id] = designed
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
  }
  const observation = compact({
    nodes: compact(observedNodes),
    links: compact(observedLinks),
    groups: compact(observedGroups),
    attachments: attsOf(null),
    exclusions,
  }) as ObservationLayer | undefined
  const design = compact({
    nodes: compact(designedNodes),
    links: compact(designedLinks),
    terminations,
  }) as DesignLayer | undefined
  const drawing = compact({
    nodes: compact(drawnNodes),
    links: compact(drawnLinks),
    groups: compact(drawnGroups),
    settings: document.drawing?.['settings'],
  }) as DrawingLayer | undefined
  return {
    network,
    ...(observation && { observation }),
    ...(design && { design }),
    ...(drawing && { drawing }),
  }
}

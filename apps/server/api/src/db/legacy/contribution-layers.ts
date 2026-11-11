// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * The contribution rows as they were stored between the network model (034) and the fold of
 * the design layer into the configuration (035): a `SourceNetwork` with an observation, a
 * design and a drawing layer, each element's payload split by layer. Read only by migration
 * 035, which lifts each contribution into the configuration's shape and writes it again with
 * the live codec; nothing else reads this format.
 */

import type { Database } from 'bun:sqlite'
import type { Identity } from '@shumoku/core'

/** A contribution as the layered store kept it, untyped: what it held is what the lift reads. */
export interface LayeredNetwork {
  network: Record<string, unknown>
  observation?: Record<string, unknown>
  design?: Record<string, unknown>
  drawing?: Record<string, unknown>
}

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
    // A row the live codec writes (036 and later), read back on a re-run: the same attribute.
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

/**
 * Port names are only node-scoped (two switches may both have `eth0`), but
 * `contribution_element.local_id` is unique per source, so a port's local_id is composed with
 * its node's id. The separator (unit separator) won't occur in real ids.
 */
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
  design?: Record<string, unknown>
  drawing?: Record<string, unknown>
}

/**
 * Project `(topologyId, sourceId)`'s rows back to the layered contribution they were stored as.
 * Rows the live codec wrote (a port's description under `config`, a link's plugs beside its
 * payload) read the same way, so the migration is idempotent.
 */
export function buildLayeredNetwork(
  topologyId: string,
  sourceId: string,
  db: Database,
): LayeredNetwork | null {
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
  const attByElement = new Map<number | null, Record<string, unknown>[]>()
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
        ? { kind: 'metrics-binding', sourceId: r.target_source_id, ...payload }
        : { kind: r.kind, ...payload }
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

  const document = parse(src.graph_payload_json) as Layered & {
    network?: Record<string, unknown>
  }
  const nodes: Record<string, unknown>[] = []
  const flatGroups: Array<{ id: string; parent?: string; config: Record<string, unknown> }> = []
  const terminations: Record<string, unknown>[] = []
  const exclusions: Record<string, unknown>[] = []
  const observedNodes: Record<string, Record<string, unknown>> = {}
  const designedNodes: Record<string, Record<string, unknown>> = {}
  const drawnNodes: Record<string, Record<string, unknown>> = {}
  const observedGroups: Record<string, Record<string, unknown>> = {}
  const drawnGroups: Record<string, Record<string, unknown>> = {}

  // Ports first, grouped by their node.
  const portsByNode = new Map<
    string,
    Array<{
      name: string
      observation?: Record<string, unknown>
      design?: Record<string, unknown>
      drawing?: Record<string, unknown>
    }>
  >()
  for (const el of elements) {
    if (el.kind !== 'port' || !el.parent_local_id) continue
    const payload = parse(el.payload_json) as Layered
    const observation = compact({
      ...payload.observation,
      identity: identityOf(el.id),
      attachments: attsOf(el.id),
      suppressedAttachments: suppOf(el.id),
    })
    const list = portsByNode.get(el.parent_local_id) ?? []
    const design = payload.design ?? payload.config
    list.push({
      name: stripPortLocalId(el.local_id, el.parent_local_id),
      ...(observation && { observation }),
      ...(design && { design }),
      ...(payload.drawing && { drawing: payload.drawing }),
    })
    portsByNode.set(el.parent_local_id, list)
  }

  for (const el of elements) {
    const payload = parse(el.payload_json) as Layered
    if (el.kind === 'node' && el.presence === 'hide') {
      const id = identityOf(el.id)
      if (id) exclusions.push(id as Record<string, unknown>)
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
      if (observed) observedNodes[el.local_id] = observed
      const designed = compact({ ...payload.design, ports: byName('design') })
      if (designed) designedNodes[el.local_id] = designed
      const drawn = compact({ ...payload.drawing, ports: byName('drawing') })
      if (drawn) drawnNodes[el.local_id] = drawn
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
      terminations.push({ id: el.local_id, ...(payload as Record<string, unknown>) })
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
  const links: Record<string, unknown>[] = []
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
    const payload = parse(r.payload_json) as Layered & {
      plugs?: [Record<string, unknown> | null, Record<string, unknown> | null]
    }
    const end = (node: string, port: string | null, side: 0 | 1): Record<string, unknown> => {
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
    const designed = compact({ ...payload.design, via })
    if (designed) designedLinks[r.local_id] = designed
    if (payload.drawing) drawnLinks[r.local_id] = payload.drawing
  }

  const childrenOf = (parent: string | undefined): Record<string, unknown>[] =>
    flatGroups
      .filter((g) => g.parent === parent)
      .map((g) => {
        const groups = childrenOf(g.id)
        return { id: g.id, ...g.config, ...(groups.length > 0 && { groups }) }
      })
  const groups = childrenOf(undefined)

  const network: Record<string, unknown> = {
    ...document.network,
    ...(groups.length > 0 && { groups }),
    nodes,
    links: [...links, ...((document.network?.['links'] as unknown[] | undefined) ?? [])],
    ...(terminations.length > 0 && { terminations }),
  }
  const observation = compact({
    nodes: compact(observedNodes),
    links: compact(observedLinks),
    groups: compact(observedGroups),
    attachments: attsOf(null),
    exclusions,
  })
  const design = compact({
    nodes: compact(designedNodes),
    links: compact(designedLinks),
    terminations,
  })
  const drawing = compact({
    nodes: compact(drawnNodes),
    links: compact(drawnLinks),
    groups: compact(drawnGroups),
    settings: document.drawing?.['settings'],
    order: document.drawing?.['order'],
  })
  return {
    network,
    ...(observation && { observation }),
    ...(design && { design }),
    ...(drawing && { drawing }),
  }
}

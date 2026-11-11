// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

import type { Database } from 'bun:sqlite'
import type { Identity, inputModel, SourceNetwork } from '@shumoku/core'
import { ingestNetwork } from '../contribution-codec.js'
import {
  buildIdentityNetwork,
  type IdentityNetwork,
  type IdentityNodeEntry,
} from '../legacy/contribution-identity.js'

/**
 * Move the device attributes a contribution kept in its observation record into its configuration,
 * as the configuration writes them: a node's `identity.mgmtIp` becomes the node's `address`,
 * `chassisId` / `sysName` / `mac` its own; a port's `identity.mac` becomes the port's `mac`, and a
 * port whose `identity.ifName` differs from its name is renamed to it (a port's name is its
 * interface name), every link end following. What stays a source's own (`vendorIds`, a port's
 * `ifIndex`) stays in the observation, under those fields; `identity` itself is gone.
 */
export function liftIdentityIntoConfiguration(stored: IdentityNetwork): SourceNetwork {
  const observed = stored.observation?.nodes ?? {}
  const renames = new Map<string, Map<string, string>>()
  const nodes = stored.network.nodes.map((node) => {
    const entry = observed[node.id]
    const id = entry?.identity
    const portRename = new Map<string, string>()
    for (const [name, port] of Object.entries(entry?.ports ?? {})) {
      const ifName = port.identity?.ifName
      if (ifName && ifName !== name) portRename.set(name, ifName)
    }
    if (portRename.size > 0) renames.set(node.id, portRename)
    const written = new Map((node.ports ?? []).map((p) => [portRename.get(p.name) ?? p.name, p]))
    for (const [name, port] of Object.entries(entry?.ports ?? {})) {
      const mac = port.identity?.mac
      if (!mac) continue
      const key = portRename.get(name) ?? name
      written.set(key, { ...(written.get(key) ?? { name: key }), name: key, mac })
    }
    const ports = [...written.values()].map((p) => ({
      ...p,
      name: portRename.get(p.name) ?? p.name,
    }))
    return {
      ...node,
      ...(id?.mgmtIp && { address: id.mgmtIp }),
      ...(id?.chassisId && { chassisId: id.chassisId }),
      ...(id?.sysName && { sysName: id.sysName }),
      ...(id?.mac && { mac: id.mac }),
      ...(ports.length > 0 ? { ports } : { ports: undefined }),
    }
  })
  const links = stored.network.links.map((link) => ({
    ...link,
    endpoints: link.endpoints.map((end) =>
      'node' in end && end.port
        ? { ...end, port: renames.get(end.node)?.get(end.port) ?? end.port }
        : end,
    ) as unknown as inputModel.Link['endpoints'],
  }))
  const observedNodes = Object.fromEntries(
    Object.entries(observed).map(([nodeId, entry]) => [
      nodeId,
      liftNodeEntry(entry, renames.get(nodeId)),
    ]),
  )
  return JSON.parse(
    JSON.stringify({
      network: { ...stored.network, nodes, links },
      observation: stored.observation
        ? {
            ...stored.observation,
            nodes: Object.keys(observedNodes).length > 0 ? observedNodes : undefined,
          }
        : undefined,
      drawing: stored.drawing,
    }),
  ) as SourceNetwork
}

function liftNodeEntry(
  entry: IdentityNodeEntry,
  rename: Map<string, string> | undefined,
): Record<string, unknown> {
  const { identity, ports, ...rest } = entry
  const vendorIds = (identity as Identity | undefined)?.vendorIds
  const lifted = Object.fromEntries(
    Object.entries(ports ?? {}).map(([name, port]) => {
      const { identity: portIdentity, ...portRest } = port
      const ifIndex = portIdentity?.ifIndex
      return [rename?.get(name) ?? name, { ...portRest, ...(ifIndex !== undefined && { ifIndex }) }]
    }),
  )
  return {
    ...rest,
    ...(vendorIds && Object.keys(vendorIds).length > 0 && { vendorIds }),
    ...(Object.keys(lifted).length > 0 && { ports: lifted }),
  }
}

/**
 * Rewrite every stored contribution in today's shape: each is read as the pre-036 store built it,
 * its identity lifted into its configuration, and written again with the live codec. A
 * contribution's content hash is cleared, so the next sync writes the source afresh.
 */
export function migrateContributionsToDeviceAttributes(db: Database): void {
  const sources = db
    .query(
      'SELECT topology_id, source_id, attachment_id, last_status, last_ok_at FROM contribution_source',
    )
    .all() as {
    topology_id: string
    source_id: string
    attachment_id: string | null
    last_status: string | null
    last_ok_at: number | null
  }[]
  for (const s of sources) {
    const stored = buildIdentityNetwork(s.topology_id, s.source_id, db)
    if (!stored) continue
    ingestNetwork(
      s.topology_id,
      s.source_id,
      liftIdentityIntoConfiguration(stored),
      {
        attachmentId: s.attachment_id,
        ...(s.last_status != null && { lastStatus: s.last_status }),
        ...(s.last_ok_at != null && { lastOkAt: s.last_ok_at }),
        contentHash: null,
      },
      db,
    )
  }
}

/** Rewrite each audit row's observed network in today's shape. */
export function migrateObservationsToDeviceAttributes(db: Database): void {
  const rows = db
    .query('SELECT id, graph_json FROM topology_observations WHERE graph_json IS NOT NULL')
    .all() as { id: string; graph_json: string }[]
  const update = db.query('UPDATE topology_observations SET graph_json = ? WHERE id = ?')
  for (const row of rows) {
    const stored = JSON.parse(row.graph_json) as Partial<IdentityNetwork>
    if (!stored.network || typeof stored.network !== 'object') continue
    update.run(
      JSON.stringify(liftIdentityIntoConfiguration({ ...stored, network: stored.network })),
      row.id,
    )
  }
}

/** The baked artifact gains the record kept beside its graph; older artifacts are rebaked. */
export function addResolvedRecordColumn(db: Database): void {
  const columns = db.query('PRAGMA table_info(topology_resolved_graph)').all() as { name: string }[]
  if (columns.some((c) => c.name === 'record_json')) return
  db.exec('ALTER TABLE topology_resolved_graph ADD COLUMN record_json TEXT')
}

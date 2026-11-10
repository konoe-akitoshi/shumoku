// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

import type { Database } from 'bun:sqlite'
import type { SourceNetwork } from '@shumoku/core'
import { ingestNetwork } from '../contribution-codec.js'
import { buildLayeredNetwork, type LayeredNetwork } from '../legacy/contribution-layers.js'

/**
 * Fold the design layer a contribution carried into its configuration, and drop what nothing
 * reads any more. A node's designed ports, product and spec become the node's `ports`,
 * `productId`, `platform`, `service` and `resource`; a link's designed ends, cable and `via`
 * become its endpoints' `plug`, its `cable` and its `via`; the designed terminations become the
 * network's. Coordinates (link bends, termination positions, node positions and sizes, group
 * bounds), port placements, group directions and membership rules, `fieldSources` and a port's
 * `disabled` are dropped: the drawing decides the first, and nothing read the rest.
 */
export function liftDesignIntoConfiguration(layered: LayeredNetwork): SourceNetwork {
  const design = (layered.design ?? {}) as {
    nodes?: Record<string, Record<string, unknown>>
    links?: Record<string, Record<string, unknown>>
    terminations?: Record<string, unknown>[]
  }
  const drawing = (layered.drawing ?? {}) as {
    nodes?: Record<string, Record<string, unknown>>
    groups?: Record<string, Record<string, unknown>>
  }
  const observation = (layered.observation ?? {}) as {
    nodes?: Record<string, Record<string, unknown>>
    groups?: Record<string, Record<string, unknown>>
  }
  const network = layered.network as {
    nodes: Record<string, unknown>[]
    links: Record<string, unknown>[]
    terminations?: Record<string, unknown>[]
  }

  const nodes = network.nodes.map((node) => {
    const id = String(node['id'])
    const designed = design.nodes?.[id] ?? {}
    const spec = (designed['spec'] ?? {}) as Record<string, unknown>
    const ports = liftPorts(node['ports'], designed['ports'])
    const { termination: _t, ...rest } = node
    return {
      ...rest,
      ...(designed['productId'] !== undefined && { productId: designed['productId'] }),
      ...(spec['platform'] !== undefined && { platform: spec['platform'] }),
      ...(spec['service'] !== undefined && { service: spec['service'] }),
      ...(spec['resource'] !== undefined && { resource: spec['resource'] }),
      ...(ports.length > 0 ? { ports } : { ports: undefined }),
    }
  })

  const links = network.links.map((link) => {
    const id = typeof link['id'] === 'string' ? link['id'] : undefined
    const designed = (id && design.links?.[id]) || {}
    const ends = (designed['ends'] ?? []) as Array<{ plug?: unknown } | undefined>
    const endpoints = ((link['endpoints'] ?? []) as Record<string, unknown>[]).map((end, i) => {
      const plug = end['plug'] ?? ends[i]?.plug
      return 'node' in end && plug ? { ...end, plug } : end
    })
    const cable = liftCable(link['cable'], designed['cable'] as Record<string, unknown> | undefined)
    const via = (link['via'] ?? designed['via']) as unknown[] | undefined
    const { bends: _b, ...rest } = link
    return {
      ...rest,
      endpoints,
      ...(cable !== undefined ? { cable } : { cable: undefined }),
      ...(Array.isArray(via) && via.length > 0 ? { via } : { via: undefined }),
    }
  })

  // The layered reader lists a termination both as the network's and as the design's.
  const terminationById = new Map<string, Record<string, unknown>>()
  for (const { position: _p, metadata, ...rest } of [
    ...(network.terminations ?? []),
    ...(design.terminations ?? []),
  ]) {
    const id = String(rest['id'])
    if (terminationById.has(id)) continue
    const autoFor = (metadata as Record<string, unknown> | undefined)?.['autoFor']
    terminationById.set(id, { ...rest, ...(typeof autoFor === 'string' && { autoFor }) })
  }
  const terminations = [...terminationById.values()]

  const drawnNodes = Object.fromEntries(
    Object.entries(drawing.nodes ?? {}).flatMap(([id, drawn]) => {
      const { position: _p, size: _s, ports: _ports, ...rest } = drawn
      return Object.keys(rest).length > 0 ? [[id, rest]] : []
    }),
  )
  const drawnGroups = Object.fromEntries(
    Object.entries(drawing.groups ?? {}).flatMap(([id, drawn]) => {
      const { direction: _d, bounds: _b, ...rest } = drawn
      return Object.keys(rest).length > 0 ? [[id, rest]] : []
    }),
  )
  const observedNodes = Object.fromEntries(
    Object.entries(observation.nodes ?? {}).map(([id, observed]) => {
      const { fieldSources: _f, ...rest } = observed
      return [id, rest]
    }),
  )
  const observedGroups = Object.fromEntries(
    Object.entries(observation.groups ?? {}).map(([id, observed]) => {
      const { membership: _m, ...rest } = observed
      return [id, rest]
    }),
  )

  return JSON.parse(
    JSON.stringify({
      network: {
        ...network,
        nodes,
        links,
        terminations: terminations.length > 0 ? terminations : undefined,
      },
      observation: layered.observation
        ? {
            ...layered.observation,
            nodes: Object.keys(observedNodes).length > 0 ? observedNodes : undefined,
            groups: Object.keys(observedGroups).length > 0 ? observedGroups : undefined,
          }
        : undefined,
      drawing: layered.drawing
        ? {
            ...layered.drawing,
            nodes: Object.keys(drawnNodes).length > 0 ? drawnNodes : undefined,
            groups: Object.keys(drawnGroups).length > 0 ? drawnGroups : undefined,
          }
        : undefined,
    }),
  ) as SourceNetwork
}

/** A node's ports as the configuration writes them: the written ones, plus the designed ones. */
function liftPorts(written: unknown, designed: unknown): Record<string, unknown>[] {
  const byName = new Map<string, Record<string, unknown>>()
  for (const port of Array.isArray(written) ? (written as Record<string, unknown>[]) : []) {
    if (typeof port['name'] === 'string') byName.set(port['name'], port)
  }
  for (const [name, port] of Object.entries((designed ?? {}) as Record<string, unknown>)) {
    const { label, disabled: _d, ...rest } = port as Record<string, unknown>
    const connectors = rest['connectors']
    byName.set(name, {
      ...byName.get(name),
      name,
      ...rest,
      ...(label !== undefined && label !== name && { label }),
      ...(Array.isArray(connectors) && connectors.length === 0 && { connectors: undefined }),
    })
  }
  return [...byName.values()]
}

/** The cable as the configuration writes it: its type (grade or medium) and its product. */
function liftCable(
  written: unknown,
  designed: Record<string, unknown> | undefined,
): string | Record<string, unknown> | undefined {
  const type =
    typeof written === 'string'
      ? written
      : ((written as Record<string, unknown> | undefined)?.['type'] ??
        designed?.['category'] ??
        designed?.['medium'])
  const productId =
    (written as Record<string, unknown> | undefined)?.['productId'] ?? designed?.['productId']
  if (productId !== undefined) return { ...(type !== undefined && { type }), productId }
  return typeof type === 'string' ? type : undefined
}

/**
 * Rewrite every stored contribution in the configuration's shape: each is read as the layered
 * contribution it was stored as, its design lifted into its configuration, and written again.
 * A contribution's content hash is cleared, so the next sync writes the source afresh.
 */
export function migrateContributionsToConfiguration(db: Database): void {
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
    const layered = buildLayeredNetwork(s.topology_id, s.source_id, db)
    if (!layered) continue
    ingestNetwork(
      s.topology_id,
      s.source_id,
      liftDesignIntoConfiguration(layered),
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

/** Rewrite each audit row's observed network in the configuration's shape. */
export function migrateObservationsToConfiguration(db: Database): void {
  const rows = db
    .query('SELECT id, graph_json FROM topology_observations WHERE graph_json IS NOT NULL')
    .all() as { id: string; graph_json: string }[]
  const update = db.query('UPDATE topology_observations SET graph_json = ? WHERE id = ?')
  for (const row of rows) {
    const stored = JSON.parse(row.graph_json) as Partial<LayeredNetwork>
    if (!stored.network || typeof stored.network !== 'object') continue
    update.run(
      JSON.stringify(liftDesignIntoConfiguration({ ...stored, network: stored.network })),
      row.id,
    )
  }
}

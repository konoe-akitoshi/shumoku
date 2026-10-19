// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only
// For commercial licensing, contact: contact@shumoku.dev

import type * as input from '../input/model.js'
import type { NetworkModel } from './network-model.js'
import { fromNetworkGraph } from './network-model-from-graph.js'
import type { Link, NetworkGraph } from './types.js'

type Mutable<T> = { -readonly [K in keyof T]: T[K] }
type LayerName = 'observation' | 'design' | 'drawing'
type Kind = 'nodes' | 'links' | 'groups'
type Entries = Record<string, unknown>

/**
 * Writes the edits made to a drawn graph back into the model it was drawn from.
 *
 * `drawn` is the graph as it was before the edits and `edited` as it is after; only what differs
 * between them is written. The configuration keeps what the graph cannot say, such as a node's
 * software or the host a VM runs on, and a field the graph draws from another (a product's name,
 * a link's speed) is kept as written until that field is edited. The layers of an edited element
 * are replaced, as the graph says all of them. Without an edit, the model itself is returned.
 */
export function applyGraphEdits(
  model: NetworkModel,
  drawn: NetworkGraph,
  edited: NetworkGraph,
): NetworkModel {
  const before = fromNetworkGraph(drawn)
  const after = fromNetworkGraph(edited)
  if (same(before, after)) return model
  const config: Mutable<input.Network> = { ...model.config }
  const layers: Record<LayerName, Record<Kind, Entries>> = {
    observation: { ...layerOf(model.observation) },
    design: { ...layerOf(model.design) },
    drawing: { ...layerOf(model.drawing) },
  }

  // Nodes, and the segments drawn as nodes.
  const drawnSegments = new Set(drawn.nodes.map((n) => n.id))
  const editedNodeIds = new Set(edited.nodes.map((n) => n.id))
  config.nodes = mergeList(config.nodes, before.config.nodes, after.config.nodes)
  config.segments = mergeList(
    config.segments ?? [],
    (before.config.segments ?? []).filter((s) => drawnSegments.has(s.id)),
    (after.config.segments ?? []).filter((s) => editedNodeIds.has(s.id)),
  )
  const removedNodes = [...drawnSegments].filter((id) => !editedNodeIds.has(id))
  if (removedNodes.length > 0) removeNodeReferences(config, new Set(removedNodes))
  editLayers(layers, 'nodes', before, after)

  // Links: matched by id, or by their ends when they have none.
  editLinks(config, drawn, edited, before, after)
  editLayers(layers, 'links', before, after)

  // Groups: their nesting, as a flat list of parents.
  if (!same(before.config.groups, after.config.groups)) {
    const groups = nestFlat(
      mergeList(
        flatGroups(config.groups ?? []),
        flatGroups(before.config.groups ?? []),
        flatGroups(after.config.groups ?? []),
      ),
    )
    config.groups = groups.length > 0 ? groups : undefined
  }
  editLayers(layers, 'groups', before, after)

  for (const key of ['name', 'description'] as const) {
    if (!same(before.config[key], after.config[key])) config[key] = after.config[key]
  }
  if (config.segments?.length === 0) config.segments = undefined
  if (config.redundancy?.length === 0) config.redundancy = undefined

  const observation = withLayer(model.observation, layers.observation, {
    attachments: edited.attachments,
    exclusions: edited.exclusions,
    changed:
      !same(drawn.attachments, edited.attachments) || !same(drawn.exclusions, edited.exclusions),
  })
  const design = withLayer(model.design, layers.design, {
    terminations: edited.terminations,
    changed: !same(drawn.terminations, edited.terminations),
  })
  const drawing = withLayer(model.drawing, layers.drawing, {
    settings: edited.settings,
    changed: !same(drawn.settings, edited.settings),
  })
  return {
    ...model,
    config: compact(config),
    observation,
    design,
    drawing,
  }
}

function layerOf(layer: object | undefined): Record<Kind, Entries> {
  const l = (layer ?? {}) as Partial<Record<Kind, Entries>>
  return { nodes: { ...l.nodes }, links: { ...l.links }, groups: { ...l.groups } }
}

/** Replaces each layer entry that differs between the two splits, and drops removed ones. */
function editLayers(
  layers: Record<LayerName, Record<Kind, Entries>>,
  kind: Kind,
  before: NetworkModel,
  after: NetworkModel,
) {
  for (const name of ['observation', 'design', 'drawing'] as const) {
    const was = ((before[name] as Partial<Record<Kind, Entries>> | undefined)?.[kind] ??
      {}) as Entries
    const now = ((after[name] as Partial<Record<Kind, Entries>> | undefined)?.[kind] ??
      {}) as Entries
    const target = layers[name][kind]
    for (const id of new Set([...Object.keys(was), ...Object.keys(now)])) {
      if (same(was[id], now[id])) continue
      if (now[id] === undefined) delete target[id]
      else target[id] = now[id]
    }
  }
}

function withLayer<L extends object>(
  layer: L | undefined,
  entries: Record<Kind, Entries>,
  top: Record<string, unknown> & { changed: boolean },
): L | undefined {
  const { changed, ...fields } = top
  const next: Record<string, unknown> = { ...layer }
  for (const kind of ['nodes', 'links', 'groups'] as const) {
    if (kind in next || Object.keys(entries[kind]).length > 0) {
      next[kind] = Object.keys(entries[kind]).length > 0 ? entries[kind] : undefined
    }
  }
  if (changed) Object.assign(next, fields)
  const set = Object.entries(next).filter(([, v]) => v !== undefined)
  return set.length > 0 ? (Object.fromEntries(set) as L) : undefined
}

/**
 * Merges an edited list of entities with ids into the configuration's: an entity added in
 * `after` is appended, one removed is dropped, and a changed one gets each changed field.
 */
function mergeList<T extends { readonly id: string }>(
  current: readonly T[],
  before: readonly T[],
  after: readonly T[],
): T[] {
  const was = new Map(before.map((e) => [e.id, e]))
  const now = new Map(after.map((e) => [e.id, e]))
  const kept = current.flatMap((entity) => {
    if (!was.has(entity.id)) return [entity]
    const next = now.get(entity.id)
    return next ? [mergeFields(entity, was.get(entity.id), next)] : []
  })
  const known = new Set(current.map((e) => e.id))
  return [...kept, ...after.filter((e) => !was.has(e.id) && !known.has(e.id))]
}

/** Sets each field that differs between `before` and `after`, keeping the rest as written. */
function mergeFields<T extends object>(current: T, before: T | undefined, after: T): T {
  const out = { ...current } as Record<string, unknown>
  const b = (before ?? {}) as Record<string, unknown>
  const a = after as unknown as Record<string, unknown>
  for (const key of new Set([...Object.keys(b), ...Object.keys(a)])) {
    if (same(b[key], a[key])) continue
    if (a[key] === undefined) delete out[key]
    else out[key] = a[key]
  }
  return out as unknown as T
}

/** A node that is gone leaves no redundancy membership, segment address or host behind. */
function removeNodeReferences(config: Mutable<input.Network>, removed: Set<string>) {
  config.redundancy = config.redundancy
    ?.map((r) => ({ ...r, nodes: r.nodes.filter((n) => !removed.has(n)) }))
    .filter((r) => r.nodes.length >= 2)
  config.segments = config.segments?.map((s) => {
    if (!s.addresses || !Object.keys(s.addresses).some((n) => removed.has(n))) return s
    const addresses = Object.fromEntries(
      Object.entries(s.addresses).filter(([n]) => !removed.has(n)),
    )
    const { addresses: _, ...rest } = s
    return Object.keys(addresses).length > 0 ? { ...rest, addresses } : rest
  })
  config.nodes = config.nodes.map((n) => {
    if (!n.host || !removed.has(n.host)) return n
    const { host: _, ...rest } = n
    return rest
  })
}

const endKey = (e: Link['from']) => `${e.node}:${e.port}`
const linkKey = (link: Link) => link.id ?? `${endKey(link.from)}|${endKey(link.to)}`

function editLinks(
  config: Mutable<input.Network>,
  drawn: NetworkGraph,
  edited: NetworkGraph,
  before: NetworkModel,
  after: NetworkModel,
) {
  const was = new Map(
    drawn.links.map((link, i) => [linkKey(link), { link, split: before.config.links[i] }]),
  )
  const now = new Map(
    edited.links.map((link, i) => [linkKey(link), { link, split: after.config.links[i] }]),
  )
  const hosted = new Map<string, string>(
    config.nodes.flatMap((n) => (n.host ? [[`${n.host}:|${n.id}:`, n.id] as const] : [])),
  )
  /** The configuration's link a drawn link was drawn from. */
  const sourceOf = (link: Link) =>
    config.links.findIndex((l) =>
      link.id
        ? l.id === link.id
        : !l.id && sameEnd(l.endpoints[0], link.from) && sameEnd(l.endpoints[1], link.to),
    )

  for (const [key, { link }] of was) {
    if (now.has(key)) continue
    const index = sourceOf(link)
    if (index >= 0) {
      config.links = config.links.filter((_, i) => i !== index)
      continue
    }
    // A host link stands for the VM's host; removing it removes that.
    const vm = hosted.get(key)
    if (vm) {
      config.nodes = config.nodes.map((n) => {
        if (n.id !== vm) return n
        const { host: _, ...rest } = n
        return rest
      })
    }
  }

  for (const [key, { link, split }] of now) {
    if (!split) continue
    const previous = was.get(key)
    if (previous && hosted.has(key)) continue
    if (previous && same(previous.link, link)) continue
    const { segments: _, ...fields } = split
    const index = previous ? sourceOf(previous.link) : -1
    let next: Mutable<input.Link>
    if (index < 0) {
      next = { ...fields, ...(link.id && { id: link.id }) }
    } else {
      const { segments: __, ...prior } = previous?.split ?? split
      const current = config.links[index] as input.Link
      next = mergeFields(current, prior as input.Link, fields as input.Link)
      if (link.id && !current.id) next.id = link.id
    }
    next = retargetSegments(config, next, previous?.link, link)
    editRedundancy(config, previous?.link, link)
    config.links =
      index < 0 ? [...config.links, next] : config.links.map((l, i) => (i === index ? next : l))
  }
}

function sameEnd(end: input.Endpoint, drawnEnd: Link['from']): boolean {
  if ('node' in end) return end.node === drawnEnd.node && (end.port ?? '') === drawnEnd.port
  return 'segment' in end && end.segment === drawnEnd.node && drawnEnd.port === ''
}

/** A link's VLANs and end addresses are the segments it carries; edits move it between them. */
function retargetSegments(
  config: Mutable<input.Network>,
  link: Mutable<input.Link>,
  before: Link | undefined,
  after: Link,
): Mutable<input.Link> {
  let segments = [...(link.segments ?? [])]
  const byId = () => new Map((config.segments ?? []).map((s) => [s.id, s]))

  const vlans = after.vlan ?? []
  if (!same(before?.vlan ?? [], vlans)) {
    const index = byId()
    segments = segments.filter((id) => {
      const vlan = index.get(id)?.vlan
      return vlan === undefined || vlans.includes(vlan)
    })
    for (const vlan of vlans) {
      if (segments.some((id) => index.get(id)?.vlan === vlan)) continue
      const existing = config.segments?.find((s) => s.vlan === vlan)
      const segment = existing ?? { id: `vlan-${vlan}`, vlan }
      if (!existing) config.segments = [...(config.segments ?? []), segment]
      segments.push(segment.id)
    }
  }

  for (const side of ['from', 'to'] as const) {
    const ip = after[side].ip
    if ((before?.[side].ip ?? undefined) === ip) continue
    const node = after[side].node
    const index = byId()
    // The segment that already holds this node's address, or one of the link's own.
    const holder =
      segments.find((id) => index.get(id)?.addresses?.[node] !== undefined) ??
      (ip ? `${link.id ?? `${node}`}:addresses` : undefined)
    if (!holder) continue
    const segment = index.get(holder) ?? { id: holder }
    const { [node]: _, ...others } = segment.addresses ?? {}
    const addresses = ip ? { ...others, [node]: ip } : others
    const { addresses: __, ...rest } = segment
    const updated = Object.keys(addresses).length > 0 ? { ...rest, addresses } : rest
    config.segments = index.has(holder)
      ? (config.segments ?? []).map((s) => (s.id === holder ? updated : s))
      : [...(config.segments ?? []), updated]
    if (!segments.includes(holder)) segments.push(holder)
  }

  const { segments: _, ...rest } = link
  return segments.length > 0 ? { ...rest, segments } : rest
}

/** A redundancy kind on a link is the set its two ends form. */
function editRedundancy(config: Mutable<input.Network>, before: Link | undefined, after: Link) {
  if (before?.redundancy === after.redundancy) return
  const a = after.from.node
  const b = after.to.node
  const sets = config.redundancy ?? []
  const index = sets.findIndex((r) => r.nodes.includes(a) && r.nodes.includes(b))
  if (!after.redundancy) {
    // Only a set of just these two is the link's own to drop.
    if (index >= 0 && sets[index]?.nodes.length === 2) {
      config.redundancy = sets.filter((_, i) => i !== index)
    }
    return
  }
  const kind = after.redundancy
  config.redundancy =
    index >= 0
      ? sets.map((r, i) => (i === index ? { ...r, kind } : r))
      : [...sets, { id: `${a}-${b}`, nodes: [a, b], kind }]
}

interface FlatGroup {
  readonly id: string
  readonly label?: string
  readonly parent?: string
}

function flatGroups(groups: readonly input.Group[], parent?: string): FlatGroup[] {
  return groups.flatMap((g) => [
    { id: g.id, ...(g.label !== undefined && { label: g.label }), ...(parent && { parent }) },
    ...flatGroups(g.groups ?? [], g.id),
  ])
}

function nestFlat(groups: readonly FlatGroup[], parent?: string): input.Group[] {
  const ids = new Set(groups.map((g) => g.id))
  return groups
    .filter((g) => (g.parent && ids.has(g.parent) ? g.parent : undefined) === parent)
    .map((g) => {
      const children = nestFlat(groups, g.id)
      return {
        id: g.id,
        ...(g.label !== undefined && { label: g.label }),
        ...(children.length > 0 && { groups: children }),
      }
    })
}

function compact(config: Mutable<input.Network>): input.Network {
  return Object.fromEntries(
    Object.entries(config).filter(([, v]) => v !== undefined),
  ) as unknown as input.Network
}

function same(a: unknown, b: unknown): boolean {
  if (a === b) return true
  return stableJson(a) === stableJson(b)
}

function stableJson(value: unknown): string {
  return JSON.stringify(value, (_, v) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v).sort(([x], [y]) => (x < y ? -1 : x > y ? 1 : 0)))
      : v,
  )
}

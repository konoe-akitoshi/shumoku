// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

import {
  type Link,
  type NetworkGraph,
  type Node,
  placePorts,
  type ResolvedEdge,
  type ResolvedLayout,
  type ResolvedPort,
  routeEdges,
  type Subgraph,
} from '@shumoku/core'
import { SvelteMap } from 'svelte/reactivity'

// Root diagram + sub-sheet mirror state. Pure store — primitives
// only, no commit wrapping. Composer (`context.svelte.ts`) layers
// undo on top via its mutation methods.

export const diagram = $state({
  nodes: new SvelteMap<string, Node>(),
  ports: new SvelteMap<string, ResolvedPort>(),
  edges: new SvelteMap<string, ResolvedEdge>(),
  subgraphs: new SvelteMap<string, Subgraph>(),
  bounds: { x: 0, y: 0, width: 0, height: 0 },
  links: [] as Link[],
})

/**
 * Mirror of the diagram populated when drilled into a sub-sheet.
 * Same shape so the renderer can bind to it the same way.
 * SvelteMap identity is preserved across switches via `replaceMap`,
 * so reactive bindings stay attached.
 */
export const sheetView = $state({
  nodes: new SvelteMap<string, Node>(),
  ports: new SvelteMap<string, ResolvedPort>(),
  edges: new SvelteMap<string, ResolvedEdge>(),
  subgraphs: new SvelteMap<string, Subgraph>(),
  bounds: { x: 0, y: 0, width: 400, height: 300 },
  links: [] as Link[],
})

const sheetState = $state({ currentSheetId: null as string | null })

export const sheetStore = {
  get currentSheetId() {
    return sheetState.currentSheetId
  },
  setCurrentSheetId(id: string | null) {
    sheetState.currentSheetId = id
  },
}

/**
 * Per-sheet layout cache. Invalidated on any structural root mutation
 * (nodes/subgraphs/links added/removed, parents reparented). Visual-
 * only edits don't affect child-sheet content so they leave it alone.
 *
 * The generation counter lets in-flight `switchSheet` calls abandon
 * stale layout results when the graph mutated underneath them.
 */
export const sheetCache = new Map<string, ResolvedLayout>()
export const sheetLinkCache = new Map<string, Link[]>()
let sheetCacheGeneration = 0

export function invalidateSheetCache() {
  sheetCache.clear()
  sheetLinkCache.clear()
  sheetCacheGeneration++
}

export function currentSheetCacheGeneration() {
  return sheetCacheGeneration
}

/**
 * Replace the contents of a SvelteMap in place, preserving its
 * identity so bindings and downstream reactivity stay attached.
 */
export function replaceMap<K, V>(target: Map<K, V>, source: Iterable<[K, V]>) {
  target.clear()
  for (const [k, v] of source) target.set(k, v)
}

/**
 * Assign a `ResolvedLayout` into the given mirror state, preserving
 * SvelteMap identity (so the renderer's bindings stay attached).
 * Shared by both sheet load and sheet cache hits.
 */
export function applyResolvedLayout(
  target: {
    nodes: SvelteMap<string, Node>
    ports: SvelteMap<string, ResolvedPort>
    edges: SvelteMap<string, ResolvedEdge>
    subgraphs: SvelteMap<string, Subgraph>
    bounds: { x: number; y: number; width: number; height: number }
    links: Link[]
  },
  resolved: ResolvedLayout,
  links: Link[],
) {
  replaceMap(target.nodes, resolved.nodes)
  replaceMap(target.ports, resolved.ports)
  replaceMap(target.edges, resolved.edges)
  replaceMap(target.subgraphs, resolved.subgraphs)
  target.bounds = { ...resolved.bounds }
  target.links = [...links]
}

// Edge routing — generation counter prevents stale async results
// from clobbering newer ones when the user is mid-edit.
let routeGeneration = 0

/** Recompute edges from current nodes/ports/links (async WASM router). */
export async function rerouteEdges() {
  const gen = ++routeGeneration
  const result = await routeEdges(diagram.nodes, diagram.ports, diagram.links)
  if (gen === routeGeneration) {
    replaceMap(diagram.edges, result)
  }
}

export function replaceDerivedPorts(direction: 'TB' | 'LR' | 'BT' | 'RL' = 'TB') {
  replaceMap(diagram.ports, placePorts(diagram.nodes, diagram.links, direction))
}

export async function rebuildPortsAndEdges() {
  replaceDerivedPorts()
  await rerouteEdges()
}

/**
 * Drop malformed entries from an imported graph so we never render
 * orphan references. Best-effort with a console warning per category
 * — favor loading *something* over rejecting the whole file.
 */
export function sanitizeGraph(graph: NetworkGraph): {
  nodes: Map<string, Node>
  subgraphs: Map<string, Subgraph>
  links: Link[]
} {
  const nodes = new Map<string, Node>()
  let duplicateNodes = 0
  for (const node of graph.nodes ?? []) {
    if (nodes.has(node.id)) {
      duplicateNodes++
      continue
    }
    nodes.set(node.id, node)
  }
  if (duplicateNodes > 0) {
    console.warn(`[import] dropped ${duplicateNodes} duplicate node id(s)`)
  }

  const subgraphs = new Map<string, Subgraph>()
  let duplicateSubgraphs = 0
  for (const sg of graph.subgraphs ?? []) {
    if (subgraphs.has(sg.id) || nodes.has(sg.id)) {
      duplicateSubgraphs++
      continue
    }
    subgraphs.set(sg.id, sg)
  }
  if (duplicateSubgraphs > 0) {
    console.warn(`[import] dropped ${duplicateSubgraphs} duplicate/conflicting subgraph id(s)`)
  }

  let strippedNodeParents = 0
  for (const [id, node] of nodes) {
    if (node.parent && !subgraphs.has(node.parent)) {
      nodes.set(id, { ...node, parent: undefined })
      strippedNodeParents++
    }
  }
  if (strippedNodeParents > 0) {
    console.warn(`[import] cleared ${strippedNodeParents} node(s) with unknown parent`)
  }

  let strippedSgParents = 0
  for (const [id, sg] of subgraphs) {
    if (sg.parent && !subgraphs.has(sg.parent)) {
      subgraphs.set(id, { ...sg, parent: undefined })
      strippedSgParents++
    }
  }
  if (strippedSgParents > 0) {
    console.warn(`[import] cleared ${strippedSgParents} subgraph(s) with unknown parent`)
  }

  const validLinks: Link[] = []
  let droppedLinks = 0
  for (const link of graph.links ?? []) {
    if (nodes.has(link.from.node) && nodes.has(link.to.node)) {
      validLinks.push(link)
    } else {
      droppedLinks++
    }
  }
  if (droppedLinks > 0) {
    console.warn(`[import] dropped ${droppedLinks} link(s) with unknown endpoints`)
  }

  // Heal orphan port references: a link's endpoint may point at a port id
  // that no longer exists on the node (legacy data from when product
  // updates regenerated port ids). Materialize a stub NodePort with the
  // referenced id and an empty label so the link stays attached and the
  // user can rename it from the popover. We mutate `nodes` in place
  // because the maps haven't been replaced into the reactive store yet.
  const portsByNode = new Map<string, Set<string>>()
  for (const [id, node] of nodes) {
    portsByNode.set(id, new Set((node.ports ?? []).map((p) => p.id)))
  }
  let healed = 0
  for (const link of validLinks) {
    for (const ep of [link.from, link.to]) {
      if (!ep.port) continue
      const existing = portsByNode.get(ep.node)
      if (!existing || existing.has(ep.port)) continue
      const node = nodes.get(ep.node)
      if (!node) continue
      const stub = { id: ep.port, label: '', connectors: [], source: 'custom' as const }
      nodes.set(ep.node, { ...node, ports: [...(node.ports ?? []), stub] })
      existing.add(ep.port)
      healed++
    }
  }
  if (healed > 0) {
    console.warn(
      `[import] materialized ${healed} stub port(s) for link endpoints referencing missing ids`,
    )
  }

  return { nodes, subgraphs, links: validLinks }
}

import { builtinEntries, Catalog } from '@shumoku/catalog'
import {
  buildHierarchicalSheets,
  collectObstacles,
  computeNetworkLayout,
  computeNodeSize,
  createMemoryFileResolver,
  createNetworkLayoutEngine,
  darkTheme,
  getNodeId,
  HierarchicalParser,
  type Link,
  lightTheme,
  moveNode,
  type NetworkGraph,
  type Node,
  type NodeSpec,
  newId,
  placePorts,
  type ResolvedEdge,
  type ResolvedPort,
  rebalanceSubgraphs,
  resolvePosition,
  routeEdges,
  type Subgraph,
  type Theme,
} from '@shumoku/core'
import { SvelteMap } from 'svelte/reactivity'
import { analyzePoE } from './poe-analysis'
import { sampleProject } from './sample-project'
import type { BomItem, NetedProject, SpecPaletteEntry } from './types'
import { paletteEntryLabel } from './types'

// =========================================================================
// Editor UI state — mode, theme
// =========================================================================

let mode = $state<'edit' | 'view'>('view')
let isDark = $state(false)

export const editorState = {
  get mode() {
    return mode
  },
  set mode(v: 'edit' | 'view') {
    mode = v
  },
  get isDark() {
    return isDark
  },
  set isDark(v: boolean) {
    isDark = v
  },
  get theme(): Theme {
    return isDark ? darkTheme : lightTheme
  },
  get interactive() {
    return mode === 'edit'
  },
  toggleMode() {
    mode = mode === 'edit' ? 'view' : 'edit'
  },
  toggleTheme() {
    isDark = !isDark
    if (typeof document !== 'undefined') {
      document.documentElement.classList.toggle('dark', isDark)
      localStorage.setItem('theme', isDark ? 'dark' : 'light')
    }
  },
}

/** Call once in root layout to sync dark mode from DOM */
export function initDarkMode() {
  if (typeof document === 'undefined') return
  isDark = document.documentElement.classList.contains('dark')
  const obs = new MutationObserver(() => {
    isDark = document.documentElement.classList.contains('dark')
  })
  obs.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class'],
  })
  return () => obs.disconnect()
}

// =========================================================================
// Diagram state — shared across pages
// =========================================================================

// The diagram object — single source of truth for the renderer's JSON.
// The four Map slots are SvelteMap instances so that `.set()`/`.delete()`
// mutations trigger reactivity directly, without the copy-on-write
// (`const n = new Map(...); ...; diagram.nodes = n`) dance that Svelte 4
// required.
const diagram = $state({
  nodes: new SvelteMap<string, Node>(),
  ports: new SvelteMap<string, ResolvedPort>(),
  edges: new SvelteMap<string, ResolvedEdge>(),
  subgraphs: new SvelteMap<string, Subgraph>(),
  bounds: { x: 0, y: 0, width: 0, height: 0 },
  links: [] as Link[],
})

/**
 * Replace the contents of a SvelteMap in place, preserving its identity
 * so bindings and downstream reactivity stay attached. Used whenever we
 * would otherwise reassign `diagram.nodes = new Map(...)`.
 */
function replaceMap<K, V>(target: Map<K, V>, source: Iterable<[K, V]>) {
  target.clear()
  for (const [k, v] of source) target.set(k, v)
}

let palette = $state<SpecPaletteEntry[]>([])
let bomItems = $state<BomItem[]>([])
let status = $state('Loading...')
let yamlSource = $state('')
let initialized = $state(false)

/**
 * Active sheet for hierarchical / multi-sheet editing.
 *
 * `null` = the root sheet (the whole diagram, as today).
 * Any non-null id = a top-level subgraph being viewed "as its own sheet".
 *
 * Layer 1 behaviour: switching to a non-null sheet drills into that
 * subgraph KiCad-style. The renderer binds to `sheetView` (a cached
 * `ResolvedLayout` built via `buildHierarchicalSheets` from core)
 * instead of the root maps. Cross-boundary links are represented as
 * stadium-shaped "export connector" nodes on the sheet edge.
 *
 * The sub-sheet view is **read-only** for now — the editor forces
 * View mode while drilled in, because the renderer's `$bindable`
 * writes would land on the sheet's ephemeral maps rather than on the
 * root canonical state. Write-through is deferred (Layer 2).
 */
let currentSheetId = $state<string | null>(null)

/**
 * Runtime state used by the renderer when drilled into a sub-sheet.
 * Structurally mirrors `diagram` so the renderer can bind the same
 * way. Populated by `switchSheet` via `buildHierarchicalSheets`.
 *
 * SvelteMap identity is preserved across switches: we `replaceMap()`
 * into these containers rather than assigning new instances, so
 * reactive bindings in the renderer stay attached.
 */
const sheetView = $state({
  nodes: new SvelteMap<string, Node>(),
  ports: new SvelteMap<string, ResolvedPort>(),
  edges: new SvelteMap<string, ResolvedEdge>(),
  subgraphs: new SvelteMap<string, Subgraph>(),
  bounds: { x: 0, y: 0, width: 400, height: 300 },
  links: [] as Link[],
})

// Edge routing: generation counter prevents stale async results
let routeGeneration = 0

/** Recompute edges from current nodes/ports/links (async WASM) */
async function rerouteEdges() {
  const gen = ++routeGeneration
  const result = await routeEdges(diagram.nodes, diagram.ports, diagram.links)
  if (gen === routeGeneration) {
    replaceMap(diagram.edges, result)
  }
}

const catalog = new Catalog()
catalog.registerAll(builtinEntries)

// Reactive: recompute whenever nodes or links change. Avoids stale budget
// display when users add/remove nodes, rebind specs, or edit links.
const poeBudgets = $derived(analyzePoE([...diagram.nodes.values()], diagram.links, catalog))

/** Update spec on multiple nodes at once (Palette → Node propagation) */
function setNodeSpecs(nodeIds: string[], spec: NodeSpec | undefined) {
  for (const id of new Set(nodeIds)) {
    const rn = diagram.nodes.get(id)
    if (rn) diagram.nodes.set(id, { ...rn, spec })
  }
}

/** Strip product details from spec, keep kind/type (role) */
function stripProductFromSpec(spec: NodeSpec | undefined): NodeSpec | undefined {
  if (!spec) return undefined
  if (spec.kind === 'hardware') return { kind: 'hardware', type: spec.type }
  if (spec.kind === 'compute') return { kind: 'compute', type: spec.type }
  if (spec.kind === 'service') return { kind: 'service', service: spec.service }
  return undefined
}

/**
 * Drop malformed entries from an imported graph so the app never renders
 * orphan references. Fixes are best-effort with a console warning per
 * category — we favor loading *something* over rejecting the whole file.
 */
function sanitizeGraph(graph: NetworkGraph): {
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

  // Strip parent pointers that reference a missing subgraph
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

  // Drop links whose endpoints reference missing nodes
  const validLinks: Link[] = []
  let droppedLinks = 0
  for (const link of graph.links ?? []) {
    const from = getNodeId(link.from)
    const to = getNodeId(link.to)
    if (nodes.has(from) && nodes.has(to)) {
      validLinks.push(link)
    } else {
      droppedLinks++
    }
  }
  if (droppedLinks > 0) {
    console.warn(`[import] dropped ${droppedLinks} link(s) with unknown endpoints`)
  }

  return { nodes, subgraphs, links: validLinks }
}

/**
 * Reconcile palette/bom against the (already-sanitized) set of node IDs.
 * BOM items whose palette is gone are dropped; items whose node is gone
 * are unbound but kept, so the user sees an "unplaced" entry rather than
 * silently losing a purchased device.
 */
function sanitizePaletteAndBom(
  rawPalette: SpecPaletteEntry[],
  rawBom: BomItem[],
  nodes: Map<string, Node>,
): { palette: SpecPaletteEntry[]; bom: BomItem[] } {
  const paletteIds = new Set<string>()
  const cleanPalette: SpecPaletteEntry[] = []
  let duplicatePalette = 0
  for (const entry of rawPalette) {
    if (paletteIds.has(entry.id)) {
      duplicatePalette++
      continue
    }
    paletteIds.add(entry.id)
    cleanPalette.push(entry)
  }
  if (duplicatePalette > 0) {
    console.warn(`[import] dropped ${duplicatePalette} duplicate palette id(s)`)
  }

  const cleanBom: BomItem[] = []
  let droppedBom = 0
  let unboundBom = 0
  const bomIds = new Set<string>()
  for (const item of rawBom) {
    if (bomIds.has(item.id)) {
      droppedBom++
      continue
    }
    if (item.paletteId && !paletteIds.has(item.paletteId)) {
      droppedBom++
      continue
    }
    bomIds.add(item.id)
    if (item.nodeId && !nodes.has(item.nodeId)) {
      cleanBom.push({ ...item, nodeId: undefined })
      unboundBom++
    } else {
      cleanBom.push(item)
    }
  }
  if (droppedBom > 0) {
    console.warn(`[import] dropped ${droppedBom} orphan/duplicate bom item(s)`)
  }
  if (unboundBom > 0) {
    console.warn(`[import] unbound ${unboundBom} bom item(s) whose node was missing`)
  }

  return { palette: cleanPalette, bom: cleanBom }
}

export const diagramState = {
  // Diagram — individual accessors for $bindable compat.
  // Setters defensively fold plain-Map assignments back into our existing
  // SvelteMap so an accidental `bind:` write-back can't silently downgrade
  // the reactive identity.
  get nodes() {
    return diagram.nodes
  },
  set nodes(v: Map<string, Node>) {
    if (v === diagram.nodes) return
    if (v instanceof SvelteMap) diagram.nodes = v
    else replaceMap(diagram.nodes, v)
  },
  get ports() {
    return diagram.ports
  },
  set ports(v: Map<string, ResolvedPort>) {
    if (v === diagram.ports) return
    if (v instanceof SvelteMap) diagram.ports = v
    else replaceMap(diagram.ports, v)
  },
  get edges() {
    return diagram.edges
  },
  set edges(v: Map<string, ResolvedEdge>) {
    if (v === diagram.edges) return
    if (v instanceof SvelteMap) diagram.edges = v
    else replaceMap(diagram.edges, v)
  },
  get subgraphs() {
    return diagram.subgraphs
  },
  set subgraphs(v: Map<string, Subgraph>) {
    if (v === diagram.subgraphs) return
    if (v instanceof SvelteMap) diagram.subgraphs = v
    else replaceMap(diagram.subgraphs, v)
  },
  get bounds() {
    return diagram.bounds
  },
  set bounds(v: { x: number; y: number; width: number; height: number }) {
    diagram.bounds = v
  },
  get links() {
    return diagram.links
  },
  set links(v: Link[]) {
    diagram.links = v
  },
  addLink(link: Link) {
    diagram.links = [...diagram.links, link]
    rerouteEdges()
  },
  updateLink(id: string, updates: Partial<Link>) {
    diagram.links = diagram.links.map((l) => (l.id === id ? { ...l, ...updates } : l))
    rerouteEdges()
  },
  removeLink(id: string) {
    diagram.links = diagram.links.filter((l) => l.id !== id)
    rerouteEdges()
  },
  updateNode(id: string, updates: Partial<Node>) {
    const rn = diagram.nodes.get(id)
    if (!rn) return
    diagram.nodes.set(id, { ...rn, ...updates })
  },
  updateSubgraph(id: string, updates: Partial<Subgraph>) {
    const sg = diagram.subgraphs.get(id)
    if (!sg) return
    diagram.subgraphs.set(id, { ...sg, ...updates })
  },
  /**
   * Re-parent a node. When moving INTO a group, the node is recentered on
   * the target subgraph so it's visible inside the new container. When
   * removing from a group (groupId = undefined), the current position is
   * preserved.
   *
   * Delegates position/port/edge recomputation to core's moveNode so ports
   * stick to the node and edges re-route through libavoid — the same path
   * used by interactive drag. A plain parent+position update on the node
   * record alone leaves ports at their stale absolute positions and leaves
   * edges routed to the old location.
   */
  async moveNodeToGroup(nodeId: string, groupId: string | undefined) {
    const node = diagram.nodes.get(nodeId)
    if (!node?.position) return
    if (node.parent === groupId) return

    // Set parent first so moveNode's obstacle filter excludes the new parent
    diagram.nodes.set(nodeId, { ...node, parent: groupId })

    if (groupId) {
      const sg = diagram.subgraphs.get(groupId)
      if (sg?.bounds) {
        const targetX = sg.bounds.x + sg.bounds.width / 2
        const targetY = sg.bounds.y + sg.bounds.height / 2
        const result = await moveNode(
          nodeId,
          targetX,
          targetY,
          { nodes: diagram.nodes, ports: diagram.ports, subgraphs: diagram.subgraphs },
          diagram.links,
        )
        if (result) {
          replaceMap(diagram.nodes, result.nodes)
          replaceMap(diagram.ports, result.ports)
          replaceMap(diagram.edges, result.edges)
          if (result.subgraphs) replaceMap(diagram.subgraphs, result.subgraphs)
          return
        }
      }
    }

    // No-op position delta (or removing from a group): parent changed but
    // node didn't move — still rebalance subgraph bounds and re-route edges.
    rebalanceSubgraphs(diagram.nodes, diagram.subgraphs, diagram.ports)
    await rerouteEdges()
  },
  get poeBudgets() {
    return poeBudgets
  },
  get catalog() {
    return catalog
  },
  get status() {
    return status
  },
  get yamlSource() {
    return yamlSource
  },
  set yamlSource(v: string) {
    yamlSource = v
  },
  get initialized() {
    return initialized
  },
  get stats() {
    return {
      nodes: diagram.nodes.size,
      links: diagram.links.length,
      subgraphs: diagram.subgraphs.size,
    }
  },

  // =====================================================================
  // Sheets — hierarchical / multi-sheet editing state
  //
  // Layer 0 of the sheet feature: we track which sheet is active and
  // expose the list of available sheets. Filtering the renderer based
  // on the active sheet is a separate follow-up (see ARCHITECTURE.md
  // "Known gaps / hierarchical sheets").
  // =====================================================================

  /**
   * Current active sheet id. `null` means the root sheet (full
   * diagram). A non-null value is the id of a top-level subgraph
   * being viewed as its own sheet.
   */
  get currentSheetId() {
    return currentSheetId
  },

  /**
   * Available sheets, derived from the current diagram.
   *
   * The root sheet always exists; it's joined by one entry per
   * top-level subgraph (those whose `parent` is undefined). Deeper
   * subgraphs aren't promoted to tabs here — they're accessible by
   * drilling further once Layer 1 filtering lands.
   */
  get availableSheets(): Array<{ id: string | null; label: string }> {
    const sheets: Array<{ id: string | null; label: string }> = [{ id: null, label: 'Root' }]
    for (const sg of diagram.subgraphs.values()) {
      if (sg.parent) continue
      sheets.push({ id: sg.id, label: sg.label ?? sg.id })
    }
    return sheets
  },

  /**
   * Switch to a different sheet. `null` switches back to the root.
   *
   * Non-null switch drills KiCad-style: runs the root graph through
   * `buildHierarchicalSheets` to get the subgraph's filtered graph
   * (with export connectors for cross-boundary links), lays it out,
   * and populates `sheetView` so the renderer can bind to it.
   *
   * Read-only: edits while drilled in land on `sheetView` maps, not
   * the root. Switching back to root discards those edits (Layer 2
   * will add write-through). `currentSheetId` changes synchronously
   * so UI highlighting is instantaneous; the heavy layout call runs
   * asynchronously and updates `sheetView` when it completes.
   */
  async switchSheet(id: string | null) {
    if (id !== null && !diagram.subgraphs.has(id)) {
      // Silently fall back to root rather than entering a ghost sheet.
      currentSheetId = null
      return
    }
    currentSheetId = id

    if (id === null) {
      // Back to root: no async work, clear the sheet view so any next
      // drill-down starts from a clean slate.
      sheetView.nodes.clear()
      sheetView.ports.clear()
      sheetView.edges.clear()
      sheetView.subgraphs.clear()
      sheetView.links = []
      return
    }

    // Build the sub-sheet graph + layout via core's hierarchical helper.
    const rootGraph = diagramState.exportGraph()
    const engine = createNetworkLayoutEngine()
    const rootLayout = await engine.layoutAsync(rootGraph)
    const sheets = await buildHierarchicalSheets(rootGraph, rootLayout, engine)
    const sheet = sheets.get(id)
    if (!sheet?.resolved) {
      // Guard: `buildHierarchicalSheets` should have produced the sheet,
      // but if anything went sideways (e.g. empty subgraph), bounce back
      // to root instead of leaving a half-populated view.
      currentSheetId = null
      return
    }

    // Skip stale result if the user has switched again while we were
    // building (e.g. clicked through tabs quickly).
    if (currentSheetId !== id) return

    replaceMap(sheetView.nodes, sheet.resolved.nodes)
    replaceMap(sheetView.ports, sheet.resolved.ports)
    replaceMap(sheetView.edges, sheet.resolved.edges)
    replaceMap(sheetView.subgraphs, sheet.resolved.subgraphs)
    sheetView.bounds = { ...sheet.resolved.bounds }
    sheetView.links = [...sheet.graph.links]
  },

  /**
   * Current visible diagram — either the root state or the cached
   * sub-sheet view. The renderer binds to this via `+page.svelte`.
   */
  get activeView() {
    if (currentSheetId === null) return diagram
    return sheetView
  },

  // Palette
  get palette() {
    return palette
  },
  addToPalette(entry: SpecPaletteEntry) {
    palette = [...palette, entry]
  },
  removeFromPalette(id: string) {
    // Strip product details but keep role (kind/type) on bound nodes
    const entry = palette.find((e) => e.id === id)
    const boundNodeIds = bomItems
      .filter((i) => i.paletteId === id && i.nodeId)
      .map((i) => i.nodeId as string)
    if (boundNodeIds.length > 0) {
      const roleSpec = stripProductFromSpec(entry?.spec)
      setNodeSpecs(boundNodeIds, roleSpec)
    }
    palette = palette.filter((e) => e.id !== id)
    bomItems = bomItems.filter((i) => i.paletteId !== id)
  },
  updatePaletteEntry(id: string, updates: Partial<SpecPaletteEntry>) {
    palette = palette.map((e) => (e.id === id ? { ...e, ...updates } : e))
    // Propagate spec change to all bound nodes (Figma-style)
    if (updates.spec) {
      const entry = palette.find((e) => e.id === id)
      if (entry) {
        const boundNodeIds = bomItems
          .filter((i) => i.paletteId === id && i.nodeId)
          .map((i) => i.nodeId as string)
        if (boundNodeIds.length > 0) setNodeSpecs(boundNodeIds, entry.spec)
      }
    }
  },

  // BOM items (device instances — master for qty management)
  get bomItems() {
    return bomItems
  },
  addBomItem(item: BomItem) {
    bomItems = [...bomItems, item]
  },
  removeBomItem(id: string) {
    const item = bomItems.find((i) => i.id === id)
    if (item?.nodeId) {
      // Remove diagram node + its ports + connected links
      const nodeId = item.nodeId
      diagram.nodes.delete(nodeId)
      for (const [portId, port] of diagram.ports) {
        if (port.nodeId === nodeId) diagram.ports.delete(portId)
      }
      diagram.links = diagram.links.filter((l) => {
        const from = typeof l.from === 'string' ? l.from : l.from.node
        const to = typeof l.to === 'string' ? l.to : l.to.node
        return from !== nodeId && to !== nodeId
      })
      rerouteEdges()
    }
    bomItems = bomItems.filter((i) => i.id !== id)
  },
  updateBomItem(id: string, updates: Partial<BomItem>) {
    bomItems = bomItems.map((i) => (i.id === id ? { ...i, ...updates } : i))
  },
  /** Bind a diagram node to a BOM item */
  bindNodeToBom(bomId: string, nodeId: string | undefined) {
    // Unbind from any other BOM item first
    if (nodeId) {
      bomItems = bomItems.map((i) => (i.nodeId === nodeId ? { ...i, nodeId: undefined } : i))
    }
    bomItems = bomItems.map((i) => (i.id === bomId ? { ...i, nodeId } : i))
    // Propagate palette spec to node
    if (nodeId) {
      const bom = bomItems.find((i) => i.id === bomId)
      const entry = bom ? palette.find((e) => e.id === bom.paletteId) : undefined
      setNodeSpecs([nodeId], entry?.spec)
    }
  },
  /** Get BOM items for a palette entry */
  getBomItemsForPalette(paletteId: string): BomItem[] {
    return bomItems.filter((i) => i.paletteId === paletteId)
  },
  /** Get palette ID for a node (via BOM) */
  getPaletteIdForNode(nodeId: string): string | undefined {
    return bomItems.find((i) => i.nodeId === nodeId)?.paletteId
  },
  /** Get all node IDs bound to a palette entry (via BOM) */
  getNodesForPalette(paletteId: string): string[] {
    return bomItems
      .filter((i) => i.paletteId === paletteId && i.nodeId)
      .map((i) => i.nodeId as string)
  },
  /** Unbind node(s) from BOM — sets nodeId to undefined, keeps the BomItem */
  unbindNodes(nodeIds: string[]) {
    const ids = new Set(nodeIds)
    // Strip product details but keep role (kind/type)
    for (const nodeId of ids) {
      const rn = diagram.nodes.get(nodeId)
      if (rn) {
        diagram.nodes.set(nodeId, { ...rn, spec: stripProductFromSpec(rn.spec) })
      }
    }
    bomItems = bomItems.map((i) =>
      i.nodeId && ids.has(i.nodeId) ? { ...i, nodeId: undefined } : i,
    )
  },
  /** Remove BomItems for deleted diagram nodes */
  removeNodeBomItems(nodeIds: string[]) {
    const ids = new Set(nodeIds)
    bomItems = bomItems.filter((i) => !i.nodeId || !ids.has(i.nodeId))
  },
  /** High-level: bind a diagram node to a palette entry (finds/creates BomItem + propagates spec) */
  bindNodeToPalette(nodeId: string, paletteId: string) {
    const existing = bomItems.find((i) => i.nodeId === nodeId)
    if (existing) {
      // Already bound — re-bind to different palette
      diagramState.updateBomItem(existing.id, { paletteId })
      const entry = palette.find((e) => e.id === paletteId)
      if (entry) setNodeSpecs([nodeId], entry.spec)
    } else {
      // Find unplaced BOM item for this palette entry, or create new
      const unplaced = bomItems.find((i) => i.paletteId === paletteId && !i.nodeId)
      if (unplaced) {
        diagramState.bindNodeToBom(unplaced.id, nodeId)
      } else {
        const id = newId('bom')
        diagramState.addBomItem({ id, paletteId, nodeId })
        const entry = palette.find((e) => e.id === paletteId)
        if (entry) setNodeSpecs([nodeId], entry.spec)
      }
    }
  },
  /** Create a diagram node for an unplaced BomItem and bind it */
  placeNodeForBom(bomId: string): string | undefined {
    const bom = bomItems.find((i) => i.id === bomId)
    if (!bom || bom.nodeId) return undefined
    const entry = palette.find((e) => e.id === bom.paletteId)
    if (!entry) return undefined

    const id = newId('node')
    const label = paletteEntryLabel(entry)
    const spec = entry.spec
    const { width: w, height: h } = computeNodeSize({ label, spec })
    const obstacles = collectObstacles(id, undefined, diagram.nodes, diagram.subgraphs)
    const pos = resolvePosition(
      {
        x: diagram.bounds.x + diagram.bounds.width + 40 + w / 2,
        y: diagram.bounds.y + diagram.bounds.height / 2,
        w,
        h,
      },
      obstacles,
    )

    diagram.nodes.set(id, { id, label, spec, shape: 'rounded', position: pos })
    // Bind BomItem to the new node
    bomItems = bomItems.map((i) => (i.id === bomId ? { ...i, nodeId: id } : i))
    return id
  },

  // NetworkGraph — canonical save/load format
  exportGraph(): NetworkGraph {
    return {
      version: '1',
      nodes: [...diagram.nodes.values()],
      links: [...diagram.links],
      subgraphs: [...diagram.subgraphs.values()],
    }
  },
  /**
   * Re-run the layout engine across the whole diagram, discarding every
   * manual position. Intended for a user-invoked "Auto-arrange" command
   * after manual edits have left the graph visually messy.
   *
   * Stripping positions (not pinning) means the result matches what a
   * fresh YAML import would produce; palette and BOM are untouched.
   */
  async autoArrange() {
    const graph: NetworkGraph = {
      ...diagramState.exportGraph(),
      nodes: [...diagram.nodes.values()].map((n) => ({ ...n, position: undefined })),
      subgraphs: [...diagram.subgraphs.values()].map((s) => ({ ...s, bounds: undefined })),
    }
    const { resolved } = await computeNetworkLayout(graph)
    replaceMap(diagram.nodes, resolved.nodes)
    replaceMap(diagram.subgraphs, resolved.subgraphs)
    replaceMap(diagram.ports, resolved.ports)
    replaceMap(diagram.edges, resolved.edges)
    diagram.bounds = { ...resolved.bounds }
  },
  // Serialization — .neted.json format
  /** Export project as NetedProject JSON string */
  exportProject(name = 'Untitled'): string {
    const project: NetedProject = {
      version: 1,
      name,
      palette: [...palette],
      bom: [...bomItems],
      diagram: diagramState.exportGraph(),
    }
    return JSON.stringify(project, null, 2)
  },

  // =====================================================================
  // Linear load pipeline:   applyYaml → importProject → loadProject
  //
  // Each step converts its input one level up and forwards to the next.
  // loadProject is the terminal: it owns state reset, `initialized`, and
  // status. Everything above is a thin adapter.
  // =====================================================================

  /** YAML text → NetedProject (current palette/bom preserved) → importProject. */
  async applyYaml(yamlStr: string) {
    try {
      status = 'Parsing YAML...'
      const fileMap = new Map<string, string>()
      fileMap.set('main.yaml', yamlStr)
      fileMap.set('./main.yaml', yamlStr)
      fileMap.set('/main.yaml', yamlStr)
      const resolver = createMemoryFileResolver(fileMap, '/')
      const hp = new HierarchicalParser(resolver)
      const diagram = (await hp.parse(yamlStr, '/main.yaml')).graph
      await diagramState.importProject({
        version: 1,
        name: 'YAML Import',
        palette: [...palette],
        bom: [...bomItems],
        diagram,
      })
      yamlSource = yamlStr
    } catch (e) {
      status = `Error: ${e instanceof Error ? e.message : String(e)}`
    }
  },

  /** JSON string or parsed NetedProject → loadProject('imported', data). */
  async importProject(input: string | NetedProject) {
    const data = typeof input === 'string' ? JSON.parse(input) : input
    await diagramState.loadProject('imported', data)
  },

  /**
   * Terminal: reset state, apply project data, set status.
   *
   * - `projectId`: 'sample' / 'imported' / 'empty' / other (= empty)
   * - `data`: optional — when provided (e.g. via importProject) it's used
   *   directly instead of the built-in lookup.
   */
  async loadProject(projectId: string, data?: Partial<NetedProject>) {
    // When importProject routed us to /project/imported/diagram it has
    // already populated state; the follow-up route-triggered loadProject
    // with no data would otherwise wipe what was just imported.
    if (projectId === 'imported' && initialized && !data) return

    // Reset all state unconditionally — every path through the terminal
    // gets a clean slate before apply.
    palette = []
    bomItems = []
    diagram.nodes.clear()
    diagram.ports.clear()
    diagram.edges.clear()
    diagram.subgraphs.clear()
    diagram.bounds = { x: 0, y: 0, width: 800, height: 600 }
    diagram.links = []
    yamlSource = ''
    currentSheetId = null
    initialized = false

    try {
      const project = data ?? (projectId === 'sample' ? sampleProject : null)
      if (project) {
        status =
          projectId === 'sample'
            ? 'Loading sample...'
            : projectId === 'imported'
              ? 'Loading project...'
              : 'Loading...'
        await applyProject(project)
      }
      status = 'Ready'
      initialized = true
    } catch (e) {
      status = `Error: ${e instanceof Error ? e.message : String(e)}`
    }
  },
}

/**
 * Apply a NetedProject (diagram + palette + bom) to runtime state.
 * Assumes state has already been reset by the caller (loadProject).
 *
 * Private to this module — the pipeline entry points (applyYaml,
 * importProject, loadProject) are the only public way to populate state.
 */
async function applyProject(data: Partial<NetedProject>) {
  await applyGraph(data.diagram ?? { version: '1', nodes: [], links: [] })
  const { palette: cleanPalette, bom: cleanBom } = sanitizePaletteAndBom(
    data.palette ?? [],
    data.bom ?? [],
    diagram.nodes,
  )
  palette = cleanPalette
  bomItems = cleanBom
}

/**
 * Populate runtime state from a NetworkGraph. Handles both positioned
 * inputs (saved JSON/sample) and unpositioned ones (parsed YAML): the
 * former derives ports/edges from the saved positions; the latter falls
 * back to the full layoutNetwork pass.
 */
async function applyGraph(graph: NetworkGraph) {
  const { nodes, subgraphs, links } = sanitizeGraph(graph)
  const direction = graph.settings?.direction ?? 'TB'
  const hasAnyNode = nodes.size > 0
  const allPositioned = hasAnyNode && [...nodes.values()].every((n) => n.position)

  if (hasAnyNode && !allPositioned) {
    const reconstructed: NetworkGraph = {
      ...graph,
      nodes: [...nodes.values()],
      subgraphs: [...subgraphs.values()],
      links,
    }
    const { resolved } = await computeNetworkLayout(reconstructed)
    replaceMap(diagram.nodes, resolved.nodes)
    replaceMap(diagram.subgraphs, resolved.subgraphs)
    replaceMap(diagram.ports, resolved.ports)
    replaceMap(diagram.edges, resolved.edges)
    diagram.bounds = { ...resolved.bounds }
    diagram.links = links
    return
  }

  replaceMap(diagram.nodes, nodes)
  replaceMap(diagram.subgraphs, subgraphs)
  diagram.links = links
  replaceMap(diagram.ports, placePorts(nodes, links, direction))
  await rerouteEdges()
}

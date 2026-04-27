import { builtinEntries, Catalog, expandCatalogPorts } from '@shumoku/catalog'
import {
  buildChildSheetGraph,
  collectObstacles,
  computeNetworkLayout,
  computeNodeSize,
  createMemoryFileResolver,
  darkTheme,
  getNodeId,
  HierarchicalParser,
  type Link,
  type LinkEndpoint,
  lightTheme,
  moveNode,
  type NetworkGraph,
  type Node,
  type NodePort,
  type NodeSpec,
  newId,
  placePorts,
  type ResolvedEdge,
  type ResolvedLayout,
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
 * way. Populated by `switchSheet` via `buildChildSheetGraph` +
 * `computeNetworkLayout`.
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

/**
 * Per-sheet layout cache. Entries are invalidated any time the root
 * graph's structure changes (nodes/subgraphs/links added/removed,
 * parents reparented). Purely-visual root edits (position, label,
 * spec, link bandwidth, …) don't affect child-sheet content, so
 * we're careful to only clear on structural changes — bouncing
 * between tabs stays instant in the common case.
 *
 * The `generation` counter lets an in-flight `switchSheet` abandon
 * a stale layout result when the graph has changed underneath it.
 */
const sheetCache = new Map<string, ResolvedLayout>()
const sheetLinkCache = new Map<string, Link[]>()
let sheetCacheGeneration = 0

function invalidateSheetCache() {
  sheetCache.clear()
  sheetLinkCache.clear()
  sheetCacheGeneration++
}

/**
 * Assign a `ResolvedLayout` into the given mirror state, preserving
 * SvelteMap identity (so the renderer's bindings stay attached).
 * Shared by both sheet load and sheet cache hits.
 */
function applyResolvedLayout(
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

function replaceDerivedPorts() {
  replaceMap(diagram.ports, placePorts(diagram.nodes, diagram.links))
}

async function rebuildPortsAndEdges() {
  replaceDerivedPorts()
  await rerouteEdges()
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

function nodePortsFromPaletteEntry(entry: SpecPaletteEntry | undefined): NodePort[] | undefined {
  if (!entry) return undefined
  const catalogEntry = entry.catalogId ? catalog.lookup(entry.catalogId) : undefined
  const ports = expandCatalogPorts(
    catalogEntry ?? {
      id: entry.id,
      label: paletteEntryLabel(entry),
      spec: entry.spec,
      tags: [],
      properties: entry.properties ?? {},
    },
  )
  return ports.length > 0
    ? ports.map((port) => ({
        id: newId('port'),
        ...port,
      }))
    : undefined
}

function setNodePortsFromPalette(
  nodeId: string,
  entry: SpecPaletteEntry | undefined,
  options: { preserveExisting?: boolean; reroute?: boolean } = {},
) {
  const node = diagram.nodes.get(nodeId)
  if (!node) return
  if (options.preserveExisting && node.ports) return
  const ports = nodePortsFromPaletteEntry(entry)
  diagram.nodes.set(nodeId, { ...node, ports })
  const migrated = migrateLinkEndpointPortsForNode(nodeId, ports)
  if (migrated && options.reroute !== false) rebuildPortsAndEdges()
}

function getEndpointNodeId(endpoint: string | LinkEndpoint): string {
  return typeof endpoint === 'string' ? endpoint : endpoint.node
}

function getEndpointPort(endpoint: string | LinkEndpoint): string | undefined {
  return typeof endpoint === 'string' ? undefined : endpoint.port
}

function findNodePortId(
  ports: NodePort[] | undefined,
  value: string | undefined,
): string | undefined {
  if (!ports || !value) return value
  const match = ports.find(
    (port) =>
      port.id === value ||
      port.label === value ||
      port.faceplateLabel === value ||
      port.interfaceName === value ||
      port.aliases?.includes(value),
  )
  return match?.id ?? value
}

function migrateLinkEndpointPortsForNode(nodeId: string, ports: NodePort[] | undefined): boolean {
  if (!ports?.length) return false
  let changed = false
  const links = diagram.links.map((link) => {
    let next = link
    for (const side of ['from', 'to'] as const) {
      const endpoint = next[side]
      if (typeof endpoint === 'string' || endpoint.node !== nodeId || !endpoint.port) continue
      const resolved = findNodePortId(ports, endpoint.port)
      if (resolved !== endpoint.port) {
        next = { ...next, [side]: { ...endpoint, port: resolved } }
        changed = true
      }
    }
    return next
  })
  if (changed) diagram.links = links
  return changed
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
    invalidateSheetCache()
    rebuildPortsAndEdges()
  },
  updateLink(id: string, updates: Partial<Link>) {
    // Endpoints may have moved into / out of a child sheet's scope.
    diagram.links = diagram.links.map((l) => (l.id === id ? { ...l, ...updates } : l))
    invalidateSheetCache()
    rebuildPortsAndEdges()
  },
  removeLink(id: string) {
    diagram.links = diagram.links.filter((l) => l.id !== id)
    invalidateSheetCache()
    rebuildPortsAndEdges()
  },
  updateNode(id: string, updates: Partial<Node>) {
    const rn = diagram.nodes.get(id)
    if (!rn) return
    // Only a `parent` change moves the node between sheets; purely-
    // visual updates (label, spec, position, style) leave sheet
    // membership untouched so we skip the cache invalidation there.
    if ('parent' in updates && updates.parent !== rn.parent) invalidateSheetCache()
    diagram.nodes.set(id, { ...rn, ...updates })
  },
  updateSubgraph(id: string, updates: Partial<Subgraph>) {
    const sg = diagram.subgraphs.get(id)
    if (!sg) return
    if ('parent' in updates && updates.parent !== sg.parent) invalidateSheetCache()
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

    // Parent change → sheet membership change → invalidate caches.
    invalidateSheetCache()
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
  getNodePorts(nodeId: string): NodePort[] {
    return diagram.nodes.get(nodeId)?.ports ?? []
  },
  getPortUsage(nodeId: string): Map<string, string[]> {
    const usage = new Map<string, string[]>()
    for (const [i, link] of diagram.links.entries()) {
      const linkId = link.id ?? `link-${i}`
      const fromNode = getEndpointNodeId(link.from)
      const toNode = getEndpointNodeId(link.to)
      const fromPort = getEndpointPort(link.from)
      const toPort = getEndpointPort(link.to)
      if (fromNode === nodeId && fromPort) {
        const links = usage.get(fromPort) ?? []
        links.push(linkId)
        usage.set(fromPort, links)
      }
      if (toNode === nodeId && toPort) {
        const links = usage.get(toPort) ?? []
        links.push(linkId)
        usage.set(toPort, links)
      }
    }
    return usage
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
   * Non-null switches drill KiCad-style: the subgraph's filtered
   * graph (with export connectors for cross-boundary links) is fed
   * into `computeNetworkLayout` and the result is mirrored into
   * `sheetView` so the renderer can bind to it. Layouts are cached
   * per sheet-id and reused until a structural root-graph change
   * invalidates them — rapid back-and-forth between tabs stays
   * instant.
   *
   * Read-only: edits while drilled in land on `sheetView`, not on
   * the root canonical state. Switching back to root discards any
   * such edits (Layer 2 will add write-through). `currentSheetId`
   * changes synchronously so UI highlighting is instantaneous; the
   * layout call runs asynchronously and updates `sheetView` when
   * it completes.
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

    // Cache hit: apply the stored layout and we're done.
    const cached = sheetCache.get(id)
    if (cached) {
      applyResolvedLayout(sheetView, cached, sheetView.links)
      // Cache hit still needs the links array — stored separately so
      // the renderer has the connections list for its port routing.
      const cachedLinks = sheetLinkCache.get(id)
      if (cachedLinks) sheetView.links = [...cachedLinks]
      return
    }

    // Cache miss: build the filtered sub-graph and lay it out. We
    // sanitize the root graph first so the sub-sheet inherits the
    // same orphan-safe invariants `applyGraph` enforces.
    const generation = sheetCacheGeneration
    const rootGraph = diagramState.exportGraph()
    const { nodes: sanNodes, subgraphs: sanSubgraphs, links: sanLinks } = sanitizeGraph(rootGraph)
    const sanitized: NetworkGraph = {
      ...rootGraph,
      nodes: [...sanNodes.values()],
      subgraphs: [...sanSubgraphs.values()],
      links: sanLinks,
    }
    const childGraph = buildChildSheetGraph(sanitized, id)
    if (!childGraph) {
      // Subgraph disappeared between the tab render and our read —
      // bounce back to root rather than showing an empty sheet.
      currentSheetId = null
      return
    }
    const { resolved } = await computeNetworkLayout(childGraph)

    // Bail if either (a) the user has switched away while we were
    // computing, or (b) the root graph has been mutated underneath us
    // (generation counter bumped) and our result is stale.
    if (currentSheetId !== id || generation !== sheetCacheGeneration) return

    sheetCache.set(id, resolved)
    sheetLinkCache.set(id, childGraph.links)
    applyResolvedLayout(sheetView, resolved, childGraph.links)
  },

  /**
   * Current visible diagram — either the root state or the cached
   * sub-sheet view. The renderer binds to this via `+page.svelte`.
   */
  get activeView() {
    if (currentSheetId === null) return diagram
    return sheetView
  },

  /**
   * Invalidate every cached sub-sheet layout. Exposed for the cases
   * where a structural mutation happens outside `diagramState` (e.g.
   * the renderer adds a node directly via its internal `addNewNode`
   * and emits `onnodeadd`). Methods inside `diagramState` that
   * already mutate root structure call this internally — callers of
   * those don't need to repeat.
   */
  invalidateSheetCache() {
    invalidateSheetCache()
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
      for (const nodeId of boundNodeIds) {
        const node = diagram.nodes.get(nodeId)
        if (node) diagram.nodes.set(nodeId, { ...node, ports: undefined })
      }
    }
    palette = palette.filter((e) => e.id !== id)
    bomItems = bomItems.filter((i) => i.paletteId !== id)
  },
  updatePaletteEntry(id: string, updates: Partial<SpecPaletteEntry>) {
    palette = palette.map((e) => (e.id === id ? { ...e, ...updates } : e))
    // Propagate product changes to all bound nodes (Figma-style)
    if (updates.spec || updates.properties || updates.catalogId) {
      const entry = palette.find((e) => e.id === id)
      if (entry) {
        const boundNodeIds = bomItems
          .filter((i) => i.paletteId === id && i.nodeId)
          .map((i) => i.nodeId as string)
        if (boundNodeIds.length > 0) {
          if (updates.spec) setNodeSpecs(boundNodeIds, entry.spec)
          for (const nodeId of boundNodeIds) setNodePortsFromPalette(nodeId, entry)
        }
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
      // Removing a diagram node is structural — clear any cached
      // sub-sheets before the rerouteEdges call runs.
      invalidateSheetCache()
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
      setNodePortsFromPalette(nodeId, entry)
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
        diagram.nodes.set(nodeId, { ...rn, spec: stripProductFromSpec(rn.spec), ports: undefined })
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
      if (entry) {
        setNodeSpecs([nodeId], entry.spec)
        setNodePortsFromPalette(nodeId, entry)
      }
    } else {
      // Find unplaced BOM item for this palette entry, or create new
      const unplaced = bomItems.find((i) => i.paletteId === paletteId && !i.nodeId)
      if (unplaced) {
        diagramState.bindNodeToBom(unplaced.id, nodeId)
      } else {
        const id = newId('bom')
        diagramState.addBomItem({ id, paletteId, nodeId })
        const entry = palette.find((e) => e.id === paletteId)
        if (entry) {
          setNodeSpecs([nodeId], entry.spec)
          setNodePortsFromPalette(nodeId, entry)
        }
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

    diagram.nodes.set(id, {
      id,
      label,
      spec,
      ports: nodePortsFromPaletteEntry(entry),
      shape: 'rounded',
      position: pos,
    })
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
   * Diagram-only import: accepts a NetworkGraph (parsed or JSON
   * string) and replaces just the diagram while preserving the
   * current palette and BOM. Wraps the input in a synthetic
   * NetedProject and forwards to `importProject`, so the linear
   * pipeline stays uniform regardless of what format came in.
   *
   * Use this when the user drops a standalone diagram JSON
   * (`NetworkGraph`) — the `.neted.json` project container is for
   * full project import which overwrites palette/BOM.
   */
  async importDiagram(input: string | NetworkGraph) {
    const diagram: NetworkGraph = typeof input === 'string' ? JSON.parse(input) : input
    await diagramState.importProject({
      version: 1,
      name: 'Diagram Import',
      palette: [...palette],
      bom: [...bomItems],
      diagram,
    })
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
  for (const item of bomItems) {
    if (!item.nodeId || !item.paletteId) continue
    setNodePortsFromPalette(
      item.nodeId,
      palette.find((entry) => entry.id === item.paletteId),
      { preserveExisting: true, reroute: false },
    )
  }
  replaceMap(
    diagram.ports,
    placePorts(diagram.nodes, diagram.links, data.diagram?.settings?.direction ?? 'TB'),
  )
  await rerouteEdges()
}

/**
 * Populate runtime state from a NetworkGraph. Handles both positioned
 * inputs (saved JSON/sample) and unpositioned ones (parsed YAML): the
 * former derives ports/edges from the saved positions; the latter falls
 * back to the full layoutNetwork pass.
 */
async function applyGraph(graph: NetworkGraph) {
  // Any root structural change invalidates every cached sheet layout.
  // Load replaces the graph wholesale, so this is always the right call.
  invalidateSheetCache()
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
  // Positioned path skips layoutNetwork, so nobody else computes
  // bounds from the saved coordinates. Mirror the same union + 50-pad
  // formula `layoutNetwork` uses internally so the renderer's viewBox
  // matches the actual extent of the loaded diagram. Without this the
  // initial viewBox stays at the `loadProject` reset default
  // (800×600) and large saved diagrams render clipped to the top-left.
  diagram.bounds = boundsOfPositionedGraph(nodes, subgraphs)
  await rerouteEdges()
}

/**
 * Compute a padded bounding box over positioned nodes and subgraphs.
 * Matches the fallback in `layoutNetwork` (50-unit margin around the
 * tight union), and falls back to the same empty-graph placeholder so
 * the runtime `diagram.bounds` shape is consistent whichever path set
 * it.
 */
function boundsOfPositionedGraph(
  nodes: Map<string, Node>,
  subgraphs: Map<string, Subgraph>,
): { x: number; y: number; width: number; height: number } {
  let minX = Number.POSITIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY

  for (const n of nodes.values()) {
    if (!n.position) continue
    const size = computeNodeSize(n)
    minX = Math.min(minX, n.position.x - size.width / 2)
    minY = Math.min(minY, n.position.y - size.height / 2)
    maxX = Math.max(maxX, n.position.x + size.width / 2)
    maxY = Math.max(maxY, n.position.y + size.height / 2)
  }
  for (const sg of subgraphs.values()) {
    if (!sg.bounds) continue
    minX = Math.min(minX, sg.bounds.x)
    minY = Math.min(minY, sg.bounds.y)
    maxX = Math.max(maxX, sg.bounds.x + sg.bounds.width)
    maxY = Math.max(maxY, sg.bounds.y + sg.bounds.height)
  }

  if (minX === Number.POSITIVE_INFINITY) {
    return { x: 0, y: 0, width: 400, height: 300 }
  }
  const pad = 50
  return {
    x: minX - pad,
    y: minY - pad,
    width: maxX - minX + pad * 2,
    height: maxY - minY + pad * 2,
  }
}

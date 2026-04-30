import { builtinEntries, Catalog, expandCatalogPorts } from '@shumoku/catalog'
import {
  buildChildSheetGraph,
  collectObstacles,
  computeNetworkLayout,
  computeNodeSize,
  createMemoryFileResolver,
  darkTheme,
  HierarchicalParser,
  type Link,
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
import type { AssignmentRow, AssignmentTarget, DeviceProduct, NetedProject, Product } from './types'
import { productLabel } from './types'

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

if (typeof window !== 'undefined' && import.meta.env.DEV) {
  // Devtools convenience: poke at editor state from the console.
  // biome-ignore lint/suspicious/noExplicitAny: dev-only window augmentation
  ;(window as any).diagramState = new Proxy(
    {},
    {
      get(_t, prop) {
        // biome-ignore lint/suspicious/noExplicitAny: lazy proxy
        return (diagramState as any)[prop]
      },
    },
  )
  // biome-ignore lint/suspicious/noExplicitAny: dev-only window augmentation
  ;(window as any).editorState = editorState
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

let products = $state<Product[]>([])
let status = $state('Loading...')
let yamlSource = $state('')
let initialized = $state(false)

function deviceProduct(id: string): DeviceProduct | undefined {
  const p = products.find((p) => p.id === id)
  return p?.kind === 'device' ? p : undefined
}

function moduleProductSku(product: Product): string | undefined {
  if (product.kind !== 'module') return undefined
  return product.spec.mpn ?? product.catalogId
}

function nodeDisplayLabel(node: Node): string {
  return Array.isArray(node.label) ? node.label[0] : (node.label ?? node.id)
}

function endpointRequirementKey(link: Link, side: 'from' | 'to'): string | undefined {
  return link[side].plug?.module?.sku ?? link[side].plug?.module?.standard
}

function cableRequirementKey(link: Link): string | undefined {
  const cable = link.cable
  if (!cable) return undefined
  return [cable.category, cable.medium, cable.length_m ? `${cable.length_m}m` : undefined]
    .filter(Boolean)
    .join(' / ')
}

function buildAssignmentRows(): AssignmentRow[] {
  const rows: AssignmentRow[] = []

  for (const [nodeId, node] of diagram.nodes) {
    rows.push({
      id: `node:${nodeId}`,
      target: { kind: 'node', nodeId },
      label: nodeDisplayLabel(node),
      source: 'Diagram node',
      productId: node.productId,
      requirementKey: node.spec
        ? 'model' in node.spec
          ? node.spec.model
          : 'service' in node.spec
            ? node.spec.service
            : node.spec.kind
        : undefined,
      status: node.productId ? 'resolved' : node.spec ? 'generic' : 'incomplete',
    })
  }

  for (const link of diagram.links) {
    if (!link.id) continue
    for (const side of ['from', 'to'] as const) {
      const endpoint = link[side]
      const key = endpointRequirementKey(link, side)
      if (!key) continue
      rows.push({
        id: `module:${link.id}:${side}`,
        target: { kind: 'link-module', linkId: link.id, side },
        label: `${link.id} ${side} module`,
        source: `${endpoint.node}:${endpoint.port}`,
        productId: endpoint.plug?.module?.productId,
        requirementKey: key,
        status: endpoint.plug?.module?.productId ? 'resolved' : 'generic',
      })
    }
    const cableKey = cableRequirementKey(link)
    if (cableKey) {
      rows.push({
        id: `cable:${link.id}`,
        target: { kind: 'link-cable', linkId: link.id },
        label: `${link.id} cable`,
        source: 'Connections cable',
        productId: link.cable?.productId,
        requirementKey: cableKey,
        status: link.cable?.productId ? 'resolved' : 'generic',
      })
    }
  }

  return rows
}

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

function nodePortsFromProduct(product: DeviceProduct | undefined): NodePort[] | undefined {
  if (!product) return undefined
  const catalogEntry = product.catalogId ? catalog.lookup(product.catalogId) : undefined
  const ports = expandCatalogPorts(
    catalogEntry ?? {
      id: product.id,
      label: productLabel(product),
      spec: product.spec,
      tags: [],
      properties: product.properties ?? {},
    },
  )
  return ports.length > 0
    ? ports.map((port) => ({
        id: newId('port'),
        ...port,
      }))
    : undefined
}

function setNodePortsFromProduct(
  nodeId: string,
  product: DeviceProduct | undefined,
  options: { preserveExisting?: boolean; reroute?: boolean } = {},
) {
  const node = diagram.nodes.get(nodeId)
  if (!node) return
  if (options.preserveExisting && node.ports) return
  const ports = nodePortsFromProduct(product)
  diagram.nodes.set(nodeId, { ...node, ports })
  const migrated = migrateLinkEndpointPortsForNode(nodeId, ports)
  if (migrated && options.reroute !== false) rebuildPortsAndEdges()
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

/**
 * Append a port to a node's `ports` array. Returns the new port's ID, or
 * undefined when the target node is missing. This is the single explicit
 * port-creation operation for the editor — link-creation paths must call
 * this themselves before constructing the LinkEndpoint, never afterward.
 */
function appendPortToNode(
  nodes: Map<string, Node>,
  nodeId: string,
  init: Partial<NodePort> = {},
): string | undefined {
  const node = nodes.get(nodeId)
  if (!node) return undefined
  const port: NodePort = {
    id: init.id ?? newId('port'),
    label: init.label ?? '',
    source: init.source ?? 'custom',
    ...init,
  }
  nodes.set(nodeId, { ...node, ports: [...(node.ports ?? []), port] })
  return port.id
}

function migrateLinkEndpointPortsForNode(nodeId: string, ports: NodePort[] | undefined): boolean {
  if (!ports?.length) return false
  let changed = false
  const links = diagram.links.map((link) => {
    let next = link
    for (const side of ['from', 'to'] as const) {
      const endpoint = next[side]
      if (endpoint.node !== nodeId || !endpoint.port) continue
      const resolved = findNodePortId(ports, endpoint.port)
      if (resolved && resolved !== endpoint.port) {
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
    if (nodes.has(link.from.node) && nodes.has(link.to.node)) {
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
 * Reconcile products against the loaded diagram. Diagram-side
 * `productId` references (Node / LinkModule / LinkCable) are cleared
 * when the referenced product is gone.
 */
function sanitizeProducts(
  rawProducts: Product[],
  nodes: Map<string, Node>,
  links: Link[],
): { products: Product[]; links: Link[] } {
  const productIds = new Set<string>()
  const cleanProducts: Product[] = []
  let duplicates = 0
  for (const entry of rawProducts) {
    if (productIds.has(entry.id)) {
      duplicates++
      continue
    }
    productIds.add(entry.id)
    cleanProducts.push(entry)
  }
  if (duplicates > 0) {
    console.warn(`[import] dropped ${duplicates} duplicate product id(s)`)
  }

  // Clear stale productId references on diagram side
  let clearedNodes = 0
  for (const [id, node] of nodes) {
    if (node.productId && !productIds.has(node.productId)) {
      nodes.set(id, { ...node, productId: undefined })
      clearedNodes++
    }
  }
  if (clearedNodes > 0) {
    console.warn(`[import] cleared ${clearedNodes} node(s) with unknown productId`)
  }

  let clearedLinks = 0
  const cleanLinks = links.map((link) => {
    let next = link
    for (const side of ['from', 'to'] as const) {
      const mod = next[side].plug?.module
      if (mod?.productId && !productIds.has(mod.productId)) {
        const { productId: _drop, ...rest } = mod
        next = {
          ...next,
          [side]: { ...next[side], plug: { ...(next[side].plug ?? {}), module: rest } },
        }
        clearedLinks++
      }
    }
    if (next.cable?.productId && !productIds.has(next.cable.productId)) {
      const { productId: _drop, ...rest } = next.cable
      next = { ...next, cable: rest }
      clearedLinks++
    }
    return next
  })
  if (clearedLinks > 0) {
    console.warn(`[import] cleared ${clearedLinks} link product reference(s)`)
  }

  return { products: cleanProducts, links: cleanLinks }
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
  /**
   * Append a port to a node and trigger a port/edge rebuild. Used by
   * forms (and other UI) that need to materialize a port *before*
   * constructing the link endpoint. The `port` field of any LinkEndpoint
   * we append to `links` must already point at an existing port.
   */
  addNodePort(nodeId: string, init: Partial<NodePort> = {}) {
    const portId = appendPortToNode(diagram.nodes, nodeId, init)
    if (portId) rebuildPortsAndEdges()
    return portId
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
  /**
   * Update a port's label and propagate to the resolved-port map. The
   * renderer's `commitLabel` only updates `ResolvedPort`, which is not
   * persisted — `Node.ports[i].label` is the source of truth.
   *
   * `portId` is the resolved-port id (`${nodeId}:${nodePortId}`).
   */
  updatePortLabel(portId: string, label: string) {
    const colon = portId.indexOf(':')
    if (colon < 0) return
    const nodeId = portId.slice(0, colon)
    const portKey = portId.slice(colon + 1)
    const node = diagram.nodes.get(nodeId)
    if (!node?.ports) return
    const idx = node.ports.findIndex((p) => p.id === portKey)
    if (idx < 0) return
    if (node.ports[idx]?.label === label) return
    const next = [...node.ports]
    const target = next[idx]
    if (!target) return
    next[idx] = { ...target, label }
    diagram.nodes.set(nodeId, { ...node, ports: next })
    const resolved = diagram.ports.get(portId)
    if (resolved) diagram.ports.set(portId, { ...resolved, label })
  },
  /**
   * Catalog-defined port names for the node's bound device, e.g.
   * `["Gi1/0/1", "Gi1/0/2", ...]` for a Cisco WS-C3560CX. Surfaced as
   * suggestions when the user renames a port. We don't filter by "already
   * used" — a 24-port switch's full template list is more useful than a
   * filtered subset, and label uniqueness isn't enforced by the model
   * anyway (links reference NodePort.id, not label).
   */
  getPortLabelSuggestions(nodeId: string): string[] {
    const spec = diagram.nodes.get(nodeId)?.spec
    if (spec?.kind !== 'hardware' || !spec.vendor || !spec.model) return []
    const entry = catalog.lookup(`${spec.vendor}/${spec.model}`)
    if (!entry) return []
    return expandCatalogPorts(entry)
      .map((t) => t.label)
      .filter(Boolean)
  },
  getPortUsage(nodeId: string): Map<string, string[]> {
    const usage = new Map<string, string[]>()
    for (const [i, link] of diagram.links.entries()) {
      const linkId = link.id ?? `link-${i}`
      const fromNode = link.from.node
      const toNode = link.to.node
      const fromPort = link.from.port
      const toPort = link.to.port
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

  // Products — project-local material library
  get products() {
    return products
  },
  addProduct(entry: Product) {
    products = [...products, entry]
  },
  removeProduct(id: string) {
    const product = products.find((p) => p.id === id)
    if (!product) return

    // Clear node bindings (devices) and strip product details from spec
    if (product.kind === 'device') {
      const boundNodeIds: string[] = []
      for (const [nodeId, node] of diagram.nodes) {
        if (node.productId === id) boundNodeIds.push(nodeId)
      }
      if (boundNodeIds.length > 0) {
        const roleSpec = stripProductFromSpec(product.spec)
        setNodeSpecs(boundNodeIds, roleSpec)
        for (const nodeId of boundNodeIds) {
          const node = diagram.nodes.get(nodeId)
          if (node) diagram.nodes.set(nodeId, { ...node, productId: undefined, ports: undefined })
        }
      }
    }

    // Clear link-module / link-cable bindings
    if (product.kind === 'module' || product.kind === 'cable') {
      diagram.links = diagram.links.map((link) => {
        let next = link
        if (product.kind === 'module') {
          for (const side of ['from', 'to'] as const) {
            const mod = next[side].plug?.module
            if (mod?.productId === id) {
              const { productId: _drop, sku: _sku, ...rest } = mod
              next = {
                ...next,
                [side]: {
                  ...next[side],
                  plug: { ...(next[side].plug ?? {}), module: rest },
                },
              }
            }
          }
        }
        if (product.kind === 'cable' && next.cable?.productId === id) {
          const { productId: _drop, ...rest } = next.cable
          next = { ...next, cable: rest }
        }
        return next
      })
    }

    products = products.filter((p) => p.id !== id)
  },
  updateProduct(id: string, updates: Partial<Product>) {
    products = products.map((p) => (p.id === id ? ({ ...p, ...updates } as Product) : p))
    // Propagate device-product changes to bound nodes
    const product = products.find((p) => p.id === id)
    if (
      product?.kind === 'device' &&
      (updates.spec || 'properties' in updates || updates.catalogId)
    ) {
      const boundNodeIds: string[] = []
      for (const [nodeId, node] of diagram.nodes) {
        if (node.productId === id) boundNodeIds.push(nodeId)
      }
      if (boundNodeIds.length > 0) {
        if (updates.spec) setNodeSpecs(boundNodeIds, product.spec)
        for (const nodeId of boundNodeIds) setNodePortsFromProduct(nodeId, product)
      }
    }
  },

  /** Count of placed units for a product (across the whole diagram). */
  placedCount(productId: string): number {
    let n = 0
    for (const node of diagram.nodes.values()) {
      if (node.productId === productId) n++
    }
    for (const link of diagram.links) {
      for (const side of ['from', 'to'] as const) {
        if (link[side].plug?.module?.productId === productId) n++
      }
      if (link.cable?.productId === productId) n++
    }
    return n
  },
  /**
   * Effective required quantity for a product. Returns the explicit
   * `requiredQty` when set; otherwise falls back to the placed count
   * (so an unset target is "however many we've drawn").
   */
  requiredCount(productId: string): number {
    const product = products.find((p) => p.id === productId)
    if (product?.requiredQty !== undefined) return product.requiredQty
    return diagramState.placedCount(productId)
  },

  // Assignments — node/module/cable ↔ product binding view
  get assignmentRows(): AssignmentRow[] {
    return buildAssignmentRows()
  },
  bindAssignment(target: AssignmentTarget, productId: string | undefined) {
    if (target.kind === 'node') {
      if (productId) diagramState.bindNodeToProduct(target.nodeId, productId)
      else diagramState.unbindNodes([target.nodeId])
      return
    }

    const link = diagram.links.find((l) => l.id === target.linkId)
    if (!link?.id) return

    if (target.kind === 'link-module') {
      const endpoint = link[target.side]
      const standard = endpoint.plug?.module?.standard
      if (!standard) return
      const product = productId ? products.find((p) => p.id === productId) : undefined
      const nextModule = {
        ...endpoint.plug?.module,
        standard,
        productId,
        sku: product ? moduleProductSku(product) : endpoint.plug?.module?.sku,
      }
      if (!productId) {
        delete nextModule.productId
        delete nextModule.sku
      }
      diagramState.updateLink(link.id, {
        [target.side]: {
          ...endpoint,
          plug: { ...(endpoint.plug ?? {}), module: nextModule },
        },
      })
      return
    }

    const nextCable = { ...(link.cable ?? {}), productId }
    if (!productId) delete nextCable.productId
    diagramState.updateLink(link.id, {
      cable: Object.keys(nextCable).length > 0 ? nextCable : undefined,
    })
  },

  /** Unbind diagram nodes from their bound product. Strips spec/ports back to role. */
  unbindNodes(nodeIds: string[]) {
    const ids = new Set(nodeIds)
    for (const nodeId of ids) {
      const rn = diagram.nodes.get(nodeId)
      if (rn) {
        diagram.nodes.set(nodeId, {
          ...rn,
          productId: undefined,
          spec: stripProductFromSpec(rn.spec),
          ports: undefined,
        })
      }
    }
  },

  /**
   * Bind a diagram node to a (device) Product. Consumes one matching
   * Bind a diagram node to a (device) Product. The product's spec is
   * snapshotted onto the node, and ports are derived from the product
   * spec when available.
   */
  bindNodeToProduct(nodeId: string, productId: string) {
    const product = deviceProduct(productId)
    if (!product) return
    const node = diagram.nodes.get(nodeId)
    if (!node) return
    diagram.nodes.set(nodeId, { ...node, productId, spec: product.spec })
    setNodePortsFromProduct(nodeId, product)
  },

  /**
   * Materialize a fresh diagram node bound to the given product. Returns
   * the new node id. Increments `placedCount` on its own; if the user
   * had a `requiredQty` set, the gap closes by one.
   */
  placeProductAsNode(productId: string): string | undefined {
    const product = deviceProduct(productId)
    if (!product) return undefined

    const id = newId('node')
    const label = productLabel(product)
    const spec = product.spec
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
      productId: product.id,
      ports: nodePortsFromProduct(product),
      shape: 'rounded',
      position: pos,
    })
    return id
  },

  /**
   * Materialize an empty diagram node with no spec or product binding.
   * Used when a user wants to start from a node placeholder and bind a
   * product later. Returns the new node id.
   */
  addEmptyNode(label = 'Node'): string {
    const id = newId('node')
    const { width: w, height: h } = computeNodeSize({ label })
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
    diagram.nodes.set(id, { id, label, shape: 'rounded', position: pos })
    invalidateSheetCache()
    rebuildPortsAndEdges()
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
      version: 2,
      name,
      products: [...products],
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

  /** YAML text → NetedProject (current products/inventory preserved) → importProject. */
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
        version: 2,
        name: 'YAML Import',
        products: [...products],
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
   * current products and inventory. Wraps the input in a synthetic
   * NetedProject and forwards to `importProject`, so the linear
   * pipeline stays uniform regardless of what format came in.
   */
  async importDiagram(input: string | NetworkGraph) {
    const diagram: NetworkGraph = typeof input === 'string' ? JSON.parse(input) : input
    await diagramState.importProject({
      version: 2,
      name: 'Diagram Import',
      products: [...products],
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
    products = []
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
  const { products: cleanProducts, links: cleanLinks } = sanitizeProducts(
    data.products ?? [],
    diagram.nodes,
    diagram.links,
  )
  products = cleanProducts
  diagram.links = cleanLinks

  // Re-derive ports for nodes bound to a device product. preserveExisting
  // keeps any port shape persisted in the saved diagram.
  for (const [nodeId, node] of diagram.nodes) {
    if (!node.productId) continue
    const product = products.find((p) => p.id === node.productId)
    if (product?.kind !== 'device') continue
    setNodePortsFromProduct(nodeId, product, { preserveExisting: true, reroute: false })
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

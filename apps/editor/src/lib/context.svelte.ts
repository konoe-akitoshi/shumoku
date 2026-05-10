// Copyright (C) 2026-present Akitoshi Saeki
// SPDX-License-Identifier: AGPL-3.0-only

// =========================================================================
// Composer — wires the per-domain stores together and exposes the
// editor's public API (`diagramState`, `editorState`).
//
// Each store under `state/` owns its own $state and primitives. This
// file:
//   1. composes them into the public API,
//   2. wraps mutations with the undo `commit` / transaction layer,
//   3. holds composite operations that span stores
//      (placeProductInScene, removeProduct→node-cleanup, …),
//   4. owns the load pipeline (applyYaml → importProject → loadProject).
//
// Re-exports `editorState` and `diagramState` from here so existing
// imports keep working — the split is internal only.
// =========================================================================

import { builtinEntries, Catalog, expandCatalogPorts } from '@shumoku/catalog'
import {
  buildChildSheetGraph,
  collectObstacles,
  computeNetworkLayout,
  computeNodeSize,
  createMemoryFileResolver,
  HierarchicalParser,
  type Link,
  moveNode,
  type NetworkGraph,
  type Node,
  type NodePort,
  type NodeSpec,
  newId,
  placePorts,
  rebalanceSubgraphs,
  removePort as removePortCore,
  resolvePosition,
  type Subgraph,
  type Theme,
} from '@shumoku/core'
import { SvelteMap } from 'svelte/reactivity'
import { projectsDb } from './persistence/projects-store'
import { readProjectZip } from './persistence/reader'
import { applySync, diffSnapshots } from './persistence/sync'
import { writeProjectZip } from './persistence/writer'
import { analyzePoE } from './poe-analysis'
import { sampleProject } from './sample-project'
import { cableLengthMeters, cableSegmentLengths } from './scene/cable-length'
import { assetStore } from './state/assets.svelte'
import { buildAssignmentRows as buildBomRows } from './state/bom'
import { cache } from './state/cache.svelte'
import {
  applyResolvedLayout,
  currentSheetCacheGeneration,
  diagram,
  invalidateSheetCache,
  rebuildPortsAndEdges,
  replaceMap,
  rerouteEdges,
  sanitizeGraph,
  sheetCache,
  sheetLinkCache,
  sheetStore,
  sheetView,
} from './state/diagram.svelte'
import { editorStore, initDarkMode } from './state/editor.svelte'
import { instantiatePortsFromProduct, mergeProductPortsIntoExisting } from './state/product-ports'
import { productsStore, sanitizeProducts } from './state/products.svelte'
import { sanitizeScenes, scenesStore } from './state/scenes.svelte'
import { sessionStore } from './state/session.svelte'
import type {
  AssignmentRow,
  AssignmentTarget,
  DeviceProduct,
  NetedProject,
  Product,
  Scene,
} from './types'
import { productLabel } from './types'
import { type ProjectSnapshot, undoManager } from './undo.svelte'

// Re-export the load-time hook so the layout file doesn't need to know
// where editor state lives.
export { initDarkMode }

// =========================================================================
// Catalog + PoE — singletons (not in undo)
// =========================================================================

const catalog = new Catalog()
catalog.registerAll(builtinEntries)

// Index Products by id for fast `node.productId → product.properties`
// lookups inside `analyzePoE`. Re-derived on every productsStore change
// so PoE budgets reflect resync events without manual cache invalidation.
const productsById = $derived(new Map(productsStore.list.map((p) => [p.id, p])))
const poeBudgets = $derived(analyzePoE([...diagram.nodes.values()], diagram.links, productsById))

// =========================================================================
// Cross-store derivations / helpers
// =========================================================================

function deviceProduct(id: string): DeviceProduct | undefined {
  const p = productsStore.find(id)
  return p?.kind === 'device' ? p : undefined
}

function moduleProductSku(product: Product): string | undefined {
  if (product.kind !== 'module') return undefined
  return product.spec.mpn ?? product.catalogId
}

function buildAssignmentRows(): AssignmentRow[] {
  return buildBomRows({
    nodes: diagram.nodes,
    links: diagram.links,
    scenes: scenesStore.list,
  })
}

// =========================================================================
// Node spec + port helpers — touch diagram + products
// =========================================================================

function setNodeSpecs(nodeIds: string[], spec: NodeSpec | undefined) {
  for (const id of new Set(nodeIds)) {
    const rn = diagram.nodes.get(id)
    if (rn) diagram.nodes.set(id, { ...rn, spec })
  }
}

/**
 * Whether the `(kind, vendor, model, platform, service)` identity tuple
 * differs between two NodeSpecs. Used by `updateProduct` to decide if a
 * product change actually warrants re-templating the catalog ports —
 * routine property edits leave this tuple intact and must skip the
 * port re-merge entirely.
 */
function nodeSpecIdentityChanged(a: NodeSpec | undefined, b: NodeSpec | undefined): boolean {
  if (!a || !b) return a !== b
  if (a.kind !== b.kind) return true
  if (a.kind === 'hardware' && b.kind === 'hardware') {
    return a.vendor !== b.vendor || a.model !== b.model || a.type !== b.type
  }
  if (a.kind === 'compute' && b.kind === 'compute') {
    return a.platform !== b.platform || a.type !== b.type
  }
  if (a.kind === 'service' && b.kind === 'service') {
    return a.service !== b.service || a.resource !== b.resource
  }
  return false
}

function stripProductFromSpec(spec: NodeSpec | undefined): NodeSpec | undefined {
  if (!spec) return undefined
  if (spec.kind === 'hardware') return { kind: 'hardware', type: spec.type }
  if (spec.kind === 'compute') return { kind: 'compute', type: spec.type }
  if (spec.kind === 'service') return { kind: 'service', service: spec.service }
  return undefined
}

// =========================================================================
// Catalog → Product (snapshot) and Product → Node (instantiate / merge)
//
// Three layers, modeled after KiCad's library/cache/instance hierarchy:
//
//   Catalog      = global, immutable, shipped via the npm package
//   Product      = project-local snapshot of a catalog entry, with its own
//                  `ports` and `properties`. Survives catalog drift;
//                  refreshed on demand via "Resync from catalog" in
//                  Materials.
//   Node.ports   = per-instance, owns each port's stable id and user-
//                  edited label.
//
// Catalog is read here only at *snapshot time* (Product creation /
// load-shim / explicit resync). Steady-state Node operations consult
// Product.ports — never the live catalog directly — so projects keep
// rendering even if a catalog entry is later renamed or removed.
//
// Pure Product → Node helpers (`instantiatePortsFromProduct`,
// `mergeProductPortsIntoExisting`) live in `./state/product-ports.ts`
// and are unit-tested there.
// =========================================================================

/**
 * Build a fresh catalog-derived snapshot of a Product (`ports` +
 * `properties` + `catalogSyncedAt`). The single place that reads the
 * live catalog for snapshotting purposes — every other catalog read is
 * either initialization or a UI helper that lists catalog entries
 * directly.
 *
 * Returns a `Partial<DeviceProduct>` so callers can decide whether to
 * overwrite existing fields (`resyncProductFromCatalog`) or only fill
 * missing ones (`ensureProductSnapshot`).
 */
function snapshotCatalogIntoProduct(product: DeviceProduct): Partial<DeviceProduct> {
  // Try the upstream catalog first; if absent, fall back to an inline
  // entry built from the Product's own `properties` so catalog-less
  // products that declare ports inline still get a snapshot.
  const catalogEntry = product.catalogId ? catalog.lookup(product.catalogId) : undefined
  const entry = catalogEntry ?? {
    id: product.id,
    label: productLabel(product),
    spec: product.spec,
    tags: [],
    properties: product.properties ?? {},
  }
  const templates = expandCatalogPorts(entry)
  const out: Partial<DeviceProduct> = {}
  if (templates.length > 0) {
    out.ports = templates.map((t) => ({
      id: newId('port'),
      ...t,
      connectors: t.connectors ?? [],
    }))
    out.catalogSyncedAt = new Date().toISOString()
  }
  // Only refresh properties when the upstream catalog actually had an
  // entry — the inline fallback's properties are just `product.properties`
  // round-tripped, so writing them back would be a no-op churn.
  if (catalogEntry) {
    out.properties = catalogEntry.properties as DeviceProduct['properties']
  }
  return out
}

/**
 * Materialize the catalog snapshot on a Product when missing. Called
 * once per product at import / load time so every Product carries its
 * own copy of the catalog data. Existing fields are preserved — this
 * never overwrites a user's customizations.
 *
 * For an explicit refresh that DOES overwrite, see
 * `resyncProductFromCatalog`.
 */
function ensureProductSnapshot(product: Product): Product {
  if (product.kind !== 'device') return product
  const needsPorts = !product.ports || product.ports.length === 0
  const needsProps = !product.properties && !!product.catalogId
  if (!needsPorts && !needsProps) return product

  const snap = snapshotCatalogIntoProduct(product)
  let next: DeviceProduct = product
  if (needsPorts && snap.ports?.length) {
    next = {
      ...next,
      ports: snap.ports,
      catalogSyncedAt: next.catalogSyncedAt ?? snap.catalogSyncedAt,
    }
  }
  if (needsProps && snap.properties) {
    next = { ...next, properties: snap.properties }
  }
  return next
}

/**
 * Apply a Product's port template to a node — instantiate fresh ids
 * when the node has none, otherwise merge into existing ports keeping
 * the stable port `id` (so existing links continue resolving) and
 * refreshing every Product-owned field from the template, including
 * `label`. The `(label, iface, faceplate, speed, connectors)` tuple
 * is owned as one unit by the catalog, so we can't preserve label
 * piecewise without breaking that pairing.
 *
 * Callers:
 * - `placeProductAsNode` / initial bind → no existing ports → instantiate
 * - `bindNodeToProduct` on a node with ports → merge
 * - load path with `preserveExisting: true` → keep saved ports as-is
 *
 * `updateProduct` should NOT call this for routine property edits —
 * see `updateProduct` for the catalog-identity gate.
 */
function setNodePortsFromProduct(
  nodeId: string,
  product: DeviceProduct | undefined,
  options: { preserveExisting?: boolean; reroute?: boolean } = {},
) {
  const node = diagram.nodes.get(nodeId)
  if (!node) return
  if (options.preserveExisting && node.ports) return
  const ports = node.ports?.length
    ? mergeProductPortsIntoExisting(node.ports, product)
    : instantiatePortsFromProduct(product)
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
    connectors: init.connectors ?? [],
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

// =========================================================================
// Project snapshot + undo machinery
// =========================================================================

function getProjectSnapshot(): ProjectSnapshot {
  return $state.snapshot({
    nodes: [...diagram.nodes.entries()],
    subgraphs: [...diagram.subgraphs.entries()],
    links: diagram.links,
    products: productsStore.list,
    scenes: scenesStore.list,
  }) as ProjectSnapshot
}

function applyProjectSnapshot(snap: ProjectSnapshot): void {
  const cloned = $state.snapshot(snap) as ProjectSnapshot
  replaceMap(diagram.nodes, cloned.nodes)
  replaceMap(diagram.subgraphs, cloned.subgraphs)
  diagram.links = cloned.links
  productsStore.set(cloned.products)
  scenesStore.set(cloned.scenes)
  if (scenesStore.currentId && !scenesStore.find(scenesStore.currentId)) {
    scenesStore.setCurrentId(null)
  }
  invalidateSheetCache()
  rebuildPortsAndEdges()
}

let inCommit = false
let txActive = false
let txSnap: ProjectSnapshot | null = null
let txLabel = ''

function commit<T>(label: string, fn: () => T): T {
  if (inCommit) return fn()
  // While a transaction is open (e.g. the user is in edit mode, or
  // a multi-tick drag is in progress) the bracket — not commit() —
  // owns undo grouping: we skip undoManager.push so individual
  // ticks don't pollute the undo stack. Cache sync is orthogonal,
  // so per-commit state changes still mirror to IDB; otherwise
  // anything done during edit mode (image upload, sidebar edits)
  // would be lost on reload.
  if (txActive) {
    inCommit = true
    try {
      const result = fn()
      cache.touch()
      return result
    } finally {
      inCommit = false
    }
  }
  const before = getProjectSnapshot()
  inCommit = true
  try {
    const result = fn()
    undoManager.push(label, before)
    cache.touch()
    return result
  } finally {
    inCommit = false
  }
}

async function commitAsync<T>(label: string, fn: () => Promise<T>): Promise<T> {
  if (inCommit) return await fn()
  if (txActive) {
    inCommit = true
    try {
      const result = await fn()
      cache.touch()
      return result
    } finally {
      inCommit = false
    }
  }
  const before = getProjectSnapshot()
  inCommit = true
  try {
    const result = await fn()
    undoManager.push(label, before)
    cache.touch()
    return result
  } finally {
    inCommit = false
  }
}

// =========================================================================
// Public editor state — adds the edit-session transaction bracket
// over the raw editor store.
// =========================================================================

export const editorState = {
  get mode() {
    return editorStore.mode
  },
  set mode(v: 'edit' | 'view') {
    // The diagram canvas drag uses Svelte $bindable so individual node
    // moves don't go through commit. Wrap the entire edit session as
    // one undo transaction: snapshot on enter, push delta on exit
    // (only if state actually changed).
    if (editorStore.mode === v) return
    if (v === 'edit') {
      diagramState.beginTx('Edit')
    } else if (editorStore.mode === 'edit') {
      diagramState.endTx()
    }
    editorStore.setMode(v)
  },
  get isDark() {
    return editorStore.isDark
  },
  set isDark(v: boolean) {
    editorStore.setDark(v)
  },
  get theme(): Theme {
    return editorStore.theme
  },
  get interactive() {
    return editorStore.interactive
  },
  toggleMode() {
    editorState.mode = editorStore.mode === 'edit' ? 'view' : 'edit'
  },
  toggleTheme() {
    editorStore.toggleTheme()
  },
}

// =========================================================================
// Public diagram state — composes diagram/products/scenes/sheet/undo
// into the existing god-object surface. Wraps mutations with commit.
// =========================================================================

export const diagramState = {
  // ----- Diagram (root maps) — getters for $bindable compat ------------
  get nodes() {
    return diagram.nodes
  },
  set nodes(v: Map<string, Node>) {
    if (v === diagram.nodes) return
    if (v instanceof SvelteMap) Object.assign(diagram, { nodes: v })
    else replaceMap(diagram.nodes, v)
  },
  get ports() {
    return diagram.ports
  },
  set ports(v: Map<string, ResolvedPortShim>) {
    if (v === diagram.ports) return
    if (v instanceof SvelteMap) Object.assign(diagram, { ports: v })
    else replaceMap(diagram.ports, v)
  },
  get edges() {
    return diagram.edges
  },
  set edges(v: Map<string, ResolvedEdgeShim>) {
    if (v === diagram.edges) return
    if (v instanceof SvelteMap) Object.assign(diagram, { edges: v })
    else replaceMap(diagram.edges, v)
  },
  get subgraphs() {
    return diagram.subgraphs
  },
  set subgraphs(v: Map<string, Subgraph>) {
    if (v === diagram.subgraphs) return
    if (v instanceof SvelteMap) Object.assign(diagram, { subgraphs: v })
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

  // ----- Diagram mutations (commit-wrapped) ---------------------------
  addLink(link: Link) {
    commit('Add link', () => {
      diagram.links = [...diagram.links, link]
      invalidateSheetCache()
      rebuildPortsAndEdges()
    })
  },
  updateLink(id: string, updates: Partial<Link>) {
    commit('Update link', () => {
      diagram.links = diagram.links.map((l) => (l.id === id ? { ...l, ...updates } : l))
      invalidateSheetCache()
      rebuildPortsAndEdges()
    })
  },
  removeLink(id: string) {
    diagram.links = diagram.links.filter((l) => l.id !== id)
    invalidateSheetCache()
    rebuildPortsAndEdges()
  },
  addNodePort(nodeId: string, init: Partial<NodePort> = {}) {
    const portId = appendPortToNode(diagram.nodes, nodeId, init)
    if (portId) rebuildPortsAndEdges()
    return portId
  },
  updateNode(id: string, updates: Partial<Node>) {
    const rn = diagram.nodes.get(id)
    if (!rn) return
    if ('parent' in updates && updates.parent !== rn.parent) invalidateSheetCache()
    diagram.nodes.set(id, { ...rn, ...updates })
  },
  updateSubgraph(id: string, updates: Partial<Subgraph>) {
    const sg = diagram.subgraphs.get(id)
    if (!sg) return
    if ('parent' in updates && updates.parent !== sg.parent) invalidateSheetCache()
    diagram.subgraphs.set(id, { ...sg, ...updates })
  },
  async moveNodeToGroup(nodeId: string, groupId: string | undefined) {
    return commitAsync('Move to group', async () => {
      const node = diagram.nodes.get(nodeId)
      if (!node?.position) return
      if (node.parent === groupId) return

      invalidateSheetCache()
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

      rebalanceSubgraphs(diagram.nodes, diagram.subgraphs, diagram.ports)
      await rerouteEdges()
    })
  },
  updatePortLabel(portId: string, label: string) {
    commit('Rename port', () => {
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
    })
  },
  getNodePorts(nodeId: string): NodePort[] {
    return diagram.nodes.get(nodeId)?.ports ?? []
  },
  getPortLabelSuggestions(nodeId: string): string[] {
    // Source from the bound Product's port snapshot — never the live
    // catalog. Steady-state UI (the label-edit popover) keeps working
    // even if the upstream catalog entry is renamed or removed.
    const node = diagram.nodes.get(nodeId)
    if (!node?.productId) return []
    const product = productsStore.find(node.productId)
    if (product?.kind !== 'device') return []
    return (product.ports ?? []).map((p) => p.label).filter(Boolean)
  },
  getPortUsage(nodeId: string): Map<string, string[]> {
    const usage = new Map<string, string[]>()
    for (const [i, link] of diagram.links.entries()) {
      const linkId = link.id ?? `link-${i}`
      if (link.from.node === nodeId && link.from.port) {
        const arr = usage.get(link.from.port) ?? []
        arr.push(linkId)
        usage.set(link.from.port, arr)
      }
      if (link.to.node === nodeId && link.to.port) {
        const arr = usage.get(link.to.port) ?? []
        arr.push(linkId)
        usage.set(link.to.port, arr)
      }
    }
    return usage
  },

  // ----- Status / session passthroughs --------------------------------
  get poeBudgets() {
    return poeBudgets
  },
  get catalog() {
    return catalog
  },
  get status() {
    return sessionStore.status
  },
  get yamlSource() {
    return sessionStore.yamlSource
  },
  set yamlSource(v: string) {
    sessionStore.setYamlSource(v)
  },
  get initialized() {
    return sessionStore.initialized
  },
  get stats() {
    return {
      nodes: diagram.nodes.size,
      links: diagram.links.length,
      subgraphs: diagram.subgraphs.size,
    }
  },

  // ----- Sheets -------------------------------------------------------
  get currentSheetId() {
    return sheetStore.currentSheetId
  },
  get availableSheets(): Array<{ id: string | null; label: string }> {
    const sheets: Array<{ id: string | null; label: string }> = [{ id: null, label: 'Root' }]
    for (const sg of diagram.subgraphs.values()) {
      if (sg.parent) continue
      sheets.push({ id: sg.id, label: sg.label ?? sg.id })
    }
    return sheets
  },
  async switchSheet(id: string | null) {
    if (id !== null && !diagram.subgraphs.has(id)) {
      sheetStore.setCurrentSheetId(null)
      return
    }
    sheetStore.setCurrentSheetId(id)

    if (id === null) {
      sheetView.nodes.clear()
      sheetView.ports.clear()
      sheetView.edges.clear()
      sheetView.subgraphs.clear()
      sheetView.links = []
      return
    }

    const cached = sheetCache.get(id)
    if (cached) {
      applyResolvedLayout(sheetView, cached, sheetView.links)
      const cachedLinks = sheetLinkCache.get(id)
      if (cachedLinks) sheetView.links = [...cachedLinks]
      return
    }

    const generation = currentSheetCacheGeneration()
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
      sheetStore.setCurrentSheetId(null)
      return
    }
    const { resolved } = await computeNetworkLayout(childGraph)

    if (sheetStore.currentSheetId !== id || generation !== currentSheetCacheGeneration()) return

    sheetCache.set(id, resolved)
    sheetLinkCache.set(id, childGraph.links)
    applyResolvedLayout(sheetView, resolved, childGraph.links)
  },
  get activeView() {
    if (sheetStore.currentSheetId === null) return diagram
    return sheetView
  },
  invalidateSheetCache() {
    invalidateSheetCache()
  },

  // ----- Products -----------------------------------------------------
  get products() {
    return productsStore.list
  },
  addProduct(entry: Product) {
    commit('Add product', () => productsStore.add(ensureProductSnapshot(entry)))
  },
  removeProduct(id: string) {
    commit('Remove product', () => {
      const product = productsStore.find(id)
      if (!product) return

      // Cross-store cleanup: clear node/link bindings before removing.
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

      productsStore.remove(id)
    })
  },
  updateProduct(id: string, updates: Partial<Product>) {
    commit('Update product', () => {
      const before = productsStore.find(id)
      productsStore.update(id, updates)
      const product = productsStore.find(id)
      const iconChanged = 'icon' in updates
      const specChanged = !!updates.spec
      // Catalog identity = the (vendor, model, catalogId, kind) tuple that
      // determines which port templates apply. Routine property tweaks
      // (description, requiredQty, properties.*) must NOT touch existing
      // ports — `node.ports` is owned by the node once instantiated, with
      // ids treated as immutable handles that links reference.
      const catalogIdentityChanged =
        before?.kind === 'device' && product?.kind === 'device'
          ? before.catalogId !== product.catalogId ||
            nodeSpecIdentityChanged(before.spec, product.spec)
          : !!updates.spec || !!updates.catalogId
      if (product?.kind === 'device' && (specChanged || iconChanged || catalogIdentityChanged)) {
        const boundNodeIds: string[] = []
        for (const [nodeId, node] of diagram.nodes) {
          if (node.productId === id) boundNodeIds.push(nodeId)
        }
        if (boundNodeIds.length > 0) {
          if (specChanged || iconChanged) {
            const nextSpec = product.icon ? { ...product.spec, icon: product.icon } : product.spec
            setNodeSpecs(boundNodeIds, nextSpec)
          }
          if (catalogIdentityChanged) {
            // Vendor/model changed — re-snapshot the catalog into the
            // Product, then merge the new template into each bound
            // node's existing ports. Stable port ids survive (so links
            // keep resolving) but every Product-owned field — labels
            // included — is taken from the new template. One reroute
            // at the end covers all bound nodes — cheaper than once per.
            const snap = snapshotCatalogIntoProduct(product as DeviceProduct)
            productsStore.update(id, snap as Partial<Product>)
            const refreshed = productsStore.find(id) as DeviceProduct | undefined
            for (const nodeId of boundNodeIds) {
              setNodePortsFromProduct(nodeId, refreshed, { reroute: false })
            }
            if (boundNodeIds.length > 0) rebuildPortsAndEdges()
          }
        }
      }
    })
  },
  /**
   * Re-snapshot the catalog template into the Product and cascade the
   * new ports into every bound Node's `node.ports`. The merge logic
   * preserves stable port ids (so existing links keep resolving) but
   * refreshes every Product-owned field — including `label` — from
   * the new template, since the `(label, iface, faceplate, speed,
   * connectors)` tuple is owned by the catalog. User-added custom
   * ports that don't match any template port survive at the end of
   * the list. No-op for catalog-less products.
   *
   * Returns the count of bound nodes that were touched, for the UI
   * to surface ("Resynced N nodes").
   */
  resyncProductFromCatalog(id: string): number {
    return commit('Resync product from catalog', () => {
      const product = productsStore.find(id)
      if (!product || product.kind !== 'device') return 0
      const snap = snapshotCatalogIntoProduct(product)
      productsStore.update(id, snap as Partial<Product>)
      const refreshed = productsStore.find(id) as DeviceProduct | undefined
      let touched = 0
      // Mutate all bound nodes in one pass with rerouting suppressed —
      // a single full reroute at the end is far cheaper than rerouting
      // once per bound node (each call walks every node + every link).
      for (const [nodeId, node] of diagram.nodes) {
        if (node.productId !== id) continue
        setNodePortsFromProduct(nodeId, refreshed, { reroute: false })
        touched++
      }
      if (touched > 0) rebuildPortsAndEdges()
      return touched
    })
  },
  /**
   * Effective real-world cable length for a link. Scene-derived
   * (when the user has placed the link's endpoints in a calibrated
   * scene and bent the wire along walls) takes precedence over the
   * stored `link.cable.length_m`.
   */
  cableLengthMeters(linkId: string): { meters: number; source: 'scene' | 'stored' } | null {
    const link = diagram.links.find((l) => l.id === linkId)
    if (!link) return null
    return cableLengthMeters(link, scenesStore.list, diagram.nodes)
  },
  /**
   * Per-visible-segment cable lengths for a link. EPS-routed wires
   * yield one entry per side of the chase (the physical cable
   * count). Empty array when no segment has a scene-derived length.
   */
  cableSegmentLengths(linkId: string): Array<{ fromId: string; toId: string; meters: number }> {
    const link = diagram.links.find((l) => l.id === linkId)
    if (!link) return []
    return cableSegmentLengths(link, scenesStore.list, diagram.nodes)
  },
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
  requiredCount(productId: string): number {
    const product = productsStore.find(productId)
    if (product?.requiredQty !== undefined) return product.requiredQty
    return diagramState.placedCount(productId)
  },

  // ----- Assignments --------------------------------------------------
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
      const product = productId ? productsStore.find(productId) : undefined
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
  unbindNodes(nodeIds: string[]) {
    commit('Unbind nodes', () => {
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
    })
  },
  bindNodeToProduct(nodeId: string, productId: string) {
    commit('Bind product', () => {
      const product = deviceProduct(productId)
      if (!product) return
      const node = diagram.nodes.get(nodeId)
      if (!node) return
      const spec = product.icon ? { ...product.spec, icon: product.icon } : product.spec
      diagram.nodes.set(nodeId, { ...node, productId, spec })
      setNodePortsFromProduct(nodeId, product)
    })
  },
  placeProductAsNode(productId: string): string | undefined {
    return commit('Place product', () => {
      const product = deviceProduct(productId)
      if (!product) return undefined

      const id = newId('node')
      const label = productLabel(product)
      const spec = product.icon ? { ...product.spec, icon: product.icon } : product.spec
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
        ports: instantiatePortsFromProduct(product),
        shape: 'rounded',
        position: pos,
      })
      return id
    })
  },
  addEmptyNode(label = 'Node'): string {
    return commit('Add node', () => {
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
    })
  },

  // ----- Scenes -------------------------------------------------------
  get scenes() {
    return scenesStore.list
  },
  get currentSceneId() {
    return scenesStore.currentId
  },
  get currentScene(): Scene | undefined {
    return scenesStore.current
  },
  setCurrentScene(id: string | null) {
    scenesStore.setCurrentId(id)
  },
  setCurrentSceneForScope(scopeSubgraphId: string | undefined) {
    const matches = scenesStore.list.filter((s) => s.scopeSubgraphId === scopeSubgraphId)
    if (matches.length > 0) {
      // Pick the most "interesting" scene when more than one shares
      // the same scope. Older builds occasionally created a stray
      // empty Root scene during load races (see the !initialized
      // guard below); plain `find` returned the dud first by
      // insertion / id order and the actual imported scene with the
      // floor plan got hidden. Prefer scenes with a background or
      // populated placements so projects with leftover empties still
      // open on the user's data.
      const score = (s: Scene): number =>
        (s.background ? 1000 : 0) + (s.nodePlacements?.length ?? 0)
      const best = matches.reduce((a, b) => (score(b) > score(a) ? b : a))
      scenesStore.setCurrentId(best.id)
      return
    }
    commit('Open scene', () => {
      const sg = scopeSubgraphId ? diagram.subgraphs.get(scopeSubgraphId) : undefined
      const name = sg?.label ?? 'Root'
      const scene: Scene = {
        id: newId('scene'),
        name,
        nodePlacements: [],
        scopeSubgraphId,
      }
      scenesStore.add(scene)
      scenesStore.setCurrentId(scene.id)
    })
  },
  addScene(scene: Scene) {
    commit('Add scene', () => scenesStore.add(scene))
  },
  removeScene(id: string) {
    commit('Remove scene', () => scenesStore.remove(id))
  },
  updateScene(id: string, updates: Partial<Omit<Scene, 'id'>>) {
    commit('Update scene', () => scenesStore.update(id, updates))
  },
  placeNodeInScene(sceneId: string, nodeId: string, position: { x: number; y: number }) {
    commit('Move item', () => scenesStore.placeNode(sceneId, nodeId, position))
  },
  /**
   * Bulk version for multi-drag: a single store mutation (and a
   * single derive cascade) for the whole selection per drag tick.
   * No-op when `updates` is empty.
   */
  placeNodesInScene(
    sceneId: string,
    updates: Array<{ nodeId: string; position: { x: number; y: number } }>,
  ) {
    if (updates.length === 0) return
    commit('Move items', () => scenesStore.placeNodes(sceneId, updates))
  },
  removePlacementFromScene(sceneId: string, nodeId: string) {
    commit('Remove placement', () => scenesStore.removePlacement(sceneId, nodeId))
  },
  hideNodeInScene(sceneId: string, nodeId: string) {
    commit('Hide node', () => scenesStore.hideNode(sceneId, nodeId))
  },
  unhideNodeInScene(sceneId: string, nodeId: string) {
    commit('Unhide node', () => scenesStore.unhideNode(sceneId, nodeId))
  },
  hideLinkInScene(sceneId: string, linkId: string) {
    commit('Hide link', () => scenesStore.hideLink(sceneId, linkId))
  },
  unhideLinkInScene(sceneId: string, linkId: string) {
    commit('Unhide link', () => scenesStore.unhideLink(sceneId, linkId))
  },
  placeProductInScene(
    sceneId: string,
    productId: string,
    position: { x: number; y: number },
  ): string | undefined {
    return commit('Place product in scene', () => {
      const nodeId = diagramState.placeProductAsNode(productId)
      if (!nodeId) return undefined
      const scene = scenesStore.find(sceneId)
      const node = diagram.nodes.get(nodeId)
      if (scene?.scopeSubgraphId && node) {
        diagram.nodes.set(nodeId, { ...node, parent: scene.scopeSubgraphId })
        invalidateSheetCache()
      }
      diagramState.placeNodeInScene(sceneId, nodeId, position)
      return nodeId
    })
  },
  addEmptyNodeInScene(sceneId: string, position: { x: number; y: number }, label = 'Node'): string {
    return commit('Add node in scene', () => {
      const id = diagramState.addEmptyNode(label)
      const scene = scenesStore.find(sceneId)
      const node = diagram.nodes.get(id)
      if (scene?.scopeSubgraphId && node) {
        diagram.nodes.set(id, { ...node, parent: scene.scopeSubgraphId })
        invalidateSheetCache()
      }
      diagramState.placeNodeInScene(sceneId, id, position)
      return id
    })
  },
  /**
   * Drop a passive cable termination point (wall outlet, EPS riser,
   * patch panel) at `position` in the scene. Termination Nodes follow
   * the same lifecycle as device Nodes (placement, parent inheritance,
   * undo) — they just carry `termination` metadata so the scene
   * renders them differently and the logical diagram filters them out.
   */
  addTerminationInScene(
    sceneId: string,
    position: { x: number; y: number },
    role: 'outlet' | 'eps' | 'panel' | 'bend',
  ): string {
    return commit('Add termination in scene', () => {
      const defaultLabel =
        role === 'outlet' ? 'Outlet' : role === 'eps' ? 'EPS' : role === 'panel' ? 'Panel' : 'Bend'
      const id = diagramState.addEmptyNode(defaultLabel)
      const scene = scenesStore.find(sceneId)
      const node = diagram.nodes.get(id)
      if (node) {
        diagram.nodes.set(id, {
          ...node,
          termination: { role },
          parent: scene?.scopeSubgraphId ?? node.parent,
        })
        invalidateSheetCache()
      }
      diagramState.placeNodeInScene(sceneId, id, position)
      return id
    })
  },
  /**
   * Insert a fresh bend Node into a wire's `via` at `viaIndex`.
   * Creates the Node (termination role 'bend'), places it in the
   * scene, and updates the link's via in one transaction. Returns
   * the new bend Node's id so the drag handler can move it.
   */
  insertBendInLink(
    sceneId: string,
    linkId: string,
    position: { x: number; y: number },
    viaIndex: number,
  ): string {
    return commit('Bend wire', () => {
      const id = diagramState.addTerminationInScene(sceneId, position, 'bend')
      const link = diagram.links.find((l) => l.id === linkId)
      const oldVia = link?.via ?? []
      const idx = Math.max(0, Math.min(viaIndex, oldVia.length))
      const newVia = [...oldVia.slice(0, idx), id, ...oldVia.slice(idx)]
      diagramState.updateLink(linkId, { via: newVia })
      return id
    })
  },
  /**
   * Apply EPS routing in bulk. For each link in `linkIds`, ensure the
   * given `epsId` is present in `link.via` (when included=true) or
   * removed (when included=false). All other entries in `via` are
   * preserved — this only toggles a single TP's membership, so other
   * TPs (other EPSes, outlets) keep their assignments. Wraps as one
   * undo step so the modal's whole apply collapses to a single entry.
   */
  /**
   * Hard-delete a Node from the diagram. Also strips it from any
   * scene placement and from any link's `via` chain so the data
   * stays consistent. Useful for cleaning up auto-created
   * termination points (e.g. outlets) that are no longer referenced.
   */
  removeNode(id: string) {
    commit('Remove node', () => {
      diagram.nodes.delete(id)
      diagram.links = diagram.links.map((l) => {
        const via = l.via
        if (!via?.includes(id)) return l
        const next = via.filter((v) => v !== id)
        return { ...l, via: next.length > 0 ? next : undefined }
      })
      // Drop placements / wire routes / hidden lists referencing this id.
      for (const scene of scenesStore.list) {
        const placements = scene.nodePlacements.filter((p) => p.nodeId !== id)
        const hidden = (scene.hiddenNodeIds ?? []).filter((nid) => nid !== id)
        if (
          placements.length !== scene.nodePlacements.length ||
          hidden.length !== (scene.hiddenNodeIds?.length ?? 0)
        ) {
          scenesStore.update(scene.id, {
            nodePlacements: placements,
            hiddenNodeIds: hidden,
          })
        }
      }
      invalidateSheetCache()
      rebuildPortsAndEdges()
    })
  },
  /**
   * Remove a port: drops it from its parent Node's `ports` array,
   * deletes any links that referenced it, and rebalances the
   * remaining ports on the node. Wraps the core helper so undo +
   * cache.touch + edge re-routing all happen in one commit.
   */
  removePort(id: string) {
    commit('Remove port', () => {
      const result = removePortCore(id, diagram.nodes, diagram.ports, diagram.links)
      if (!result) return
      diagram.nodes = result.nodes as typeof diagram.nodes
      diagram.ports = result.ports as typeof diagram.ports
      diagram.links = result.links
      rebuildPortsAndEdges()
    })
  },
  /**
   * Remove a subgraph but leave its contents intact — children
   * (nodes and nested subgraphs) re-parent to the deleted
   * subgraph's parent, so the subgraph "unwraps" rather than
   * cascading. Scenes that scoped to this subgraph fall back to
   * its parent (or root if it was a top-level subgraph).
   *
   * Recursive descendant deletion is intentionally not the default:
   * users almost always want to ungroup, not nuke. If they do want
   * to remove the contents, they can multi-select and Delete.
   */
  removeSubgraph(id: string) {
    commit('Remove subgraph', () => {
      const sg = diagram.subgraphs.get(id)
      if (!sg) return
      const newParent = sg.parent
      for (const [nid, n] of diagram.nodes) {
        if (n.parent === id) diagram.nodes.set(nid, { ...n, parent: newParent })
      }
      for (const [cid, c] of diagram.subgraphs) {
        if (c.parent === id) diagram.subgraphs.set(cid, { ...c, parent: newParent })
      }
      diagram.subgraphs.delete(id)

      for (const scene of scenesStore.list) {
        if (scene.scopeSubgraphId === id) {
          scenesStore.update(scene.id, { scopeSubgraphId: newParent })
        }
      }

      invalidateSheetCache()
      rebuildPortsAndEdges()
    })
  },
  setEpsRoutingForLinks(epsId: string, linkIds: string[], included: boolean) {
    if (linkIds.length === 0) return
    commit('Update EPS routing', () => {
      const targets = new Set(linkIds)
      diagram.links = diagram.links.map((l) => {
        if (!l.id || !targets.has(l.id)) return l
        const via = l.via ?? []
        const has = via.includes(epsId)
        if (included && !has) return { ...l, via: [...via, epsId] }
        if (!included && has) {
          const next = via.filter((id) => id !== epsId)
          return { ...l, via: next.length > 0 ? next : undefined }
        }
        return l
      })
      invalidateSheetCache()
      rebuildPortsAndEdges()
    })
  },
  addWireInScene(_sceneId: string, fromNodeId: string, toNodeId: string): string | undefined {
    return commit('Add wire', () => {
      const fromNode = diagram.nodes.get(fromNodeId)
      const toNode = diagram.nodes.get(toNodeId)
      if (!fromNode || !toNode) return undefined
      const linkId = newId('link')
      // Init an empty cable record so the BOM / detail panel pick
      // the wire up immediately. Type / grade / length stay unset;
      // the user (or scene-derived length) fills them in
      // afterward. The wire's scene appearance is fully derived
      // from `link.via` placements — no per-scene route record.
      diagramState.addLink({
        id: linkId,
        from: { node: fromNodeId, port: '' },
        to: { node: toNodeId, port: '' },
        cable: {},
      })
      return linkId
    })
  },

  // ----- Undo / Redo + transactions -----------------------------------
  get canUndo() {
    return undoManager.canUndo
  },
  get canRedo() {
    return undoManager.canRedo
  },
  get undoLabel() {
    return undoManager.undoLabel
  },
  get redoLabel() {
    return undoManager.redoLabel
  },
  undo(): boolean {
    const current = getProjectSnapshot()
    const target = undoManager.undo(current)
    if (!target) return false
    applyProjectSnapshot(target)
    return true
  },
  redo(): boolean {
    const current = getProjectSnapshot()
    const target = undoManager.redo(current)
    if (!target) return false
    applyProjectSnapshot(target)
    return true
  },
  beginTx(label: string): void {
    if (txActive) return
    txSnap = getProjectSnapshot()
    txLabel = label
    txActive = true
  },
  endTx(): void {
    if (!txActive) return
    const snap = txSnap
    const label = txLabel
    txActive = false
    txSnap = null
    txLabel = ''
    if (!snap) return
    const after = getProjectSnapshot()
    const changed =
      snap.nodes.length !== after.nodes.length ||
      snap.subgraphs.length !== after.subgraphs.length ||
      snap.links.length !== after.links.length ||
      snap.products.length !== after.products.length ||
      snap.scenes.length !== after.scenes.length ||
      JSON.stringify(snap) !== JSON.stringify(after)
    if (changed) {
      undoManager.push(label, snap)
      // Same hook as `commit()` — close the transaction by telling
      // the cache layer to sync. Without this, drag (which uses
      // beginTx/endTx instead of per-frame commit()) would land in
      // memory but never reach IndexedDB.
      cache.touch()
    }
  },
  get inTx(): boolean {
    return txActive
  },

  // ----- Serialization ------------------------------------------------
  exportGraph(): NetworkGraph {
    return {
      version: '1',
      nodes: [...diagram.nodes.values()],
      links: [...diagram.links],
      subgraphs: [...diagram.subgraphs.values()],
    }
  },
  /**
   * Build the .neted zip blob for the current project from the DB
   * mirror. We drain the cache first so any pending sync lands,
   * then read entity + asset rows back. This keeps "what you
   * Export" identical to "what you'd see on reload" and matches
   * the DB-as-canonical model.
   *
   * Sample falls back to in-memory state because it's never cached.
   */
  async exportProjectZip(name?: string): Promise<Blob> {
    const id = sessionStore.projectId
    if (id && id !== 'sample') {
      await cache.drain()
      const cached = await projectsDb.loadSnapshot(id)
      if (cached) {
        const assets = await projectsDb.getAssets(id)
        const byHash = new Map(assets.map((a) => [a.hash, a]))
        const project = snapshotToProject(cached.snapshot, cached.meta)
        return await writeProjectZip({
          name: name ?? cached.meta.name,
          settings: cached.meta.settings,
          diagram: project.diagram,
          products: project.products,
          scenes: project.scenes ?? [],
          // DB-side asset rows feed the writer directly — bypass
          // the AssetStore so the zip reflects what's actually
          // persisted, not what's hot in memory.
          resolveAsset: (hash) => {
            const a = byHash.get(hash)
            return a ? { hash: a.hash, ext: a.ext, blob: a.blob, url: '' } : undefined
          },
        })
      }
    }
    // Sample / detached: fall back to current in-memory state.
    return await writeProjectZip({
      name: name ?? sessionStore.projectName,
      diagram: diagramState.exportGraph(),
      products: [...productsStore.list],
      scenes: [...scenesStore.list],
    })
  },
  async autoArrange() {
    return commitAsync('Auto-arrange', async () => {
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
    })
  },

  // ----- Load pipeline ------------------------------------------------
  async applyYaml(yamlStr: string) {
    try {
      sessionStore.setStatus('Parsing YAML...')
      const fileMap = new Map<string, string>()
      fileMap.set('main.yaml', yamlStr)
      fileMap.set('./main.yaml', yamlStr)
      fileMap.set('/main.yaml', yamlStr)
      const resolver = createMemoryFileResolver(fileMap, '/')
      const hp = new HierarchicalParser(resolver)
      const parsed = (await hp.parse(yamlStr, '/main.yaml')).graph
      await diagramState.importProject({
        version: 1,
        name: 'YAML Import',
        products: [...productsStore.list],
        diagram: parsed,
        scenes: scenesStore.list.length > 0 ? [...scenesStore.list] : undefined,
      })
      sessionStore.setYamlSource(yamlStr)
    } catch (e) {
      sessionStore.setStatus(`Error: ${e instanceof Error ? e.message : String(e)}`)
    }
  },
  /**
   * Load a project. Accepts either an in-memory NetedProject (used
   * by sample / YAML paths) or a `.neted` zip blob (user import).
   * Returns the new project's id so the caller can navigate to it
   * — imported projects get a fresh `proj_<id>` and round-trip
   * through the IndexedDB cache so reload picks up where the user
   * left off.
   *
   * The asset reset has to bracket the zip read: clear the previous
   * project's blob URLs first, *then* let the reader register the
   * incoming ones. Calling reset later (e.g. inside `loadProject`)
   * would revoke the blobs the reader just created.
   */
  async importProject(input: NetedProject | Blob): Promise<string> {
    cache.reset()
    assetStore.reset()
    const data = input instanceof Blob ? await readProjectZip(input) : input
    const id = newId('proj')
    const now = Date.now()
    const meta = {
      id,
      name: data.name || 'Untitled',
      settings: data.settings,
      formatVersion: 1,
      createdAt: now,
      updatedAt: now,
    }
    // Write the imported project as one big snapshot, then persist
    // every asset the reader registered in memory under this proj.
    // `persistedAssetHashes` gets seeded here so the post-load sync
    // doesn't re-put what we just put. On any DB write failure
    // partway through, roll back so we don't leave half-imported
    // rows hanging under a `proj_id` no UI surfaces.
    try {
      await projectsDb.writeSnapshot(meta, projectToSnapshot(data))
      persistedAssetHashes = new Set()
      for (const entry of assetStore.list()) {
        await projectsDb.putAsset(id, entry.hash, entry.ext, entry.blob)
        persistedAssetHashes.add(entry.hash)
      }
      await diagramState.loadProject(id, data)
      return id
    } catch (err) {
      // Best-effort cleanup. If delete itself fails we'd rather
      // surface the original error than mask it.
      await projectsDb.deleteProject(id).catch(() => {})
      persistedAssetHashes = new Set()
      throw err
    }
  },
  async importDiagram(input: string | NetworkGraph): Promise<string> {
    const parsed: NetworkGraph = typeof input === 'string' ? JSON.parse(input) : input
    return await diagramState.importProject({
      version: 1,
      name: 'Diagram Import',
      products: [],
      diagram: parsed,
    })
  },
  /**
   * Create an empty project, persist it, and return its id. Used by
   * the home page's "New project" entry point.
   */
  async createNewProject(name = 'Untitled'): Promise<string> {
    const project: NetedProject = {
      version: 1,
      name,
      products: [],
      diagram: { version: '1', nodes: [], links: [], subgraphs: [] },
    }
    return await diagramState.importProject(project)
  },
  /** Delete a cached project (no in-memory side effects). */
  async deleteCachedProject(id: string): Promise<void> {
    await projectsDb.deleteProject(id)
  },
  /** Rename a cached project (DB only — caller still owns in-memory name). */
  async renameCachedProject(id: string, name: string): Promise<void> {
    await projectsDb.rename(id, name)
    if (sessionStore.projectId === id) sessionStore.setProjectName(name)
  },
  async loadProject(projectId: string, data?: Partial<NetedProject>) {
    // Layout `$effect` re-fires `loadProject(projectId)` on every
    // navigation tick. Skip the rebuild if the requested project
    // is already loaded.
    if (sessionStore.initialized && sessionStore.projectId === projectId && !data) return

    cache.reset()
    productsStore.set([])
    scenesStore.set([])
    scenesStore.setCurrentId(null)
    diagram.nodes.clear()
    diagram.ports.clear()
    diagram.edges.clear()
    diagram.subgraphs.clear()
    diagram.bounds = { x: 0, y: 0, width: 800, height: 600 }
    diagram.links = []
    // Reset image asset blobs (and the persisted-hashes set that
    // tracks them) only when the caller hasn't preloaded them.
    // `importProject(Blob)` extracts assets *before* getting here
    // so its `data` already references blob URLs we don't want to
    // revoke and has seeded the persisted set; sample / empty
    // paths have no assets to clear but any prior session's
    // assets should go.
    if (!data) {
      assetStore.reset()
      persistedAssetHashes = new Set()
    }
    sessionStore.setYamlSource('')
    sheetStore.setCurrentSheetId(null)
    sessionStore.setInitialized(false)
    sessionStore.setProjectId(projectId)

    try {
      // Resolution order:
      //   - explicit data wins (caller already parsed via importProject)
      //   - 'sample' loads the bundled sample (read-only, never cached)
      //   - anything else: read normalized rows for projectId from IDB
      let project: NetedProject | Partial<NetedProject> | null = data ?? null
      if (!project && projectId === 'sample') project = sampleProject
      if (!project && projectId !== 'sample') {
        sessionStore.setStatus('Loading from cache...')
        // Asset rows MUST be registered into the AssetStore before
        // we read the snapshot — `loadSnapshot` rehydrates each
        // entity's `asset:<hash>` refs back into blob URLs by
        // looking the hash up, and an empty store means every ref
        // gets left as a literal string. The visible symptom of
        // getting the order wrong: scene backgrounds and product
        // icons render as broken `<img>`.
        const assets = await projectsDb.getAssets(projectId)
        for (const a of assets) {
          assetStore.putWithHash(a.hash, a.ext, a.blob)
          persistedAssetHashes.add(a.hash)
        }
        const cached = await projectsDb.loadSnapshot(projectId)
        if (cached) {
          // Translate the persisted snapshot back into a NetedProject
          // so the existing applyProject pipeline (sanitize, port
          // placement, asset rehydration) handles it uniformly.
          project = snapshotToProject(cached.snapshot, cached.meta)
          sessionStore.setProjectName(cached.meta.name)
        }
      }
      if (project) {
        sessionStore.setStatus(projectId === 'sample' ? 'Loading sample...' : 'Loading project...')
        // applyProject runs sanitize, port placement, edge routing,
        // and the legacy `wireRoutes.controlPoints` migration —
        // each of which fires `commit()` and would otherwise emit
        // its own IDB write. Suspend the cache for the duration.
        //
        // The baseline for the post-load diff is `project` itself
        // (not the post-applyProject state): both DB-load and
        // import paths just put `project` into IDB, so any
        // mutations applyProject made over the top of it are the
        // delta we want persisted. Setting the baseline to
        // post-applyProject state would lose those mutations on
        // the very next drain.
        cache.suspend()
        try {
          await applyProject(project)
        } finally {
          lastSyncedSnap =
            projectId === 'sample' ? null : projectToSnapshot(project as NetedProject)
          cache.resume()
        }
        sessionStore.setProjectName((project as NetedProject).name ?? sessionStore.projectName)
      } else {
        lastSyncedSnap = null
      }
      sessionStore.setStatus('Ready')
      sessionStore.setInitialized(true)
    } catch (e) {
      sessionStore.setStatus(`Error: ${e instanceof Error ? e.message : String(e)}`)
    }
  },
}

// =========================================================================
// Cache sync — keep the IndexedDB mirror up-to-date with current
// state. After every commit we diff against the last-synced
// snapshot and write only the entities that actually changed.
// One IDB transaction per commit; commits are user-action grained,
// so the cost stays O(touched-rows) rather than O(project-size).
// =========================================================================

let lastSyncedSnap: ProjectSnapshot | null = null
/**
 * Hashes already persisted to IDB under the current project.
 * Initialized from `getAssets(projectId)` on load and updated as
 * sync writes new ones. Lets the sync loop skip the per-commit
 * "put every AssetStore entry" loop, which previously did a full
 * IDB roundtrip per asset on every commit.
 */
let persistedAssetHashes = new Set<string>()

const EMPTY_SNAP: ProjectSnapshot = {
  nodes: [],
  subgraphs: [],
  links: [],
  products: [],
  scenes: [],
}

function projectToSnapshot(data: NetedProject): ProjectSnapshot {
  const graph = data.diagram ?? { version: '1', nodes: [], links: [], subgraphs: [] }
  return {
    nodes: graph.nodes.map((n) => [n.id, n] as [string, Node]),
    subgraphs: (graph.subgraphs ?? []).map((sg) => [sg.id, sg] as [string, Subgraph]),
    links: graph.links,
    products: data.products ?? [],
    scenes: data.scenes ?? [],
  }
}

function snapshotToProject(
  snap: ProjectSnapshot,
  meta: { name: string; settings?: Record<string, unknown> },
): NetedProject {
  return {
    version: 1,
    name: meta.name,
    settings: meta.settings,
    products: snap.products,
    diagram: {
      version: '1',
      nodes: snap.nodes.map(([_id, n]) => n),
      links: snap.links,
      subgraphs: snap.subgraphs.map(([_id, sg]) => sg),
    },
    scenes: snap.scenes,
  }
}

cache.register(async () => {
  const id = sessionStore.projectId
  if (!id || id === 'sample') return
  const after = getProjectSnapshot()
  const before = lastSyncedSnap ?? EMPTY_SNAP
  const diff = diffSnapshots(before, after)
  // Persist only assets that aren't already in the per-project
  // `persistedAssetHashes` set. Previously we re-put every entry
  // on every commit; on a project with 10 raster icons that's 10
  // IDB writes for every node-position commit.
  for (const entry of assetStore.list()) {
    if (persistedAssetHashes.has(entry.hash)) continue
    await projectsDb.putAsset(id, entry.hash, entry.ext, entry.blob)
    persistedAssetHashes.add(entry.hash)
  }
  await applySync(id, diff)
  lastSyncedSnap = after
})

// ResolvedPort/ResolvedEdge type aliases used in the Map setter signatures
// — avoids re-importing the (lengthy) interfaces just for setters.
type ResolvedPortShim =
  ReturnType<typeof diagram.ports.values> extends IterableIterator<infer V> ? V : never
type ResolvedEdgeShim =
  ReturnType<typeof diagram.edges.values> extends IterableIterator<infer V> ? V : never

// =========================================================================
// Internal: load pipeline body
// =========================================================================

async function applyProject(data: Partial<NetedProject>) {
  // Loading is not undoable — clear history so the first user action
  // captures the loaded state as its baseline.
  undoManager.reset()
  await applyGraph(data.diagram ?? { version: '1', nodes: [], links: [] })
  const { products: cleanProducts, links: cleanLinks } = sanitizeProducts(
    data.products ?? [],
    diagram.nodes,
    diagram.links,
  )
  productsStore.set(
    cleanProducts.map((p) => {
      let next = p
      // Inherit icon from catalog if the saved product has none.
      if (!next.icon && next.catalogId) {
        const entry = catalog.lookup(next.catalogId)
        if (entry?.icon) next = { ...next, icon: entry.icon } as Product
      }
      // Materialize port snapshot for legacy projects saved before
      // Product.ports existed. New `addProduct` flow already populates
      // this; the shim only fires once on load.
      next = ensureProductSnapshot(next)
      return next
    }),
  )
  diagram.links = cleanLinks

  for (const [nodeId, node] of diagram.nodes) {
    if (!node.productId) continue
    const product = productsStore.find(node.productId)
    if (product?.kind !== 'device') continue
    if (product.icon && node.spec && node.spec.icon !== product.icon) {
      diagram.nodes.set(nodeId, { ...node, spec: { ...node.spec, icon: product.icon } })
    }
    setNodePortsFromProduct(nodeId, product, { preserveExisting: true, reroute: false })
  }
  replaceMap(
    diagram.ports,
    placePorts(diagram.nodes, diagram.links, data.diagram?.settings?.direction ?? 'TB'),
  )
  await rerouteEdges()

  const linkIdSet = new Set(diagram.links.map((l) => l.id).filter((id): id is string => !!id))
  // Migration must run BEFORE sanitize so the legacy `wireRoutes`
  // field (already stripped by sanitize) is still readable from
  // the raw input. addTerminationInScene needs the scene present
  // in scenesStore though, so we set sanitized first and then
  // migrate from the raw payload.
  scenesStore.set(sanitizeScenes(data.scenes ?? [], diagram.nodes, linkIdSet))
  scenesStore.setCurrentId(null)
  migrateLegacyWireRoutes(data.scenes ?? [])
}

/**
 * One-shot migration of legacy `Scene.wireRoutes[].controlPoints`
 * (anonymous absolute-coord bends) into bend Nodes spliced into
 * `Link.via`. The new model treats every transit point — bends
 * included — as a Node, so multi-drag / deletion / selection all
 * flow through Svelte Flow's native node machinery. The
 * `wireRoutes` field is gone from the Scene type; the migration
 * reads it via a loose cast on the raw input.
 */
type LegacyScene = {
  id: string
  wireRoutes?: Array<{ linkId: string; controlPoints?: Array<{ x: number; y: number }> }>
}

function migrateLegacyWireRoutes(rawScenes: unknown[]) {
  for (const raw of rawScenes) {
    const legacy = raw as LegacyScene
    const routes = legacy.wireRoutes
    if (!routes?.length) continue
    for (const route of routes) {
      const points = route.controlPoints
      if (!points?.length) continue
      const link = diagram.links.find((l) => l.id === route.linkId)
      if (!link) continue
      const newBendIds: string[] = []
      for (const pt of points) {
        const id = diagramState.addTerminationInScene(legacy.id, pt, 'bend')
        newBendIds.push(id)
      }
      // Bends go before any existing TPs in via — preserves the
      // visual order from before the migration where bends were
      // first-class waypoints.
      diagramState.updateLink(route.linkId, { via: [...newBendIds, ...(link.via ?? [])] })
    }
  }
}

async function applyGraph(graph: NetworkGraph) {
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
  diagram.bounds = boundsOfPositionedGraph(nodes, subgraphs)
  await rerouteEdges()
}

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

// =========================================================================
// Devtools window bindings
// =========================================================================

if (typeof window !== 'undefined' && import.meta.env.DEV) {
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

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
  resolvePosition,
  type Subgraph,
  type Theme,
} from '@shumoku/core'
import { SvelteMap } from 'svelte/reactivity'
import { analyzePoE } from './poe-analysis'
import { sampleProject } from './sample-project'
import { cableLengthMeters } from './scene/cable-length'
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
  WireRoute,
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

const poeBudgets = $derived(analyzePoE([...diagram.nodes.values()], diagram.links, catalog))

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

function nodeDisplayLabel(node: Node): string {
  return Array.isArray(node.label) ? node.label[0] : (node.label ?? node.id)
}

function endpointRequirementKey(link: Link, side: 'from' | 'to'): string | undefined {
  return link[side].plug?.module?.sku ?? link[side].plug?.module?.standard
}

function cableRequirementKey(link: Link): string | undefined {
  // Scene-derived length wins over the stored field — keeps BOM /
  // Materials Library in sync with the floor-plan polyline as the
  // user bends wires, without writing back to link.cable.length_m.
  // We also generate a row when only scene-derived length is known
  // (e.g. wire authored in scene before its cable type is filled in)
  // so BOM doesn't silently drop those wires.
  const eff = cableLengthMeters(link, scenesStore.list, diagram.nodes)
  const cable = link.cable
  if (!cable && !eff) return undefined
  const lengthLabel = eff
    ? `${eff.meters < 10 ? eff.meters.toFixed(1) : Math.round(eff.meters)}m`
    : cable?.length_m
      ? `${cable.length_m}m`
      : undefined
  const parts = [cable?.category, cable?.medium, lengthLabel].filter(Boolean)
  return parts.length > 0 ? parts.join(' / ') : undefined
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

// =========================================================================
// Node spec + port helpers — touch diagram + products
// =========================================================================

function setNodeSpecs(nodeIds: string[], spec: NodeSpec | undefined) {
  for (const id of new Set(nodeIds)) {
    const rn = diagram.nodes.get(id)
    if (rn) diagram.nodes.set(id, { ...rn, spec })
  }
}

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
  return ports.length > 0 ? ports.map((port) => ({ id: newId('port'), ...port })) : undefined
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
  if (inCommit || txActive) return fn()
  const before = getProjectSnapshot()
  inCommit = true
  try {
    const result = fn()
    undoManager.push(label, before)
    return result
  } finally {
    inCommit = false
  }
}

async function commitAsync<T>(label: string, fn: () => Promise<T>): Promise<T> {
  if (inCommit || txActive) return await fn()
  const before = getProjectSnapshot()
  inCommit = true
  try {
    const result = await fn()
    undoManager.push(label, before)
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
    commit('Add product', () => productsStore.add(entry))
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
      productsStore.update(id, updates)
      const product = productsStore.find(id)
      const iconChanged = 'icon' in updates
      const specChanged = !!updates.spec
      const propsChanged = 'properties' in updates || !!updates.catalogId
      if (product?.kind === 'device' && (specChanged || propsChanged || iconChanged)) {
        const boundNodeIds: string[] = []
        for (const [nodeId, node] of diagram.nodes) {
          if (node.productId === id) boundNodeIds.push(nodeId)
        }
        if (boundNodeIds.length > 0) {
          if (specChanged || iconChanged) {
            const nextSpec = product.icon ? { ...product.spec, icon: product.icon } : product.spec
            setNodeSpecs(boundNodeIds, nextSpec)
          }
          if (specChanged || propsChanged) {
            for (const nodeId of boundNodeIds) setNodePortsFromProduct(nodeId, product)
          }
        }
      }
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
        ports: nodePortsFromProduct(product),
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
    const existing = scenesStore.list.find((s) => s.scopeSubgraphId === scopeSubgraphId)
    if (existing) {
      scenesStore.setCurrentId(existing.id)
      return
    }
    commit('Open scene', () => {
      const sg = scopeSubgraphId ? diagram.subgraphs.get(scopeSubgraphId) : undefined
      const name = sg?.label ?? 'Root'
      const scene: Scene = {
        id: newId('scene'),
        name,
        nodePlacements: [],
        wireRoutes: [],
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
  removePlacementFromScene(sceneId: string, nodeId: string) {
    commit('Remove placement', () => {
      scenesStore.removePlacement(sceneId, nodeId, (linkId) => {
        const link = diagram.links.find((l) => l.id === linkId)
        if (!link) return false
        return link.from.node !== nodeId && link.to.node !== nodeId
      })
    })
  },
  setWireRoute(sceneId: string, route: WireRoute) {
    commit('Route wire', () => scenesStore.setWireRoute(sceneId, route))
  },
  removeWireFromScene(sceneId: string, linkId: string) {
    commit('Remove wire route', () => scenesStore.removeWireRoute(sceneId, linkId))
  },
  hideNodeInScene(sceneId: string, nodeId: string) {
    commit('Hide node', () => {
      scenesStore.hideNode(sceneId, nodeId, (linkId) => {
        const link = diagram.links.find((l) => l.id === linkId)
        if (!link) return false
        return link.from.node !== nodeId && link.to.node !== nodeId
      })
    })
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
  addWireInScene(
    sceneId: string,
    fromNodeId: string,
    toNodeId: string,
    options?: { pathStyle?: WireRoute['pathStyle']; controlPoints?: WireRoute['controlPoints'] },
  ): string | undefined {
    return commit('Add wire', () => {
      const fromNode = diagram.nodes.get(fromNodeId)
      const toNode = diagram.nodes.get(toNodeId)
      if (!fromNode || !toNode) return undefined
      const linkId = newId('link')
      // Init an empty cable record so the BOM / detail panel pick the
      // wire up immediately. Type/grade/length stay unset; the user
      // (or scene-derived length) fills them in afterward.
      diagramState.addLink({
        id: linkId,
        from: { node: fromNodeId, port: '' },
        to: { node: toNodeId, port: '' },
        cable: {},
      })
      diagramState.setWireRoute(sceneId, {
        linkId,
        pathStyle: options?.pathStyle ?? 'orthogonal',
        controlPoints: options?.controlPoints,
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
    if (changed) undoManager.push(label, snap)
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
  exportProject(name = 'Untitled'): string {
    const project: NetedProject = {
      version: 3,
      name,
      products: [...productsStore.list],
      diagram: diagramState.exportGraph(),
      scenes: scenesStore.list.length > 0 ? [...scenesStore.list] : undefined,
    }
    return JSON.stringify(project, null, 2)
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
        version: 3,
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
  async importProject(input: string | NetedProject) {
    const data = typeof input === 'string' ? JSON.parse(input) : input
    await diagramState.loadProject('imported', data)
  },
  async importDiagram(input: string | NetworkGraph) {
    const parsed: NetworkGraph = typeof input === 'string' ? JSON.parse(input) : input
    await diagramState.importProject({
      version: 3,
      name: 'Diagram Import',
      products: [...productsStore.list],
      diagram: parsed,
      scenes: scenesStore.list.length > 0 ? [...scenesStore.list] : undefined,
    })
  },
  async loadProject(projectId: string, data?: Partial<NetedProject>) {
    if (projectId === 'imported' && sessionStore.initialized && !data) return

    productsStore.set([])
    scenesStore.set([])
    scenesStore.setCurrentId(null)
    diagram.nodes.clear()
    diagram.ports.clear()
    diagram.edges.clear()
    diagram.subgraphs.clear()
    diagram.bounds = { x: 0, y: 0, width: 800, height: 600 }
    diagram.links = []
    sessionStore.setYamlSource('')
    sheetStore.setCurrentSheetId(null)
    sessionStore.setInitialized(false)

    try {
      const project = data ?? (projectId === 'sample' ? sampleProject : null)
      if (project) {
        sessionStore.setStatus(
          projectId === 'sample'
            ? 'Loading sample...'
            : projectId === 'imported'
              ? 'Loading project...'
              : 'Loading...',
        )
        await applyProject(project)
      }
      sessionStore.setStatus('Ready')
      sessionStore.setInitialized(true)
    } catch (e) {
      sessionStore.setStatus(`Error: ${e instanceof Error ? e.message : String(e)}`)
    }
  },
}

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
      if (p.icon || !p.catalogId) return p
      const entry = catalog.lookup(p.catalogId)
      return entry?.icon ? ({ ...p, icon: entry.icon } as Product) : p
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
  scenesStore.set(sanitizeScenes(data.scenes ?? [], diagram.nodes, linkIdSet))
  scenesStore.setCurrentId(null)
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

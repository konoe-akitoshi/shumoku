import { builtinEntries, Catalog } from '@shumoku/catalog'
import {
  collectObstacles,
  computeNetworkLayout,
  computeNodeSize,
  createMemoryFileResolver,
  darkTheme,
  HierarchicalParser,
  type Link,
  lightTheme,
  type NodeSpec,
  type ResolvedEdge,
  type ResolvedLayout,
  type ResolvedNode,
  type ResolvedPort,
  type ResolvedSubgraph,
  resolvePosition,
  sampleNetwork,
  type Theme,
} from '@shumoku/core'
import { nanoid } from 'nanoid'
import { analyzePoE, type PoEBudget } from './poe-analysis'
import { sampleBomItems, samplePalette } from './sample-project'
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

let nodes = $state<Map<string, ResolvedNode>>(new Map())
let ports = $state<Map<string, ResolvedPort>>(new Map())
let edges = $state<Map<string, ResolvedEdge>>(new Map())
let subgraphs = $state<Map<string, ResolvedSubgraph>>(new Map())
let bounds = $state({ x: 0, y: 0, width: 0, height: 0 })
let links = $state<Link[]>([])
let poeBudgets = $state<PoEBudget[]>([])
let palette = $state<SpecPaletteEntry[]>([])
let bomItems = $state<BomItem[]>([])
let status = $state('Loading...')
let yamlSource = $state('')
let initialized = $state(false)

const catalog = new Catalog()
catalog.registerAll(builtinEntries)

/** Update spec on multiple nodes at once (Palette → Node propagation) */
function setNodeSpecs(nodeIds: string[], spec: NodeSpec | undefined) {
  const ids = new Set(nodeIds)
  const n = new Map(nodes)
  let changed = false
  for (const id of ids) {
    const rn = n.get(id)
    if (rn) {
      n.set(id, { ...rn, node: { ...rn.node, spec } })
      changed = true
    }
  }
  if (changed) nodes = n
}

/** Strip product details from spec, keep kind/type (role) */
function stripProductFromSpec(spec: NodeSpec | undefined): NodeSpec | undefined {
  if (!spec) return undefined
  if (spec.kind === 'hardware') return { kind: 'hardware', type: spec.type }
  if (spec.kind === 'compute') return { kind: 'compute', type: spec.type }
  if (spec.kind === 'service') return { kind: 'service', service: spec.service }
  return undefined
}

export const diagramState = {
  get nodes() {
    return nodes
  },
  set nodes(v: Map<string, ResolvedNode>) {
    nodes = v
  },
  get ports() {
    return ports
  },
  set ports(v: Map<string, ResolvedPort>) {
    ports = v
  },
  get edges() {
    return edges
  },
  set edges(v: Map<string, ResolvedEdge>) {
    edges = v
  },
  get subgraphs() {
    return subgraphs
  },
  set subgraphs(v: Map<string, ResolvedSubgraph>) {
    subgraphs = v
  },
  get bounds() {
    return bounds
  },
  set bounds(v: { x: number; y: number; width: number; height: number }) {
    bounds = v
  },
  get links() {
    return links
  },
  set links(v: Link[]) {
    links = v
  },
  addLink(link: Link) {
    links = [...links, link]
  },
  updateLink(id: string, updates: Partial<Link>) {
    links = links.map((l) => (l.id === id ? { ...l, ...updates } : l))
  },
  removeLink(id: string) {
    links = links.filter((l) => l.id !== id)
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
    return { nodes: nodes.size, links: links.length, subgraphs: subgraphs.size }
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
      const n = new Map(nodes)
      const p = new Map(ports)
      n.delete(nodeId)
      for (const [portId, port] of p) {
        if (port.nodeId === nodeId) p.delete(portId)
      }
      nodes = n
      ports = p
      links = links.filter((l) => {
        const from = typeof l.from === 'string' ? l.from : l.from.node
        const to = typeof l.to === 'string' ? l.to : l.to.node
        return from !== nodeId && to !== nodeId
      })
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
    const n = new Map(nodes)
    for (const nodeId of ids) {
      const rn = n.get(nodeId)
      if (rn) {
        n.set(nodeId, { ...rn, node: { ...rn.node, spec: stripProductFromSpec(rn.node.spec) } })
      }
    }
    nodes = n
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
        const id = nanoid()
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

    const id = `node-${Date.now()}`
    const label = paletteEntryLabel(entry)
    const spec = entry.spec
    const { width: w, height: h } = computeNodeSize({ label, spec })
    const obstacles = collectObstacles(id, undefined, nodes, subgraphs)
    const pos = resolvePosition(
      { x: bounds.x + bounds.width + 40 + w / 2, y: bounds.y + bounds.height / 2, w, h },
      obstacles,
    )

    const n = new Map(nodes)
    n.set(id, {
      id,
      position: pos,
      size: { width: w, height: h },
      node: { id, label, spec, shape: 'rounded' },
    })
    nodes = n
    // Bind BomItem to the new node
    bomItems = bomItems.map((i) => (i.id === bomId ? { ...i, nodeId: id } : i))
    return id
  },

  // Serialization — .neted.json format
  /** Export project as NetedProject JSON string */
  exportProject(name = 'Untitled'): string {
    const project: NetedProject = {
      version: 1,
      name,
      palette: [...palette],
      bom: [...bomItems],
      connections: [...links],
      diagram: {
        nodes: Object.fromEntries(new Map(nodes)),
        ports: Object.fromEntries(new Map(ports)),
        edges: Object.fromEntries(new Map(edges)),
        subgraphs: Object.fromEntries(new Map(subgraphs)),
        bounds: { ...bounds },
      },
    }
    return JSON.stringify(project, null, 2)
  },

  /** Import project from NetedProject JSON string */
  importProject(jsonStr: string) {
    const data = JSON.parse(jsonStr)

    // Support both .neted.json (v1) and legacy diagram.json
    if (data.version === 1) {
      // NetedProject format
      palette = data.palette ?? []
      bomItems = data.bom ?? []
      links = data.connections ?? []
      const d = data.diagram ?? {}
      nodes = new Map(Object.entries(d.nodes ?? {})) as Map<string, ResolvedNode>
      ports = new Map(Object.entries(d.ports ?? {})) as Map<string, ResolvedPort>
      edges = new Map(Object.entries(d.edges ?? {})) as Map<string, ResolvedEdge>
      subgraphs = new Map(Object.entries(d.subgraphs ?? {})) as Map<string, ResolvedSubgraph>
      bounds = d.bounds ?? { x: 0, y: 0, width: 800, height: 600 }
    } else {
      // Legacy format: { layout: {...}, links: [...] }
      const layout = data.layout ?? data.diagram ?? {}
      nodes = new Map(Object.entries(layout.nodes ?? {})) as Map<string, ResolvedNode>
      ports = new Map(Object.entries(layout.ports ?? {})) as Map<string, ResolvedPort>
      edges = new Map(Object.entries(layout.edges ?? {})) as Map<string, ResolvedEdge>
      subgraphs = new Map(Object.entries(layout.subgraphs ?? {})) as Map<string, ResolvedSubgraph>
      bounds = layout.bounds ?? { x: 0, y: 0, width: 800, height: 600 }
      links = data.links ?? data.connections ?? []
      // Legacy: no palette/bom
      palette = []
      bomItems = []
    }
    poeBudgets = analyzePoE(
      [...nodes.values()].map((rn) => rn.node),
      links,
      catalog,
    )
    status = 'Ready'
  },

  loadFromResolved(resolved: ResolvedLayout, graphLinks: Link[]) {
    nodes = new Map(resolved.nodes)
    ports = new Map(resolved.ports)
    edges = new Map(resolved.edges)
    subgraphs = new Map(resolved.subgraphs)
    bounds = resolved.bounds
    links = [...graphLinks]
  },

  /** Load a project by ID. Resets all state first. */
  async loadProject(projectId: string) {
    // Reset all state
    palette = []
    bomItems = []
    nodes = new Map()
    ports = new Map()
    edges = new Map()
    subgraphs = new Map()
    bounds = { x: 0, y: 0, width: 800, height: 600 }
    links = []
    poeBudgets = []
    yamlSource = ''
    initialized = false

    if (projectId === 'sample') {
      // Load sample project data
      palette = [...samplePalette]
      bomItems = [...sampleBomItems]

      try {
        status = 'Loading sample...'
        const fileMap = new Map<string, string>()
        for (const f of sampleNetwork) {
          fileMap.set(f.name, f.content)
          fileMap.set(`./${f.name}`, f.content)
          fileMap.set(`/${f.name}`, f.content)
        }
        const resolver = createMemoryFileResolver(fileMap, '/')
        const hp = new HierarchicalParser(resolver)
        const mainFile = sampleNetwork.find((f) => f.name === 'main.yaml')
        if (!mainFile) throw new Error('main.yaml not found')
        const g = (await hp.parse(mainFile.content, '/main.yaml')).graph

        const { resolved } = await computeNetworkLayout(g)
        diagramState.loadFromResolved(resolved, g.links)
        poeBudgets = analyzePoE(g.nodes, g.links, catalog)
        const mf = sampleNetwork.find((f) => f.name === 'main.yaml')
        if (mf) yamlSource = mf.content
        status = 'Ready'
      } catch (e) {
        status = `Error: ${e instanceof Error ? e.message : String(e)}`
      }
    } else {
      // Empty project (or future: load from DB by ID)
      status = 'Ready'
    }

    initialized = true
  },

  async applyYaml(yamlStr: string) {
    try {
      status = 'Parsing YAML...'
      const fileMap = new Map<string, string>()
      fileMap.set('main.yaml', yamlStr)
      fileMap.set('./main.yaml', yamlStr)
      fileMap.set('/main.yaml', yamlStr)
      const resolver = createMemoryFileResolver(fileMap, '/')
      const hp = new HierarchicalParser(resolver)
      const g = (await hp.parse(yamlStr, '/main.yaml')).graph
      const { resolved } = await computeNetworkLayout(g)
      diagramState.loadFromResolved(resolved, g.links)
      poeBudgets = analyzePoE(g.nodes, g.links, catalog)
      yamlSource = yamlStr
      status = 'Ready'
    } catch (e) {
      status = `Error: ${e instanceof Error ? e.message : String(e)}`
    }
  },
}

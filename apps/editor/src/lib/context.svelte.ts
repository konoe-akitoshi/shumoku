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
  type NetworkGraph,
  type Node,
  type NodeSpec,
  type ResolvedEdge,
  type ResolvedLayout,
  type ResolvedNode,
  type ResolvedPort,
  type ResolvedSubgraph,
  resolvePosition,
  routeEdges,
  type Subgraph,
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

// The diagram object — single source of truth for the renderer's JSON
const diagram = $state({
  nodes: new Map<string, ResolvedNode>(),
  ports: new Map<string, ResolvedPort>(),
  edges: new Map<string, ResolvedEdge>(),
  subgraphs: new Map<string, ResolvedSubgraph>(),
  bounds: { x: 0, y: 0, width: 0, height: 0 },
  links: [] as Link[],
})

let poeBudgets = $state<PoEBudget[]>([])
let palette = $state<SpecPaletteEntry[]>([])
let bomItems = $state<BomItem[]>([])
let status = $state('Loading...')
let yamlSource = $state('')
let initialized = $state(false)

// Edge routing: generation counter prevents stale async results
let routeGeneration = 0

/** Recompute edges from current nodes/ports/links (async WASM) */
async function rerouteEdges() {
  const gen = ++routeGeneration
  const result = await routeEdges(diagram.nodes, diagram.ports, diagram.links)
  if (gen === routeGeneration) {
    diagram.edges = result
  }
}

const catalog = new Catalog()
catalog.registerAll(builtinEntries)

/** Update spec on multiple nodes at once (Palette → Node propagation) */
function setNodeSpecs(nodeIds: string[], spec: NodeSpec | undefined) {
  const ids = new Set(nodeIds)
  const n = new Map(diagram.nodes)
  let changed = false
  for (const id of ids) {
    const rn = n.get(id)
    if (rn) {
      n.set(id, { ...rn, node: { ...rn.node, spec } })
      changed = true
    }
  }
  if (changed) diagram.nodes = n
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
  // Diagram — individual accessors for $bindable compat
  get nodes() {
    return diagram.nodes
  },
  set nodes(v: Map<string, ResolvedNode>) {
    diagram.nodes = v
  },
  get ports() {
    return diagram.ports
  },
  set ports(v: Map<string, ResolvedPort>) {
    diagram.ports = v
  },
  get edges() {
    return diagram.edges
  },
  set edges(v: Map<string, ResolvedEdge>) {
    diagram.edges = v
  },
  get subgraphs() {
    return diagram.subgraphs
  },
  set subgraphs(v: Map<string, ResolvedSubgraph>) {
    diagram.subgraphs = v
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
      const n = new Map(diagram.nodes)
      const p = new Map(diagram.ports)
      n.delete(nodeId)
      for (const [portId, port] of p) {
        if (port.nodeId === nodeId) p.delete(portId)
      }
      diagram.nodes = n
      diagram.ports = p
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
    const n = new Map(diagram.nodes)
    for (const nodeId of ids) {
      const rn = n.get(nodeId)
      if (rn) {
        n.set(nodeId, { ...rn, node: { ...rn.node, spec: stripProductFromSpec(rn.node.spec) } })
      }
    }
    diagram.nodes = n
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

    const n = new Map(diagram.nodes)
    n.set(id, {
      id,
      position: pos,
      size: { width: w, height: h },
      node: { id, label, spec, shape: 'rounded' },
    })
    diagram.nodes = n
    // Bind BomItem to the new node
    bomItems = bomItems.map((i) => (i.id === bomId ? { ...i, nodeId: id } : i))
    return id
  },

  // NetworkGraph — canonical save/load format
  /** Export as NetworkGraph (ResolvedNode → Node with position) */
  exportGraph(): NetworkGraph {
    const graphNodes: Node[] = [...diagram.nodes.values()].map((rn) => ({
      ...rn.node,
      position: rn.position,
    }))
    const graphSubgraphs: Subgraph[] = [...diagram.subgraphs.values()].map((rs) => rs.subgraph)
    return {
      version: '1',
      nodes: graphNodes,
      links: [...diagram.links],
      subgraphs: graphSubgraphs,
    }
  },
  /** Import from NetworkGraph (Node with position → ResolvedNode, recompute ports/edges) */
  async importGraph(graph: NetworkGraph) {
    const nodes = new Map<string, ResolvedNode>()
    for (const node of graph.nodes) {
      const size = computeNodeSize(node)
      nodes.set(node.id, {
        id: node.id,
        position: node.position ?? { x: 0, y: 0 },
        size,
        node,
      })
    }
    const subgraphs = new Map<string, ResolvedSubgraph>()
    for (const sg of graph.subgraphs ?? []) {
      subgraphs.set(sg.id, {
        id: sg.id,
        bounds: { x: 0, y: 0, width: 200, height: 120 },
        subgraph: sg,
      })
    }
    diagram.nodes = nodes
    diagram.subgraphs = subgraphs
    diagram.links = graph.links ?? []
    // Ports and edges are derived — recompute
    diagram.ports = new Map()
    await rerouteEdges()
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

  /** Import project from NetedProject JSON string */
  async importProject(jsonStr: string) {
    const data = JSON.parse(jsonStr)
    palette = data.palette ?? []
    bomItems = data.bom ?? []
    await diagramState.importGraph(data.diagram ?? { version: '1', nodes: [], links: [] })
    poeBudgets = analyzePoE(
      [...diagram.nodes.values()].map((rn) => rn.node),
      diagram.links,
      catalog,
    )
    status = 'Ready'
  },

  loadFromResolved(resolved: ResolvedLayout, graphLinks: Link[]) {
    diagram.nodes = new Map(resolved.nodes)
    diagram.ports = new Map(resolved.ports)
    diagram.edges = new Map(resolved.edges)
    diagram.subgraphs = new Map(resolved.subgraphs)
    diagram.bounds = resolved.bounds
    diagram.links = [...graphLinks]
  },

  /** Load a project by ID. Resets all state first. */
  async loadProject(projectId: string) {
    // Reset all state
    palette = []
    bomItems = []
    diagram.nodes = new Map()
    diagram.ports = new Map()
    diagram.edges = new Map()
    diagram.subgraphs = new Map()
    diagram.bounds = { x: 0, y: 0, width: 800, height: 600 }
    diagram.links = []
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

import { builtinEntries, Catalog } from '@shumoku/catalog'
import {
  computeNetworkLayout,
  createMemoryFileResolver,
  darkTheme,
  HierarchicalParser,
  type Link,
  lightTheme,
  type ResolvedEdge,
  type ResolvedLayout,
  type ResolvedNode,
  type ResolvedPort,
  type ResolvedSubgraph,
  sampleNetwork,
  type Theme,
} from '@shumoku/core'
import { analyzePoE, type PoEBudget } from './poe-analysis'
import { sampleBomItems, samplePalette } from './sample-project'
import type { BomItem, SpecPaletteEntry } from './types'

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
    palette = palette.filter((e) => e.id !== id)
    bomItems = bomItems.filter((i) => i.paletteId !== id)
  },
  updatePaletteEntry(id: string, updates: Partial<SpecPaletteEntry>) {
    palette = palette.map((e) => (e.id === id ? { ...e, ...updates } : e))
  },

  // BOM items (device instances — master for qty management)
  get bomItems() {
    return bomItems
  },
  addBomItem(item: BomItem) {
    bomItems = [...bomItems, item]
  },
  removeBomItem(id: string) {
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

  // Serialization
  stateToJson(): string {
    return JSON.stringify(
      {
        layout: {
          nodes: Object.fromEntries(new Map(nodes)),
          ports: Object.fromEntries(new Map(ports)),
          edges: Object.fromEntries(new Map(edges)),
          subgraphs: Object.fromEntries(new Map(subgraphs)),
          bounds: { ...bounds },
        },
        links: [...links],
      },
      null,
      2,
    )
  },

  loadFromJson(jsonStr: string) {
    const data = JSON.parse(jsonStr)
    nodes = new Map(Object.entries(data.layout?.nodes ?? {})) as Map<string, ResolvedNode>
    ports = new Map(Object.entries(data.layout?.ports ?? {})) as Map<string, ResolvedPort>
    edges = new Map(Object.entries(data.layout?.edges ?? {})) as Map<string, ResolvedEdge>
    subgraphs = new Map(Object.entries(data.layout?.subgraphs ?? {})) as Map<
      string,
      ResolvedSubgraph
    >
    bounds = data.layout?.bounds ?? { x: 0, y: 0, width: 800, height: 600 }
    links = data.links ?? []
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

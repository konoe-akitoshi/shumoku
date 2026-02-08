<script lang="ts">
import { onMount } from 'svelte'
import { page } from '$app/stores'
import { goto } from '$app/navigation'
import { api } from '$lib/api'
import { Button } from '$lib/components/ui/button'
import {
  displaySettings,
  metricsConnected,
  liveUpdatesEnabled,
  showTrafficFlow,
  showNodeStatus,
  mappingStore,
  mappingLoading,
  mappingError,
  nodeMapping,
  linkMapping,
  mappingHosts,
  hostInterfaces,
  hostInterfacesLoading,
} from '$lib/stores'
import type {
  Topology,
  TopologyDataSource,
  TopologyDataSourceInput,
  DataSource,
  SyncMode,
  ParsedTopologyResponse,
} from '$lib/types'
import ArrowLeft from 'phosphor-svelte/lib/ArrowLeft'
import PencilSimple from 'phosphor-svelte/lib/PencilSimple'
import Trash from 'phosphor-svelte/lib/Trash'
import Plus from 'phosphor-svelte/lib/Plus'
import ArrowsClockwise from 'phosphor-svelte/lib/ArrowsClockwise'
import Copy from 'phosphor-svelte/lib/Copy'
import CheckCircle from 'phosphor-svelte/lib/CheckCircle'
import FloppyDisk from 'phosphor-svelte/lib/FloppyDisk'
import MagnifyingGlass from 'phosphor-svelte/lib/MagnifyingGlass'
import Lightning from 'phosphor-svelte/lib/Lightning'
import ArrowRight from 'phosphor-svelte/lib/ArrowRight'
import Star from 'phosphor-svelte/lib/Star'
import ArrowDown from 'phosphor-svelte/lib/ArrowDown'

// ============================================
// State
// ============================================

let topologyId = $derived($page.params.id!)

// Tab state - check URL hash for initial tab
let activeTab = $state<'general' | 'sources' | 'mapping'>('general')

// General data
let topology = $state<Topology | null>(null)
let loading = $state(true)
let error = $state('')
let deleting = $state(false)
let renderData = $state<{ nodeCount: number; edgeCount: number } | null>(null)

// Edge style settings
let edgeStyle = $state('orthogonal')
let splineMode = $state('sloppy')
let savingEdgeStyle = $state(false)

// Sources state
let currentSources = $state<TopologyDataSource[]>([])
let editableSources = $state<TopologyDataSourceInput[]>([])
let topologyDataSources = $state<DataSource[]>([])
let metricsDataSources = $state<DataSource[]>([])
let savingSources = $state(false)
let hasSourceChanges = $state(false)
let syncing = $state(false)
let syncResult = $state<{ nodeCount: number; linkCount: number } | null>(null)
let copiedSecret = $state<string | null>(null)

// Filter options cache
let filterOptionsCache = $state<Record<string, {
  sites: { slug: string; name: string }[]
  tags: { slug: string; name: string }[]
  roles?: { slug: string; name: string }[]
}>>({})
let filterOptionsLoading = $state<Record<string, boolean>>({})

// Merge state
let baseSourceId = $state<string | null>(null)
let overlayConfigs = $state<Record<string, OverlayConfig>>({})
let hasMergeChanges = $state(false)

// Mapping state
let parsedTopology = $state<ParsedTopologyResponse | null>(null)
let savingMapping = $state(false)
let nodeSearchQuery = $state('')
let autoMapResult = $state<{ matched: number; total: number } | null>(null)

interface EdgeData {
  id: string
  from: { nodeId: string; port?: string }
  to: { nodeId: string; port?: string }
  bandwidth?: string
}
let edges = $state<EdgeData[]>([])

// ============================================
// Types
// ============================================

type MergeMatchStrategy = 'id' | 'name' | 'attribute' | 'manual'
type MergeMergeStrategy = 'merge-properties' | 'keep-base' | 'keep-overlay'
type MergeUnmatchedStrategy = 'add-to-root' | 'add-to-subgraph' | 'ignore'

interface OverlayConfig {
  match: MergeMatchStrategy
  matchAttribute?: string
  idMapping?: Record<string, string>
  onMatch: MergeMergeStrategy
  onUnmatched: MergeUnmatchedStrategy
  subgraphName?: string
}

interface MergeConfig {
  isBase?: boolean
  match?: MergeMatchStrategy
  matchAttribute?: string
  idMapping?: Record<string, string>
  onMatch?: MergeMergeStrategy
  onUnmatched?: MergeUnmatchedStrategy
  subgraphName?: string
}

interface NetBoxOptions {
  groupBy?: string
  siteFilter?: string[]
  tagFilter?: string[]
  roleFilter?: string[]
  excludeRoleFilter?: string[]
  excludeTagFilter?: string[]
}

// ============================================
// Derived
// ============================================

let metricsSourceId = $derived($mappingStore.metricsSourceId)
let hasMetricsSource = $derived(!!metricsSourceId)

let topologySources = $derived(editableSources.filter(s => s.purpose === 'topology'))
let metricsSources = $derived(editableSources.filter(s => s.purpose === 'metrics'))
let hasMultipleTopologySources = $derived(topologySources.length >= 2)

let overlaySources = $derived(currentSources.filter(s => s.purpose === 'topology' && s.dataSourceId !== baseSourceId))

let filteredNodes = $derived(
  parsedTopology?.graph.nodes.filter(node => {
    if (!nodeSearchQuery) return true
    const label = getNodeLabel(node).toLowerCase()
    return label.includes(nodeSearchQuery.toLowerCase())
  }) || []
)

let mappedCount = $derived(
  parsedTopology?.graph.nodes.filter(n => $nodeMapping[n.id]?.hostId).length || 0
)
let totalNodes = $derived(parsedTopology?.graph.nodes.length || 0)
let mappedLinksCount = $derived(
  edges.filter(e => {
    const m = $linkMapping[e.id]
    return m?.monitoredNodeId && m?.interface
  }).length
)
let totalLinks = $derived(edges.length)

// ============================================
// Lifecycle
// ============================================

onMount(async () => {
  // Check URL hash for initial tab
  const hash = window.location.hash.slice(1)
  if (hash === 'sources' || hash === 'mapping') {
    activeTab = hash
  }

  await loadData()
})

async function loadData() {
  try {
    const [topoData, renderResponse, sources, topoSources, metricsSrcs] = await Promise.all([
      api.topologies.get(topologyId),
      fetch(`/api/topologies/${topologyId}/render`).then(r => r.json()),
      api.topologies.sources.list(topologyId),
      api.dataSources.listByCapability('topology'),
      api.dataSources.listByCapability('metrics'),
    ])

    topology = topoData
    renderData = { nodeCount: renderResponse.nodeCount, edgeCount: renderResponse.edgeCount }
    currentSources = sources
    topologyDataSources = topoSources
    metricsDataSources = metricsSrcs

    // Parse graph settings
    parseGraphSettings()

    // Initialize editable sources
    editableSources = sources.map(s => ({
      dataSourceId: s.dataSourceId,
      purpose: s.purpose,
      syncMode: s.syncMode,
      priority: s.priority,
      optionsJson: s.optionsJson,
    }))

    // Load filter options for NetBox sources
    for (const s of editableSources) {
      loadFilterOptions(s.dataSourceId)
    }

    // Initialize merge state
    for (const source of sources.filter(s => s.purpose === 'topology')) {
      const config = parseMergeConfig(source.optionsJson)
      if (config.isBase) {
        baseSourceId = source.dataSourceId
      } else {
        overlayConfigs[source.dataSourceId] = {
          match: config.match || 'name',
          matchAttribute: config.matchAttribute,
          idMapping: config.idMapping,
          onMatch: config.onMatch || 'merge-properties',
          onUnmatched: config.onUnmatched || 'add-to-subgraph',
          subgraphName: config.subgraphName,
        }
      }
    }

    if (!baseSourceId && sources.filter(s => s.purpose === 'topology').length > 0) {
      baseSourceId = sources.find(s => s.purpose === 'topology')?.dataSourceId || null
    }

    // Load mapping data
    await loadMappingData()
  } catch (e) {
    error = e instanceof Error ? e.message : 'Failed to load topology'
  } finally {
    loading = false
  }
}

async function loadMappingData() {
  try {
    await mappingStore.load(topologyId, false)
    const contextData = await api.topologies.getContext(topologyId)
    edges = contextData.edges
    parsedTopology = {
      id: contextData.id,
      name: contextData.name,
      graph: {
        nodes: contextData.nodes.map(n => ({
          id: n.id,
          label: n.label,
          type: n.type,
          vendor: n.vendor,
        })),
        links: contextData.edges.map(e => ({
          id: e.id,
          from: e.from.nodeId,
          to: e.to.nodeId,
          bandwidth: e.bandwidth,
        })),
      },
      layout: { nodes: {} },
      metrics: contextData.metrics,
      dataSourceId: contextData.dataSourceId,
      mapping: contextData.mapping,
    }
    loadInterfacesForMappedNodes()
  } catch {
    // Mapping may not be available
  }
}

// ============================================
// General Tab Functions
// ============================================

function parseGraphSettings() {
  try {
    const graph = JSON.parse(topology?.contentJson || '{}')
    edgeStyle = graph.settings?.edgeStyle || 'orthogonal'
    splineMode = graph.settings?.splineMode || 'sloppy'
  } catch {
    // Use defaults
  }
}

async function updateEdgeStyle() {
  if (!topology) return
  savingEdgeStyle = true
  try {
    const graph = JSON.parse(topology.contentJson)
    graph.settings = graph.settings || {}
    graph.settings.edgeStyle = edgeStyle
    if (edgeStyle === 'splines') {
      graph.settings.splineMode = splineMode
    } else {
      delete graph.settings.splineMode
    }
    const updated = await api.topologies.update(topology.id, { contentJson: JSON.stringify(graph) })
    if (updated) topology = updated
  } catch (e) {
    console.error('Failed to update edge style:', e)
  } finally {
    savingEdgeStyle = false
  }
}

async function handleDelete() {
  if (!topology) return
  if (!confirm(`Delete topology "${topology.name}"? This action cannot be undone.`)) return
  deleting = true
  try {
    await api.topologies.delete(topology.id)
    goto('/topologies')
  } catch (e) {
    alert(e instanceof Error ? e.message : 'Failed to delete')
    deleting = false
  }
}

// ============================================
// Sources Tab Functions
// ============================================

function getDataSource(id: string): DataSource | undefined {
  return [...topologyDataSources, ...metricsDataSources].find(ds => ds.id === id)
}

function getCurrentSource(dataSourceId: string, purpose: string): TopologyDataSource | undefined {
  return currentSources.find(s => s.dataSourceId === dataSourceId && s.purpose === purpose)
}

function getSourcesByPurpose(purpose: 'topology' | 'metrics') {
  return editableSources.map((s, index) => ({ ...s, index })).filter(s => s.purpose === purpose)
}

function addSource(purpose: 'topology' | 'metrics') {
  const availableSources = purpose === 'topology' ? topologyDataSources : metricsDataSources
  const existing = editableSources.filter(s => s.purpose === purpose).map(s => s.dataSourceId)
  const available = availableSources.filter(ds => !existing.includes(ds.id))
  if (available.length === 0) {
    alert('No more data sources available to add')
    return
  }
  editableSources = [...editableSources, {
    dataSourceId: available[0].id,
    purpose,
    syncMode: 'manual',
    priority: existing.length,
  }]
  hasSourceChanges = true
}

function removeSource(index: number) {
  editableSources = editableSources.filter((_, i) => i !== index)
  hasSourceChanges = true
}

function updateSource(index: number, updates: Partial<TopologyDataSourceInput>) {
  editableSources = editableSources.map((s, i) => i === index ? { ...s, ...updates } : s)
  hasSourceChanges = true
  if (updates.dataSourceId) loadFilterOptions(updates.dataSourceId)
}

async function loadFilterOptions(dataSourceId: string) {
  if (filterOptionsCache[dataSourceId] || filterOptionsLoading[dataSourceId]) return
  const ds = getDataSource(dataSourceId)
  if (ds?.type !== 'netbox') return
  filterOptionsLoading = { ...filterOptionsLoading, [dataSourceId]: true }
  try {
    const options = await api.dataSources.getFilterOptions(dataSourceId)
    filterOptionsCache = { ...filterOptionsCache, [dataSourceId]: options }
  } catch {
    // silently fail
  } finally {
    filterOptionsLoading = { ...filterOptionsLoading, [dataSourceId]: false }
  }
}

function parseOptions(optionsJson?: string): NetBoxOptions {
  if (!optionsJson) return {}
  try {
    const raw = JSON.parse(optionsJson)
    if (typeof raw.siteFilter === 'string') raw.siteFilter = raw.siteFilter ? [raw.siteFilter] : []
    if (typeof raw.tagFilter === 'string') raw.tagFilter = raw.tagFilter ? [raw.tagFilter] : []
    if (typeof raw.roleFilter === 'string') raw.roleFilter = raw.roleFilter ? [raw.roleFilter] : []
    if (typeof raw.excludeRoleFilter === 'string') raw.excludeRoleFilter = raw.excludeRoleFilter ? [raw.excludeRoleFilter] : []
    if (typeof raw.excludeTagFilter === 'string') raw.excludeTagFilter = raw.excludeTagFilter ? [raw.excludeTagFilter] : []
    return raw
  } catch {
    return {}
  }
}

function updateOptions(index: number, patch: Partial<NetBoxOptions>) {
  const current = parseOptions(editableSources[index].optionsJson)
  const merged = { ...current, ...patch }
  if (!merged.groupBy) delete merged.groupBy
  if (!merged.siteFilter?.length) delete merged.siteFilter
  if (!merged.tagFilter?.length) delete merged.tagFilter
  if (!merged.roleFilter?.length) delete merged.roleFilter
  if (!merged.excludeRoleFilter?.length) delete merged.excludeRoleFilter
  if (!merged.excludeTagFilter?.length) delete merged.excludeTagFilter
  const json = Object.keys(merged).length > 0 ? JSON.stringify(merged) : undefined
  updateSource(index, { optionsJson: json })
}

function toggleArrayOption(arr: string[] | undefined, value: string): string[] {
  const current = arr || []
  return current.includes(value) ? current.filter(v => v !== value) : [...current, value]
}

async function handleSaveSources() {
  savingSources = true
  error = ''
  try {
    // Include merge config in optionsJson
    const sourcesWithMerge = editableSources.map(source => {
      if (source.purpose !== 'topology') return source

      const otherOptions = getOtherOptions(source.optionsJson)
      let mergeConfig: MergeConfig = {}

      if (source.dataSourceId === baseSourceId) {
        mergeConfig = { isBase: true }
      } else {
        const overlay = overlayConfigs[source.dataSourceId]
        if (overlay) {
          mergeConfig = {
            match: overlay.match,
            matchAttribute: overlay.matchAttribute,
            idMapping: overlay.idMapping,
            onMatch: overlay.onMatch,
            onUnmatched: overlay.onUnmatched,
            subgraphName: overlay.subgraphName,
          }
        }
      }

      const combined: Record<string, unknown> = { ...otherOptions, ...mergeConfig }
      for (const key of Object.keys(combined)) {
        if (combined[key] === undefined || combined[key] === '') delete combined[key]
      }

      return {
        ...source,
        optionsJson: Object.keys(combined).length > 0 ? JSON.stringify(combined) : undefined,
      }
    })

    const updated = await api.topologies.sources.replaceAll(topologyId, sourcesWithMerge)
    currentSources = updated
    editableSources = updated.map(s => ({
      dataSourceId: s.dataSourceId,
      purpose: s.purpose,
      syncMode: s.syncMode,
      priority: s.priority,
      optionsJson: s.optionsJson,
    }))
    hasSourceChanges = false
    hasMergeChanges = false
  } catch (e) {
    error = e instanceof Error ? e.message : 'Failed to save'
  } finally {
    savingSources = false
  }
}

async function handleSyncAll() {
  syncing = true
  syncResult = null
  try {
    const result = await api.topologies.sources.syncAll(topologyId)
    syncResult = { nodeCount: result.nodeCount, linkCount: result.linkCount }
    topology = result.topology
  } catch (e) {
    alert(e instanceof Error ? e.message : 'Sync failed')
  } finally {
    syncing = false
  }
}

function getWebhookUrl(source: TopologyDataSource): string {
  return `${window.location.origin}/api/webhooks/topology/${source.webhookSecret}`
}

async function copyWebhookUrl(source: TopologyDataSource) {
  await navigator.clipboard.writeText(getWebhookUrl(source))
  copiedSecret = source.id
  setTimeout(() => { copiedSecret = null }, 2000)
}

// Merge functions
function parseMergeConfig(optionsJson?: string): MergeConfig {
  if (!optionsJson) return {}
  try { return JSON.parse(optionsJson) } catch { return {} }
}

function getOtherOptions(optionsJson?: string): Record<string, unknown> {
  if (!optionsJson) return {}
  try {
    const parsed = JSON.parse(optionsJson)
    const { isBase, match, matchAttribute, idMapping, onMatch, onUnmatched, subgraphName, ...rest } = parsed
    return rest
  } catch { return {} }
}

function setBaseSource(dataSourceId: string) {
  baseSourceId = dataSourceId
  hasMergeChanges = true
  hasSourceChanges = true
}

function updateOverlayConfig(dataSourceId: string, updates: Partial<OverlayConfig>) {
  overlayConfigs = {
    ...overlayConfigs,
    [dataSourceId]: { ...overlayConfigs[dataSourceId], ...updates },
  }
  hasMergeChanges = true
  hasSourceChanges = true
}

function getSourceName(dataSourceId: string): string {
  const source = currentSources.find(s => s.dataSourceId === dataSourceId)
  return source?.dataSource?.name || dataSourceId
}

function getSourceType(dataSourceId: string): string {
  const source = currentSources.find(s => s.dataSourceId === dataSourceId)
  return source?.dataSource?.type || 'unknown'
}

// ============================================
// Mapping Tab Functions
// ============================================

function getNodeLabel(node: { label?: string | string[] }): string {
  let label: string
  if (Array.isArray(node.label)) {
    label = node.label[0] || 'Unnamed'
  } else {
    label = node.label || 'Unnamed'
  }
  return label.replace(/<[^>]*>/g, '')
}

function getNodeLabelById(nodeId: string): string {
  const node = parsedTopology?.graph.nodes.find(n => n.id === nodeId)
  if (!node) return nodeId
  return getNodeLabel(node)
}

function loadInterfacesForMappedNodes() {
  const hostIds = new Set<string>()
  for (const edge of edges) {
    const fromHostId = $nodeMapping[edge.from.nodeId]?.hostId
    const toHostId = $nodeMapping[edge.to.nodeId]?.hostId
    if (fromHostId) hostIds.add(fromHostId)
    if (toHostId) hostIds.add(toHostId)
  }
  for (const hostId of hostIds) {
    mappingStore.loadHostInterfaces(hostId)
  }
}

function handleNodeMappingChange(nodeId: string, hostId: string) {
  const host = $mappingHosts.find(h => h.id === hostId)
  mappingStore.updateNode(nodeId, hostId ? { hostId, hostName: host?.name || host?.displayName } : {})
  if (hostId) mappingStore.loadHostInterfaces(hostId)
}

function handleAutoMap() {
  if (!parsedTopology) return
  autoMapResult = mappingStore.autoMapNodes(parsedTopology.graph.nodes, { overwrite: false })
  setTimeout(() => { autoMapResult = null }, 5000)
}

function handleClearAll() {
  if (confirm('Clear all node mappings?')) {
    mappingStore.clearAllNodes()
    autoMapResult = null
  }
}

async function handleSaveMapping() {
  savingMapping = true
  try {
    await mappingStore.save()
  } catch (e) {
    error = e instanceof Error ? e.message : 'Failed to save mapping'
  } finally {
    savingMapping = false
  }
}

function handleMonitoredNodeChange(linkId: string, nodeId: string) {
  const existing = $linkMapping[linkId] || {}
  if (nodeId) {
    mappingStore.updateLink(linkId, { ...existing, monitoredNodeId: nodeId, interface: undefined })
    const hostId = $nodeMapping[nodeId]?.hostId
    if (hostId) mappingStore.loadHostInterfaces(hostId)
  } else {
    mappingStore.updateLink(linkId, { ...existing, monitoredNodeId: undefined, interface: undefined })
  }
}

function handleLinkInterfaceChange(linkId: string, interfaceName: string) {
  const existing = $linkMapping[linkId] || {}
  mappingStore.updateLink(linkId, { ...existing, interface: interfaceName || undefined })
}

const standardCapacities = new Set(['100000000', '1000000000', '10000000000', '25000000000', '40000000000', '100000000000'])
let customCapacityLinks = $state(new Set<string>())

function capacityToSelectValue(linkId: string, capacity?: number): string {
  if (customCapacityLinks.has(linkId)) return 'custom'
  if (!capacity) return ''
  const s = String(capacity)
  return standardCapacities.has(s) ? s : 'custom'
}

function handleLinkCapacityChange(linkId: string, capacityBps: number | undefined) {
  const existing = $linkMapping[linkId] || {}
  if (capacityBps !== undefined) {
    mappingStore.updateLink(linkId, { ...existing, capacity: capacityBps })
  } else {
    const { capacity: _, ...rest } = existing
    if (Object.keys(rest).length > 0) {
      mappingStore.updateLink(linkId, rest)
    } else {
      mappingStore.updateLink(linkId, null)
    }
  }
}

function handleAutoMapLinks() {
  let matched = 0
  for (const edge of edges) {
    const fromHostId = $nodeMapping[edge.from.nodeId]?.hostId
    const toHostId = $nodeMapping[edge.to.nodeId]?.hostId
    const fromInterfaces = fromHostId ? $hostInterfaces[fromHostId] || [] : []
    const toInterfaces = toHostId ? $hostInterfaces[toHostId] || [] : []
    const currentMapping = $linkMapping[edge.id] || {}
    if (currentMapping.interface) continue

    let monitoredNodeId: string | null = null
    let matchedInterface: string | null = null

    if (fromHostId && fromInterfaces.length > 0 && edge.from.port) {
      const match = findMatchingInterface(edge.from.port, fromInterfaces)
      if (match) { monitoredNodeId = edge.from.nodeId; matchedInterface = match }
    }
    if (!matchedInterface && toHostId && toInterfaces.length > 0 && edge.to.port) {
      const match = findMatchingInterface(edge.to.port, toInterfaces)
      if (match) { monitoredNodeId = edge.to.nodeId; matchedInterface = match }
    }
    if (!matchedInterface) {
      if (fromHostId && fromInterfaces.length > 0) monitoredNodeId = edge.from.nodeId
      else if (toHostId && toInterfaces.length > 0) monitoredNodeId = edge.to.nodeId
    }

    if (monitoredNodeId && matchedInterface) {
      mappingStore.updateLink(edge.id, { ...currentMapping, monitoredNodeId, interface: matchedInterface })
      matched++
    } else if (monitoredNodeId && !currentMapping.monitoredNodeId) {
      mappingStore.updateLink(edge.id, { ...currentMapping, monitoredNodeId })
    }
  }
  return matched
}

function findMatchingInterface(portName: string, interfaces: Array<{ name: string }>): string | null {
  const normalized = portName.toLowerCase().replace(/[:\s]/g, '')
  for (const iface of interfaces) {
    if (iface.name.toLowerCase() === portName.toLowerCase()) return iface.name
  }
  for (const iface of interfaces) {
    const ifNorm = iface.name.toLowerCase().replace(/[:\s]/g, '')
    if (ifNorm.includes(normalized) || normalized.includes(ifNorm)) return iface.name
  }
  const basePort = normalized.split('.')[0]
  for (const iface of interfaces) {
    const baseIf = iface.name.toLowerCase().split('.')[0]
    if (baseIf === basePort) return iface.name
  }
  return null
}
</script>

<svelte:head>
  <title>Settings - {topology?.name || 'Topology'} - Shumoku</title>
</svelte:head>

<div class="p-6 max-w-4xl mx-auto">
  {#if loading}
    <div class="flex items-center justify-center py-12">
      <div class="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
    </div>
  {:else if error && !topology}
    <div class="card p-6 text-center">
      <p class="text-danger mb-4">{error}</p>
      <a href="/topologies" class="btn btn-secondary">Back to Topologies</a>
    </div>
  {:else if topology}
    <!-- Header -->
    <div class="mb-6">
      <a
        href="/topologies/{topologyId}"
        class="inline-flex items-center gap-2 text-sm text-theme-text-muted hover:text-theme-text transition-colors mb-4"
      >
        <ArrowLeft size={16} />
        Back to Diagram
      </a>
      <h1 class="text-xl font-semibold text-theme-text-emphasis">{topology.name}</h1>
      <p class="text-sm text-theme-text-muted">Settings</p>
    </div>

    <!-- Tabs -->
    <div class="flex gap-1 mb-6 border-b border-theme-border">
      <button
        class="px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px
          {activeTab === 'general'
            ? 'text-primary border-primary'
            : 'text-theme-text-muted border-transparent hover:text-theme-text'}"
        onclick={() => { activeTab = 'general'; history.replaceState(null, '', '#general') }}
      >
        General
      </button>
      <button
        class="px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px
          {activeTab === 'sources'
            ? 'text-primary border-primary'
            : 'text-theme-text-muted border-transparent hover:text-theme-text'}"
        onclick={() => { activeTab = 'sources'; history.replaceState(null, '', '#sources') }}
      >
        Data Sources
      </button>
      <button
        class="px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px
          {activeTab === 'mapping'
            ? 'text-primary border-primary'
            : 'text-theme-text-muted border-transparent hover:text-theme-text'}"
        onclick={() => { activeTab = 'mapping'; history.replaceState(null, '', '#mapping') }}
      >
        Mapping
      </button>
    </div>

    {#if error}
      <div class="p-3 bg-danger/10 border border-danger/20 rounded-lg text-danger text-sm mb-6">{error}</div>
    {/if}

    <!-- ============================================ -->
    <!-- General Tab -->
    <!-- ============================================ -->
    {#if activeTab === 'general'}
      <div class="space-y-6">
        <!-- Statistics -->
        {#if renderData}
          <div class="card">
            <div class="card-header">
              <h2 class="font-medium text-theme-text-emphasis">Statistics</h2>
            </div>
            <div class="card-body">
              <div class="grid grid-cols-3 gap-4">
                <div class="bg-theme-bg rounded-lg p-3">
                  <p class="text-xs text-theme-text-muted">Nodes</p>
                  <p class="text-xl font-semibold text-theme-text-emphasis">{renderData.nodeCount}</p>
                </div>
                <div class="bg-theme-bg rounded-lg p-3">
                  <p class="text-xs text-theme-text-muted">Edges</p>
                  <p class="text-xl font-semibold text-theme-text-emphasis">{renderData.edgeCount}</p>
                </div>
                <div class="bg-theme-bg rounded-lg p-3">
                  <p class="text-xs text-theme-text-muted">Updated</p>
                  <p class="text-sm text-theme-text">{new Date(topology.updatedAt).toLocaleDateString()}</p>
                </div>
              </div>
            </div>
          </div>
        {/if}

        <!-- Display Settings -->
        <div class="card">
          <div class="card-header">
            <h2 class="font-medium text-theme-text-emphasis">Display</h2>
          </div>
          <div class="card-body space-y-4">
            <!-- Edge Style -->
            <div>
              <label for="edgeStyle" class="text-sm text-theme-text block mb-1">Edge Style</label>
              <select
                id="edgeStyle"
                class="input w-full"
                bind:value={edgeStyle}
                onchange={updateEdgeStyle}
                disabled={savingEdgeStyle}
              >
                <option value="orthogonal">Orthogonal (default)</option>
                <option value="polyline">Polyline</option>
                <option value="splines">Splines (curved)</option>
                <option value="straight">Straight</option>
              </select>
            </div>

            {#if edgeStyle === 'splines'}
              <div>
                <label for="splineMode" class="text-sm text-theme-text block mb-1">Spline Mode</label>
                <select
                  id="splineMode"
                  class="input w-full"
                  bind:value={splineMode}
                  onchange={updateEdgeStyle}
                  disabled={savingEdgeStyle}
                >
                  <option value="sloppy">Sloppy</option>
                  <option value="conservative">Conservative</option>
                  <option value="conservative_soft">Conservative Soft</option>
                </select>
              </div>
            {/if}

            <hr class="border-theme-border" />

            <!-- Connection Status -->
            <div class="flex items-center justify-between">
              <div>
                <p class="text-sm text-theme-text">Connection Status</p>
                <p class="text-xs text-theme-text-muted">Real-time data stream</p>
              </div>
              <div class="flex items-center gap-2">
                {#if $metricsConnected}
                  <span class="w-2 h-2 bg-success rounded-full animate-pulse"></span>
                  <span class="text-xs text-success font-medium">Live</span>
                {:else}
                  <span class="w-2 h-2 bg-theme-text-muted rounded-full"></span>
                  <span class="text-xs text-theme-text-muted">Offline</span>
                {/if}
              </div>
            </div>

            <!-- Toggles -->
            <label class="flex items-center justify-between cursor-pointer">
              <div>
                <p class="text-sm text-theme-text">Live Updates</p>
                <p class="text-xs text-theme-text-muted">Connect to metrics server</p>
              </div>
              <input
                type="checkbox"
                class="toggle"
                checked={$liveUpdatesEnabled}
                onchange={(e) => displaySettings.setLiveUpdates(e.currentTarget.checked)}
              />
            </label>

            <label class="flex items-center justify-between cursor-pointer {!$liveUpdatesEnabled ? 'opacity-50' : ''}">
              <div>
                <p class="text-sm text-theme-text">Traffic Flow</p>
                <p class="text-xs text-theme-text-muted">Show link utilization colors</p>
              </div>
              <input
                type="checkbox"
                class="toggle"
                checked={$showTrafficFlow}
                disabled={!$liveUpdatesEnabled}
                onchange={(e) => displaySettings.setShowTrafficFlow(e.currentTarget.checked)}
              />
            </label>

            <label class="flex items-center justify-between cursor-pointer {!$liveUpdatesEnabled ? 'opacity-50' : ''}">
              <div>
                <p class="text-sm text-theme-text">Node Status</p>
                <p class="text-xs text-theme-text-muted">Show up/down indicators</p>
              </div>
              <input
                type="checkbox"
                class="toggle"
                checked={$showNodeStatus}
                disabled={!$liveUpdatesEnabled}
                onchange={(e) => displaySettings.setShowNodeStatus(e.currentTarget.checked)}
              />
            </label>
          </div>
        </div>

        <!-- Actions -->
        <div class="card">
          <div class="card-header">
            <h2 class="font-medium text-theme-text-emphasis">Actions</h2>
          </div>
          <div class="card-body">
            <a href="/topologies/{topology.id}/edit" class="btn btn-secondary w-full justify-center">
              <PencilSimple size={16} class="mr-2" />
              Edit YAML
            </a>
          </div>
        </div>

        <!-- Danger Zone -->
        <div class="card border-danger/30">
          <div class="card-header">
            <h2 class="font-medium text-danger">Danger Zone</h2>
          </div>
          <div class="card-body">
            <p class="text-xs text-theme-text-muted mb-3">Once deleted, this topology cannot be recovered.</p>
            <Button variant="destructive" class="w-full justify-center" onclick={handleDelete} disabled={deleting}>
              {#if deleting}
                <span class="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2"></span>
              {:else}
                <Trash size={16} class="mr-2" />
              {/if}
              Delete Topology
            </Button>
          </div>
        </div>
      </div>
    {/if}

    <!-- ============================================ -->
    <!-- Sources Tab -->
    <!-- ============================================ -->
    {#if activeTab === 'sources'}
      <div class="space-y-6">
        <!-- Save button -->
        <div class="flex justify-end">
          <Button onclick={handleSaveSources} disabled={savingSources || !hasSourceChanges}>
            {#if savingSources}
              <span class="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2"></span>
            {:else}
              <FloppyDisk size={16} class="mr-2" />
            {/if}
            Save Changes
          </Button>
        </div>

        <!-- Topology Sources -->
        <div class="card">
          <div class="card-header flex items-center justify-between">
            <h2 class="font-medium text-theme-text-emphasis">Topology Sources</h2>
            <div class="flex items-center gap-2">
              {#if topologySources.length > 0}
                <Button variant="secondary" size="sm" onclick={handleSyncAll} disabled={syncing || hasSourceChanges}>
                  {#if syncing}
                    <span class="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin mr-1"></span>
                  {:else}
                    <ArrowsClockwise size={14} class="mr-1" />
                  {/if}
                  Sync All
                </Button>
              {/if}
              <Button variant="outline" size="sm" onclick={() => addSource('topology')}>
                <Plus size={16} class="mr-1" />
                Add
              </Button>
            </div>
          </div>

          {#if syncResult}
            <div class="px-4 py-2 bg-success/10 border-b border-success/20 text-success text-sm">
              Synced: {syncResult.nodeCount} nodes, {syncResult.linkCount} links
            </div>
          {/if}

          <div class="card-body">
            {#if topologySources.length === 0}
              <p class="text-sm text-theme-text-muted text-center py-4">
                No topology sources configured. Topology is defined manually.
              </p>
            {:else}
              <div class="space-y-4">
                {#each getSourcesByPurpose('topology') as source (source.index)}
                  {@const currentSource = getCurrentSource(source.dataSourceId, 'topology')}
                  {@const dataSource = getDataSource(source.dataSourceId)}
                  <div class="border border-theme-border rounded-lg p-4">
                    <div class="flex items-start justify-between gap-4">
                      <div class="flex-1 space-y-3">
                        <div class="flex items-center gap-2">
                          <select
                            class="input flex-1"
                            value={source.dataSourceId}
                            onchange={(e) => updateSource(source.index, { dataSourceId: e.currentTarget.value })}
                          >
                            {#each topologyDataSources as ds}
                              <option value={ds.id}>{ds.name} ({ds.type})</option>
                            {/each}
                          </select>
                          <select
                            class="input"
                            style="width: 10rem;"
                            value={source.syncMode}
                            onchange={(e) => updateSource(source.index, { syncMode: e.currentTarget.value as SyncMode })}
                          >
                            <option value="manual">Manual</option>
                            <option value="on_view">On View</option>
                            <option value="webhook">Webhook</option>
                          </select>
                        </div>

                        {#if source.syncMode === 'webhook' && currentSource?.webhookSecret}
                          <div class="flex items-center gap-2">
                            <input
                              type="text"
                              class="input font-mono text-xs flex-1"
                              value={getWebhookUrl(currentSource)}
                              readonly
                            />
                            <Button variant="outline" size="sm" onclick={() => copyWebhookUrl(currentSource)}>
                              {#if copiedSecret === currentSource.id}
                                <CheckCircle size={16} class="text-success" />
                              {:else}
                                <Copy size={16} />
                              {/if}
                            </Button>
                          </div>
                        {/if}

                        <!-- NetBox options -->
                        {#if dataSource?.type === 'netbox'}
                          {@const opts = parseOptions(source.optionsJson)}
                          {@const filterOpts = filterOptionsCache[source.dataSourceId]}
                          {@const isLoading = filterOptionsLoading[source.dataSourceId]}
                          <div class="border-t border-theme-border pt-3 space-y-3">
                            <p class="text-xs font-medium text-theme-text-muted uppercase tracking-wide">NetBox Options</p>

                            <div class="flex items-center gap-4">
                              <label class="text-xs text-theme-text-muted">Group By</label>
                              <select
                                class="input text-sm"
                                value={opts.groupBy || 'tag'}
                                onchange={(e) => updateOptions(source.index, { groupBy: e.currentTarget.value })}
                              >
                                <option value="tag">Tag</option>
                                <option value="site">Site</option>
                                <option value="location">Location</option>
                                <option value="prefix">Prefix</option>
                                <option value="none">None</option>
                              </select>
                            </div>

                            {#if filterOpts}
                              <!-- Include Filters -->
                              <div class="grid grid-cols-3 gap-3">
                                <div>
                                  <p class="text-xs text-theme-text-muted mb-1">Site Filter</p>
                                  <div class="flex flex-wrap gap-1">
                                    {#each filterOpts.sites || [] as site}
                                      {@const selected = opts.siteFilter?.includes(site.slug)}
                                      <button
                                        type="button"
                                        class="px-2 py-0.5 rounded-full text-xs border cursor-pointer
                                          {selected ? 'bg-primary/15 border-primary/40 text-primary' : 'border-theme-border text-theme-text-muted hover:border-theme-text-muted'}"
                                        onclick={() => updateOptions(source.index, { siteFilter: toggleArrayOption(opts.siteFilter, site.slug) })}
                                      >{site.name}</button>
                                    {/each}
                                  </div>
                                </div>

                                <div>
                                  <p class="text-xs text-theme-text-muted mb-1">Tag Filter</p>
                                  <div class="flex flex-wrap gap-1">
                                    {#each filterOpts.tags || [] as tag}
                                      {@const selected = opts.tagFilter?.includes(tag.slug)}
                                      <button
                                        type="button"
                                        class="px-2 py-0.5 rounded-full text-xs border cursor-pointer
                                          {selected ? 'bg-primary/15 border-primary/40 text-primary' : 'border-theme-border text-theme-text-muted hover:border-theme-text-muted'}"
                                        onclick={() => updateOptions(source.index, { tagFilter: toggleArrayOption(opts.tagFilter, tag.slug) })}
                                      >{tag.name}</button>
                                    {/each}
                                  </div>
                                </div>

                                <div>
                                  <p class="text-xs text-theme-text-muted mb-1">Role Filter</p>
                                  <div class="flex flex-wrap gap-1">
                                    {#each filterOpts.roles || [] as role}
                                      {@const selected = opts.roleFilter?.includes(role.slug)}
                                      <button
                                        type="button"
                                        class="px-2 py-0.5 rounded-full text-xs border cursor-pointer
                                          {selected ? 'bg-primary/15 border-primary/40 text-primary' : 'border-theme-border text-theme-text-muted hover:border-theme-text-muted'}"
                                        onclick={() => updateOptions(source.index, { roleFilter: toggleArrayOption(opts.roleFilter, role.slug) })}
                                      >{role.name}</button>
                                    {/each}
                                  </div>
                                </div>
                              </div>

                              <!-- Exclude Filters -->
                              <div class="grid grid-cols-2 gap-3">
                                <div>
                                  <p class="text-xs text-danger mb-1">Exclude Roles</p>
                                  <div class="flex flex-wrap gap-1">
                                    {#each filterOpts.roles || [] as role}
                                      {@const selected = opts.excludeRoleFilter?.includes(role.slug)}
                                      <button
                                        type="button"
                                        class="px-2 py-0.5 rounded-full text-xs border cursor-pointer
                                          {selected ? 'bg-danger/15 border-danger/40 text-danger' : 'border-theme-border text-theme-text-muted hover:border-theme-text-muted'}"
                                        onclick={() => updateOptions(source.index, { excludeRoleFilter: toggleArrayOption(opts.excludeRoleFilter, role.slug) })}
                                      >{role.name}</button>
                                    {/each}
                                  </div>
                                </div>

                                <div>
                                  <p class="text-xs text-danger mb-1">Exclude Tags</p>
                                  <div class="flex flex-wrap gap-1">
                                    {#each filterOpts.tags || [] as tag}
                                      {@const selected = opts.excludeTagFilter?.includes(tag.slug)}
                                      <button
                                        type="button"
                                        class="px-2 py-0.5 rounded-full text-xs border cursor-pointer
                                          {selected ? 'bg-danger/15 border-danger/40 text-danger' : 'border-theme-border text-theme-text-muted hover:border-theme-text-muted'}"
                                        onclick={() => updateOptions(source.index, { excludeTagFilter: toggleArrayOption(opts.excludeTagFilter, tag.slug) })}
                                      >{tag.name}</button>
                                    {/each}
                                  </div>
                                </div>
                              </div>
                            {:else if isLoading}
                              <p class="text-xs text-theme-text-muted">Loading filter options...</p>
                            {/if}
                          </div>
                        {/if}
                      </div>
                      <Button variant="ghost" size="sm" class="text-danger hover:bg-danger/10" onclick={() => removeSource(source.index)}>
                        <Trash size={16} />
                      </Button>
                    </div>
                  </div>
                {/each}
              </div>
            {/if}
          </div>
        </div>

        <!-- Merge Configuration (inline when multiple sources) -->
        {#if hasMultipleTopologySources}
          <div class="card">
            <div class="card-header">
              <h2 class="font-medium text-theme-text-emphasis flex items-center gap-2">
                <Star size={18} weight="fill" class="text-warning" />
                Merge Configuration
              </h2>
            </div>
            <div class="card-body space-y-4">
              <!-- Base source selection -->
              <div>
                <p class="text-xs text-theme-text-muted mb-2">Base Source (others merge into this)</p>
                <div class="flex flex-wrap gap-2">
                  {#each currentSources.filter(s => s.purpose === 'topology') as source}
                    {@const isBase = source.dataSourceId === baseSourceId}
                    <button
                      type="button"
                      class="px-3 py-1.5 rounded-lg border-2 text-sm cursor-pointer
                        {isBase ? 'bg-warning/15 border-warning text-warning font-medium' : 'border-theme-border text-theme-text-muted hover:border-theme-text-muted'}"
                      onclick={() => setBaseSource(source.dataSourceId)}
                    >
                      {getSourceName(source.dataSourceId)}
                    </button>
                  {/each}
                </div>
              </div>

              <!-- Overlay configs -->
              {#if overlaySources.length > 0}
                <div class="flex justify-center">
                  <ArrowDown size={20} class="text-theme-text-muted" />
                </div>

                {#each overlaySources as source}
                  {@const config = overlayConfigs[source.dataSourceId] || { match: 'name', onMatch: 'merge-properties', onUnmatched: 'add-to-subgraph' }}
                  <div class="border border-theme-border rounded-lg p-4">
                    <h3 class="font-medium text-theme-text-emphasis mb-3">{getSourceName(source.dataSourceId)}</h3>
                    <div class="grid grid-cols-2 gap-3">
                      <div>
                        <label class="text-xs text-theme-text-muted">Match Strategy</label>
                        <select
                          class="input mt-1"
                          value={config.match}
                          onchange={(e) => updateOverlayConfig(source.dataSourceId, { match: e.currentTarget.value as MergeMatchStrategy })}
                        >
                          <option value="name">By Name</option>
                          <option value="id">By ID</option>
                          <option value="manual">Manual Mapping</option>
                        </select>
                      </div>
                      <div>
                        <label class="text-xs text-theme-text-muted">Unmatched Nodes</label>
                        <select
                          class="input mt-1"
                          value={config.onUnmatched}
                          onchange={(e) => updateOverlayConfig(source.dataSourceId, { onUnmatched: e.currentTarget.value as MergeUnmatchedStrategy })}
                        >
                          <option value="add-to-subgraph">Add to Subgraph</option>
                          <option value="add-to-root">Add to Root</option>
                          <option value="ignore">Ignore</option>
                        </select>
                      </div>
                      {#if config.match === 'manual'}
                        <div class="col-span-2">
                          <label class="text-xs text-theme-text-muted">ID Mapping (JSON)</label>
                          <textarea
                            class="input mt-1 font-mono text-xs"
                            rows="4"
                            placeholder={`{\n  "overlay-id": "base-id"\n}`}
                            value={config.idMapping ? JSON.stringify(config.idMapping, null, 2) : ''}
                            onchange={(e) => {
                              try {
                                const parsed = JSON.parse(e.currentTarget.value || '{}')
                                updateOverlayConfig(source.dataSourceId, { idMapping: parsed })
                              } catch { /* invalid */ }
                            }}
                          ></textarea>
                        </div>
                      {/if}
                      {#if config.onUnmatched === 'add-to-subgraph'}
                        <div class="col-span-2">
                          <label class="text-xs text-theme-text-muted">Subgraph Name</label>
                          <input
                            type="text"
                            class="input mt-1"
                            placeholder={getSourceType(source.dataSourceId)}
                            value={config.subgraphName || ''}
                            onchange={(e) => updateOverlayConfig(source.dataSourceId, { subgraphName: e.currentTarget.value })}
                          />
                        </div>
                      {/if}
                    </div>
                  </div>
                {/each}
              {/if}
            </div>
          </div>
        {/if}

        <!-- Metrics Sources -->
        <div class="card">
          <div class="card-header flex items-center justify-between">
            <h2 class="font-medium text-theme-text-emphasis">Metrics Sources</h2>
            <Button variant="outline" size="sm" onclick={() => addSource('metrics')}>
              <Plus size={16} class="mr-1" />
              Add
            </Button>
          </div>
          <div class="card-body">
            {#if metricsSources.length === 0}
              <p class="text-sm text-theme-text-muted text-center py-4">
                No metrics sources configured. Live metrics disabled.
              </p>
            {:else}
              <div class="space-y-3">
                {#each getSourcesByPurpose('metrics') as source (source.index)}
                  <div class="flex items-center gap-3 border border-theme-border rounded-lg p-3">
                    <select
                      class="input flex-1"
                      value={source.dataSourceId}
                      onchange={(e) => updateSource(source.index, { dataSourceId: e.currentTarget.value })}
                    >
                      {#each metricsDataSources as ds}
                        <option value={ds.id}>{ds.name} ({ds.type})</option>
                      {/each}
                    </select>
                    <Button variant="ghost" size="sm" class="text-danger hover:bg-danger/10" onclick={() => removeSource(source.index)}>
                      <Trash size={16} />
                    </Button>
                  </div>
                {/each}
              </div>
            {/if}
          </div>
        </div>
      </div>
    {/if}

    <!-- ============================================ -->
    <!-- Mapping Tab -->
    <!-- ============================================ -->
    {#if activeTab === 'mapping'}
      <div class="space-y-6">
        {#if !hasMetricsSource}
          <div class="card p-6 text-center">
            <p class="text-theme-text-muted mb-4">No metrics source configured.</p>
            <button class="text-primary hover:underline" onclick={() => activeTab = 'sources'}>
              Configure Data Sources →
            </button>
          </div>
        {:else}
          <!-- Save button -->
          <div class="flex items-center justify-between">
            <div class="text-sm text-theme-text-muted">
              {mappedCount}/{totalNodes} nodes • {mappedLinksCount}/{totalLinks} links
            </div>
            <Button onclick={handleSaveMapping} disabled={savingMapping}>
              {#if savingMapping}
                <span class="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2"></span>
              {:else}
                <FloppyDisk size={16} class="mr-2" />
              {/if}
              Save Mapping
            </Button>
          </div>

          {#if autoMapResult}
            <div class="p-3 bg-success/10 border border-success/20 rounded-lg text-success text-sm flex items-center gap-2">
              <CheckCircle size={16} />
              Auto-mapped {autoMapResult.matched} of {autoMapResult.total} nodes
            </div>
          {/if}

          <!-- Node Mapping -->
          <div class="card">
            <div class="card-header">
              <div class="flex items-center justify-between gap-4 mb-3">
                <h2 class="font-medium text-theme-text-emphasis">Node Mapping</h2>
                <div class="flex items-center gap-2">
                  <Button variant="outline" size="sm" onclick={handleAutoMap} disabled={$mappingStore.hostsLoading}>
                    <Lightning size={14} class="mr-1" />
                    Auto-map
                  </Button>
                  <Button variant="outline" size="sm" onclick={handleClearAll} disabled={mappedCount === 0}>
                    <Trash size={14} class="mr-1" />
                    Clear
                  </Button>
                </div>
              </div>
              <div class="relative">
                <MagnifyingGlass size={16} class="absolute left-3 top-1/2 -translate-y-1/2 text-theme-text-muted" />
                <input
                  type="text"
                  class="input w-full"
                  style="padding-left: 2.25rem;"
                  placeholder="Search nodes..."
                  bind:value={nodeSearchQuery}
                />
              </div>
            </div>
            <div class="divide-y divide-theme-border max-h-96 overflow-y-auto">
              {#if filteredNodes.length === 0}
                <div class="p-4 text-center text-theme-text-muted">
                  {nodeSearchQuery ? 'No matching nodes' : 'No nodes'}
                </div>
              {:else}
                {#each filteredNodes as node}
                  {@const isMapped = !!$nodeMapping[node.id]?.hostId}
                  <div class="p-3 flex items-center gap-4">
                    <div class="flex-1 min-w-0">
                      <p class="font-medium text-theme-text-emphasis truncate flex items-center gap-2">
                        <span class="w-2 h-2 rounded-full flex-shrink-0 {isMapped ? 'bg-success' : 'bg-theme-text-muted'}"></span>
                        {getNodeLabel(node)}
                      </p>
                      <p class="text-xs text-theme-text-muted">{node.type || 'Unknown'}</p>
                    </div>
                    <select
                      class="input"
                      style="width: 14rem;"
                      value={$nodeMapping[node.id]?.hostId || ''}
                      onchange={(e) => handleNodeMappingChange(node.id, e.currentTarget.value)}
                    >
                      <option value="">Not mapped</option>
                      {#each $mappingHosts as host}
                        <option value={host.id}>{host.displayName || host.name}</option>
                      {/each}
                    </select>
                  </div>
                {/each}
              {/if}
            </div>
          </div>

          <!-- Link Mapping -->
          <div class="card">
            <div class="card-header">
              <div class="flex items-center justify-between gap-4">
                <h2 class="font-medium text-theme-text-emphasis">Link Mapping</h2>
                <Button variant="outline" size="sm" onclick={() => {
                  const matched = handleAutoMapLinks()
                  if (matched > 0) {
                    autoMapResult = { matched, total: edges.length }
                    setTimeout(() => { autoMapResult = null }, 5000)
                  }
                }}>
                  <Lightning size={14} class="mr-1" />
                  Auto-map
                </Button>
              </div>
            </div>
            <div class="divide-y divide-theme-border max-h-96 overflow-y-auto">
              {#if edges.length === 0}
                <div class="p-4 text-center text-theme-text-muted">No links</div>
              {:else}
                {#each edges as edge}
                  {@const currentMapping = $linkMapping[edge.id] || {}}
                  {@const fromHostId = $nodeMapping[edge.from.nodeId]?.hostId}
                  {@const toHostId = $nodeMapping[edge.to.nodeId]?.hostId}
                  {@const monitoredNodeId = currentMapping.monitoredNodeId}
                  {@const monitoredHostId = monitoredNodeId === edge.from.nodeId ? fromHostId : monitoredNodeId === edge.to.nodeId ? toHostId : undefined}
                  {@const interfaces = monitoredHostId ? $hostInterfaces[monitoredHostId] || [] : []}
                  {@const hasAnyMappedNode = !!fromHostId || !!toHostId}
                  <div class="p-3 space-y-2">
                    <div class="flex items-center gap-2 text-sm">
                      <span class="w-2 h-2 rounded-full flex-shrink-0
                        {currentMapping.monitoredNodeId && currentMapping.interface ? 'bg-success' : currentMapping.monitoredNodeId ? 'bg-warning' : 'bg-theme-text-muted'}"></span>
                      <span class="font-medium">{getNodeLabelById(edge.from.nodeId)}</span>
                      {#if edge.from.port}<span class="text-theme-text-muted">({edge.from.port})</span>{/if}
                      <ArrowRight size={14} class="text-theme-text-muted" />
                      <span class="font-medium">{getNodeLabelById(edge.to.nodeId)}</span>
                      {#if edge.to.port}<span class="text-theme-text-muted">({edge.to.port})</span>{/if}
                    </div>
                    {#if hasAnyMappedNode}
                      <div class="flex items-center gap-2">
                        <select
                          class="input text-sm"
                          style="width: 10rem;"
                          value={monitoredNodeId || ''}
                          onchange={(e) => handleMonitoredNodeChange(edge.id, e.currentTarget.value)}
                        >
                          <option value="">Monitor from...</option>
                          {#if fromHostId}<option value={edge.from.nodeId}>{getNodeLabelById(edge.from.nodeId)}</option>{/if}
                          {#if toHostId}<option value={edge.to.nodeId}>{getNodeLabelById(edge.to.nodeId)}</option>{/if}
                        </select>
                        {#if monitoredNodeId && interfaces.length > 0}
                          <select
                            class="input text-sm flex-1"
                            value={currentMapping.interface || ''}
                            onchange={(e) => handleLinkInterfaceChange(edge.id, e.currentTarget.value)}
                          >
                            <option value="">Select interface</option>
                            {#each interfaces as iface}
                              <option value={iface.name}>{iface.name}</option>
                            {/each}
                          </select>
                        {/if}
                        <select
                          class="input text-sm"
                          style="width: 6rem;"
                          value={capacityToSelectValue(edge.id, currentMapping.capacity)}
                          onchange={(e) => {
                            const val = e.currentTarget.value
                            if (val === '') {
                              customCapacityLinks.delete(edge.id)
                              customCapacityLinks = new Set(customCapacityLinks)
                              handleLinkCapacityChange(edge.id, undefined)
                            } else if (val === 'custom') {
                              customCapacityLinks.add(edge.id)
                              customCapacityLinks = new Set(customCapacityLinks)
                              handleLinkCapacityChange(edge.id, 1_000_000_000)
                            } else {
                              customCapacityLinks.delete(edge.id)
                              customCapacityLinks = new Set(customCapacityLinks)
                              handleLinkCapacityChange(edge.id, parseInt(val))
                            }
                          }}
                        >
                          <option value="">Auto</option>
                          <option value="1000000000">1G</option>
                          <option value="10000000000">10G</option>
                          <option value="100000000000">100G</option>
                        </select>
                      </div>
                    {:else}
                      <p class="text-xs text-theme-text-muted italic">Map at least one node first</p>
                    {/if}
                  </div>
                {/each}
              {/if}
            </div>
          </div>
        {/if}
      </div>
    {/if}
  {/if}
</div>

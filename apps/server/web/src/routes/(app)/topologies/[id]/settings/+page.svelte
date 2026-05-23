<script lang="ts">
  import { nodeIdentityQuality } from '@shumoku/core'
  import {
    ArrowDownIcon,
    ArrowLeftIcon,
    ArrowRightIcon,
    ArrowsClockwiseIcon,
    CheckCircleIcon,
    CopyIcon,
    FloppyDiskIcon,
    LightningIcon,
    MagnifyingGlassIcon,
    PencilSimpleIcon,
    PlusIcon,
    StarIcon,
    TrashIcon,
  } from 'phosphor-svelte'
  import { onMount } from 'svelte'
  import { goto } from '$app/navigation'
  import { page } from '$app/stores'
  import { api } from '$lib/api'
  import { findBestInterfaceMatch } from '$lib/auto-mapping'
  import DiscoveryNodeDetail from '$lib/components/DiscoveryNodeDetail.svelte'
  import { Button } from '$lib/components/ui/button'
  import {
    dataSources,
    displaySettings,
    hostInterfaces,
    linkMapping,
    liveUpdatesEnabled,
    mappingHosts,
    mappingStore,
    metricsConnected,
    nodeMapping,
    showNodeStatus,
    showTrafficFlow,
    topologies,
  } from '$lib/stores'
  import type { MetricsData } from '$lib/stores/metrics'
  import type {
    DataSource,
    EdgeEndpoint,
    MetricsMapping,
    SyncMode,
    Topology,
    TopologyDataSource,
    TopologyDataSourceInput,
  } from '$lib/types'
  import { nodeLabelById, nodeLabel as resolveNodeLabel } from '$lib/utils/node-label'

  /**
   * Local UI-side snapshot synthesized from `/api/topologies/:id/context`.
   * Not the same as core's `NetworkGraph` — the mapping UI only reads a few
   * fields per node/link and doesn't need the canonical model's full shape.
   */
  interface SettingsTopologySnapshot {
    id: string
    name: string
    graph: {
      nodes: Array<{
        id: string
        label?: string | string[]
        spec?: { type?: string; vendor?: string }
      }>
      links: Array<{ id: string; from: string; to: string; standard?: string }>
    }
    metrics: MetricsData
    dataSourceId?: string
    mapping?: MetricsMapping
  }

  // ============================================
  // State
  // ============================================

  // biome-ignore lint/style/noNonNullAssertion: using depricated $page, which is not typed
  let topologyId = $derived($page.params.id!)

  // Tab state - check URL hash for initial tab
  let activeTab = $state<'general' | 'sources' | 'discovery' | 'mapping' | 'resolved'>('general')

  // Resolved JSON viewer state. The resolver folds all source observations
  // (NetBox / SNMP) plus Manual 's source-level graph into one project
  // graph — this is what the diagram actually renders against.
  let resolvedJson = $state('')
  let resolvedSnapshotCount = $state(0)
  let resolvedLoading = $state(false)
  let resolvedError = $state('')
  let resolvedCopied = $state(false)

  async function loadResolved() {
    if (!topology) return
    resolvedLoading = true
    resolvedError = ''
    try {
      const { graph, snapshotCount } = await api.topologies.getResolved(topology.id)
      resolvedJson = JSON.stringify(graph, null, 2)
      resolvedSnapshotCount = snapshotCount
    } catch (e) {
      resolvedError = e instanceof Error ? e.message : 'Failed to load resolved graph'
    } finally {
      resolvedLoading = false
    }
  }

  async function copyResolved() {
    try {
      await navigator.clipboard.writeText(resolvedJson)
      resolvedCopied = true
      setTimeout(() => {
        resolvedCopied = false
      }, 1500)
    } catch (e) {
      console.error('[Resolved] Copy failed:', e)
    }
  }

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
  let copiedSecret = $state<string | null>(null)

  // ----- Discovery tab state -----
  /** Per-source sync result chips (keyed by sourceId). */
  let perSourceSync = $state<
    Record<
      string,
      {
        status: 'ok' | 'partial' | 'failed' | 'empty'
        nodeCount: number
        linkCount: number
        message?: string
        at: number
      }
    >
  >({})
  let syncingSourceId = $state<string | null>(null)
  /** Identity-quality counts across the resolved topology. */
  let identityQuality = $state<{ stable: number; weak: number; unbound: number; total: number }>({
    stable: 0,
    weak: 0,
    unbound: 0,
    total: 0,
  })
  /**
   * Discovered nodes (the resolved graph 's nodes, minus synthetic
   * segment nodes). One card per entry in the Discovery tab; the
   * detail modal pulls from the same shape.
   */
  let discoveredNodes = $state<
    Array<{
      id: string
      label: string
      sysDescr?: string
      model?: string
      vendor?: string
      mgmtIp?: string
      sysName?: string
      chassisId?: string
      sysObjectID?: string
      catalogId?: string
      quality: 'stable' | 'weak' | 'unbound'
      sourceId?: string
      sourceName?: string
      sourceType?: string
      observedAt?: number
    }>
  >([])
  /** Card opened in the detail modal, null when closed. */
  let detailNode = $state<(typeof discoveredNodes)[number] | null>(null)
  /** Recent observation snapshots for this topology. */
  let recentObservations = $state<
    Array<{
      id: string
      sourceId: string
      capturedAt: number
      status: 'ok' | 'partial' | 'failed' | 'empty'
      statusMessage?: string
      nodeCount: number
      linkCount: number
      portCount: number
    }>
  >([])
  let discoveryLoading = $state(false)
  /**
   * Effective-policy view from `GET /discovery-policy`. The server folds
   * topology default → subgraph chain → node override once; the UI just
   * renders. Keyed by node id and subgraph id.
   *
   * We also keep the topology default + runtime default separately so
   * the summary strip can display them and the modal can attribute
   * "Inherits from: topology default" without re-walking the chain.
   */
  let policyView = $state<{
    topologyDefault: { mode?: import('$lib/api').DiscoveryMode; intervalMs?: number } | null
    runtimeDefault: { mode: import('$lib/api').DiscoveryMode; intervalMs: number }
    nodes: Record<string, import('$lib/api').EffectivePolicy>
    subgraphs: Record<string, import('$lib/api').EffectivePolicy>
  } | null>(null)
  /** Discovery-grid filters. The grid + summary strip share these. */
  let discoverySearch = $state('')
  let modeFilter = $state<'all' | 'auto' | 'observe' | 'disabled'>('all')
  let qualityFilter = $state<'all' | 'stable' | 'weak' | 'unbound'>('all')
  /** Patch in-flight, keyed by node id, so the modal can show a spinner
   *  without blocking other interactions. */
  let policyPatching = $state<Record<string, boolean>>({})
  /** Last patch error keyed by node id — surfaced in the modal so the
   *  operator sees why their click didn 't stick (e.g. 409 on
   *  discovered-only nodes). Cleared on the next successful patch. */
  let policyError = $state<Record<string, string>>({})
  /** Bulk-selection set. Click a card 's checkbox to toggle; the action
   *  bar appears when count > 0. */
  let bulkSelection = $state<Set<string>>(new Set())
  /** Bulk PATCH in flight — disables the action bar while running. */
  let bulkApplying = $state(false)

  // Filter options cache
  let filterOptionsCache = $state<
    Record<
      string,
      {
        sites: { slug: string; name: string }[]
        tags: { slug: string; name: string }[]
        roles?: { slug: string; name: string }[]
      }
    >
  >({})
  let filterOptionsLoading = $state<Record<string, boolean>>({})

  // Merge state
  let baseSourceId = $state<string | null>(null)
  let overlayConfigs = $state<Record<string, OverlayConfig>>({})

  // Mapping state
  let parsedTopology = $state<SettingsTopologySnapshot | null>(null)
  let savingMapping = $state(false)
  let nodeSearchQuery = $state('')
  let autoMapResult = $state<{ matched: number; total: number; kind: 'nodes' | 'links' } | null>(
    null,
  )
  let singleCandidateFallback = $state(true)

  // Transient UI timers — tracked so we can cancel them on unmount.
  let copiedTimer: ReturnType<typeof setTimeout> | null = null
  let autoMapTimer: ReturnType<typeof setTimeout> | null = null

  $effect(() => {
    return () => {
      if (copiedTimer) clearTimeout(copiedTimer)
      if (autoMapTimer) clearTimeout(autoMapTimer)
    }
  })

  function scheduleClearCopiedSecret() {
    if (copiedTimer) clearTimeout(copiedTimer)
    copiedTimer = setTimeout(() => {
      copiedSecret = null
      copiedTimer = null
    }, 2000)
  }

  function scheduleClearAutoMapResult() {
    if (autoMapTimer) clearTimeout(autoMapTimer)
    autoMapTimer = setTimeout(() => {
      autoMapResult = null
      autoMapTimer = null
    }, 5000)
  }

  interface EdgeData {
    id: string
    from: EdgeEndpoint
    to: EdgeEndpoint
    standard?: string
  }
  let edges = $state<EdgeData[]>([])

  /** Best human-readable name for a port endpoint: label > interfaceName > id */
  function portDisplay(ep: EdgeEndpoint): string | undefined {
    return ep.portInfo?.label || ep.portInfo?.interfaceName || ep.port
  }

  /** All names worth trying when matching this port against host interfaces. */
  function portMatchCandidates(ep: EdgeEndpoint): string[] {
    const info = ep.portInfo
    if (!info) return []
    return [info.interfaceName, info.label, ...(info.aliases ?? [])].filter((n): n is string => !!n)
  }

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

  let hasMetricsSource = $derived($mappingStore.metricsSources.length > 0)

  let topologySources = $derived(editableSources.filter((s) => s.purpose === 'topology'))
  let metricsSources = $derived(editableSources.filter((s) => s.purpose === 'metrics'))
  let hasMultipleTopologySources = $derived(topologySources.length >= 2)

  let overlaySources = $derived(
    currentSources.filter((s) => s.purpose === 'topology' && s.dataSourceId !== baseSourceId),
  )

  let filteredNodes = $derived(
    parsedTopology?.graph.nodes.filter((node) => {
      if (!nodeSearchQuery) return true
      const label = getNodeLabel(node).toLowerCase()
      return label.includes(nodeSearchQuery.toLowerCase())
    }) || [],
  )

  let mappedCount = $derived(
    parsedTopology?.graph.nodes.filter((n) => $nodeMapping[n.id]?.hostId).length || 0,
  )
  let totalNodes = $derived(parsedTopology?.graph.nodes.length || 0)
  let mappedLinksCount = $derived(
    edges.filter((e) => {
      const m = $linkMapping[e.id]
      return m?.monitoredNodeId && m?.interface
    }).length,
  )
  let totalLinks = $derived(edges.length)

  /** Hosts grouped by their owning data source, in source priority
   *  order. Drives `<optgroup>` rendering in the host dropdown so the
   *  operator sees which source each candidate comes from. */
  let hostsBySource = $derived.by(() => {
    const groups = new Map<string, { sourceName: string; items: typeof $mappingHosts }>()
    for (const h of $mappingHosts) {
      const g = groups.get(h.sourceId)
      if (g) g.items.push(h)
      else groups.set(h.sourceId, { sourceName: h.sourceName, items: [h] })
    }
    return [...groups.values()]
  })

  // ============================================
  // Lifecycle
  // ============================================

  onMount(async () => {
    // Check URL hash for initial tab
    const hash = window.location.hash.slice(1)
    if (hash === 'sources' || hash === 'mapping' || hash === 'discovery' || hash === 'resolved') {
      activeTab = hash
    }

    await loadData()
  })

  async function loadData() {
    try {
      const [topoData, renderResponse, sources, topoSources, metricsSrcs] = await Promise.all([
        api.topologies.get(topologyId),
        fetch(`/api/topologies/${topologyId}/render`).then((r) => r.json()),
        api.topologies.sources.list(topologyId),
        api.dataSources.listByCapability('topology'),
        api.dataSources.listByCapability('metrics'),
      ])

      topology = topoData
      topologies.upsert(topoData)
      renderData = { nodeCount: renderResponse.nodeCount, edgeCount: renderResponse.edgeCount }
      currentSources = sources
      topologyDataSources = topoSources
      metricsDataSources = metricsSrcs

      // Parse graph settings
      parseGraphSettings()

      // Initialize editable sources
      editableSources = sources.map((s) => ({
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
      for (const source of sources.filter((s) => s.purpose === 'topology')) {
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

      if (!baseSourceId && sources.filter((s) => s.purpose === 'topology').length > 0) {
        baseSourceId = sources.find((s) => s.purpose === 'topology')?.dataSourceId || null
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
          nodes: contextData.nodes.map((n) => ({
            id: n.id,
            label: n.label,
            spec: { type: n.type, vendor: n.vendor },
          })),
          links: contextData.edges.map((e) => ({
            id: e.id,
            from: e.from.nodeId,
            to: e.to.nodeId,
            standard: e.standard,
          })),
        },
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

  // edgeStyle / splineMode live on `NetworkGraph.settings` inside the
  // Manual source 's stored graph (config_json.graph). Read/write goes
  // through the data source config, not through observations.
  async function parseGraphSettings() {
    if (!topology?.manualSourceId) return
    try {
      const ds = await api.dataSources.get(topology.manualSourceId)
      const config = JSON.parse(ds.configJson || '{}') as {
        graph?: { settings?: { edgeStyle?: string; splineMode?: string } }
      }
      const settings = config.graph?.settings
      edgeStyle = settings?.edgeStyle || 'orthogonal'
      splineMode = settings?.splineMode || 'sloppy'
    } catch {
      // Use defaults
    }
  }

  async function updateEdgeStyle() {
    if (!topology?.manualSourceId) return
    savingEdgeStyle = true
    try {
      const ds = await api.dataSources.get(topology.manualSourceId)
      const config = JSON.parse(ds.configJson || '{}') as {
        graph?: { settings?: Record<string, unknown>; [k: string]: unknown }
        [k: string]: unknown
      }
      const graph = (config.graph ?? { version: '1', nodes: [], links: [] }) as {
        settings?: Record<string, unknown>
        [k: string]: unknown
      }
      graph.settings = (graph.settings ?? {}) as Record<string, unknown>
      graph.settings['edgeStyle'] = edgeStyle
      if (edgeStyle === 'splines') {
        graph.settings['splineMode'] = splineMode
      } else {
        delete graph.settings['splineMode']
      }
      config.graph = graph
      await dataSources.update(topology.manualSourceId, {
        configJson: JSON.stringify(config),
      })
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
      await topologies.delete(topology.id)
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
    return [...topologyDataSources, ...metricsDataSources].find((ds) => ds.id === id)
  }

  function getCurrentSource(dataSourceId: string, purpose: string): TopologyDataSource | undefined {
    return currentSources.find((s) => s.dataSourceId === dataSourceId && s.purpose === purpose)
  }

  function getSourcesByPurpose(purpose: 'topology' | 'metrics') {
    return editableSources.map((s, index) => ({ ...s, index })).filter((s) => s.purpose === purpose)
  }

  function addSource(purpose: 'topology' | 'metrics') {
    const availableSources = purpose === 'topology' ? topologyDataSources : metricsDataSources
    const existing = editableSources.filter((s) => s.purpose === purpose).map((s) => s.dataSourceId)
    const available = availableSources.filter((ds) => !existing.includes(ds.id))
    if (!available[0]) {
      alert('No data sources available. Create one on /datasources first.')
      return
    }
    editableSources = [
      ...editableSources,
      {
        dataSourceId: available[0].id,
        purpose,
        syncMode: 'manual',
        priority: existing.length,
      },
    ]
    hasSourceChanges = true
  }

  function removeSource(index: number) {
    editableSources = editableSources.filter((_, i) => i !== index)
    hasSourceChanges = true
  }

  function updateSource(index: number, updates: Partial<TopologyDataSourceInput>) {
    editableSources = editableSources.map((s, i) => (i === index ? { ...s, ...updates } : s))
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
      if (typeof raw.siteFilter === 'string')
        raw.siteFilter = raw.siteFilter ? [raw.siteFilter] : []
      if (typeof raw.tagFilter === 'string') raw.tagFilter = raw.tagFilter ? [raw.tagFilter] : []
      if (typeof raw.roleFilter === 'string')
        raw.roleFilter = raw.roleFilter ? [raw.roleFilter] : []
      if (typeof raw.excludeRoleFilter === 'string')
        raw.excludeRoleFilter = raw.excludeRoleFilter ? [raw.excludeRoleFilter] : []
      if (typeof raw.excludeTagFilter === 'string')
        raw.excludeTagFilter = raw.excludeTagFilter ? [raw.excludeTagFilter] : []
      return raw
    } catch {
      return {}
    }
  }

  function updateOptions(index: number, patch: Partial<NetBoxOptions>) {
    const current = parseOptions(editableSources[index]?.optionsJson)
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
    return current.includes(value) ? current.filter((v) => v !== value) : [...current, value]
  }

  async function handleSaveSources() {
    savingSources = true
    error = ''
    try {
      // Include merge config in optionsJson
      const sourcesWithMerge = editableSources.map((source) => {
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
      editableSources = updated.map((s) => ({
        dataSourceId: s.dataSourceId,
        purpose: s.purpose,
        syncMode: s.syncMode,
        priority: s.priority,
        optionsJson: s.optionsJson,
      }))
      hasSourceChanges = false
      // Sources changed — mapping store's metricsSources/hosts are now stale
      await mappingStore.load(topologyId, true)
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to save'
    } finally {
      savingSources = false
    }
  }

  /**
   * Load the resolved graph (for identity quality counts) and the
   * observation history. Called whenever the Discovery tab is opened
   * and after each per-source sync.
   */
  async function refreshDiscovery() {
    discoveryLoading = true
    try {
      const [graphResp, obsList, policy] = await Promise.all([
        api.topologies.getGraph(topologyId),
        api.topologies.listObservations(topologyId, 20),
        api.topologies.discoveryPolicy.get(topologyId),
      ])
      policyView = policy
      // Count identity quality + collect per-node card data.
      // Segment nodes (synthetic L2 transit, from subnet inference)
      // are not "grabbed" devices — they 're virtual stand-ins for
      // unknown L2 fabric. Exclude them from both the gauge and the
      // card grid.
      const counts = { stable: 0, weak: 0, unbound: 0, total: 0 }
      const cards: typeof discoveredNodes = []
      for (const node of graphResp.graph.nodes ?? []) {
        const isSegment =
          node.spec?.kind === 'hardware' && (node.spec as { type?: string }).type === 'segment'
        if (isSegment) continue
        const q = nodeIdentityQuality(node.identity)
        counts[q]++
        counts.total++
        const md = (node.metadata ?? {}) as Record<string, unknown>
        const label = Array.isArray(node.label) ? node.label.join(' ') : (node.label ?? node.id)
        const sourceId = node.provenance?.source
        const sourceDs = sourceId ? getDataSource(sourceId) : undefined
        cards.push({
          id: node.id,
          label,
          sysDescr: typeof md['sysDescr'] === 'string' ? (md['sysDescr'] as string) : undefined,
          model:
            typeof md['chassisModel'] === 'string' ? (md['chassisModel'] as string) : undefined,
          vendor: typeof md['vendor'] === 'string' ? (md['vendor'] as string) : undefined,
          mgmtIp: node.identity?.mgmtIp,
          sysName: node.identity?.sysName,
          chassisId: node.identity?.chassisId,
          sysObjectID:
            typeof md['sysObjectID'] === 'string' ? (md['sysObjectID'] as string) : undefined,
          catalogId: typeof md['catalogId'] === 'string' ? (md['catalogId'] as string) : undefined,
          quality: q,
          sourceId,
          sourceName: sourceDs?.name,
          sourceType: sourceDs?.type,
          observedAt: node.provenance?.observedAt,
        })
      }
      identityQuality = counts
      discoveredNodes = cards
      recentObservations = obsList
    } catch (e) {
      console.error('[Discovery] failed to refresh', e)
    } finally {
      discoveryLoading = false
    }
  }

  /** Sync exactly one attached topology source. */
  async function handleSyncOne(source: TopologyDataSource) {
    syncingSourceId = source.dataSourceId
    try {
      const result = await api.topologies.sources.syncOne(topologyId, source.dataSourceId)
      const counts = result.snapshot.graph ?? { nodes: [], links: [] }
      perSourceSync = {
        ...perSourceSync,
        [source.dataSourceId]: {
          status: result.snapshot.status,
          nodeCount: counts.nodes?.length ?? 0,
          linkCount: counts.links?.length ?? 0,
          message: result.snapshot.statusMessage,
          at: Date.now(),
        },
      }
      // Update topology re-render through the resolver.
      const updatedTopology = await api.topologies.get(topologyId)
      topology = updatedTopology
      topologies.upsert(updatedTopology)
      await refreshDiscovery()
    } catch (e) {
      perSourceSync = {
        ...perSourceSync,
        [source.dataSourceId]: {
          status: 'failed',
          nodeCount: 0,
          linkCount: 0,
          message: e instanceof Error ? e.message : 'Sync failed',
          at: Date.now(),
        },
      }
    } finally {
      syncingSourceId = null
    }
  }

  /**
   * Probe a single discovered node — re-run discovery against the
   * source that owns it. v1 just kicks the whole source 's sync
   * because the SNMP plugin doesn 't yet expose a single-target probe
   * endpoint; the UI affordance is per-card so a future targeted
   * scan can land transparently.
   */
  /**
   * Filter + search applied to the grabbed-node card grid. The summary
   * strip 's counters are derived from `discoveredNodes` (the
   * unfiltered set) so they always reflect the topology total, not
   * "what survived my filter".
   */
  let filteredDiscoveredNodes = $derived.by(() => {
    const q = discoverySearch.trim().toLowerCase()
    return discoveredNodes.filter((c) => {
      if (qualityFilter !== 'all' && c.quality !== qualityFilter) return false
      if (modeFilter !== 'all') {
        const eff = policyView?.nodes[c.id]
        if ((eff?.mode ?? policyView?.runtimeDefault.mode) !== modeFilter) return false
      }
      if (!q) return true
      const hay = [c.label, c.model, c.vendor, c.mgmtIp, c.sysName]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return hay.includes(q)
    })
  })

  /** Per-mode counters for the summary strip — derived from the full
   *  set, not the filtered set, on purpose (filter = "what to view",
   *  summary = "what the topology is"). */
  let modeCounts = $derived.by(() => {
    const out = { auto: 0, observe: 0, disabled: 0 }
    for (const c of discoveredNodes) {
      const m = policyView?.nodes[c.id]?.mode ?? policyView?.runtimeDefault.mode ?? 'auto'
      if (m === 'auto' || m === 'observe' || m === 'disabled') out[m]++
    }
    return out
  })

  /**
   * Patch the discovery override for a single node. The server returns
   * the new effective policy; we splice it into `policyView` so the
   * grid + modal update without a full refresh. On 409 (discovered-only
   * node), surface the message — the API contract documents this and
   * the user has to "pin to Manual" first (Phase A2 next).
   */
  async function setNodeDiscoveryMode(
    nodeId: string,
    discovery: { mode?: import('$lib/api').DiscoveryMode; intervalMs?: number } | null,
  ): Promise<{ ok: true } | { ok: false; reason: string }> {
    policyPatching = { ...policyPatching, [nodeId]: true }
    try {
      const { effective } = await api.topologies.discoveryPolicy.patch(topologyId, {
        scope: 'node',
        id: nodeId,
        discovery,
      })
      if (policyView) {
        policyView = {
          ...policyView,
          nodes: { ...policyView.nodes, [nodeId]: effective },
        }
      }
      // Clear any stale error from a prior failure on this node.
      if (policyError[nodeId]) {
        const next = { ...policyError }
        delete next[nodeId]
        policyError = next
      }
      return { ok: true }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'patch failed'
      policyError = { ...policyError, [nodeId]: msg }
      return { ok: false, reason: msg }
    } finally {
      policyPatching = { ...policyPatching, [nodeId]: false }
    }
  }

  /**
   * Apply a mode to every selected node in parallel. The PATCH endpoint
   * is per-node, so we fan out and gather. Errors are kept in
   * `policyError` so the operator can see which ones bounced (e.g.
   * discovered-only). Selection persists after apply so the operator
   * can retry / change strategy without re-selecting.
   */
  async function handleBulkSetMode(
    mode: import('$lib/api').DiscoveryMode | 'inherit',
  ): Promise<void> {
    if (bulkSelection.size === 0) return
    bulkApplying = true
    try {
      const ids = [...bulkSelection]
      await Promise.all(
        ids.map((id) => setNodeDiscoveryMode(id, mode === 'inherit' ? null : { mode })),
      )
    } finally {
      bulkApplying = false
    }
  }

  function toggleBulkSelection(nodeId: string): void {
    const next = new Set(bulkSelection)
    if (next.has(nodeId)) next.delete(nodeId)
    else next.add(nodeId)
    bulkSelection = next
  }

  /** Add (or remove) every currently-visible card to the selection.
   *  "Visible" = post-filter, so the operator can scope a bulk action
   *  by filtering first then "select all". */
  function toggleBulkSelectAll(): void {
    const visible = filteredDiscoveredNodes.map((c) => c.id)
    const allSelected = visible.every((id) => bulkSelection.has(id))
    const next = new Set(bulkSelection)
    if (allSelected) for (const id of visible) next.delete(id)
    else for (const id of visible) next.add(id)
    bulkSelection = next
  }

  /** Modal callback: change the node's discovery mode. `null` clears
   *  the per-node override (falls back through the inheritance chain). */
  async function handleSetMode(mode: import('$lib/api').DiscoveryMode | 'inherit'): Promise<void> {
    if (!detailNode) return
    const result = await setNodeDiscoveryMode(detailNode.id, mode === 'inherit' ? null : { mode })
    if (!result.ok) {
      // 409 / discovered-only landing: surface the reason in the modal.
      // The card row in the grid still shows the inherited mode; nothing
      // visibly broke, but the operator needs to know why their click
      // didn 't stick.
      console.warn('[Discovery] policy patch failed:', result.reason)
    }
  }

  let probingNodeId = $state<string | null>(null)
  async function handleProbeNode(card: (typeof discoveredNodes)[number]) {
    if (!card.sourceId || !card.mgmtIp) return
    probingNodeId = card.id
    try {
      await api.topologies.sources.probe(topologyId, card.sourceId, [card.mgmtIp])
      await refreshDiscovery()
      // The card object we hand the modal isn 't reactive to
      // discoveredNodes regenerating, so re-bind it explicitly when
      // the user just probed.
      if (detailNode?.id === card.id) {
        const refreshed = discoveredNodes.find((c) => c.id === card.id)
        if (refreshed) detailNode = refreshed
      }
    } catch (e) {
      console.error('[Discovery] probe failed', e)
    } finally {
      probingNodeId = null
    }
  }

  function formatAgo(ts: number): string {
    const diff = Date.now() - ts
    if (diff < 60_000) return 'just now'
    if (diff < 3600_000) return `${Math.floor(diff / 60_000)}m ago`
    if (diff < 86400_000) return `${Math.floor(diff / 3600_000)}h ago`
    return new Date(ts).toLocaleString()
  }

  // Re-load Discovery data whenever the tab is opened.
  $effect(() => {
    if (activeTab === 'discovery' && topology) {
      void refreshDiscovery()
    }
  })

  // Re-fetch the resolved graph whenever the Resolved tab is opened.
  // Cheap — server already caches the parsed topology and re-uses it.
  $effect(() => {
    if (activeTab === 'resolved' && topology) {
      void loadResolved()
    }
  })

  function getWebhookUrl(source: TopologyDataSource): string {
    return `${window.location.origin}/api/webhooks/topology/${source.webhookSecret}`
  }

  async function copyWebhookUrl(source: TopologyDataSource) {
    await navigator.clipboard.writeText(getWebhookUrl(source))
    copiedSecret = source.id
    scheduleClearCopiedSecret()
  }

  // Merge functions
  function parseMergeConfig(optionsJson?: string): MergeConfig {
    if (!optionsJson) return {}
    try {
      return JSON.parse(optionsJson)
    } catch {
      return {}
    }
  }

  function getOtherOptions(optionsJson?: string): Record<string, unknown> {
    if (!optionsJson) return {}
    try {
      const parsed = JSON.parse(optionsJson)
      const {
        isBase,
        match,
        matchAttribute,
        idMapping,
        onMatch,
        onUnmatched,
        subgraphName,
        ...rest
      } = parsed
      return rest
    } catch {
      return {}
    }
  }

  function setBaseSource(dataSourceId: string) {
    baseSourceId = dataSourceId
    hasSourceChanges = true
  }

  function updateOverlayConfig(dataSourceId: string, updates: Partial<OverlayConfig>) {
    const prevConfig = overlayConfigs[dataSourceId]
    if (prevConfig) {
      overlayConfigs[dataSourceId] = {
        ...prevConfig,
        ...updates,
      }
    }

    hasSourceChanges = true
  }

  function getSourceName(dataSourceId: string): string {
    const source = currentSources.find((s) => s.dataSourceId === dataSourceId)
    return source?.dataSource?.name || dataSourceId
  }

  function getSourceType(dataSourceId: string): string {
    const source = currentSources.find((s) => s.dataSourceId === dataSourceId)
    return source?.dataSource?.type || 'unknown'
  }

  // ============================================
  // Mapping Tab Functions
  // ============================================

  function getNodeLabel(node: { id: string; label?: string | string[] }): string {
    return resolveNodeLabel(node)
  }

  function getNodeLabelById(nodeId: string): string {
    return nodeLabelById(parsedTopology?.graph.nodes, nodeId)
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
    const host = $mappingHosts.find((h) => h.id === hostId)
    mappingStore.updateNode(
      nodeId,
      hostId ? { hostId, hostName: host?.name || host?.displayName } : {},
    )
    if (hostId) mappingStore.loadHostInterfaces(hostId)
  }

  function handleAutoMap() {
    if (!parsedTopology) return
    autoMapResult = {
      ...mappingStore.autoMapNodes(parsedTopology.graph.nodes, { overwrite: false }),
      kind: 'nodes',
    }
    scheduleClearAutoMapResult()
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
      mappingStore.updateLink(linkId, {
        ...existing,
        monitoredNodeId: nodeId,
        interface: undefined,
      })
      const hostId = $nodeMapping[nodeId]?.hostId
      if (hostId) mappingStore.loadHostInterfaces(hostId)
    } else {
      mappingStore.updateLink(linkId, {
        ...existing,
        monitoredNodeId: undefined,
        interface: undefined,
      })
    }
  }

  function handleLinkInterfaceChange(linkId: string, interfaceName: string) {
    const existing = $linkMapping[linkId] || {}
    mappingStore.updateLink(linkId, { ...existing, interface: interfaceName || undefined })
  }

  const standardBandwidths = new Set([
    '100000000',
    '1000000000',
    '10000000000',
    '25000000000',
    '40000000000',
    '100000000000',
  ])
  let customBandwidthLinks = $state(new Set<string>())

  function bandwidthToSelectValue(linkId: string, bandwidth?: number): string {
    if (customBandwidthLinks.has(linkId)) return 'custom'
    if (!bandwidth) return ''
    const s = String(bandwidth)
    return standardBandwidths.has(s) ? s : 'custom'
  }

  function handleLinkBandwidthChange(linkId: string, bandwidthBps: number | undefined) {
    const existing = $linkMapping[linkId] || {}
    if (bandwidthBps !== undefined) {
      mappingStore.updateLink(linkId, { ...existing, bandwidth: bandwidthBps })
    } else {
      const { bandwidth: _, ...rest } = existing
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

      if (fromHostId && fromInterfaces.length > 0) {
        const match = findMatchingInterface(portMatchCandidates(edge.from), fromInterfaces)
        if (match) {
          monitoredNodeId = edge.from.nodeId
          matchedInterface = match
        }
      }
      if (!matchedInterface && toHostId && toInterfaces.length > 0) {
        const match = findMatchingInterface(portMatchCandidates(edge.to), toInterfaces)
        if (match) {
          monitoredNodeId = edge.to.nodeId
          matchedInterface = match
        }
      }
      if (!matchedInterface) {
        if (fromHostId && fromInterfaces.length > 0) monitoredNodeId = edge.from.nodeId
        else if (toHostId && toInterfaces.length > 0) monitoredNodeId = edge.to.nodeId
      }

      if (monitoredNodeId && matchedInterface) {
        mappingStore.updateLink(edge.id, {
          ...currentMapping,
          monitoredNodeId,
          interface: matchedInterface,
        })
        matched++
      } else if (monitoredNodeId && !currentMapping.monitoredNodeId) {
        mappingStore.updateLink(edge.id, { ...currentMapping, monitoredNodeId })
      }
    }
    return matched
  }

  /**
   * Try each candidate name (label, interfaceName, aliases) against the host's
   * interfaces and pick the best-scoring match. Falls back to a single-candidate
   * heuristic if enabled and we have no signal.
   */
  function findMatchingInterface(
    portNames: string[],
    interfaces: Array<{ name: string }>,
  ): string | null {
    if (portNames.length === 0) {
      return singleCandidateFallback && interfaces.length === 1
        ? (interfaces[0]?.name ?? null)
        : null
    }
    const candidateNames = interfaces.map((i) => i.name)
    let best: string | null = null
    for (const name of portNames) {
      const match = findBestInterfaceMatch(name, candidateNames, { singleCandidateFallback })
      if (match) {
        // First successful match wins (candidates are ordered most→least specific)
        best = match
        break
      }
    }
    return best
  }

  const componentId = $props.id()
  const groupBySelectorId = `${componentId}:groupBy`
  const matchStrategySelectorId = `${componentId}:matchStrategy`
  const unmatchedNodesSelectorId = `${componentId}:unmatchedNodes`
  const idMappingId = `${componentId}:idMapping`
  const subgraphNameId = `${componentId}:subgraph`
</script>

<svelte:head> <title>Settings - {topology?.name || 'Topology'} - Shumoku</title> </svelte:head>

<div class="p-6 max-w-4xl mx-auto">
  {#if loading}
    <div class="flex items-center justify-center py-12">
      <div
        class="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"
      ></div>
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
        <ArrowLeftIcon size={16} />
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
        onclick={() => {
          activeTab = 'sources'
          history.replaceState(null, '', '#sources')
        }}
      >
        Sources
      </button>
      <button
        class="px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px
          {activeTab === 'discovery'
            ? 'text-primary border-primary'
            : 'text-theme-text-muted border-transparent hover:text-theme-text'}"
        onclick={() => {
          activeTab = 'discovery'
          history.replaceState(null, '', '#discovery')
        }}
      >
        Discovery
      </button>
      <button
        class="px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px
          {activeTab === 'mapping'
            ? 'text-primary border-primary'
            : 'text-theme-text-muted border-transparent hover:text-theme-text'}"
        onclick={() => {
          activeTab = 'mapping'
          history.replaceState(null, '', '#mapping')
        }}
      >
        Mapping
      </button>
      <button
        class="px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px
          {activeTab === 'resolved'
            ? 'text-primary border-primary'
            : 'text-theme-text-muted border-transparent hover:text-theme-text'}"
        onclick={() => {
          activeTab = 'resolved'
          history.replaceState(null, '', '#resolved')
        }}
      >
        Resolved
      </button>
    </div>

    {#if error}
      <div class="p-3 bg-danger/10 border border-danger/20 rounded-lg text-danger text-sm mb-6">
        {error}
      </div>
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
                  <p class="text-xl font-semibold text-theme-text-emphasis">
                    {renderData.nodeCount}
                  </p>
                </div>
                <div class="bg-theme-bg rounded-lg p-3">
                  <p class="text-xs text-theme-text-muted">Edges</p>
                  <p class="text-xl font-semibold text-theme-text-emphasis">
                    {renderData.edgeCount}
                  </p>
                </div>
                <div class="bg-theme-bg rounded-lg p-3">
                  <p class="text-xs text-theme-text-muted">Updated</p>
                  <p class="text-sm text-theme-text">
                    {new Date(topology.updatedAt).toLocaleDateString()}
                  </p>
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
                <label for="splineMode" class="text-sm text-theme-text block mb-1">
                  Spline Mode
                </label>
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

            <hr class="border-theme-border">

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
              >
            </label>

            <label
              class="flex items-center justify-between cursor-pointer {!$liveUpdatesEnabled ? 'opacity-50' : ''}"
            >
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
              >
            </label>

            <label
              class="flex items-center justify-between cursor-pointer {!$liveUpdatesEnabled ? 'opacity-50' : ''}"
            >
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
              >
            </label>
          </div>
        </div>

        <!-- Actions -->
        <div class="card">
          <div class="card-header">
            <h2 class="font-medium text-theme-text-emphasis">Actions</h2>
          </div>
          <div class="card-body">
            {#if topology.manualSourceId}
              <a
                href="/datasources/{topology.manualSourceId}"
                class="btn btn-secondary w-full justify-center"
              >
                <PencilSimpleIcon size={16} class="mr-2" />
                Edit Manual content
              </a>
            {/if}
          </div>
        </div>

        <!-- Danger Zone -->
        <div class="card border-danger/30">
          <div class="card-header">
            <h2 class="font-medium text-danger">Danger Zone</h2>
          </div>
          <div class="card-body">
            <p class="text-xs text-theme-text-muted mb-3">
              Once deleted, this topology cannot be recovered.
            </p>
            <Button
              variant="destructive"
              class="w-full justify-center"
              onclick={handleDelete}
              disabled={deleting}
            >
              {#if deleting}
                <span
                  class="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2"
                ></span>
              {:else}
                <TrashIcon size={16} class="mr-2" />
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
              <span
                class="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2"
              ></span>
            {:else}
              <FloppyDiskIcon size={16} class="mr-2" />
            {/if}
            Save Changes
          </Button>
        </div>

        <!-- Topology Sources — declarative: which sources are attached and
             how they 're configured. The "go grab data" actions (Sync now /
             Sync all) live in the Discovery tab. -->
        <div class="card">
          <div class="card-header flex items-center justify-between">
            <h2 class="font-medium text-theme-text-emphasis">Topology Sources</h2>
            <Button variant="outline" size="sm" onclick={() => addSource('topology')}>
              <PlusIcon size={16} class="mr-1" />
              Add
            </Button>
          </div>

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
                            >
                            <Button
                              variant="outline"
                              size="sm"
                              onclick={() => copyWebhookUrl(currentSource)}
                            >
                              {#if copiedSecret === currentSource.id}
                                <CheckCircleIcon size={16} class="text-success" />
                              {:else}
                                <CopyIcon size={16} />
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
                            <p
                              class="text-xs font-medium text-theme-text-muted uppercase tracking-wide"
                            >
                              NetBox Options
                            </p>

                            <div class="flex items-center gap-4">
                              <label for={groupBySelectorId} class="text-xs text-theme-text-muted">
                                Group By
                              </label>
                              <select
                                id={groupBySelectorId}
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
                                      >
                                        {site.name}
                                      </button>
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
                                      >
                                        {tag.name}
                                      </button>
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
                                      >
                                        {role.name}
                                      </button>
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
                                      >
                                        {role.name}
                                      </button>
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
                                      >
                                        {tag.name}
                                      </button>
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
                      <Button
                        variant="ghost"
                        size="sm"
                        class="text-danger hover:bg-danger/10"
                        onclick={() => removeSource(source.index)}
                      >
                        <TrashIcon size={16} />
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
                <StarIcon size={18} weight="fill" class="text-warning" />
                Merge Configuration
              </h2>
            </div>
            <div class="card-body space-y-4">
              <!-- Base source selection -->
              <div>
                <p class="text-xs text-theme-text-muted mb-2">
                  Base Source (others merge into this)
                </p>
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
                  <ArrowDownIcon size={20} class="text-theme-text-muted" />
                </div>

                {#each overlaySources as source}
                  {@const config = overlayConfigs[source.dataSourceId] || { match: 'name', onMatch: 'merge-properties', onUnmatched: 'add-to-subgraph' }}
                  <div class="border border-theme-border rounded-lg p-4">
                    <h3 class="font-medium text-theme-text-emphasis mb-3">
                      {getSourceName(source.dataSourceId)}
                    </h3>
                    <div class="grid grid-cols-2 gap-3">
                      <div>
                        <label for={matchStrategySelectorId} class="text-xs text-theme-text-muted">
                          Match Strategy
                        </label>
                        <select
                          id={matchStrategySelectorId}
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
                        <label for={unmatchedNodesSelectorId} class="text-xs text-theme-text-muted">
                          Unmatched Nodes
                        </label>
                        <select
                          id={unmatchedNodesSelectorId}
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
                          <label for={idMappingId} class="text-xs text-theme-text-muted">
                            ID Mapping (JSON)
                          </label>
                          <textarea
                            id={idMappingId}
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
                          <label for={subgraphNameId} class="text-xs text-theme-text-muted">
                            Subgraph Name
                          </label>
                          <input
                            id={subgraphNameId}
                            type="text"
                            class="input mt-1"
                            placeholder={getSourceType(source.dataSourceId)}
                            value={config.subgraphName || ''}
                            onchange={(e) => updateOverlayConfig(source.dataSourceId, { subgraphName: e.currentTarget.value })}
                          >
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
              <PlusIcon size={16} class="mr-1" />
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
                    <Button
                      variant="ghost"
                      size="sm"
                      class="text-danger hover:bg-danger/10"
                      onclick={() => removeSource(source.index)}
                    >
                      <TrashIcon size={16} />
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
    <!-- Discovery Tab — imperative: drive attached sources to fetch     -->
    <!-- fresh data. Each source 's last observation lands as a snapshot -->
    <!-- in topology_observations and the diagram re-renders through    -->
    <!-- resolve(). Sources tab is declarative; this tab is action.     -->
    <!-- ============================================ -->
    {#if activeTab === 'discovery'}
      <div class="space-y-6">
        {#if topologySources.length === 0}
          <div class="card p-8 text-center space-y-2">
            <p class="text-theme-text-emphasis font-medium">No sources to discover from</p>
            <p class="text-sm text-theme-text-muted">
              Discovery runs against attached topology sources — NetBox, Network Discovery, Zabbix
              and so on. Attach one first.
            </p>
            <div class="pt-2">
              <Button
                variant="secondary"
                size="sm"
                onclick={() => {
                  activeTab = 'sources'
                  history.replaceState(null, '', '#sources')
                }}
              >
                Go to Sources →
              </Button>
            </div>
          </div>
        {:else}
          <!-- Summary strip — combines identity-binding (how reliably
               each node is locked-on across re-scans) with the policy
               distribution (how the scheduler is configured to treat
               it). One row, six clickable chips that double as filters
               so the operator sees the topology shape AND drills down
               in the same gesture. -->
          <div class="card">
            <div class="card-header flex items-center justify-between gap-3">
              <div>
                <h2 class="font-medium text-theme-text-emphasis">Overview</h2>
                <p class="text-xs text-theme-text-muted mt-0.5">
                  Identity binding (掴み) on the left, scheduler policy on the right. Click a chip
                  to filter the grid below.
                </p>
              </div>
              {#if policyView}
                {@const def =
                  policyView.topologyDefault?.mode ?? policyView.runtimeDefault.mode}
                <span class="text-xs text-theme-text-muted whitespace-nowrap">
                  topology default: <span class="font-mono">{def}</span>
                </span>
              {/if}
            </div>
            <div class="card-body">
              <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 text-center">
                <button
                  type="button"
                  class="rounded-lg border p-3 transition-colors cursor-pointer text-left {qualityFilter ===
                  'stable'
                    ? 'border-primary ring-1 ring-primary/40'
                    : 'border-theme-border hover:border-theme-text-muted'}"
                  onclick={() =>
                    (qualityFilter = qualityFilter === 'stable' ? 'all' : 'stable')}
                >
                  <p class="text-2xl font-semibold text-green-600 dark:text-green-400">
                    {identityQuality.stable}
                  </p>
                  <p class="text-xs text-theme-text-muted mt-1">🟢 stable</p>
                </button>
                <button
                  type="button"
                  class="rounded-lg border p-3 transition-colors cursor-pointer text-left {qualityFilter ===
                  'weak'
                    ? 'border-primary ring-1 ring-primary/40'
                    : 'border-theme-border hover:border-theme-text-muted'}"
                  onclick={() => (qualityFilter = qualityFilter === 'weak' ? 'all' : 'weak')}
                >
                  <p class="text-2xl font-semibold text-amber-600 dark:text-amber-400">
                    {identityQuality.weak}
                  </p>
                  <p class="text-xs text-theme-text-muted mt-1">🟡 weak</p>
                </button>
                <button
                  type="button"
                  class="rounded-lg border p-3 transition-colors cursor-pointer text-left {qualityFilter ===
                  'unbound'
                    ? 'border-primary ring-1 ring-primary/40'
                    : 'border-theme-border hover:border-theme-text-muted'}"
                  onclick={() =>
                    (qualityFilter = qualityFilter === 'unbound' ? 'all' : 'unbound')}
                >
                  <p class="text-2xl font-semibold text-theme-text-muted">
                    {identityQuality.unbound}
                  </p>
                  <p class="text-xs text-theme-text-muted mt-1">🔴 unbound</p>
                </button>
                <button
                  type="button"
                  class="rounded-lg border p-3 transition-colors cursor-pointer text-left {modeFilter ===
                  'auto'
                    ? 'border-primary ring-1 ring-primary/40'
                    : 'border-theme-border hover:border-theme-text-muted'}"
                  onclick={() => (modeFilter = modeFilter === 'auto' ? 'all' : 'auto')}
                >
                  <p class="text-2xl font-semibold text-sky-600 dark:text-sky-400">
                    {modeCounts.auto}
                  </p>
                  <p class="text-xs text-theme-text-muted mt-1">auto</p>
                </button>
                <button
                  type="button"
                  class="rounded-lg border p-3 transition-colors cursor-pointer text-left {modeFilter ===
                  'observe'
                    ? 'border-primary ring-1 ring-primary/40'
                    : 'border-theme-border hover:border-theme-text-muted'}"
                  onclick={() =>
                    (modeFilter = modeFilter === 'observe' ? 'all' : 'observe')}
                >
                  <p class="text-2xl font-semibold text-violet-600 dark:text-violet-400">
                    {modeCounts.observe}
                  </p>
                  <p class="text-xs text-theme-text-muted mt-1">observe</p>
                </button>
                <button
                  type="button"
                  class="rounded-lg border p-3 transition-colors cursor-pointer text-left {modeFilter ===
                  'disabled'
                    ? 'border-primary ring-1 ring-primary/40'
                    : 'border-theme-border hover:border-theme-text-muted'}"
                  onclick={() =>
                    (modeFilter = modeFilter === 'disabled' ? 'all' : 'disabled')}
                >
                  <p class="text-2xl font-semibold text-theme-text-muted">{modeCounts.disabled}</p>
                  <p class="text-xs text-theme-text-muted mt-1">disabled</p>
                </button>
              </div>
              {#if identityQuality.total === 0 && !discoveryLoading}
                <p class="text-xs text-theme-text-muted text-center mt-3">
                  No nodes resolved yet. Sync a source below to populate.
                </p>
              {/if}
            </div>
          </div>

          <!-- Grabbed nodes — card grid showing every node that
               discovery has locked-on. Synthetic L2 segments are
               filtered out (they 're stand-ins, not grabbed devices). -->
          {#if discoveredNodes.length > 0}
            <div class="card">
              <div class="card-header flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <h2 class="font-medium text-theme-text-emphasis">
                    Grabbed nodes
                    <span class="text-xs text-theme-text-muted ml-2">
                      {#if filteredDiscoveredNodes.length === discoveredNodes.length}
                        ({discoveredNodes.length})
                      {:else}
                        ({filteredDiscoveredNodes.length}
                        of {discoveredNodes.length})
                      {/if}
                    </span>
                  </h2>
                  <p class="text-xs text-theme-text-muted mt-0.5">
                    Click to see identity / probe / change discovery mode.
                  </p>
                </div>
                <div class="flex items-center gap-2">
                  <input
                    type="text"
                    bind:value={discoverySearch}
                    placeholder="Search by name, IP, model…"
                    class="text-sm rounded border border-theme-border bg-theme-bg px-2 py-1 w-56 placeholder:text-theme-text-muted/70"
                  >
                  {#if modeFilter !== 'all' || qualityFilter !== 'all' || discoverySearch}
                    <button
                      type="button"
                      class="text-xs text-theme-text-muted hover:text-theme-text-emphasis"
                      onclick={() => {
                        modeFilter = 'all'
                        qualityFilter = 'all'
                        discoverySearch = ''
                      }}
                    >
                      Clear filters
                    </button>
                  {/if}
                </div>
              </div>
              <div class="card-body">
                {#if filteredDiscoveredNodes.length === 0}
                  <p class="text-xs text-theme-text-muted text-center py-6">
                    No nodes match the current filters.
                  </p>
                {:else}
                  <!-- Bulk-action bar — appears only when something is
                       selected. "Select all" toggles every visible card
                       so filter + select-all = scoped bulk action. -->
                  <div class="flex items-center justify-between gap-3 mb-3 text-xs flex-wrap">
                    <button
                      type="button"
                      class="text-theme-text-muted hover:text-theme-text-emphasis"
                      onclick={toggleBulkSelectAll}
                    >
                      {filteredDiscoveredNodes.every((c) => bulkSelection.has(c.id))
                        ? 'Deselect all'
                        : `Select all (${filteredDiscoveredNodes.length})`}
                    </button>
                    {#if bulkSelection.size > 0}
                      <div class="flex items-center gap-2 ml-auto">
                        <span class="text-theme-text-muted">
                          {bulkSelection.size}
                          selected → set mode:
                        </span>
                        <button
                          type="button"
                          class="px-2 py-1 rounded border border-theme-border hover:border-primary disabled:opacity-50"
                          disabled={bulkApplying}
                          onclick={() => handleBulkSetMode('auto')}
                        >
                          auto
                        </button>
                        <button
                          type="button"
                          class="px-2 py-1 rounded border border-theme-border hover:border-primary disabled:opacity-50"
                          disabled={bulkApplying}
                          onclick={() => handleBulkSetMode('observe')}
                        >
                          observe
                        </button>
                        <button
                          type="button"
                          class="px-2 py-1 rounded border border-theme-border hover:border-primary disabled:opacity-50"
                          disabled={bulkApplying}
                          onclick={() => handleBulkSetMode('disabled')}
                        >
                          disabled
                        </button>
                        <button
                          type="button"
                          class="px-2 py-1 rounded border border-theme-border hover:border-primary disabled:opacity-50 text-theme-text-muted"
                          disabled={bulkApplying}
                          onclick={() => handleBulkSetMode('inherit')}
                        >
                          inherit
                        </button>
                        <button
                          type="button"
                          class="text-theme-text-muted hover:text-theme-text-emphasis ml-1"
                          disabled={bulkApplying}
                          onclick={() => (bulkSelection = new Set())}
                        >
                          clear
                        </button>
                        {#if bulkApplying}
                          <span class="text-theme-text-muted">applying…</span>
                        {/if}
                      </div>
                    {/if}
                  </div>
                  <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {#each filteredDiscoveredNodes as card (card.id)}
                      {@const qualityColor =
                        card.quality === 'stable'
                          ? 'bg-green-500'
                          : card.quality === 'weak'
                            ? 'bg-amber-500'
                            : 'bg-neutral-500'}
                      {@const eff = policyView?.nodes[card.id]}
                      {@const effMode = eff?.mode ?? policyView?.runtimeDefault.mode ?? 'auto'}
                      {@const modeTone =
                        effMode === 'disabled'
                          ? 'text-theme-text-muted bg-theme-bg-canvas/60'
                          : effMode === 'observe'
                            ? 'text-violet-700 dark:text-violet-300 bg-violet-500/10'
                            : 'text-sky-700 dark:text-sky-300 bg-sky-500/10'}
                      {@const inherited = eff && eff.source.mode !== 'node'}
                      {@const selected = bulkSelection.has(card.id)}
                      <div
                        class="relative rounded-lg border p-3 hover:border-primary hover:bg-theme-bg-canvas/30 transition-colors {selected
                          ? 'border-primary ring-1 ring-primary/30'
                          : 'border-theme-border'} {effMode === 'disabled' ? 'opacity-70' : ''}"
                      >
                        <!-- Selection checkbox — stopPropagation so
                             clicking it doesn 't also open the modal. -->
                        <input
                          type="checkbox"
                          class="absolute top-2 right-2 cursor-pointer"
                          checked={selected}
                          onclick={(e) => {
                            e.stopPropagation()
                            toggleBulkSelection(card.id)
                          }}
                          aria-label="Select {card.label}"
                        >
                        <button
                          type="button"
                          class="text-left w-full cursor-pointer"
                          onclick={() => {
                            detailNode = card
                          }}
                        >
                          <div class="flex items-start gap-2 pr-6">
                            <span
                              class="inline-block w-2 h-2 rounded-full mt-1.5 flex-shrink-0 {qualityColor}"
                              title={card.quality}
                            ></span>
                            <div class="min-w-0 flex-1">
                              <p class="font-medium text-sm text-theme-text-emphasis truncate">
                                {card.label}
                              </p>
                              <p class="text-xs text-theme-text-muted truncate">
                                {card.model ?? card.vendor ?? card.sysDescr?.split(',')[0] ?? '—'}
                              </p>
                              <p class="text-xs text-theme-text-muted font-mono mt-0.5">
                                {card.mgmtIp ?? '—'}
                              </p>
                            </div>
                            <span
                              class="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded {modeTone} whitespace-nowrap"
                              title={inherited
                              ? `inherited from ${eff?.source.mode}`
                              : 'per-node override'}
                            >
                              {effMode}
                              {#if inherited}
                                <span class="ml-0.5 opacity-60">·inh</span>
                              {/if}
                            </span>
                          </div>
                          <div
                            class="mt-3 pt-2 border-t border-theme-border/50 text-xs text-theme-text-muted"
                          >
                            {card.quality}
                            {#if card.observedAt}
                              · {formatAgo(card.observedAt)}
                            {/if}
                          </div>
                        </button>
                      </div>
                    {/each}
                  </div>
                {/if}
              </div>
            </div>
          {/if}

          <!-- Per-source sync — per-row Sync now. -->
          <div class="card">
            <div class="card-header">
              <h2 class="font-medium text-theme-text-emphasis">Sources</h2>
              <p class="text-xs text-theme-text-muted mt-0.5">
                Drive each attached source. Results land as observation snapshots and the diagram
                re-renders through the resolver.
              </p>
            </div>
            {#if hasSourceChanges}
              <div class="px-4 py-2 bg-warning/10 border-t border-warning/20 text-warning text-sm">
                You have unsaved changes in Sources. Save them before syncing.
              </div>
            {/if}
            <div class="card-body space-y-2">
              {#each currentSources.filter((s) => s.purpose === 'topology') as source (source.id)}
                {@const dataSource = getDataSource(source.dataSourceId)}
                {@const lastResult = perSourceSync[source.dataSourceId]}
                <div class="rounded-lg border border-theme-border p-3 space-y-2">
                  <div class="flex items-start justify-between gap-3">
                    <div class="min-w-0 flex-1">
                      <div class="flex items-center gap-2 flex-wrap">
                        <h3 class="text-sm font-medium text-theme-text-emphasis truncate">
                          {dataSource?.name ?? source.dataSourceId}
                        </h3>
                        <span
                          class="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-theme-bg font-mono text-theme-text-muted"
                        >
                          {dataSource?.type ?? '—'}
                        </span>
                        {#if dataSource?.status === 'connected'}
                          <span class="badge badge-success text-xs">connected</span>
                        {:else if dataSource?.status === 'disconnected'}
                          <span class="badge badge-danger text-xs" title={dataSource.statusMessage}>
                            disconnected
                          </span>
                        {:else}
                          <span class="badge badge-secondary text-xs">unknown</span>
                        {/if}
                      </div>
                      <p class="text-xs text-theme-text-muted mt-1">
                        {#if source.lastSyncedAt}
                          last synced {formatAgo(source.lastSyncedAt)}
                        {:else}
                          never synced
                        {/if}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onclick={() => handleSyncOne(source)}
                      disabled={syncingSourceId === source.dataSourceId || hasSourceChanges}
                    >
                      {#if syncingSourceId === source.dataSourceId}
                        <span
                          class="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin mr-1"
                        ></span>
                        Syncing…
                      {:else}
                        <ArrowsClockwiseIcon size={12} class="mr-1" />
                        Sync now
                      {/if}
                    </Button>
                  </div>
                  {#if lastResult}
                    <p class="text-xs">
                      {#if lastResult.status === 'ok'}
                        <span class="text-theme-text-muted">
                          ✓ {lastResult.nodeCount} nodes / {lastResult.linkCount} links ·
                          {formatAgo(
                            lastResult.at,
                          )}
                        </span>
                      {:else if lastResult.status === 'partial'}
                        <span class="text-amber-600 dark:text-amber-400" title={lastResult.message}>
                          ⚠ partial: {lastResult.nodeCount} nodes / {lastResult.linkCount} links ·
                          {formatAgo(lastResult.at)}
                        </span>
                      {:else if lastResult.status === 'empty'}
                        <span class="text-theme-text-muted">
                          no devices observed · {formatAgo(lastResult.at)}
                        </span>
                      {:else}
                        <span class="text-red-500" title={lastResult.message}>
                          ✗ {lastResult.message ?? 'failed'}
                        </span>
                      {/if}
                    </p>
                  {/if}
                </div>
              {/each}
            </div>
          </div>

          <!-- Observation history -->
          <div class="card">
            <div class="card-header">
              <h2 class="font-medium text-theme-text-emphasis">Recent observations</h2>
              <p class="text-xs text-theme-text-muted mt-0.5">
                Last 20 snapshots across all sources.
              </p>
            </div>
            <div class="card-body">
              {#if recentObservations.length === 0}
                <p class="text-xs text-theme-text-muted text-center py-4">
                  No observations yet. Sync a source above to record one.
                </p>
              {:else}
                <div class="overflow-x-auto">
                  <table class="w-full text-xs">
                    <thead>
                      <tr class="border-b border-theme-border text-left text-theme-text-muted">
                        <th class="py-1.5 font-medium">When</th>
                        <th class="py-1.5 font-medium">Source</th>
                        <th class="py-1.5 font-medium">Status</th>
                        <th class="py-1.5 font-medium text-right">Nodes</th>
                        <th class="py-1.5 font-medium text-right">Links</th>
                        <th class="py-1.5 font-medium text-right">Ports</th>
                      </tr>
                    </thead>
                    <tbody>
                      {#each recentObservations as o (o.id)}
                        {@const ds = getDataSource(o.sourceId)}
                        <tr class="border-b border-theme-border last:border-0">
                          <td class="py-1.5">{formatAgo(o.capturedAt)}</td>
                          <td class="py-1.5 font-mono text-theme-text-muted">
                            {ds?.name ?? o.sourceId}
                          </td>
                          <td class="py-1.5">
                            {#if o.status === 'ok'}
                              <span class="text-green-600 dark:text-green-400">✓ ok</span>
                            {:else if o.status === 'partial'}
                              <span class="text-amber-600 dark:text-amber-400">⚠ partial</span>
                            {:else if o.status === 'empty'}
                              <span class="text-theme-text-muted">empty</span>
                            {:else}
                              <span class="text-red-500" title={o.statusMessage}>✗ failed</span>
                            {/if}
                          </td>
                          <td class="py-1.5 text-right">{o.nodeCount}</td>
                          <td class="py-1.5 text-right">{o.linkCount}</td>
                          <td class="py-1.5 text-right">{o.portCount}</td>
                        </tr>
                      {/each}
                    </tbody>
                  </table>
                </div>
              {/if}
            </div>
          </div>
        {/if}
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
              {mappedCount}/{totalNodes}
              nodes • {mappedLinksCount}/{totalLinks}
              links
            </div>
            <Button onclick={handleSaveMapping} disabled={savingMapping}>
              {#if savingMapping}
                <span
                  class="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2"
                ></span>
              {:else}
                <FloppyDiskIcon size={16} class="mr-2" />
              {/if}
              Save Mapping
            </Button>
          </div>

          {#if autoMapResult}
            <div
              class="p-3 bg-success/10 border border-success/20 rounded-lg text-success text-sm flex items-center gap-2"
            >
              <CheckCircleIcon size={16} />
              Auto-mapped {autoMapResult.matched} of {autoMapResult.total} {autoMapResult.kind}
            </div>
          {/if}

          <!-- Node Mapping -->
          <div class="card">
            <div class="card-header">
              <div class="flex items-center justify-between gap-4 mb-3">
                <h2 class="font-medium text-theme-text-emphasis">Node Mapping</h2>
                <div class="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onclick={handleAutoMap}
                    disabled={$mappingStore.hostsLoading}
                  >
                    <LightningIcon size={14} class="mr-1" />
                    Auto-map
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onclick={handleClearAll}
                    disabled={mappedCount === 0}
                  >
                    <TrashIcon size={14} class="mr-1" />
                    Clear
                  </Button>
                </div>
              </div>
              <div class="relative">
                <MagnifyingGlassIcon
                  size={16}
                  class="absolute left-3 top-1/2 -translate-y-1/2 text-theme-text-muted"
                />
                <input
                  type="text"
                  class="input w-full"
                  style="padding-left: 2.25rem;"
                  placeholder="Search nodes..."
                  bind:value={nodeSearchQuery}
                >
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
                      <p
                        class="font-medium text-theme-text-emphasis truncate flex items-center gap-2"
                      >
                        <span
                          class="w-2 h-2 rounded-full flex-shrink-0 {isMapped ? 'bg-success' : 'bg-theme-text-muted'}"
                        ></span>
                        {getNodeLabel(node)}
                      </p>
                      <p class="text-xs text-theme-text-muted">{node.spec?.type || 'Unknown'}</p>
                    </div>
                    <select
                      class="input"
                      style="width: 14rem;"
                      value={$nodeMapping[node.id]?.hostId || ''}
                      onchange={(e) => handleNodeMappingChange(node.id, e.currentTarget.value)}
                    >
                      <option value="">Not mapped</option>
                      {#each hostsBySource as group}
                        {#if hostsBySource.length > 1}
                          <optgroup label={group.sourceName}>
                            {#each group.items as host}
                              <option value={host.id}>{host.displayName || host.name}</option>
                            {/each}
                          </optgroup>
                        {:else}
                          {#each group.items as host}
                            <option value={host.id}>{host.displayName || host.name}</option>
                          {/each}
                        {/if}
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
                <div class="flex items-center gap-3">
                  <label
                    class="flex items-center gap-1.5 text-xs text-theme-text-muted cursor-pointer"
                  >
                    <input type="checkbox" bind:checked={singleCandidateFallback} class="rounded">
                    Single candidate fallback
                  </label>
                  <Button
                    variant="outline"
                    size="sm"
                    onclick={() => {
                      const matched = handleAutoMapLinks()
                      if (matched > 0) {
                        autoMapResult = { matched, total: edges.length, kind: 'links' }
                        scheduleClearAutoMapResult()
                      }
                    }}
                  >
                    <LightningIcon size={14} class="mr-1" />
                    Auto-map
                  </Button>
                </div>
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
                      <span
                        class="w-2 h-2 rounded-full flex-shrink-0
                        {currentMapping.monitoredNodeId && currentMapping.interface ? 'bg-success' : currentMapping.monitoredNodeId ? 'bg-warning' : 'bg-theme-text-muted'}"
                      ></span>
                      <span class="font-medium">{getNodeLabelById(edge.from.nodeId)}</span>
                      {#if portDisplay(edge.from)}
                        <span class="text-theme-text-muted">({portDisplay(edge.from)})</span>
                      {/if}
                      <ArrowRightIcon size={14} class="text-theme-text-muted" />
                      <span class="font-medium">{getNodeLabelById(edge.to.nodeId)}</span>
                      {#if portDisplay(edge.to)}
                        <span class="text-theme-text-muted">({portDisplay(edge.to)})</span>
                      {/if}
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
                          {#if fromHostId}
                            <option value={edge.from.nodeId}>
                              {getNodeLabelById(edge.from.nodeId)}
                            </option>
                          {/if}
                          {#if toHostId}
                            <option value={edge.to.nodeId}>
                              {getNodeLabelById(edge.to.nodeId)}
                            </option>
                          {/if}
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
                          value={bandwidthToSelectValue(edge.id, currentMapping.bandwidth)}
                          onchange={(e) => {
                            const val = e.currentTarget.value
                            if (val === '') {
                              customBandwidthLinks.delete(edge.id)
                              customBandwidthLinks = new Set(customBandwidthLinks)
                              handleLinkBandwidthChange(edge.id, undefined)
                            } else if (val === 'custom') {
                              customBandwidthLinks.add(edge.id)
                              customBandwidthLinks = new Set(customBandwidthLinks)
                              handleLinkBandwidthChange(edge.id, 1_000_000_000)
                            } else {
                              customBandwidthLinks.delete(edge.id)
                              customBandwidthLinks = new Set(customBandwidthLinks)
                              handleLinkBandwidthChange(edge.id, parseInt(val, 10))
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
                      <p class="text-xs text-theme-text-muted italic">
                        Map at least one node first
                      </p>
                    {/if}
                  </div>
                {/each}
              {/if}
            </div>
          </div>
        {/if}
      </div>
    {/if}

    <!-- ============================================ -->
    <!-- Resolved Tab -->
    <!-- ============================================ -->
    <!-- The project 's current rendered graph. This is the output of
         `resolve()` folding Manual 's source-level graph with every
         attached source 's latest observation snapshot. Read-only —
         to change anything, edit the input sources. -->
    {#if activeTab === 'resolved'}
      <div class="space-y-3">
        <div class="flex items-start justify-between">
          <div>
            <h2 class="font-medium text-theme-text-emphasis">Resolved project graph</h2>
            <p class="text-sm text-theme-text-muted mt-0.5">
              Output of <code>resolve()</code> over Manual + every attached source 's latest
              snapshot. This is the JSON the diagram renders.
              {#if resolvedSnapshotCount > 0}
                <span class="text-xs"
                  >({resolvedSnapshotCount}
                  source snapshot{resolvedSnapshotCount === 1 ? '' : 's'}
                  folded in)</span
                >
              {/if}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onclick={copyResolved}
            disabled={!resolvedJson || resolvedLoading}
          >
            {resolvedCopied ? 'Copied ✓' : 'Copy'}
          </Button>
        </div>

        {#if resolvedError}
          <div class="p-3 bg-danger/10 border border-danger/20 rounded-lg text-danger text-sm">
            {resolvedError}
          </div>
        {/if}

        <div class="card">
          {#if resolvedLoading && !resolvedJson}
            <div class="card-body flex items-center justify-center py-12">
              <div
                class="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"
              ></div>
            </div>
          {:else if !resolvedJson}
            <div class="card-body text-sm text-theme-text-muted text-center">
              No resolved graph yet.
            </div>
          {:else}
            <pre
              class="p-4 text-xs font-mono overflow-auto max-h-[70vh] text-theme-text"
            ><code>{resolvedJson}</code></pre>
          {/if}
        </div>
      </div>
    {/if}
  {/if}
</div>

<!-- Per-node Discovery detail modal. Card-click in the Discovery tab
     sets detailNode; closing reverts it to null. -->
<DiscoveryNodeDetail
  open={detailNode !== null}
  onOpenChange={(v) => {
    if (!v) detailNode = null
  }}
  node={detailNode}
  probing={detailNode !== null && probingNodeId === detailNode.id}
  effectivePolicy={detailNode ? (policyView?.nodes[detailNode.id] ?? null) : null}
  patchingPolicy={detailNode !== null && policyPatching[detailNode.id] === true}
  policyErrorMessage={detailNode ? (policyError[detailNode.id] ?? null) : null}
  {formatAgo}
  onProbe={() => {
    if (detailNode) handleProbeNode(detailNode)
  }}
  onSetMode={handleSetMode}
/>

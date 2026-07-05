<script lang="ts">
  /**
   * Mapping — wires every node and link in the diagram to a monitored
   * host/interface from the attached metrics sources. The link half is
   * what drives the weathermap utilization colors; the node half drives
   * the per-node up/down indicators.
   *
   * Auto-map: best-effort match by name/label/alias against host
   * interfaces. Link auto-map delegates to the server endpoint
   * (POST /mapping/auto-map-links) which matches port identity keys
   * against the metrics source's reported interfaces server-side.
   *
   * Saves through `mappingStore` so the diagram view (which reads from
   * the same store) updates without a refresh.
   */
  import { ArrowRightIcon, CheckCircleIcon, FloppyDiskIcon } from 'phosphor-svelte'
  import { api } from '$lib/api'
  import { Button } from '$lib/components/ui/button'
  import {
    hostInterfaces,
    linkMapping,
    mappingHosts,
    mappingStore,
    mappingWarning,
    nodeMapping,
  } from '$lib/stores'
  import type { MetricsData } from '$lib/stores/metrics'
  import type { EdgeEndpoint, Identity, MetricsMapping } from '$lib/types'
  import { nodeLabelById, nodeLabel as resolveNodeLabel } from '$lib/utils/node-label'
  import { useTopologyCtx } from '../_context.svelte'
  import MappingPanel from './MappingPanel.svelte'
  import VirtualList from './VirtualList.svelte'

  const ctx = useTopologyCtx()

  interface SettingsTopologySnapshot {
    id: string
    name: string
    graph: {
      nodes: Array<{
        id: string
        label?: string | string[]
        spec?: { type?: string; vendor?: string }
        identity?: Identity
      }>
      links: Array<{ id: string; from: string; to: string; standard?: string }>
    }
    metrics: MetricsData
    dataSourceId?: string
    mapping?: MetricsMapping
  }

  interface EdgeData {
    id: string
    from: EdgeEndpoint
    to: EdgeEndpoint
    standard?: string
  }

  let parsedTopology = $state<SettingsTopologySnapshot | null>(null)
  let edges = $state<EdgeData[]>([])
  let savingMapping = $state(false)
  // Node mapping and link mapping are distinct concerns — show one at a time
  // (they were stacked, which scrolled forever). Full fold into per-entity
  // detail is tracked in #374; this is the interim split.
  let mappingTab = $state<'nodes' | 'links'>('nodes')
  let nodeSearchQuery = $state('')
  let linkSearchQuery = $state('')
  let autoMapResult = $state<{
    matched: number
    total: number
    kind: 'nodes' | 'links'
    byIdentity?: number
    byName?: number
  } | null>(null)
  let customBandwidthLinks = $state(new Set<string>())
  let localError = $state('')
  let autoMapTimer: ReturnType<typeof setTimeout> | null = null

  let hasMetricsSource = $derived($mappingStore.metricsSources.length > 0)
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

  let filteredNodes = $derived(
    parsedTopology?.graph.nodes.filter((node) => {
      if (!nodeSearchQuery) return true
      const label = getNodeLabel(node).toLowerCase()
      return label.includes(nodeSearchQuery.toLowerCase())
    }) || [],
  )

  // Both lists are virtualized via <VirtualList> (only ~visible rows in the DOM)
  // so large topologies stay cheap to open.
  let filteredEdges = $derived(
    !linkSearchQuery
      ? edges
      : edges.filter((e) => {
          const q = linkSearchQuery.toLowerCase()
          return (
            getNodeLabelById(e.from.nodeId).toLowerCase().includes(q) ||
            getNodeLabelById(e.to.nodeId).toLowerCase().includes(q)
          )
        }),
  )

  /** Hosts grouped by their owning data source, in source priority
   *  order. Drives `<optgroup>` rendering so the operator sees which
   *  source each candidate comes from. */
  let hostsBySource = $derived.by(() => {
    const groups = new Map<string, { sourceName: string; items: typeof $mappingHosts }>()
    for (const h of $mappingHosts) {
      const g = groups.get(h.sourceId)
      if (g) g.items.push(h)
      else groups.set(h.sourceId, { sourceName: h.sourceName, items: [h] })
    }
    return [...groups.values()]
  })

  // Load once the shell context is ready (topology + id). No separate onMount —
  // it would fire before ctx.topologyId is set (→ wasteful `/topologies//…`
  // requests) and then again here, double-fetching /context.
  $effect(() => {
    if (ctx.topology && ctx.topologyId) void loadMappingData()
  })

  $effect(() => {
    return () => {
      if (autoMapTimer) clearTimeout(autoMapTimer)
    }
  })

  async function loadMappingData() {
    try {
      await mappingStore.load(ctx.topologyId, false)
      const contextData = await api.topologies.getContext(ctx.topologyId)
      edges = contextData.edges
      parsedTopology = {
        id: contextData.id,
        name: contextData.name,
        graph: {
          nodes: contextData.nodes.map((n) => ({
            id: n.id,
            label: n.label,
            spec: { type: n.type, vendor: n.vendor },
            identity: n.identity,
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
    } catch (e) {
      localError = e instanceof Error ? e.message : 'Failed to load mapping data'
    }
  }

  function getNodeLabel(node: { id: string; label?: string | string[] }): string {
    return resolveNodeLabel(node)
  }

  function getNodeLabelById(nodeId: string): string {
    return nodeLabelById(parsedTopology?.graph.nodes, nodeId)
  }

  function portDisplay(ep: EdgeEndpoint): string | undefined {
    return ep.portInfo?.label || ep.portInfo?.interfaceName || ep.port
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

  function handleClearAllLinks() {
    if (confirm('Clear all link mappings?')) {
      mappingStore.clearAllLinks()
      autoMapResult = null
    }
  }

  async function handleSaveMapping() {
    savingMapping = true
    try {
      await mappingStore.save()
      // Commit landed → let the persistent diagram re-fetch (no manual reload).
      ctx.bumpRevision()
    } catch (e) {
      localError = e instanceof Error ? e.message : 'Failed to save mapping'
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
      if (Object.keys(rest).length > 0) mappingStore.updateLink(linkId, rest)
      else mappingStore.updateLink(linkId, null)
    }
  }

  function scheduleClearAutoMapResult() {
    if (autoMapTimer) clearTimeout(autoMapTimer)
    autoMapTimer = setTimeout(() => {
      autoMapResult = null
      autoMapTimer = null
    }, 5000)
  }

  // Link auto-map: delegates to the server endpoint which fetches host interfaces
  // and matches port identity keys (id / ifName / label) server-side.
  async function handleLinkAutoMap() {
    try {
      const result = await api.topologies.autoMapLinks(ctx.topologyId, { overwrite: false })
      // Reload the mapping from the server so the UI reflects the persisted state.
      await mappingStore.load(ctx.topologyId, false)
      autoMapResult = { matched: result.matched, total: result.total, kind: 'links' }
      scheduleClearAutoMapResult()
    } catch (e) {
      localError = e instanceof Error ? e.message : 'Failed to auto-map links'
    }
  }

  // ---------------------------------------------------------------------------
  // Orphaned mappings (Phase 4) — the "drift is visible, never silent" surface.
  // A mapping row whose entity left the diagram (retired / disappeared element).
  // The operator reassigns it to a current element or discards it. Additive
  // section — kept self-contained so it doesn't tangle with the auto-map flow.
  // ---------------------------------------------------------------------------

  interface OrphanRow {
    entityId: string
    kind: string
    sourceId: string
    payload: unknown
  }

  let orphans = $state<OrphanRow[]>([])
  let orphansLoaded = $state(false)
  let orphanError = $state('')
  // entityId → chosen target element id (= entity id after the Phase 3 flip).
  let reassignTargets = $state<Record<string, string>>({})
  let orphanActing = $state<Record<string, boolean>>({})

  // Current node / link elements a node/link orphan can be reassigned onto. After
  // the Phase 3 id flip, element `id` IS the entity id the server validates against.
  let nodeTargets = $derived(
    (parsedTopology?.graph.nodes ?? []).map((n) => ({ id: n.id, label: getNodeLabel(n) })),
  )
  let linkTargets = $derived(
    edges.map((e) => ({
      id: e.id,
      label: `${getNodeLabelById(e.from.nodeId)} → ${getNodeLabelById(e.to.nodeId)}`,
    })),
  )

  function orphanHint(payload: unknown): string {
    if (payload && typeof payload === 'object') {
      const p = payload as { hostName?: string; hostId?: string; interface?: string }
      const parts = [p.hostName ?? p.hostId, p.interface].filter((v): v is string => !!v)
      if (parts.length > 0) return parts.join(' · ')
    }
    return ''
  }

  $effect(() => {
    if (ctx.topologyId) void loadOrphans()
  })

  async function loadOrphans() {
    try {
      const resp = await api.topologies.getOrphans(ctx.topologyId)
      orphans = resp.orphans
      orphansLoaded = true
    } catch {
      // Non-fatal: the orphan panel just stays hidden if the fetch fails.
      orphansLoaded = true
    }
  }

  async function handleReassign(entityId: string) {
    const toEntityId = reassignTargets[entityId]
    if (!toEntityId) return
    orphanActing = { ...orphanActing, [entityId]: true }
    orphanError = ''
    try {
      await api.topologies.reassignOrphan(ctx.topologyId, entityId, toEntityId)
      await loadOrphans()
      // Re-hydrate the mapping so the reassigned binding shows up on its new element.
      await mappingStore.load(ctx.topologyId, false)
    } catch (e) {
      orphanError = e instanceof Error ? e.message : 'Reassign failed'
    } finally {
      const next = { ...orphanActing }
      delete next[entityId]
      orphanActing = next
    }
  }

  async function handleDiscardOrphan(entityId: string) {
    if (!confirm('Discard this orphaned mapping? This cannot be undone.')) return
    orphanActing = { ...orphanActing, [entityId]: true }
    orphanError = ''
    try {
      await api.topologies.discardOrphan(ctx.topologyId, entityId)
      await loadOrphans()
    } catch (e) {
      orphanError = e instanceof Error ? e.message : 'Discard failed'
    } finally {
      const next = { ...orphanActing }
      delete next[entityId]
      orphanActing = next
    }
  }
</script>

<div class="p-4 space-y-4">
  {#if localError}
    <div class="p-3 bg-danger/10 border border-danger/20 rounded-lg text-danger text-sm">
      {localError}
    </div>
  {/if}

  <!-- Non-fatal: the save landed, but the source lacked port identity to anchor
       some bindings, so they weren't persisted. Warn instead of a silent drop. -->
  {#if $mappingWarning}
    <div class="p-3 bg-warning/10 border border-warning/20 rounded-lg text-warning text-sm">
      {$mappingWarning}
    </div>
  {/if}

  {#if !hasMetricsSource}
    <div class="card p-6 text-center">
      <p class="text-theme-text-muted mb-4">No metrics source configured.</p>
      <a class="text-primary hover:underline" href="/topologies/{ctx.topologyId}/sources">
        Configure Data Sources →
      </a>
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
        {#if autoMapResult.byIdentity !== undefined && autoMapResult.matched > 0}
          <span class="text-muted-foreground">
            ({autoMapResult.byIdentity}
            by identity, {autoMapResult.byName} by name)
          </span>
        {/if}
      </div>
    {/if}

    <!-- Nodes | Links sub-toggle: the two mappings are separate concerns. -->
    <div class="flex gap-1 border-b border-theme-border">
      <button
        type="button"
        class="px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors {mappingTab ===
        'nodes'
          ? 'text-primary border-primary'
          : 'text-theme-text-muted border-transparent hover:text-theme-text'}"
        onclick={() => (mappingTab = 'nodes')}
      >
        Nodes <span class="text-xs">({mappedCount}/{totalNodes})</span>
      </button>
      <button
        type="button"
        class="px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors {mappingTab ===
        'links'
          ? 'text-primary border-primary'
          : 'text-theme-text-muted border-transparent hover:text-theme-text'}"
        onclick={() => (mappingTab = 'links')}
      >
        Links <span class="text-xs">({mappedLinksCount}/{totalLinks})</span>
      </button>
    </div>

    {#if mappingTab === 'nodes'}
      <!-- Node Mapping -->
      <MappingPanel
        title="Node Mapping"
        onAutoMap={handleAutoMap}
        autoMapDisabled={$mappingStore.hostsLoading}
        onClear={handleClearAll}
        clearDisabled={mappedCount === 0}
        bind:searchValue={nodeSearchQuery}
        searchPlaceholder="Search nodes..."
      >
        {#if filteredNodes.length === 0}
          <div class="p-4 text-center text-theme-text-muted">
            {nodeSearchQuery ? 'No matching nodes' : 'No nodes'}
          </div>
        {:else}
          <VirtualList items={filteredNodes} estimateSize={60}>
            {#snippet row(node)}
              {@const isMapped = !!$nodeMapping[node.id]?.hostId}
              <div class="p-3 flex items-center gap-4 border-b border-theme-border">
                <div class="flex-1 min-w-0">
                  <p class="font-medium text-theme-text-emphasis truncate flex items-center gap-2">
                    <span
                      class="w-2 h-2 rounded-full flex-shrink-0 {isMapped
                        ? 'bg-success'
                        : 'bg-theme-text-muted'}"
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
                  {#each hostsBySource as group (group.sourceName)}
                    {#if hostsBySource.length > 1}
                      <optgroup label={group.sourceName}>
                        {#each group.items as host (host.id)}
                          <option value={host.id}>{host.displayName || host.name}</option>
                        {/each}
                      </optgroup>
                    {:else}
                      {#each group.items as host (host.id)}
                        <option value={host.id}>{host.displayName || host.name}</option>
                      {/each}
                    {/if}
                  {/each}
                </select>
              </div>
            {/snippet}
          </VirtualList>
        {/if}
      </MappingPanel>
    {/if}

    {#if mappingTab === 'links'}
      <!-- Link Mapping -->
      <MappingPanel
        title="Link Mapping"
        onAutoMap={handleLinkAutoMap}
        onClear={handleClearAllLinks}
        clearDisabled={mappedLinksCount === 0}
        bind:searchValue={linkSearchQuery}
        searchPlaceholder="Search links..."
      >
        {#if filteredEdges.length === 0}
          <div class="p-4 text-center text-theme-text-muted">
            {linkSearchQuery ? 'No matching links' : 'No links'}
          </div>
        {:else}
          <VirtualList items={filteredEdges} estimateSize={92}>
            {#snippet row(edge)}
              {@const currentMapping = $linkMapping[edge.id] || {}}
              {@const fromHostId = $nodeMapping[edge.from.nodeId]?.hostId}
              {@const toHostId = $nodeMapping[edge.to.nodeId]?.hostId}
              {@const monitoredNodeId = currentMapping.monitoredNodeId}
              {@const monitoredHostId =
                monitoredNodeId === edge.from.nodeId
                  ? fromHostId
                  : monitoredNodeId === edge.to.nodeId
                    ? toHostId
                    : undefined}
              {@const interfaces = monitoredHostId ? $hostInterfaces[monitoredHostId] || [] : []}
              {@const hasAnyMappedNode = !!fromHostId || !!toHostId}
              <div class="p-3 space-y-2 border-b border-theme-border">
                <div class="flex items-center gap-2 text-sm">
                  <span
                    class="w-2 h-2 rounded-full flex-shrink-0 {currentMapping.monitoredNodeId &&
                  currentMapping.interface
                    ? 'bg-success'
                    : currentMapping.monitoredNodeId
                      ? 'bg-warning'
                      : 'bg-theme-text-muted'}"
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
                        <option value={edge.to.nodeId}>{getNodeLabelById(edge.to.nodeId)}</option>
                      {/if}
                    </select>
                    {#if monitoredNodeId && interfaces.length > 0}
                      <select
                        class="input text-sm flex-1"
                        value={currentMapping.interface || ''}
                        onchange={(e) => handleLinkInterfaceChange(edge.id, e.currentTarget.value)}
                      >
                        <option value="">Select interface</option>
                        {#each interfaces as iface (iface.name)}
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
                  <p class="text-xs text-theme-text-muted italic">Map at least one node first</p>
                {/if}
              </div>
            {/snippet}
          </VirtualList>
        {/if}
      </MappingPanel>
    {/if}
  {/if}

  <!-- Orphaned mappings (Phase 4): drift surface. Only rendered when the server
       reports rows pointing at entities that left the diagram. -->
  {#if orphansLoaded && orphans.length > 0}
    <div class="card border-warning/30">
      <div class="card-header">
        <h2 class="font-medium text-warning">Orphaned mappings ({orphans.length})</h2>
        <p class="text-xs text-theme-text-muted mt-0.5">
          These mappings point at elements no longer in the diagram (retired or removed). Reassign
          each to a current element, or discard it.
        </p>
      </div>
      <div class="card-body space-y-3">
        {#if orphanError}
          <p class="text-xs text-danger">{orphanError}</p>
        {/if}
        {#each orphans as orphan (orphan.entityId)}
          {@const hint = orphanHint(orphan.payload)}
          {@const targets = orphan.kind === 'link' ? linkTargets : nodeTargets}
          <div class="flex items-center gap-2 border border-theme-border rounded p-2">
            <div class="flex-1 min-w-0">
              <p class="text-xs text-theme-text truncate">{hint || orphan.entityId}</p>
              <p class="text-xs text-theme-text-muted">{orphan.kind}</p>
            </div>
            <select
              class="input text-xs"
              style="width: 14rem;"
              bind:value={reassignTargets[orphan.entityId]}
            >
              <option value="">Reassign to…</option>
              {#each targets as t (t.id)}
                <option value={t.id}>{t.label}</option>
              {/each}
            </select>
            <Button
              variant="outline"
              class="text-xs px-2 py-1 h-auto"
              disabled={orphanActing[orphan.entityId] || !reassignTargets[orphan.entityId]}
              onclick={() => handleReassign(orphan.entityId)}
            >
              Reassign
            </Button>
            <Button
              variant="destructive"
              class="text-xs px-2 py-1 h-auto"
              disabled={orphanActing[orphan.entityId]}
              onclick={() => handleDiscardOrphan(orphan.entityId)}
            >
              Discard
            </Button>
          </div>
        {/each}
      </div>
    </div>
  {/if}
</div>

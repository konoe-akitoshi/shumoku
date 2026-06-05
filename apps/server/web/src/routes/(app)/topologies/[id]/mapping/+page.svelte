<script lang="ts">
  /**
   * Mapping — wires every node and link in the diagram to a monitored
   * host/interface from the attached metrics sources. The link half is
   * what drives the weathermap utilization colors; the node half drives
   * the per-node up/down indicators.
   *
   * Auto-map: best-effort match by name/label/alias against host
   * interfaces. The operator can flip a "single candidate fallback"
   * toggle to also accept "the host has exactly one interface, use it".
   *
   * Saves through `mappingStore` so the diagram view (which reads from
   * the same store) updates without a refresh.
   */
  import {
    ArrowRightIcon,
    CheckCircleIcon,
    FloppyDiskIcon,
    LightningIcon,
    MagnifyingGlassIcon,
    TrashIcon,
  } from 'phosphor-svelte'
  import { onMount } from 'svelte'
  import { api } from '$lib/api'
  import { findBestInterfaceMatch, matchInterfaceByNeighbor } from '$lib/auto-mapping'
  import { Button } from '$lib/components/ui/button'
  import {
    hostInterfaces,
    hostNeighbors,
    linkMapping,
    mappingHosts,
    mappingStore,
    nodeMapping,
  } from '$lib/stores'
  import type { MetricsData } from '$lib/stores/metrics'
  import type { EdgeEndpoint, Identity, MetricsMapping } from '$lib/types'
  import { nodeLabelById, nodeLabel as resolveNodeLabel } from '$lib/utils/node-label'
  import { useTopologyCtx } from '../_context.svelte'

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
  let nodeSearchQuery = $state('')
  let autoMapResult = $state<{
    matched: number
    total: number
    kind: 'nodes' | 'links'
    byIdentity?: number
    byName?: number
  } | null>(null)
  let singleCandidateFallback = $state(true)
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

  onMount(() => {
    void loadMappingData()
  })

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
      loadInterfacesForMappedNodes()
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

  function portMatchCandidates(ep: EdgeEndpoint): string[] {
    const info = ep.portInfo
    if (!info) return []
    return [info.interfaceName, info.label, ...(info.aliases ?? [])].filter((n): n is string => !!n)
  }

  function loadInterfacesForMappedNodes() {
    const hostIds = new Set<string>()
    for (const edge of edges) {
      const fromHostId = $nodeMapping[edge.from.nodeId]?.hostId
      const toHostId = $nodeMapping[edge.to.nodeId]?.hostId
      if (fromHostId) hostIds.add(fromHostId)
      if (toHostId) hostIds.add(toHostId)
    }
    for (const hostId of hostIds) mappingStore.loadHostInterfaces(hostId)
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

  function nodeForMapping(nodeId: string): { identity?: Identity; label?: string | string[] } {
    return parsedTopology?.graph.nodes.find((n) => n.id === nodeId) ?? {}
  }

  /**
   * Resolve one endpoint's interface: LLDP neighbour first (which local
   * interface faces the peer), then fuzzy port-name matching. A neighbour hit
   * is only accepted when it maps to a monitored interface so the link polls.
   */
  function resolveLinkInterface(
    hostId: string | undefined,
    side: EdgeEndpoint,
    peerNodeId: string,
    peerPort: string | undefined,
    interfaces: Array<{ name: string }>,
  ): string | null {
    if (!hostId || interfaces.length === 0) return null
    const names = interfaces.map((i) => i.name)
    const neighborIf = matchInterfaceByNeighbor(
      nodeForMapping(peerNodeId),
      peerPort,
      $hostNeighbors[hostId] ?? [],
    )
    if (neighborIf) {
      const resolved = names.includes(neighborIf)
        ? neighborIf
        : findBestInterfaceMatch(neighborIf, names, { singleCandidateFallback: false })
      if (resolved) return resolved
    }
    return findMatchingInterface(portMatchCandidates(side), interfaces)
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
      let matchedInterface = resolveLinkInterface(
        fromHostId,
        edge.from,
        edge.to.nodeId,
        edge.to.port,
        fromInterfaces,
      )
      if (matchedInterface) {
        monitoredNodeId = edge.from.nodeId
      } else {
        matchedInterface = resolveLinkInterface(
          toHostId,
          edge.to,
          edge.from.nodeId,
          edge.from.port,
          toInterfaces,
        )
        if (matchedInterface) monitoredNodeId = edge.to.nodeId
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
        best = match
        break
      }
    }
    return best
  }

  function scheduleClearAutoMapResult() {
    if (autoMapTimer) clearTimeout(autoMapTimer)
    autoMapTimer = setTimeout(() => {
      autoMapResult = null
      autoMapTimer = null
    }, 5000)
  }
</script>

<div class="container mx-auto p-6 max-w-6xl space-y-6">
  {#if localError}
    <div class="p-3 bg-danger/10 border border-danger/20 rounded-lg text-danger text-sm">
      {localError}
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
          {#each filteredNodes as node (node.id)}
            {@const isMapped = !!$nodeMapping[node.id]?.hostId}
            <div class="p-3 flex items-center gap-4">
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
            <label class="flex items-center gap-1.5 text-xs text-theme-text-muted cursor-pointer">
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
          {#each edges as edge (edge.id)}
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
            <div class="p-3 space-y-2">
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
                      <option value={edge.from.nodeId}>{getNodeLabelById(edge.from.nodeId)}</option>
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
          {/each}
        {/if}
      </div>
    </div>
  {/if}
</div>

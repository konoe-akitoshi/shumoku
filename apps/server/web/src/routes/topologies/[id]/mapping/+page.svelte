<script lang="ts">
import { onMount } from 'svelte'
import { page } from '$app/stores'
import { afterNavigate } from '$app/navigation'
import { Button } from '$lib/components/ui/button'
import {
  mappingStore,
  mappingLoading,
  mappingError,
  nodeMapping,
  linkMapping,
  mappingHosts,
} from '$lib/stores'
import type { ParsedTopologyResponse } from '$lib/types'
import { api } from '$lib/api'
import ArrowLeft from 'phosphor-svelte/lib/ArrowLeft'
import FloppyDisk from 'phosphor-svelte/lib/FloppyDisk'
import MagnifyingGlass from 'phosphor-svelte/lib/MagnifyingGlass'
import Lightning from 'phosphor-svelte/lib/Lightning'
import Trash from 'phosphor-svelte/lib/Trash'
import CheckCircle from 'phosphor-svelte/lib/CheckCircle'
import Warning from 'phosphor-svelte/lib/Warning'

let parsedTopology = $state<ParsedTopologyResponse | null>(null)
let topologyName = $state('')
let saving = $state(false)
let nodeSearchQuery = $state('')
let autoMapResult = $state<{ matched: number; total: number } | null>(null)
let localError = $state('')

let topologyId = $derived($page.params.id!)
let metricsSourceId = $derived($mappingStore.metricsSourceId)
let hasMetricsSource = $derived(!!metricsSourceId)

onMount(() => {
  loadData()
})

// Reload when navigating to this page
afterNavigate(() => {
  loadData(true)
})

async function loadData(forceReload = false) {
  try {
    // Load mapping data via store
    await mappingStore.load(topologyId, forceReload)

    // Load parsed topology for node/link list
    const contextData = await api.topologies.getContext(topologyId)
    topologyName = contextData.name
    parsedTopology = {
      id: contextData.id,
      name: contextData.name,
      graph: {
        nodes: contextData.nodes.map((n) => ({
          id: n.id,
          label: n.label,
          type: n.type,
          vendor: n.vendor,
        })),
        links: contextData.edges.map((e) => ({
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
  } catch (e) {
    localError = e instanceof Error ? e.message : 'Failed to load topology'
  }
}

async function handleSave() {
  saving = true
  localError = ''

  try {
    await mappingStore.save()
  } catch (e) {
    localError = e instanceof Error ? e.message : 'Failed to save mapping'
  } finally {
    saving = false
  }
}

function handleNodeMappingChange(nodeId: string, hostId: string) {
  const host = $mappingHosts.find((h) => h.id === hostId)
  mappingStore.updateNode(
    nodeId,
    hostId ? { hostId, hostName: host?.name || host?.displayName } : {},
  )
}

function handleLinkCapacityChange(linkId: string, capacity: number | undefined) {
  if (capacity !== undefined) {
    mappingStore.updateLink(linkId, { ...$linkMapping[linkId], capacity })
  } else {
    const existing = $linkMapping[linkId]
    if (existing?.interface) {
      mappingStore.updateLink(linkId, { interface: existing.interface })
    } else {
      mappingStore.updateLink(linkId, null)
    }
  }
}

function handleAutoMap() {
  if (!parsedTopology) return

  autoMapResult = mappingStore.autoMapNodes(parsedTopology.graph.nodes, { overwrite: false })

  // Clear result after 5 seconds
  setTimeout(() => {
    autoMapResult = null
  }, 5000)
}

function handleClearAll() {
  if (confirm('Clear all node mappings?')) {
    mappingStore.clearAllNodes()
    autoMapResult = null
  }
}

function getNodeLabel(node: { label?: string | string[] }): string {
  let label: string
  if (Array.isArray(node.label)) {
    label = node.label[0] || 'Unnamed'
  } else {
    label = node.label || 'Unnamed'
  }
  // Strip HTML tags (e.g., <b>label</b> -> label)
  return label.replace(/<[^>]*>/g, '')
}

// Filtered nodes based on search
let filteredNodes = $derived(
  parsedTopology?.graph.nodes.filter((node) => {
    if (!nodeSearchQuery) return true
    const label = getNodeLabel(node).toLowerCase()
    return label.includes(nodeSearchQuery.toLowerCase())
  }) || [],
)

// Count mapped nodes
let mappedCount = $derived(
  parsedTopology?.graph.nodes.filter((n) => $nodeMapping[n.id]?.hostId).length || 0,
)
let totalNodes = $derived(parsedTopology?.graph.nodes.length || 0)
</script>

<svelte:head>
  <title>Mapping - {topologyName || 'Topology'} - Shumoku</title>
</svelte:head>

<div class="p-6 max-w-4xl mx-auto">
  {#if $mappingLoading}
    <div class="flex items-center justify-center py-12">
      <div class="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
    </div>
  {:else if ($mappingError || localError) && !parsedTopology}
    <div class="card p-6 text-center">
      <p class="text-danger mb-4">{$mappingError || localError}</p>
      <a href="/topologies" class="btn btn-secondary">Back to Topologies</a>
    </div>
  {:else if parsedTopology}
    <!-- Header -->
    <div class="flex items-start justify-between gap-4 mb-6">
      <div class="flex-1 min-w-0">
        <a
          href="/topologies/{topologyId}"
          class="inline-flex items-center gap-2 text-sm text-theme-text-muted hover:text-theme-text transition-colors mb-2"
        >
          <ArrowLeft size={16} />
          Back to Topology
        </a>
        <h1 class="text-xl font-semibold text-theme-text-emphasis">Mapping Configuration</h1>
        <p class="text-sm text-theme-text-muted truncate">
          {topologyName}
          {#if totalNodes > 0}
            <span class="ml-2">• {mappedCount}/{totalNodes} nodes mapped</span>
          {/if}
        </p>
      </div>
      <Button class="flex-shrink-0" onclick={handleSave} disabled={saving}>
        {#if saving}
          <span class="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2"></span>
        {:else}
          <FloppyDisk size={16} class="mr-2" />
        {/if}
        Save Mapping
      </Button>
    </div>

    {#if $mappingError || localError}
      <div class="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm mb-6">
        {$mappingError || localError}
      </div>
    {/if}

    {#if autoMapResult}
      <div class="p-3 bg-success/10 border border-success/20 rounded-lg text-success text-sm mb-6 flex items-center gap-2">
        <CheckCircle size={16} />
        Auto-mapped {autoMapResult.matched} of {autoMapResult.total} nodes
      </div>
    {/if}

    {#if !hasMetricsSource}
      <div class="card p-6 text-center">
        <div class="flex items-center justify-center gap-2 text-warning mb-4">
          <Warning size={20} />
          <span>No metrics source configured</span>
        </div>
        <p class="text-theme-text-muted mb-4">
          Please configure a data source to enable node mapping.
        </p>
        <a href="/topologies/{topologyId}/sources" class="btn btn-primary">
          Configure Data Sources
        </a>
      </div>
    {:else}
      <!-- Node Mapping -->
      <div class="card mb-6">
        <div class="card-header">
          <div class="flex items-center justify-between gap-4 mb-3">
            <h2 class="font-medium text-theme-text-emphasis">Node Mapping</h2>
            <div class="flex items-center gap-2 flex-shrink-0">
              <!-- Auto-map button -->
              <Button variant="outline" size="sm" onclick={handleAutoMap} disabled={$mappingStore.hostsLoading}>
                <Lightning size={14} class="mr-1" />
                Auto-map
              </Button>
              <!-- Clear all button -->
              <Button variant="outline" size="sm" onclick={handleClearAll} disabled={mappedCount === 0}>
                <Trash size={14} class="mr-1" />
                Clear All
              </Button>
            </div>
          </div>
          <!-- Search -->
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
        <div class="divide-y divide-theme-border">
          {#if $mappingStore.hostsLoading}
            <div class="p-4 text-center text-theme-text-muted">
              Loading hosts...
            </div>
          {:else if filteredNodes.length === 0}
            <div class="p-4 text-center text-theme-text-muted">
              {nodeSearchQuery ? 'No matching nodes found' : 'No nodes in topology'}
            </div>
          {:else}
            {#each filteredNodes as node}
              {@const isMapped = !!$nodeMapping[node.id]?.hostId}
              <div class="p-4 flex items-center gap-4">
                <div class="flex-1 min-w-0">
                  <p class="font-medium text-theme-text-emphasis truncate flex items-center gap-2">
                    {#if isMapped}
                      <span class="w-2 h-2 rounded-full bg-success flex-shrink-0"></span>
                    {:else}
                      <span class="w-2 h-2 rounded-full bg-theme-text-muted flex-shrink-0"></span>
                    {/if}
                    {getNodeLabel(node)}
                  </p>
                  <p class="text-xs text-theme-text-muted">{node.type || 'Unknown type'}</p>
                </div>
                <select
                  class="input flex-shrink-0"
                  style="width: 16rem;"
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
          <h2 class="font-medium text-theme-text-emphasis">Link Capacity</h2>
          <p class="text-xs text-theme-text-muted mt-1">Set link capacity for utilization calculation</p>
        </div>
        <div class="divide-y divide-theme-border">
          {#if parsedTopology.graph.links.length === 0}
            <div class="p-4 text-center text-theme-text-muted">
              No links in topology
            </div>
          {:else}
            {#each parsedTopology.graph.links as link}
              <div class="p-4 flex items-center gap-4">
                <div class="flex-1 min-w-0">
                  <p class="font-medium text-theme-text-emphasis truncate">
                    {typeof link.from === 'string' ? link.from : (link.from?.node ?? 'Unknown')}
                    →
                    {typeof link.to === 'string' ? link.to : (link.to?.node ?? 'Unknown')}
                  </p>
                  <p class="text-xs text-theme-text-muted">{link.bandwidth || 'No bandwidth specified'}</p>
                </div>
                <div class="flex items-center gap-2 flex-shrink-0">
                  <input
                    type="number"
                    class="input"
                    style="width: 6rem;"
                    placeholder="Mbps"
                    value={$linkMapping[link.id || '']?.capacity || ''}
                    oninput={(e) => {
                      const value = e.currentTarget.value ? parseInt(e.currentTarget.value) : undefined
                      handleLinkCapacityChange(link.id || '', value)
                    }}
                  />
                  <span class="text-xs text-theme-text-muted">Mbps</span>
                </div>
              </div>
            {/each}
          {/if}
        </div>
      </div>
    {/if}
  {/if}
</div>

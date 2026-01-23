<script lang="ts">
import { onMount } from 'svelte'
import { page } from '$app/stores'
import { api } from '$lib/api'
import { Button } from '$lib/components/ui/button'
import type { Topology, Host, ZabbixMapping, ParsedTopologyResponse } from '$lib/types'
import ArrowLeft from 'phosphor-svelte/lib/ArrowLeft'
import FloppyDisk from 'phosphor-svelte/lib/FloppyDisk'
import MagnifyingGlass from 'phosphor-svelte/lib/MagnifyingGlass'

let topology = $state<Topology | null>(null)
let parsedTopology = $state<ParsedTopologyResponse | null>(null)
let hosts = $state<Host[]>([])
let loading = $state(true)
let saving = $state(false)
let error = $state('')

// Mapping state
let nodeMapping = $state<Record<string, { hostId?: string; hostName?: string }>>({})
let linkMapping = $state<Record<string, { interface?: string; capacity?: number }>>({})
let nodeSearchQuery = $state('')

let topologyId = $derived($page.params.id!)

onMount(async () => {
  try {
    // Load topology, parsed data, and hosts in parallel
    const [topoData, contextData] = await Promise.all([
      api.topologies.get(topologyId),
      api.topologies.getContext(topologyId),
    ])

    topology = topoData
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

    // Load existing mapping
    if (topology.mappingJson) {
      try {
        const existingMapping = JSON.parse(topology.mappingJson) as ZabbixMapping
        nodeMapping = existingMapping.nodes || {}
        linkMapping = existingMapping.links || {}
      } catch {
        // Ignore parsing error
      }
    }

    // Load hosts if metrics source is configured
    if (topology.metricsSourceId) {
      hosts = await api.dataSources.getHosts(topology.metricsSourceId)
    }
  } catch (e) {
    error = e instanceof Error ? e.message : 'Failed to load topology'
  } finally {
    loading = false
  }
})

async function handleSave() {
  if (!topology) return

  saving = true
  error = ''

  try {
    const mapping: ZabbixMapping = {
      nodes: nodeMapping,
      links: linkMapping,
    }

    await api.topologies.updateMapping(topology.id, mapping)
    // Update local state
    topology = { ...topology, mappingJson: JSON.stringify(mapping) }
  } catch (e) {
    error = e instanceof Error ? e.message : 'Failed to save mapping'
  } finally {
    saving = false
  }
}

function updateNodeMapping(nodeId: string, hostId: string) {
  const host = hosts.find((h) => h.id === hostId)
  if (hostId) {
    nodeMapping = {
      ...nodeMapping,
      [nodeId]: { hostId, hostName: host?.name || host?.displayName },
    }
  } else {
    const { [nodeId]: _, ...rest } = nodeMapping
    nodeMapping = rest
  }
}

function updateLinkCapacity(linkId: string, capacity: number | undefined) {
  if (capacity !== undefined) {
    linkMapping = {
      ...linkMapping,
      [linkId]: { ...linkMapping[linkId], capacity },
    }
  } else {
    const existing = linkMapping[linkId]
    if (existing) {
      const { capacity: _, ...rest } = existing
      if (Object.keys(rest).length === 0) {
        const { [linkId]: __, ...restLinks } = linkMapping
        linkMapping = restLinks
      } else {
        linkMapping = { ...linkMapping, [linkId]: rest }
      }
    }
  }
}

function updateLinkInterface(linkId: string, interfaceName: string) {
  if (interfaceName) {
    linkMapping = {
      ...linkMapping,
      [linkId]: { ...linkMapping[linkId], interface: interfaceName },
    }
  } else {
    const existing = linkMapping[linkId]
    if (existing) {
      const { interface: _, ...rest } = existing
      if (Object.keys(rest).length === 0) {
        const { [linkId]: __, ...restLinks } = linkMapping
        linkMapping = restLinks
      } else {
        linkMapping = { ...linkMapping, [linkId]: rest }
      }
    }
  }
}

function getNodeLabel(node: { label?: string | string[] }): string {
  if (Array.isArray(node.label)) {
    return node.label[0] || 'Unnamed'
  }
  return node.label || 'Unnamed'
}

// Filtered nodes based on search
let filteredNodes = $derived(
  parsedTopology?.graph.nodes.filter((node) => {
    if (!nodeSearchQuery) return true
    const label = getNodeLabel(node).toLowerCase()
    return label.includes(nodeSearchQuery.toLowerCase())
  }) || [],
)
</script>

<svelte:head>
  <title>Mapping - {topology?.name || 'Topology'} - Shumoku</title>
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
  {:else if topology && parsedTopology}
    <!-- Header -->
    <div class="flex items-center justify-between mb-6">
      <div>
        <a
          href="/topologies/{topologyId}/settings"
          class="inline-flex items-center gap-2 text-sm text-theme-text-muted hover:text-theme-text transition-colors mb-2"
        >
          <ArrowLeft size={16} />
          Back to Settings
        </a>
        <h1 class="text-xl font-semibold text-theme-text-emphasis">Mapping Configuration</h1>
        <p class="text-sm text-theme-text-muted">{topology.name}</p>
      </div>
      <Button onclick={handleSave} disabled={saving}>
        {#if saving}
          <span class="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2"></span>
        {:else}
          <FloppyDisk size={16} class="mr-2" />
        {/if}
        Save Mapping
      </Button>
    </div>

    {#if error}
      <div class="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm mb-6">
        {error}
      </div>
    {/if}

    {#if !topology.metricsSourceId}
      <div class="card p-6 text-center">
        <p class="text-theme-text-muted mb-4">
          No metrics source configured. Please select a data source in the settings first.
        </p>
        <a href="/topologies/{topologyId}/settings" class="btn btn-primary">
          Go to Settings
        </a>
      </div>
    {:else}
      <!-- Node Mapping -->
      <div class="card mb-6">
        <div class="card-header flex items-center justify-between">
          <h2 class="font-medium text-theme-text-emphasis">Node Mapping</h2>
          <div class="relative">
            <MagnifyingGlass size={16} class="absolute left-3 top-1/2 -translate-y-1/2 text-theme-text-muted" />
            <input
              type="text"
              class="input pl-9 w-48"
              placeholder="Search nodes..."
              bind:value={nodeSearchQuery}
            />
          </div>
        </div>
        <div class="divide-y divide-theme-border">
          {#if filteredNodes.length === 0}
            <div class="p-4 text-center text-theme-text-muted">
              {nodeSearchQuery ? 'No matching nodes found' : 'No nodes in topology'}
            </div>
          {:else}
            {#each filteredNodes as node}
              <div class="p-4 flex items-center gap-4">
                <div class="flex-1 min-w-0">
                  <p class="font-medium text-theme-text-emphasis truncate">{getNodeLabel(node)}</p>
                  <p class="text-xs text-theme-text-muted">{node.type || 'Unknown type'}</p>
                </div>
                <select
                  class="input w-64"
                  value={nodeMapping[node.id]?.hostId || ''}
                  on:change={(e) => updateNodeMapping(node.id, e.currentTarget.value)}
                >
                  <option value="">Not mapped</option>
                  {#each hosts as host}
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
                    {typeof link.from === 'string' ? link.from : link.from.node}
                    →
                    {typeof link.to === 'string' ? link.to : link.to.node}
                  </p>
                  <p class="text-xs text-theme-text-muted">{link.bandwidth || 'No bandwidth specified'}</p>
                </div>
                <div class="flex items-center gap-2">
                  <input
                    type="number"
                    class="input w-24"
                    placeholder="Mbps"
                    value={linkMapping[link.id || '']?.capacity || ''}
                    on:input={(e) => {
                      const value = e.currentTarget.value ? parseInt(e.currentTarget.value) : undefined
                      updateLinkCapacity(link.id || '', value)
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

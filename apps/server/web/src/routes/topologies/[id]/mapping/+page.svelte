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
  hostInterfaces,
  hostInterfacesLoading,
} from '$lib/stores'
import type { ParsedTopologyResponse } from '$lib/types'

// Edge endpoint with node and optional port
interface EdgeEndpoint {
  nodeId: string
  port?: string
}

// Edge data from API
interface EdgeData {
  id: string
  from: EdgeEndpoint
  to: EdgeEndpoint
  bandwidth?: string
}
import { api } from '$lib/api'
import ArrowLeft from 'phosphor-svelte/lib/ArrowLeft'
import FloppyDisk from 'phosphor-svelte/lib/FloppyDisk'
import MagnifyingGlass from 'phosphor-svelte/lib/MagnifyingGlass'
import Lightning from 'phosphor-svelte/lib/Lightning'
import Trash from 'phosphor-svelte/lib/Trash'
import CheckCircle from 'phosphor-svelte/lib/CheckCircle'
import Warning from 'phosphor-svelte/lib/Warning'
import ArrowRight from 'phosphor-svelte/lib/ArrowRight'

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

// Store edges with full endpoint info
let edges = $state<EdgeData[]>([])

async function loadData(forceReload = false) {
  try {
    // Load mapping data via store
    await mappingStore.load(topologyId, forceReload)

    // Load parsed topology for node/link list
    const contextData = await api.topologies.getContext(topologyId)
    topologyName = contextData.name
    edges = contextData.edges
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

    // Pre-load interfaces for all mapped hosts used in links
    loadInterfacesForMappedNodes()
  } catch (e) {
    localError = e instanceof Error ? e.message : 'Failed to load topology'
  }
}

// Load interfaces for all nodes that are mapped and used in links
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

// Auto-map link interfaces based on port names from topology
// Prioritizes the side that has interfaces available (network device side)
function handleAutoMapLinks() {
  let matched = 0
  for (const edge of edges) {
    const fromHostId = $nodeMapping[edge.from.nodeId]?.hostId
    const toHostId = $nodeMapping[edge.to.nodeId]?.hostId

    const fromInterfaces = fromHostId ? $hostInterfaces[fromHostId] || [] : []
    const toInterfaces = toHostId ? $hostInterfaces[toHostId] || [] : []
    const currentMapping = $linkMapping[edge.id] || {}

    // Skip if already mapped
    if (currentMapping.interface) continue

    // Try to find which side has interfaces (network device)
    // Priority: side with matching port name > side with any interfaces
    let monitoredNodeId: string | null = null
    let matchedInterface: string | null = null

    // Check "from" side first
    if (fromHostId && fromInterfaces.length > 0 && edge.from.port) {
      const match = findMatchingInterface(edge.from.port, fromInterfaces)
      if (match) {
        monitoredNodeId = edge.from.nodeId
        matchedInterface = match
      }
    }

    // If no match on "from", try "to" side
    if (!matchedInterface && toHostId && toInterfaces.length > 0 && edge.to.port) {
      const match = findMatchingInterface(edge.to.port, toInterfaces)
      if (match) {
        monitoredNodeId = edge.to.nodeId
        matchedInterface = match
      }
    }

    // Fallback: pick the side that has interfaces even without port match
    if (!matchedInterface) {
      if (fromHostId && fromInterfaces.length > 0) {
        monitoredNodeId = edge.from.nodeId
      } else if (toHostId && toInterfaces.length > 0) {
        monitoredNodeId = edge.to.nodeId
      }
    }

    if (monitoredNodeId && matchedInterface) {
      mappingStore.updateLink(edge.id, {
        ...currentMapping,
        monitoredNodeId,
        interface: matchedInterface,
      })
      matched++
    } else if (monitoredNodeId && !currentMapping.monitoredNodeId) {
      // At least set the monitored node even without interface match
      mappingStore.updateLink(edge.id, {
        ...currentMapping,
        monitoredNodeId,
      })
    }
  }
  return matched
}

// Find matching interface by port name (handles variations like "ge-0/0/1" vs "ge-0/0/1.0")
function findMatchingInterface(
  portName: string,
  interfaces: Array<{ name: string }>,
): string | null {
  const normalized = portName.toLowerCase().replace(/[:\s]/g, '')

  // Exact match first
  for (const iface of interfaces) {
    if (iface.name.toLowerCase() === portName.toLowerCase()) {
      return iface.name
    }
  }

  // Partial match (interface name contains port name or vice versa)
  for (const iface of interfaces) {
    const ifNorm = iface.name.toLowerCase().replace(/[:\s]/g, '')
    if (ifNorm.includes(normalized) || normalized.includes(ifNorm)) {
      return iface.name
    }
  }

  // Match base name (without .0 suffix)
  const basePort = normalized.split('.')[0]
  for (const iface of interfaces) {
    const baseIf = iface.name.toLowerCase().split('.')[0]
    if (baseIf === basePort) {
      return iface.name
    }
  }

  return null
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
  // Load interfaces for the new host
  if (hostId) {
    mappingStore.loadHostInterfaces(hostId)
  }
}

function handleLinkCapacityChange(linkId: string, capacity: number | undefined) {
  const existing = $linkMapping[linkId] || {}
  if (capacity !== undefined) {
    mappingStore.updateLink(linkId, { ...existing, capacity })
  } else {
    const { capacity: _, ...rest } = existing
    if (Object.keys(rest).length > 0) {
      mappingStore.updateLink(linkId, rest)
    } else {
      mappingStore.updateLink(linkId, null)
    }
  }
}

function handleMonitoredNodeChange(linkId: string, nodeId: string) {
  const existing = $linkMapping[linkId] || {}
  if (nodeId) {
    mappingStore.updateLink(linkId, { ...existing, monitoredNodeId: nodeId, interface: undefined })
    // Load interfaces for the selected node
    const hostId = $nodeMapping[nodeId]?.hostId
    if (hostId) {
      mappingStore.loadHostInterfaces(hostId)
    }
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

// Get node label by ID
function getNodeLabelById(nodeId: string): string {
  const node = parsedTopology?.graph.nodes.find((n) => n.id === nodeId)
  if (!node) return nodeId
  return getNodeLabel(node)
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

// Count mapped links (interface set)
let mappedLinksCount = $derived(
  edges.filter((e) => {
    const m = $linkMapping[e.id]
    return m?.monitoredNodeId && m?.interface
  }).length,
)
let totalLinks = $derived(edges.length)
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
            <span class="ml-2">• {mappedCount}/{totalNodes} nodes</span>
          {/if}
          {#if totalLinks > 0}
            <span class="ml-2">• {mappedLinksCount}/{totalLinks} links</span>
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
          <div class="flex items-center justify-between gap-4 mb-1">
            <h2 class="font-medium text-theme-text-emphasis">Link Mapping</h2>
            <Button variant="outline" size="sm" onclick={() => {
              const matched = handleAutoMapLinks()
              if (matched > 0) {
                autoMapResult = { matched, total: edges.length }
                setTimeout(() => { autoMapResult = null }, 5000)
              }
            }}>
              <Lightning size={14} class="mr-1" />
              Auto-map Interfaces
            </Button>
          </div>
          <p class="text-xs text-theme-text-muted">Select the monitored device and interface for each link</p>
        </div>
        <div class="divide-y divide-theme-border">
          {#if edges.length === 0}
            <div class="p-4 text-center text-theme-text-muted">
              No links in topology
            </div>
          {:else}
            {#each edges as edge}
              {@const linkId = edge.id}
              {@const fromNodeId = edge.from.nodeId}
              {@const toNodeId = edge.to.nodeId}
              {@const fromPort = edge.from.port}
              {@const toPort = edge.to.port}
              {@const fromHostId = $nodeMapping[fromNodeId]?.hostId}
              {@const toHostId = $nodeMapping[toNodeId]?.hostId}
              {@const currentMapping = $linkMapping[linkId] || {}}
              {@const monitoredNodeId = currentMapping.monitoredNodeId}
              {@const monitoredHostId = monitoredNodeId === fromNodeId ? fromHostId : monitoredNodeId === toNodeId ? toHostId : undefined}
              {@const interfaces = monitoredHostId ? $hostInterfaces[monitoredHostId] || [] : []}
              {@const interfacesLoading = monitoredHostId ? $hostInterfacesLoading[monitoredHostId] : false}
              {@const hasAnyMappedNode = !!fromHostId || !!toHostId}
              {@const fromHasInterfaces = fromHostId && ($hostInterfaces[fromHostId]?.length || 0) > 0}
              {@const toHasInterfaces = toHostId && ($hostInterfaces[toHostId]?.length || 0) > 0}
              <div class="p-4 space-y-3">
                <!-- Link header -->
                <div class="flex items-center justify-between gap-4">
                  <div class="flex-1 min-w-0">
                    <p class="font-medium text-theme-text-emphasis truncate flex items-center gap-2">
                      {#if currentMapping.monitoredNodeId && currentMapping.interface}
                        <span class="w-2 h-2 rounded-full bg-success flex-shrink-0"></span>
                      {:else if currentMapping.monitoredNodeId}
                        <span class="w-2 h-2 rounded-full bg-warning flex-shrink-0"></span>
                      {:else}
                        <span class="w-2 h-2 rounded-full bg-theme-text-muted flex-shrink-0"></span>
                      {/if}
                      {getNodeLabelById(fromNodeId)}
                      {#if fromPort}
                        <span class="text-xs text-theme-text-muted">({fromPort})</span>
                      {/if}
                      <ArrowRight size={14} class="text-theme-text-muted flex-shrink-0" />
                      {getNodeLabelById(toNodeId)}
                      {#if toPort}
                        <span class="text-xs text-theme-text-muted">({toPort})</span>
                      {/if}
                    </p>
                    <p class="text-xs text-theme-text-muted">{edge.bandwidth || 'No bandwidth specified'}</p>
                  </div>
                  <div class="flex items-center gap-2 flex-shrink-0">
                    <input
                      type="number"
                      class="input"
                      style="width: 5rem;"
                      placeholder="Mbps"
                      value={currentMapping.capacity || ''}
                      oninput={(e) => {
                        const value = e.currentTarget.value ? parseInt(e.currentTarget.value) : undefined
                        handleLinkCapacityChange(linkId, value)
                      }}
                    />
                    <span class="text-xs text-theme-text-muted">Mbps</span>
                  </div>
                </div>

                <!-- Interface mapping: single monitored node + interface -->
                {#if hasAnyMappedNode}
                  <div class="flex items-center gap-3 text-sm">
                    <!-- Monitored node selector -->
                    <div class="flex-shrink-0">
                      <label class="text-xs text-theme-text-muted mb-1 block">Monitor from</label>
                      <select
                        class="input"
                        style="width: 10rem;"
                        value={monitoredNodeId || ''}
                        onchange={(e) => handleMonitoredNodeChange(linkId, e.currentTarget.value)}
                      >
                        <option value="">Select device</option>
                        {#if fromHostId}
                          <option value={fromNodeId}>
                            {getNodeLabelById(fromNodeId)}{fromHasInterfaces ? '' : ' (no interfaces)'}
                          </option>
                        {/if}
                        {#if toHostId}
                          <option value={toNodeId}>
                            {getNodeLabelById(toNodeId)}{toHasInterfaces ? '' : ' (no interfaces)'}
                          </option>
                        {/if}
                      </select>
                    </div>

                    <!-- Interface selector -->
                    <div class="flex-1 min-w-0">
                      <label class="text-xs text-theme-text-muted mb-1 block">Interface</label>
                      {#if !monitoredNodeId}
                        <div class="input text-theme-text-muted" style="width: 100%;">Select device first</div>
                      {:else if interfacesLoading}
                        <div class="input text-theme-text-muted" style="width: 100%;">Loading...</div>
                      {:else if interfaces.length === 0}
                        <div class="input text-theme-text-muted" style="width: 100%;">No interfaces found</div>
                      {:else}
                        <select
                          class="input"
                          style="width: 100%;"
                          value={currentMapping.interface || ''}
                          onchange={(e) => handleLinkInterfaceChange(linkId, e.currentTarget.value)}
                        >
                          <option value="">Select interface</option>
                          {#each interfaces as iface}
                            <option value={iface.name}>{iface.name}</option>
                          {/each}
                        </select>
                      {/if}
                    </div>
                  </div>
                {:else}
                  <p class="text-xs text-theme-text-muted italic">
                    Map at least one node to enable interface selection
                  </p>
                {/if}
              </div>
            {/each}
          {/if}
        </div>
      </div>
    {/if}
  {/if}
</div>

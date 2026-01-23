<script lang="ts">
import { onMount } from 'svelte'
import { page } from '$app/stores'
import { goto } from '$app/navigation'
import { api } from '$lib/api'
import { metricsConnected } from '$lib/stores'
import InteractiveSvgDiagram from '$lib/components/InteractiveSvgDiagram.svelte'
import TopologySettings from '$lib/components/TopologySettings.svelte'
import type { Topology } from '$lib/types'
import X from 'phosphor-svelte/lib/X'

let topology: Topology | null = null
let renderData: { nodeCount: number; edgeCount: number } | null = null
let loading = true
let error = ''

// Settings panel state
let settingsOpen = false

// Get ID from route params
$: topologyId = $page.params.id!

onMount(async () => {
  try {
    const [topoData, renderResponse] = await Promise.all([
      api.topologies.get(topologyId),
      fetch(`/api/topologies/${topologyId}/render`).then((r) => r.json()),
    ])
    topology = topoData
    renderData = { nodeCount: renderResponse.nodeCount, edgeCount: renderResponse.edgeCount }
  } catch (e) {
    error = e instanceof Error ? e.message : 'Failed to load topology'
  } finally {
    loading = false
  }
})

function toggleSettings() {
  settingsOpen = !settingsOpen
}

function handleDeleted() {
  goto('/topologies')
}
</script>

<svelte:head>
  <title>{topology?.name || 'Topology'} - Shumoku</title>
</svelte:head>

<div class="h-full flex overflow-hidden">
  <!-- Main diagram area -->
  <div class="flex-1 relative min-h-0 min-w-0">
    {#if loading}
      <div class="absolute inset-0 flex items-center justify-center">
        <div class="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    {:else if error && !topology}
      <div class="absolute inset-0 flex items-center justify-center">
        <div class="card p-6 text-center">
          <p class="text-danger mb-4">{error}</p>
          <a href="/topologies" class="btn btn-secondary">Back to Topologies</a>
        </div>
      </div>
    {:else if topology}
      <div class="absolute inset-0">
        <InteractiveSvgDiagram {topologyId} onToggleSettings={toggleSettings} {settingsOpen} />
      </div>

      <!-- Connection status indicator -->
      <div class="absolute top-4 left-4 flex items-center gap-2 px-3 py-1.5 bg-theme-bg-elevated/90 backdrop-blur border border-theme-border rounded-lg text-xs z-10">
        {#if $metricsConnected}
          <span class="w-2 h-2 bg-success rounded-full animate-pulse"></span>
          <span class="text-success">Live</span>
        {:else}
          <span class="w-2 h-2 bg-theme-text-muted rounded-full"></span>
          <span class="text-theme-text-muted">Offline</span>
        {/if}
      </div>
    {/if}
  </div>

  <!-- Settings panel -->
  {#if topology && settingsOpen}
    <div class="w-80 border-l border-theme-border bg-theme-bg-elevated flex flex-col overflow-hidden">
      <!-- Panel header -->
      <div class="h-14 flex items-center justify-between px-4 border-b border-theme-border flex-shrink-0">
        <h2 class="font-medium text-theme-text-emphasis">Settings</h2>
        <button
          onclick={toggleSettings}
          class="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-theme-bg transition-colors text-theme-text-muted hover:text-theme-text"
          aria-label="Close settings"
        >
          <X size={20} />
        </button>
      </div>

      <!-- Panel content -->
      <div class="flex-1 overflow-y-auto p-4">
        <TopologySettings {topology} {renderData} onDeleted={handleDeleted} />
      </div>
    </div>
  {/if}
</div>

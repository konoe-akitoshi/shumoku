<script lang="ts">
  import { onMount } from 'svelte'
  import { page } from '$app/stores'
  import { goto } from '$app/navigation'
  import { api } from '$lib/api'
  import { metricsConnected } from '$lib/stores'
  import InteractiveSvgDiagram from '$lib/components/InteractiveSvgDiagram.svelte'
  import TopologySettings from '$lib/components/TopologySettings.svelte'
  import type { Topology } from '$lib/types'

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
        <InteractiveSvgDiagram {topologyId} />
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

      <!-- Settings toggle button -->
      <button
        onclick={toggleSettings}
        class="absolute top-4 right-4 w-9 h-9 flex items-center justify-center bg-theme-bg-elevated/90 backdrop-blur border border-theme-border rounded-lg text-theme-text-muted hover:text-theme-text hover:bg-theme-bg-elevated transition-colors z-10 {settingsOpen ? 'bg-theme-bg-elevated text-theme-text' : ''}"
        title="Toggle Settings"
      >
        <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      </button>
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
          <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      <!-- Panel content -->
      <div class="flex-1 overflow-y-auto p-4">
        <TopologySettings {topology} {renderData} onDeleted={handleDeleted} />
      </div>
    </div>
  {/if}
</div>

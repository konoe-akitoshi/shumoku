<script lang="ts">
  import { onMount } from 'svelte'
  import { page } from '$app/stores'
  import { api } from '$lib/api'
  import TopologySettings from '$lib/components/TopologySettings.svelte'
  import type { Topology } from '$lib/types'

  let topology: Topology | null = null
  let renderData: { nodeCount: number; edgeCount: number } | null = null
  let loading = true
  let error = ''

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
</script>

<svelte:head>
  <title>Settings - {topology?.name || 'Topology'} - Shumoku</title>
</svelte:head>

<div class="p-6 max-w-2xl mx-auto">
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
    <!-- Back to diagram -->
    <div class="mb-6">
      <a
        href="/topologies/{topologyId}"
        class="inline-flex items-center gap-2 text-sm text-theme-text-muted hover:text-theme-text transition-colors"
      >
        <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
        Back to Diagram
      </a>
    </div>

    <div class="card">
      <div class="card-header">
        <h1 class="font-medium text-theme-text-emphasis">Topology Settings</h1>
      </div>
      <div class="card-body">
        <TopologySettings {topology} {renderData} />
      </div>
    </div>
  {/if}
</div>

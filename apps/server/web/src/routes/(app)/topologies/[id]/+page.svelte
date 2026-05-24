<script lang="ts">
  import { page } from '$app/stores'
  import { api } from '$lib/api'
  import type {
    NodeSelectEvent,
    SubgraphSelectEvent,
  } from '$lib/components/InteractiveSvgDiagram.svelte'
  import InteractiveSvgDiagram from '$lib/components/InteractiveSvgDiagram.svelte'
  import NodeMappingModal from '$lib/components/NodeMappingModal.svelte'
  import NodeSearchPalette from '$lib/components/NodeSearchPalette.svelte'
  import ShareButton from '$lib/components/ShareButton.svelte'
  import SubgraphInfoModal from '$lib/components/SubgraphInfoModal.svelte'
  import { mappingStore, metricsConnected, topologies } from '$lib/stores'
  import type { Topology, TopologyDataSource } from '$lib/types'

  let topology = $state<Topology | null>(null)
  let loading = $state(true)
  let error = $state('')

  // Node mapping modal state
  let mappingModalOpen = $state(false)
  let selectedNodeData = $state<NodeSelectEvent | null>(null)
  let netboxBaseUrl = $state<string | undefined>(undefined)

  // Node search palette state
  let searchPaletteOpen = $state(false)

  // Subgraph info modal state
  let subgraphModalOpen = $state(false)
  let selectedSubgraphData = $state<SubgraphSelectEvent | null>(null)

  // Diagram component reference for drill-down
  let diagramComponent: InteractiveSvgDiagram | undefined = $state()

  // biome-ignore lint/style/noNonNullAssertion: $page.params.id is always defined for this route
  const topologyId = $derived($page.params.id!)
  const currentMapping = $derived($mappingStore.mapping)

  // Re-fetch whenever the route id changes (SvelteKit reuses this component
  // for navigations within /topologies/[id], so onMount alone would leave
  // the previous topology's data on screen).
  $effect(() => {
    const id = topologyId
    let cancelled = false
    loading = true
    error = ''
    topology = null
    netboxBaseUrl = undefined

    ;(async () => {
      try {
        const [topoData, sources] = await Promise.all([
          api.topologies.get(id),
          api.topologies.sources.list(id),
        ])
        if (cancelled) return
        topology = topoData
        topologies.upsert(topoData)
        mappingStore.hydrate(id, topoData, sources)

        const netboxSource = sources.find(
          (s: TopologyDataSource) => s.purpose === 'topology' && s.dataSource?.type === 'netbox',
        )
        if (netboxSource?.dataSource?.configJson) {
          try {
            const config = JSON.parse(netboxSource.dataSource.configJson)
            netboxBaseUrl = config.url?.replace(/\/$/, '')
          } catch {
            // Ignore parse errors
          }
        }
      } catch (e) {
        if (cancelled) return
        error = e instanceof Error ? e.message : 'Failed to load topology'
      } finally {
        if (!cancelled) loading = false
      }
    })()

    return () => {
      cancelled = true
    }
  })

  function handleNodeSelect(event: NodeSelectEvent) {
    selectedNodeData = event
    mappingModalOpen = true
  }

  function handleSubgraphSelect(event: SubgraphSelectEvent) {
    selectedSubgraphData = event
    subgraphModalOpen = true
  }

  function handleSubgraphDrillDown(subgraphId: string) {
    diagramComponent?.navigateToSheet(subgraphId)
  }

  function handleMappingSaved(_nodeId: string, _mapping: { hostId?: string; hostName?: string }) {
    // Mapping is now handled by the shared store, no need to update local state
  }

  function handleSearchSelect(nodeId: string) {
    diagramComponent?.panToNode(nodeId)
  }

  async function handleShare() {
    if (!topology) return
    topology = await topologies.share(topologyId)
  }

  async function handleUnshare() {
    if (!topology) return
    topology = await topologies.unshare(topologyId)
  }

  function handleKeydown(e: KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault()
      searchPaletteOpen = !searchPaletteOpen
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<svelte:head> <title>{topology?.name || 'Topology'} - Shumoku</title> </svelte:head>

<div class="h-full flex overflow-hidden">
  <!-- Main diagram area -->
  <div class="flex-1 relative min-h-0 min-w-0">
    {#if loading}
      <div class="absolute inset-0 flex items-center justify-center">
        <div
          class="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"
        ></div>
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
        <InteractiveSvgDiagram
          bind:this={diagramComponent}
          {topologyId}
          onSearchOpen={() => (searchPaletteOpen = true)}
          onNodeSelect={handleNodeSelect}
          onSubgraphSelect={handleSubgraphSelect}
        />
      </div>

      <!-- Share button -->
      <div class="absolute top-4 right-4 z-10">
        <ShareButton
          shareToken={topology.shareToken}
          shareType="topologies"
          onShare={handleShare}
          onUnshare={handleUnshare}
        />
      </div>

      <!-- Connection status indicator -->
      <div
        class="absolute top-4 left-4 flex items-center gap-2 px-3 py-1.5 bg-theme-bg-elevated/90 backdrop-blur border border-theme-border rounded-lg text-xs z-10"
      >
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
</div>

<!-- Subgraph Info Modal -->
<SubgraphInfoModal
  bind:open={subgraphModalOpen}
  subgraphData={selectedSubgraphData}
  onDrillDown={handleSubgraphDrillDown}
/>

<!-- Node Search Palette -->
<NodeSearchPalette
  bind:open={searchPaletteOpen}
  getGraph={() => diagramComponent?.getGraph() ?? null}
  onSelect={handleSearchSelect}
/>

<!-- Node Mapping Modal -->
{#if topology}
  <NodeMappingModal
    bind:open={mappingModalOpen}
    {topologyId}
    {netboxBaseUrl}
    nodeData={selectedNodeData}
    {currentMapping}
    onSaved={handleMappingSaved}
  />
{/if}

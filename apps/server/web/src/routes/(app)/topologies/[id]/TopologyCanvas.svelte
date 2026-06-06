<script lang="ts">
  /**
   * The persistent diagram canvas (表). Rendered once by the topology
   * shell layout and kept mounted behind the Composition drawer, so
   * switching composition stages never tears down the diagram — the
   * operator keeps focus+context (a mapping/discovery edit is visible
   * here immediately). See `apps/server/docs/design/topology-ui-ia.md`.
   *
   * Reads the topology + sources the layout already loaded into the
   * shell context, so there is no second fetch.
   */
  import type {
    NodeSelectEvent,
    SubgraphSelectEvent,
  } from '$lib/components/InteractiveSvgDiagram.svelte'
  import InteractiveSvgDiagram from '$lib/components/InteractiveSvgDiagram.svelte'
  import NodeMappingModal from '$lib/components/NodeMappingModal.svelte'
  import NodeSearchPalette from '$lib/components/NodeSearchPalette.svelte'
  import SubgraphInfoModal from '$lib/components/SubgraphInfoModal.svelte'
  import { mappingStore, metricsConnected } from '$lib/stores'
  import type { TopologyDataSource } from '$lib/types'
  import { useTopologyCtx } from './_context.svelte'

  const ctx = useTopologyCtx()

  let mappingModalOpen = $state(false)
  let selectedNodeData = $state<NodeSelectEvent | null>(null)
  let netboxBaseUrl = $state<string | undefined>(undefined)
  let searchPaletteOpen = $state(false)
  let subgraphModalOpen = $state(false)
  let selectedSubgraphData = $state<SubgraphSelectEvent | null>(null)
  let diagramComponent: InteractiveSvgDiagram | undefined = $state()

  const topologyId = $derived(ctx.topologyId)
  const currentMapping = $derived($mappingStore.mapping)

  // Hydrate the metrics mapping + derive the NetBox deep-link base once the
  // shell context has loaded the topology and its sources. Re-runs when the
  // topology id changes (the layout reloads the context on navigation).
  $effect(() => {
    const id = ctx.topologyId
    const topo = ctx.topology
    const sources = ctx.currentSources
    if (!id || !topo) return
    mappingStore.hydrate(id, topo, sources)
    netboxBaseUrl = undefined
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
    // Mapping is handled by the shared store; nothing to do locally.
  }

  function handleSearchSelect(nodeId: string) {
    diagramComponent?.panToNode(nodeId)
  }

  function handleKeydown(e: KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault()
      searchPaletteOpen = !searchPaletteOpen
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="absolute inset-0 min-h-0 min-w-0">
  {#if ctx.loading && !ctx.topology}
    <div class="absolute inset-0 flex items-center justify-center">
      <div
        class="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"
      ></div>
    </div>
  {:else if ctx.error && !ctx.topology}
    <div class="absolute inset-0 flex items-center justify-center">
      <div class="card p-6 text-center">
        <p class="text-danger mb-4">{ctx.error}</p>
        <a href="/topologies" class="btn btn-secondary">Back to Topologies</a>
      </div>
    </div>
  {:else if ctx.topology}
    <div class="absolute inset-0">
      <InteractiveSvgDiagram
        bind:this={diagramComponent}
        {topologyId}
        onSearchOpen={() => (searchPaletteOpen = true)}
        onNodeSelect={handleNodeSelect}
        onSubgraphSelect={handleSubgraphSelect}
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

<SubgraphInfoModal
  bind:open={subgraphModalOpen}
  subgraphData={selectedSubgraphData}
  onDrillDown={handleSubgraphDrillDown}
/>

<NodeSearchPalette
  bind:open={searchPaletteOpen}
  getGraph={() => diagramComponent?.getGraph() ?? null}
  onSelect={handleSearchSelect}
/>

{#if ctx.topology}
  <NodeMappingModal
    bind:open={mappingModalOpen}
    {topologyId}
    {netboxBaseUrl}
    nodeData={selectedNodeData}
    {currentMapping}
    onSaved={handleMappingSaved}
  />
{/if}

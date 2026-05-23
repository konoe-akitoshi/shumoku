<script lang="ts">
  import { DatabaseIcon, PencilSimpleIcon, TrashIcon } from 'phosphor-svelte'
  import { onMount } from 'svelte'
  import { goto } from '$app/navigation'
  import { api } from '$lib/api'
  import { Button } from '$lib/components/ui/button'
  import {
    dataSources,
    displaySettings,
    liveUpdatesEnabled,
    metricsConnected,
    showNodeStatus,
    showTrafficFlow,
    topologies,
  } from '$lib/stores'
  import type { MetricsMapping, Topology, TopologyDataSource } from '$lib/types'

  interface Props {
    topology: Topology
    renderData?: { nodeCount: number; edgeCount: number } | null
    onDeleted?: (() => void) | null
    onUpdated?: ((topology: Topology) => void) | null
  }

  let { topology, renderData = null, onDeleted = null, onUpdated = null }: Props = $props()

  let deleting = $state(false)
  let savingEdgeStyle = $state(false)
  let topologySources = $state<TopologyDataSource[]>([])
  let metricsSources = $state<TopologyDataSource[]>([])

  // Edge style settings (from topology's graph.settings)
  let edgeStyle = $state('orthogonal')
  let splineMode = $state('sloppy')

  // edgeStyle / splineMode live on `NetworkGraph.settings` inside the
  // Manual source 's graph (config_json.graph). Read/write via the data
  // source config — same path as the Manual editor page.
  async function parseGraphSettings() {
    if (!topology.manualSourceId) return
    try {
      const ds = await api.dataSources.get(topology.manualSourceId)
      const config = JSON.parse(ds.configJson || '{}') as {
        graph?: { settings?: { edgeStyle?: string; splineMode?: string } }
      }
      const settings = config.graph?.settings
      edgeStyle = settings?.edgeStyle || 'orthogonal'
      splineMode = settings?.splineMode || 'sloppy'
    } catch {
      // Use defaults
    }
  }

  async function updateEdgeStyle() {
    if (!topology.manualSourceId) return
    savingEdgeStyle = true
    try {
      const ds = await api.dataSources.get(topology.manualSourceId)
      const config = JSON.parse(ds.configJson || '{}') as {
        graph?: { settings?: Record<string, unknown>; [k: string]: unknown }
        [k: string]: unknown
      }
      const graph = (config.graph ?? { version: '1', nodes: [], links: [] }) as {
        settings?: Record<string, unknown>
        [k: string]: unknown
      }
      graph.settings = (graph.settings ?? {}) as Record<string, unknown>
      graph.settings['edgeStyle'] = edgeStyle
      if (edgeStyle === 'splines') {
        graph.settings['splineMode'] = splineMode
      } else {
        delete graph.settings['splineMode']
      }
      config.graph = graph
      await dataSources.update(topology.manualSourceId, {
        configJson: JSON.stringify(config),
      })
      if (onUpdated) onUpdated(topology)
    } catch (e) {
      console.error('Failed to update edge style:', e)
    } finally {
      savingEdgeStyle = false
    }
  }

  // Mapping stats
  function getMappingStats(mappingJson?: string): { mappedNodes: number; mappedLinks: number } {
    if (!mappingJson) return { mappedNodes: 0, mappedLinks: 0 }
    try {
      const mapping = JSON.parse(mappingJson) as MetricsMapping
      const mappedNodes = Object.values(mapping.nodes || {}).filter(
        (n) => n.hostId || n.hostName,
      ).length
      const mappedLinks = Object.values(mapping.links || {}).filter(
        (l) => l.interface || l.monitoredNodeId,
      ).length
      return { mappedNodes, mappedLinks }
    } catch {
      return { mappedNodes: 0, mappedLinks: 0 }
    }
  }

  let mappingStats = $derived(getMappingStats(topology.mappingJson))

  onMount(async () => {
    // Parse graph settings
    parseGraphSettings()

    try {
      const sources = await api.topologies.sources.list(topology.id)
      topologySources = sources.filter((s) => s.purpose === 'topology')
      metricsSources = sources.filter((s) => s.purpose === 'metrics')
    } catch (e) {
      console.error('Failed to load data sources:', e)
    }
  })

  async function handleDelete() {
    if (!confirm(`Delete topology "${topology.name}"? This action cannot be undone.`)) {
      return
    }
    deleting = true
    try {
      await topologies.delete(topology.id)
      if (onDeleted) {
        onDeleted()
      } else {
        goto('/topologies')
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to delete')
      deleting = false
    }
  }
</script>

<div class="space-y-4">
  <!-- General -->
  <div class="space-y-3">
    <h3 class="text-xs font-medium text-theme-text-muted uppercase tracking-wide">General</h3>
    <div class="space-y-2">
      <div>
        <p class="text-xs text-theme-text-muted">Name</p>
        <p class="text-sm font-medium text-theme-text-emphasis">{topology.name}</p>
      </div>
      <div>
        <p class="text-xs text-theme-text-muted">ID</p>
        <p class="text-xs font-mono text-theme-text">{topology.id}</p>
      </div>
    </div>
  </div>

  <hr class="border-theme-border">

  <!-- Statistics -->
  {#if renderData}
    <div class="space-y-3">
      <h3 class="text-xs font-medium text-theme-text-muted uppercase tracking-wide">Statistics</h3>
      <div class="grid grid-cols-2 gap-3">
        <div class="bg-theme-bg rounded-lg p-3">
          <p class="text-xs text-theme-text-muted">Nodes</p>
          <p class="text-xl font-semibold text-theme-text-emphasis">{renderData.nodeCount}</p>
        </div>
        <div class="bg-theme-bg rounded-lg p-3">
          <p class="text-xs text-theme-text-muted">Edges</p>
          <p class="text-xl font-semibold text-theme-text-emphasis">{renderData.edgeCount}</p>
        </div>
      </div>
      <div>
        <p class="text-xs text-theme-text-muted">Updated</p>
        <p class="text-sm text-theme-text">{new Date(topology.updatedAt).toLocaleString()}</p>
      </div>
    </div>

    <hr class="border-theme-border">
  {/if}

  <!-- Data Sources — summary + link to the full Settings page. The
       actual "go grab data" (Sync all / per-source sync) lives in the
       Discovery tab there. Keeping this drawer thin avoids the
       2-places-for-the-same-thing problem PR #310/#311 created. -->
  <div class="space-y-3">
    <h3 class="text-xs font-medium text-theme-text-muted uppercase tracking-wide">Data Sources</h3>
    <div class="space-y-3">
      <!-- Topology Sources Summary -->
      <div class="bg-theme-bg rounded-lg p-3">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm text-theme-text">Topology Sources</p>
            <p class="text-xs text-theme-text-muted">
              {#if topologySources.length === 0}
                Manual (YAML)
              {:else}
                {topologySources.length}
                source{topologySources.length > 1 ? 's' : ''}
                configured
              {/if}
            </p>
          </div>
          <DatabaseIcon size={20} class="text-theme-text-muted" />
        </div>
      </div>

      <!-- Metrics Sources Summary -->
      <div class="bg-theme-bg rounded-lg p-3">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm text-theme-text">Metrics Sources</p>
            <p class="text-xs text-theme-text-muted">
              {#if metricsSources.length === 0}
                Not configured
              {:else}
                {metricsSources.length}
                source{metricsSources.length > 1 ? 's' : ''}
                configured
              {/if}
            </p>
          </div>
          <DatabaseIcon size={20} class="text-theme-text-muted" />
        </div>
      </div>

      <!-- Configure + Discovery links — each is its own subroute now
           (Sources is declarative, Discovery is where "Sync now" lives). -->
      <div class="grid grid-cols-2 gap-2">
        <a href="/topologies/{topology.id}/sources" class="btn btn-secondary justify-center">
          <DatabaseIcon size={16} class="mr-2" />
          Configure
        </a>
        <a href="/topologies/{topology.id}/discovery" class="btn btn-secondary justify-center">
          Discovery →
        </a>
      </div>
    </div>
  </div>

  <hr class="border-theme-border">

  <!-- Mapping Configuration -->
  {#if metricsSources.length > 0}
    <div class="space-y-3">
      <h3 class="text-xs font-medium text-theme-text-muted uppercase tracking-wide">
        Metrics Mapping
      </h3>
      <div class="space-y-3">
        <div class="grid grid-cols-2 gap-3">
          <div class="bg-theme-bg rounded-lg p-3">
            <p class="text-xs text-theme-text-muted">Mapped Nodes</p>
            <p class="text-lg font-semibold text-theme-text-emphasis">
              {mappingStats.mappedNodes}
              {#if renderData}
                <span class="text-xs font-normal text-theme-text-muted"
                  >/ {renderData.nodeCount}</span
                >
              {/if}
            </p>
          </div>
          <div class="bg-theme-bg rounded-lg p-3">
            <p class="text-xs text-theme-text-muted">Mapped Links</p>
            <p class="text-lg font-semibold text-theme-text-emphasis">
              {mappingStats.mappedLinks}
              {#if renderData}
                <span class="text-xs font-normal text-theme-text-muted"
                  >/ {renderData.edgeCount}</span
                >
              {/if}
            </p>
          </div>
        </div>
        <a href="/topologies/{topology.id}/mapping" class="btn btn-secondary w-full justify-center">
          Configure Mapping
        </a>
        <p class="text-xs text-theme-text-muted">
          Map topology nodes and links to hosts and interfaces for live metrics display.
        </p>
      </div>
    </div>

    <hr class="border-theme-border">
  {/if}

  <!-- Display Settings -->
  <div class="space-y-3">
    <h3 class="text-xs font-medium text-theme-text-muted uppercase tracking-wide">Display</h3>

    <!-- Edge Style -->
    <div class="py-2">
      <label for="edgeStyle" class="text-sm text-theme-text block mb-1">Edge Style</label>
      <select
        id="edgeStyle"
        class="input w-full"
        bind:value={edgeStyle}
        onchange={updateEdgeStyle}
        disabled={savingEdgeStyle}
      >
        <option value="orthogonal">Orthogonal (default)</option>
        <option value="polyline">Polyline</option>
        <option value="splines">Splines (curved)</option>
        <option value="straight">Straight</option>
      </select>
      <p class="text-xs text-theme-text-muted mt-1">How edges are routed between nodes</p>
    </div>

    {#if edgeStyle === 'splines'}
      <div class="py-2">
        <label for="splineMode" class="text-sm text-theme-text block mb-1">Spline Mode</label>
        <select
          id="splineMode"
          class="input w-full"
          bind:value={splineMode}
          onchange={updateEdgeStyle}
          disabled={savingEdgeStyle}
        >
          <option value="sloppy">Sloppy (smoother curves)</option>
          <option value="conservative">Conservative (avoids nodes)</option>
          <option value="conservative_soft">Conservative Soft</option>
        </select>
        <p class="text-xs text-theme-text-muted mt-1">
          Trade-off between smoothness and node avoidance
        </p>
      </div>
    {/if}

    <hr class="border-theme-border/50">

    <!-- Connection Status (read-only indicator) -->
    <div class="flex items-center justify-between py-2">
      <div>
        <p class="text-sm text-theme-text">Connection Status</p>
        <p class="text-xs text-theme-text-muted">Real-time data stream</p>
      </div>
      <div class="flex items-center gap-2">
        {#if $metricsConnected}
          <span class="w-2 h-2 bg-success rounded-full animate-pulse"></span>
          <span class="text-xs text-success font-medium">Live</span>
        {:else}
          <span class="w-2 h-2 bg-theme-text-muted rounded-full"></span>
          <span class="text-xs text-theme-text-muted">Offline</span>
        {/if}
      </div>
    </div>

    <hr class="border-theme-border/50">

    <!-- Live Updates Toggle -->
    <label class="flex items-center justify-between py-2 cursor-pointer">
      <div>
        <p class="text-sm text-theme-text">Live Updates</p>
        <p class="text-xs text-theme-text-muted">Connect to metrics server</p>
      </div>
      <input
        type="checkbox"
        class="toggle"
        checked={$liveUpdatesEnabled}
        onchange={(e) => displaySettings.setLiveUpdates(e.currentTarget.checked)}
      >
    </label>

    <!-- Traffic Flow Toggle -->
    <label
      class="flex items-center justify-between py-2 cursor-pointer {!$liveUpdatesEnabled ? 'opacity-50' : ''}"
    >
      <div>
        <p class="text-sm text-theme-text">Traffic Flow</p>
        <p class="text-xs text-theme-text-muted">Show link utilization colors</p>
      </div>
      <input
        type="checkbox"
        class="toggle"
        checked={$showTrafficFlow}
        disabled={!$liveUpdatesEnabled}
        onchange={(e) => displaySettings.setShowTrafficFlow(e.currentTarget.checked)}
      >
    </label>

    <!-- Node Status Toggle -->
    <label
      class="flex items-center justify-between py-2 cursor-pointer {!$liveUpdatesEnabled ? 'opacity-50' : ''}"
    >
      <div>
        <p class="text-sm text-theme-text">Node Status</p>
        <p class="text-xs text-theme-text-muted">Show up/down indicators</p>
      </div>
      <input
        type="checkbox"
        class="toggle"
        checked={$showNodeStatus}
        disabled={!$liveUpdatesEnabled}
        onchange={(e) => displaySettings.setShowNodeStatus(e.currentTarget.checked)}
      >
    </label>
  </div>

  <hr class="border-theme-border">

  <!-- Actions -->
  <div class="space-y-3">
    <h3 class="text-xs font-medium text-theme-text-muted uppercase tracking-wide">Actions</h3>
    <div class="space-y-2">
      {#if topology.manualSourceId}
        <a
          href="/datasources/{topology.manualSourceId}"
          class="btn btn-secondary w-full justify-center"
        >
          <PencilSimpleIcon size={16} class="mr-2" />
          Edit Manual content
        </a>
      {/if}
    </div>
  </div>

  <hr class="border-theme-border">

  <!-- Danger Zone -->
  <div class="space-y-3">
    <h3 class="text-xs font-medium text-danger uppercase tracking-wide">Danger Zone</h3>
    <div>
      <p class="text-xs text-theme-text-muted mb-2">
        Once deleted, this topology cannot be recovered.
      </p>
      <Button
        variant="destructive"
        class="w-full justify-center"
        onclick={handleDelete}
        disabled={deleting}
      >
        {#if deleting}
          <span
            class="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2"
          ></span>
        {:else}
          <TrashIcon size={16} class="mr-2" />
        {/if}
        Delete Topology
      </Button>
    </div>
  </div>
</div>

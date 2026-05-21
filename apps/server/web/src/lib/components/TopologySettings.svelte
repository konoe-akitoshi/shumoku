<script lang="ts">
  import { DatabaseIcon, PencilSimpleIcon, TrashIcon } from 'phosphor-svelte'
  import { onMount } from 'svelte'
  import { goto } from '$app/navigation'
  import { api } from '$lib/api'
  import { Button } from '$lib/components/ui/button'
  import {
    displaySettings,
    liveUpdatesEnabled,
    metricsConnected,
    showNodeStatus,
    showTrafficFlow,
    topologies,
  } from '$lib/stores'
  import type {
    DataSourcePluginInfo,
    MetricsMapping,
    Topology,
    TopologyDataSource,
  } from '$lib/types'

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
  let pluginTypes = $state<DataSourcePluginInfo[]>([])
  let pluginTypeMap = $derived(
    pluginTypes.reduce(
      (acc, p) => {
        acc[p.type] = p
        return acc
      },
      {} as Record<string, DataSourcePluginInfo>,
    ),
  )
  let syncingId = $state<string | null>(null)
  /** Per-source last-sync result. */
  let lastSyncResult = $state<
    Record<
      string,
      {
        status: 'ok' | 'partial' | 'failed' | 'empty'
        nodeCount: number
        linkCount: number
        portCount: number
        message?: string
        at: number
      }
    >
  >({})

  // Edge style settings (from topology's graph.settings)
  let edgeStyle = $state('orthogonal')
  let splineMode = $state('sloppy')

  // Parse graph settings from contentJson
  function parseGraphSettings() {
    try {
      const graph = JSON.parse(topology.contentJson)
      edgeStyle = graph.settings?.edgeStyle || 'orthogonal'
      splineMode = graph.settings?.splineMode || 'sloppy'
    } catch {
      // Use defaults
    }
  }

  // Update edge style in topology
  async function updateEdgeStyle() {
    savingEdgeStyle = true
    try {
      const graph = JSON.parse(topology.contentJson)
      graph.settings = graph.settings || {}
      graph.settings.edgeStyle = edgeStyle
      if (edgeStyle === 'splines') {
        graph.settings.splineMode = splineMode
      } else {
        delete graph.settings.splineMode
      }
      const updatedTopology = await topologies.update(topology.id, {
        contentJson: JSON.stringify(graph),
      })
      if (updatedTopology && onUpdated) {
        onUpdated(updatedTopology)
      }
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
      const [sources, types] = await Promise.all([
        api.topologies.sources.list(topology.id),
        api.dataSources.getPluginTypes(),
      ])
      topologySources = sources.filter((s) => s.purpose === 'topology')
      metricsSources = sources.filter((s) => s.purpose === 'metrics')
      pluginTypes = types
    } catch (e) {
      console.error('Failed to load data sources:', e)
    }
  })

  /** Does the registered plugin advertise the `autoscan` capability? */
  function hasAutoscan(type: string | undefined): boolean {
    if (!type) return false
    return pluginTypeMap[type]?.capabilities?.includes('autoscan') ?? false
  }

  /**
   * Trigger sync for a single attached source. Dispatches by capability:
   *   - autoscan plugins → POST /datasources/:id/scan with this topology
   *     id → records a `topology_observations` row → server cache is
   *     invalidated → next /render re-runs resolve()
   *   - other topology-capable plugins (e.g. NetBox) → existing
   *     /topologies/:id/sync-from-source path (legacy, edits content_json)
   */
  async function handleSync(source: TopologyDataSource) {
    syncingId = source.dataSourceId
    try {
      if (hasAutoscan(source.dataSource?.type)) {
        const result = await api.dataSources.scan(source.dataSourceId, {
          topologyId: topology.id,
        })
        const counts = result.snapshot.graph ?? { nodes: [], links: [] }
        let portCount = 0
        for (const n of counts.nodes ?? []) {
          portCount += n.ports?.length ?? 0
        }
        lastSyncResult = {
          ...lastSyncResult,
          [source.dataSourceId]: {
            status: result.snapshot.status,
            nodeCount: counts.nodes?.length ?? 0,
            linkCount: counts.links?.length ?? 0,
            portCount,
            message: result.snapshot.statusMessage,
            at: Date.now(),
          },
        }
      } else {
        const result = await api.topologies.syncFromSource(topology.id)
        lastSyncResult = {
          ...lastSyncResult,
          [source.dataSourceId]: {
            status: 'ok',
            nodeCount: result.nodeCount,
            linkCount: result.linkCount,
            portCount: 0,
            at: Date.now(),
          },
        }
      }
      // Pull the refreshed topology so the diagram re-renders through the
      // observation-resolver path.
      const updated = await api.topologies.get(topology.id)
      if (onUpdated) onUpdated(updated)
    } catch (e) {
      lastSyncResult = {
        ...lastSyncResult,
        [source.dataSourceId]: {
          status: 'failed',
          nodeCount: 0,
          linkCount: 0,
          portCount: 0,
          message: e instanceof Error ? e.message : 'Sync failed',
          at: Date.now(),
        },
      }
    } finally {
      syncingId = null
    }
  }

  function formatAgo(ts: number): string {
    const diff = Date.now() - ts
    if (diff < 60_000) return 'just now'
    if (diff < 3600_000) return `${Math.floor(diff / 60_000)}m ago`
    return new Date(ts).toLocaleString()
  }

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

  <!-- Sources — unified section: list every attached source (topology +
       metrics), let user trigger sync inline. Replaces the older split
       between two summary boxes and a separate "Sync sources" panel. -->
  <div class="space-y-3">
    <h3 class="text-xs font-medium text-theme-text-muted uppercase tracking-wide">Sources</h3>

    {#if topologySources.length === 0 && metricsSources.length === 0}
      <p class="text-xs text-theme-text-muted">Manual (YAML). No data sources attached.</p>
    {:else}
      <div class="space-y-2">
        {#each [...topologySources, ...metricsSources] as src (src.id)}
          {@const isTopology = src.purpose === 'topology'}
          {@const canSync = isTopology}
          {@const result = lastSyncResult[src.dataSourceId]}
          <div class="rounded-lg border border-theme-border p-3">
            <div class="flex items-center justify-between gap-2">
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-2">
                  <p class="text-sm text-theme-text-emphasis truncate">
                    {src.dataSource?.name ?? src.dataSourceId}
                  </p>
                  <span
                    class="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded {isTopology
                      ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                      : 'bg-purple-500/10 text-purple-600 dark:text-purple-400'}"
                  >
                    {src.purpose}
                  </span>
                </div>
                <p class="text-xs font-mono text-theme-text-muted">
                  {src.dataSource?.type ?? '—'}
                  {#if isTopology}
                    · {hasAutoscan(src.dataSource?.type) ? 'autoscan' : 'fetch'}
                  {/if}
                </p>
              </div>
              {#if canSync}
                <Button
                  variant="outline"
                  size="sm"
                  onclick={() => handleSync(src)}
                  disabled={syncingId === src.dataSourceId}
                >
                  {syncingId === src.dataSourceId ? 'Syncing…' : 'Sync now'}
                </Button>
              {/if}
            </div>
            {#if result}
              <p class="mt-2 text-xs">
                {#if result.status === 'ok'}
                  <span class="text-theme-text-muted">
                    ✓ {result.nodeCount} nodes / {result.linkCount} links
                    {#if result.portCount > 0}
                      / {result.portCount} ports
                    {/if}
                    · {formatAgo(result.at)}
                  </span>
                {:else if result.status === 'partial'}
                  <span class="text-amber-500" title={result.message}>
                    ⚠ partial: {result.nodeCount} nodes / {result.linkCount} links ·
                    {formatAgo(
                      result.at,
                    )}
                  </span>
                {:else if result.status === 'empty'}
                  <span class="text-theme-text-muted">
                    no devices observed · {formatAgo(result.at)}
                  </span>
                {:else}
                  <span class="text-red-500" title={result.message}>
                    ✗ {result.message ?? 'failed'}
                  </span>
                {/if}
              </p>
            {/if}
          </div>
        {/each}
      </div>
    {/if}

    <a
      href="/topologies/{topology.id}/settings#sources"
      class="btn btn-secondary w-full justify-center"
    >
      <DatabaseIcon size={16} class="mr-2" />
      Configure sources
    </a>
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
        <a
          href="/topologies/{topology.id}/settings#mapping"
          class="btn btn-secondary w-full justify-center"
        >
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
      <a href="/topologies/{topology.id}/edit" class="btn btn-secondary w-full justify-center">
        <PencilSimpleIcon size={16} class="mr-2" />
        Edit YAML
      </a>
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

<script lang="ts">
import { onMount } from 'svelte'
import { page } from '$app/stores'
import { api } from '$lib/api'
import { Button } from '$lib/components/ui/button'
import type {
  Topology,
  DataSource,
  TopologyDataSource,
  TopologyDataSourceInput,
  SyncMode,
} from '$lib/types'
import ArrowLeft from 'phosphor-svelte/lib/ArrowLeft'
import Plus from 'phosphor-svelte/lib/Plus'
import Trash from 'phosphor-svelte/lib/Trash'
import ArrowsClockwise from 'phosphor-svelte/lib/ArrowsClockwise'
import Copy from 'phosphor-svelte/lib/Copy'
import CheckCircle from 'phosphor-svelte/lib/CheckCircle'

let topologyId = $derived($page.params.id!)

let topology = $state<Topology | null>(null)
let loading = $state(true)
let error = $state('')
let saving = $state(false)
let hasChanges = $state(false)

// Current sources (from API)
let currentSources = $state<TopologyDataSource[]>([])

// Editable sources (local state until save)
let editableSources = $state<TopologyDataSourceInput[]>([])

// Available data sources
let topologyDataSources = $state<DataSource[]>([])
let metricsDataSources = $state<DataSource[]>([])

// Sync state
let syncing = $state(false)
let syncResult = $state<{ nodeCount: number; linkCount: number } | null>(null)

// Webhook URL state
let copiedSecret = $state<string | null>(null)

// Filter options cache per data source ID
let filterOptionsCache = $state<
  Record<
    string,
    {
      sites: { slug: string; name: string }[]
      tags: { slug: string; name: string }[]
      roles: { slug: string; name: string }[]
    }
  >
>({})
let filterOptionsLoading = $state<Record<string, boolean>>({})

onMount(async () => {
  try {
    const [topoData, sources, topologySources, metricsSources] = await Promise.all([
      api.topologies.get(topologyId),
      api.topologies.sources.list(topologyId),
      api.dataSources.listByCapability('topology'),
      api.dataSources.listByCapability('metrics'),
    ])
    topology = topoData
    currentSources = sources
    topologyDataSources = topologySources
    metricsDataSources = metricsSources

    // Initialize editable sources from current
    editableSources = sources.map((s) => ({
      dataSourceId: s.dataSourceId,
      purpose: s.purpose,
      syncMode: s.syncMode,
      priority: s.priority,
      optionsJson: s.optionsJson,
    }))

    // Preload filter options for NetBox sources
    for (const s of editableSources) {
      loadFilterOptions(s.dataSourceId)
    }
  } catch (e) {
    error = e instanceof Error ? e.message : 'Failed to load data'
  } finally {
    loading = false
  }
})

async function loadFilterOptions(dataSourceId: string) {
  if (filterOptionsCache[dataSourceId] || filterOptionsLoading[dataSourceId]) return
  const ds = getDataSource(dataSourceId)
  if (ds?.type !== 'netbox') return
  filterOptionsLoading = { ...filterOptionsLoading, [dataSourceId]: true }
  try {
    const options = await api.dataSources.getFilterOptions(dataSourceId)
    filterOptionsCache = { ...filterOptionsCache, [dataSourceId]: options }
  } catch {
    // silently fail — user can still type manually
  } finally {
    filterOptionsLoading = { ...filterOptionsLoading, [dataSourceId]: false }
  }
}

function getDataSource(id: string): DataSource | undefined {
  return [...topologyDataSources, ...metricsDataSources].find((ds) => ds.id === id)
}

function getCurrentSource(dataSourceId: string, purpose: string): TopologyDataSource | undefined {
  return currentSources.find((s) => s.dataSourceId === dataSourceId && s.purpose === purpose)
}

function addSource(purpose: 'topology' | 'metrics') {
  const availableSources = purpose === 'topology' ? topologyDataSources : metricsDataSources
  const existing = editableSources.filter((s) => s.purpose === purpose).map((s) => s.dataSourceId)
  const available = availableSources.filter((ds) => !existing.includes(ds.id))

  if (available.length === 0) {
    alert('No more data sources available to add')
    return
  }

  editableSources = [
    ...editableSources,
    {
      dataSourceId: available[0].id,
      purpose,
      syncMode: 'manual',
      priority: existing.length,
    },
  ]
  hasChanges = true
}

function removeSource(index: number) {
  editableSources = editableSources.filter((_, i) => i !== index)
  hasChanges = true
}

function updateSource(index: number, updates: Partial<TopologyDataSourceInput>) {
  editableSources = editableSources.map((s, i) => (i === index ? { ...s, ...updates } : s))
  hasChanges = true
  if (updates.dataSourceId) {
    loadFilterOptions(updates.dataSourceId)
  }
}

async function handleSave() {
  saving = true
  error = ''
  try {
    const updated = await api.topologies.sources.replaceAll(topologyId, editableSources)
    currentSources = updated
    hasChanges = false
  } catch (e) {
    error = e instanceof Error ? e.message : 'Failed to save'
  } finally {
    saving = false
  }
}

async function handleSyncAll() {
  syncing = true
  syncResult = null
  try {
    const result = await api.topologies.sources.syncAll(topologyId)
    syncResult = { nodeCount: result.nodeCount, linkCount: result.linkCount }
    topology = result.topology
  } catch (e) {
    alert(e instanceof Error ? e.message : 'Sync failed')
  } finally {
    syncing = false
  }
}

function getWebhookUrl(source: TopologyDataSource): string {
  const baseUrl = window.location.origin
  return `${baseUrl}/api/webhooks/topology/${source.webhookSecret}`
}

async function copyWebhookUrl(source: TopologyDataSource) {
  const url = getWebhookUrl(source)
  await navigator.clipboard.writeText(url)
  copiedSecret = source.id
  setTimeout(() => {
    copiedSecret = null
  }, 2000)
}

function getSourcesByPurpose(purpose: 'topology' | 'metrics') {
  return editableSources.map((s, index) => ({ ...s, index })).filter((s) => s.purpose === purpose)
}

interface NetBoxOptions {
  groupBy?: string
  siteFilter?: string[]
  tagFilter?: string[]
  roleFilter?: string[]
  excludeRoleFilter?: string[]
  excludeTagFilter?: string[]
}


function parseOptions(optionsJson?: string): NetBoxOptions {
  if (!optionsJson) return {}
  try {
    const raw = JSON.parse(optionsJson)
    // Normalize legacy string values to arrays
    if (typeof raw.siteFilter === 'string') {
      raw.siteFilter = raw.siteFilter ? [raw.siteFilter] : []
    }
    if (typeof raw.tagFilter === 'string') {
      raw.tagFilter = raw.tagFilter ? [raw.tagFilter] : []
    }
    if (typeof raw.roleFilter === 'string') {
      raw.roleFilter = raw.roleFilter ? [raw.roleFilter] : []
    }
    if (typeof raw.excludeRoleFilter === 'string') {
      raw.excludeRoleFilter = raw.excludeRoleFilter ? [raw.excludeRoleFilter] : []
    }
    if (typeof raw.excludeTagFilter === 'string') {
      raw.excludeTagFilter = raw.excludeTagFilter ? [raw.excludeTagFilter] : []
    }
    return raw
  } catch {
    return {}
  }
}

function updateOptions(index: number, patch: Partial<NetBoxOptions>) {
  const current = parseOptions(editableSources[index].optionsJson)
  const merged = { ...current, ...patch }
  // Remove empty values
  if (!merged.groupBy) delete merged.groupBy
  if (!merged.siteFilter?.length) delete merged.siteFilter
  if (!merged.tagFilter?.length) delete merged.tagFilter
  if (!merged.roleFilter?.length) delete merged.roleFilter
  if (!merged.excludeRoleFilter?.length) delete merged.excludeRoleFilter
  if (!merged.excludeTagFilter?.length) delete merged.excludeTagFilter
  const json = Object.keys(merged).length > 0 ? JSON.stringify(merged) : undefined
  updateSource(index, { optionsJson: json })
}

function toggleArrayOption(arr: string[] | undefined, value: string): string[] {
  const current = arr || []
  return current.includes(value) ? current.filter((v) => v !== value) : [...current, value]
}

// Check if multiple topology sources exist (show merge link)
let hasMultipleTopologySources = $derived(
  editableSources.filter((s) => s.purpose === 'topology').length >= 2
)
</script>

<svelte:head>
  <title>Data Sources - {topology?.name || 'Topology'} - Shumoku</title>
</svelte:head>

<div class="p-6 max-w-3xl mx-auto">
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
    <!-- Back link -->
    <div class="mb-6">
      <a
        href="/topologies/{topologyId}/settings"
        class="inline-flex items-center gap-2 text-sm text-theme-text-muted hover:text-theme-text transition-colors"
      >
        <ArrowLeft size={16} />
        Back to Settings
      </a>
    </div>

    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-xl font-semibold text-theme-text-emphasis">Data Sources</h1>
        <p class="text-sm text-theme-text-muted mt-1">{topology.name}</p>
      </div>
      <Button onclick={handleSave} disabled={saving || !hasChanges}>
        {#if saving}
          <span class="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2"></span>
        {/if}
        Save Changes
      </Button>
    </div>

    {#if error}
      <div class="p-3 bg-danger/10 border border-danger/20 rounded-lg text-danger text-sm mb-6">
        {error}
      </div>
    {/if}

    <!-- Topology Sources -->
    <div class="card mb-6">
      <div class="card-header flex items-center justify-between">
        <div>
          <h2 class="font-medium text-theme-text-emphasis">Topology Sources</h2>
          {#if hasMultipleTopologySources}
            <a
              href="/topologies/{topologyId}/merge"
              class="text-xs text-primary hover:underline"
            >
              Configure merge settings →
            </a>
          {/if}
        </div>
        <div class="flex items-center gap-2">
          {#if getSourcesByPurpose('topology').length > 0}
            <Button
              variant="secondary"
              size="sm"
              onclick={handleSyncAll}
              disabled={syncing || hasChanges}
            >
              {#if syncing}
                <span class="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin mr-1"></span>
              {:else}
                <ArrowsClockwise size={14} class="mr-1" />
              {/if}
              Sync All
            </Button>
          {/if}
          <Button variant="outline" size="sm" onclick={() => addSource('topology')}>
            <Plus size={16} class="mr-1" />
            Add
          </Button>
        </div>
      </div>
      {#if syncResult}
        <div class="px-4 py-2 bg-success/10 border-b border-success/20 text-success text-sm">
          Synced: {syncResult.nodeCount} nodes, {syncResult.linkCount} links
        </div>
      {/if}
      <div class="card-body">
        {#if getSourcesByPurpose('topology').length === 0}
          <p class="text-sm text-theme-text-muted text-center py-4">
            No topology sources configured. Topology is defined manually.
          </p>
        {:else}
          <div class="space-y-4">
            {#each getSourcesByPurpose('topology') as source (source.index)}
              {@const currentSource = getCurrentSource(source.dataSourceId, 'topology')}
              {@const dataSource = getDataSource(source.dataSourceId)}
              <div class="border border-theme-border rounded-lg p-4">
                <div class="flex items-start justify-between gap-4">
                  <div class="flex-1 space-y-3">
                    <!-- Source selector -->
                    <div>
                      <label for="topo-source-{source.index}" class="text-xs text-theme-text-muted">Source</label>
                      <select
                        id="topo-source-{source.index}"
                        class="input mt-1"
                        value={source.dataSourceId}
                        onchange={(e) => updateSource(source.index, { dataSourceId: e.currentTarget.value })}
                      >
                        {#each topologyDataSources as ds}
                          <option value={ds.id}>{ds.name} ({ds.type})</option>
                        {/each}
                      </select>
                    </div>

                    <!-- Sync mode -->
                    <div>
                      <label for="topo-sync-{source.index}" class="text-xs text-theme-text-muted">Sync Mode</label>
                      <select
                        id="topo-sync-{source.index}"
                        class="input mt-1"
                        value={source.syncMode}
                        onchange={(e) => updateSource(source.index, { syncMode: e.currentTarget.value as SyncMode })}
                      >
                        <option value="manual">Manual (button only)</option>
                        <option value="on_view">On View (sync when page opens)</option>
                        <option value="webhook">Webhook (real-time from {dataSource?.type || 'source'})</option>
                      </select>
                    </div>

                    <!-- Webhook URL (shown right after sync mode selector) -->
                    {#if source.syncMode === 'webhook' && currentSource?.webhookSecret}
                      <div>
                        <label for="webhook-url-{source.index}" class="text-xs text-theme-text-muted">Webhook URL</label>
                        <div class="flex items-center gap-2 mt-1">
                          <input
                            id="webhook-url-{source.index}"
                            type="text"
                            class="input font-mono text-xs flex-1"
                            value={getWebhookUrl(currentSource)}
                            readonly
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            onclick={() => copyWebhookUrl(currentSource)}
                          >
                            {#if copiedSecret === currentSource.id}
                              <CheckCircle size={16} class="text-success" />
                            {:else}
                              <Copy size={16} />
                            {/if}
                          </Button>
                        </div>
                        <p class="text-xs text-theme-text-muted mt-1">
                          Configure this URL in {dataSource?.type || 'your source'} webhooks
                        </p>
                        {#if currentSource.lastSyncedAt}
                          <p class="text-xs text-theme-text-muted mt-1">
                            Last received: {new Date(currentSource.lastSyncedAt).toLocaleString()}
                          </p>
                        {:else}
                          <p class="text-xs text-warning mt-1">
                            No webhook received yet
                          </p>
                        {/if}
                      </div>
                    {:else if source.syncMode === 'webhook' && !currentSource?.webhookSecret}
                      <p class="text-xs text-warning">Save changes to generate webhook URL</p>
                    {/if}

                    <!-- NetBox options (if source is netbox type) -->
                    {#if dataSource?.type === 'netbox'}
                      {@const opts = parseOptions(source.optionsJson)}
                      {@const filterOpts = filterOptionsCache[source.dataSourceId]}
                      {@const isLoading = filterOptionsLoading[source.dataSourceId]}
                      <div class="border-t border-theme-border pt-3 mt-3 space-y-3">
                        <p class="text-xs font-medium text-theme-text-muted uppercase tracking-wide">NetBox Options</p>

                        <div>
                          <label for="opts-groupby-{source.index}" class="text-xs text-theme-text-muted">Group By</label>
                          <select
                            id="opts-groupby-{source.index}"
                            class="input mt-1"
                            value={opts.groupBy || 'tag'}
                            onchange={(e) => updateOptions(source.index, { groupBy: e.currentTarget.value })}
                          >
                            <option value="tag">Tag</option>
                            <option value="site">Site</option>
                            <option value="location">Location</option>
                            <option value="prefix">Prefix</option>
                            <option value="none">None</option>
                          </select>
                        </div>

                        <!-- Include Filters -->
                        <div class="grid grid-cols-3 gap-3">
                          <div>
                            <label class="text-xs text-theme-text-muted">Site Filter</label>
                            {#if isLoading}
                              <div class="input mt-1 text-theme-text-muted text-sm">Loading...</div>
                            {:else if filterOpts?.sites?.length}
                              <div class="mt-1 flex flex-wrap gap-1.5">
                                {#each filterOpts.sites as site}
                                  {@const selected = opts.siteFilter?.includes(site.slug)}
                                  <button
                                    type="button"
                                    class="px-2 py-0.5 rounded-full text-xs border transition-colors cursor-pointer
                                      {selected
                                        ? 'bg-primary/15 border-primary/40 text-primary'
                                        : 'bg-theme-bg-canvas border-theme-border text-theme-text-muted hover:border-theme-text-muted'}"
                                    onclick={() => updateOptions(source.index, { siteFilter: toggleArrayOption(opts.siteFilter, site.slug) })}
                                  >
                                    {site.name}
                                  </button>
                                {/each}
                              </div>
                              {#if opts.siteFilter?.length}
                                <p class="text-xs text-theme-text-muted mt-1">{opts.siteFilter.length} selected</p>
                              {:else}
                                <p class="text-xs text-theme-text-muted mt-1">All sites</p>
                              {/if}
                            {:else}
                              <p class="text-xs text-theme-text-muted mt-1">No sites found</p>
                            {/if}
                          </div>

                          <div>
                            <label class="text-xs text-theme-text-muted">Tag Filter</label>
                            {#if isLoading}
                              <div class="input mt-1 text-theme-text-muted text-sm">Loading...</div>
                            {:else if filterOpts?.tags?.length}
                              <div class="mt-1 flex flex-wrap gap-1.5">
                                {#each filterOpts.tags as tag}
                                  {@const selected = opts.tagFilter?.includes(tag.slug)}
                                  <button
                                    type="button"
                                    class="px-2 py-0.5 rounded-full text-xs border transition-colors cursor-pointer
                                      {selected
                                        ? 'bg-primary/15 border-primary/40 text-primary'
                                        : 'bg-theme-bg-canvas border-theme-border text-theme-text-muted hover:border-theme-text-muted'}"
                                    onclick={() => updateOptions(source.index, { tagFilter: toggleArrayOption(opts.tagFilter, tag.slug) })}
                                  >
                                    {tag.name}
                                  </button>
                                {/each}
                              </div>
                              {#if opts.tagFilter?.length}
                                <p class="text-xs text-theme-text-muted mt-1">{opts.tagFilter.length} selected</p>
                              {:else}
                                <p class="text-xs text-theme-text-muted mt-1">All tags</p>
                              {/if}
                            {:else}
                              <p class="text-xs text-theme-text-muted mt-1">No tags found</p>
                            {/if}
                          </div>

                          <div>
                            <label class="text-xs text-theme-text-muted">Role Filter</label>
                            {#if isLoading}
                              <div class="input mt-1 text-theme-text-muted text-sm">Loading...</div>
                            {:else if filterOpts?.roles?.length}
                              <div class="mt-1 flex flex-wrap gap-1.5">
                                {#each filterOpts.roles as role}
                                  {@const selected = opts.roleFilter?.includes(role.slug)}
                                  <button
                                    type="button"
                                    class="px-2 py-0.5 rounded-full text-xs border transition-colors cursor-pointer
                                      {selected
                                        ? 'bg-primary/15 border-primary/40 text-primary'
                                        : 'bg-theme-bg-canvas border-theme-border text-theme-text-muted hover:border-theme-text-muted'}"
                                    onclick={() => updateOptions(source.index, { roleFilter: toggleArrayOption(opts.roleFilter, role.slug) })}
                                  >
                                    {role.name}
                                  </button>
                                {/each}
                              </div>
                              {#if opts.roleFilter?.length}
                                <p class="text-xs text-theme-text-muted mt-1">{opts.roleFilter.length} selected</p>
                              {:else}
                                <p class="text-xs text-theme-text-muted mt-1">All roles</p>
                              {/if}
                            {:else}
                              <p class="text-xs text-theme-text-muted mt-1">No roles found</p>
                            {/if}
                          </div>
                        </div>

                        <!-- Exclude Filters -->
                        <div class="grid grid-cols-2 gap-3 mt-3">
                          <div>
                            <label class="text-xs text-danger">Exclude Roles</label>
                            {#if isLoading}
                              <div class="input mt-1 text-theme-text-muted text-sm">Loading...</div>
                            {:else if filterOpts?.roles?.length}
                              <div class="mt-1 flex flex-wrap gap-1.5">
                                {#each filterOpts.roles as role}
                                  {@const selected = opts.excludeRoleFilter?.includes(role.slug)}
                                  <button
                                    type="button"
                                    class="px-2 py-0.5 rounded-full text-xs border transition-colors cursor-pointer
                                      {selected
                                        ? 'bg-danger/15 border-danger/40 text-danger'
                                        : 'bg-theme-bg-canvas border-theme-border text-theme-text-muted hover:border-theme-text-muted'}"
                                    onclick={() => updateOptions(source.index, { excludeRoleFilter: toggleArrayOption(opts.excludeRoleFilter, role.slug) })}
                                  >
                                    {role.name}
                                  </button>
                                {/each}
                              </div>
                              {#if opts.excludeRoleFilter?.length}
                                <p class="text-xs text-danger mt-1">{opts.excludeRoleFilter.length} excluded</p>
                              {:else}
                                <p class="text-xs text-theme-text-muted mt-1">None excluded</p>
                              {/if}
                            {:else}
                              <p class="text-xs text-theme-text-muted mt-1">No roles found</p>
                            {/if}
                          </div>

                          <div>
                            <label class="text-xs text-danger">Exclude Tags</label>
                            {#if isLoading}
                              <div class="input mt-1 text-theme-text-muted text-sm">Loading...</div>
                            {:else if filterOpts?.tags?.length}
                              <div class="mt-1 flex flex-wrap gap-1.5">
                                {#each filterOpts.tags as tag}
                                  {@const selected = opts.excludeTagFilter?.includes(tag.slug)}
                                  <button
                                    type="button"
                                    class="px-2 py-0.5 rounded-full text-xs border transition-colors cursor-pointer
                                      {selected
                                        ? 'bg-danger/15 border-danger/40 text-danger'
                                        : 'bg-theme-bg-canvas border-theme-border text-theme-text-muted hover:border-theme-text-muted'}"
                                    onclick={() => updateOptions(source.index, { excludeTagFilter: toggleArrayOption(opts.excludeTagFilter, tag.slug) })}
                                  >
                                    {tag.name}
                                  </button>
                                {/each}
                              </div>
                              {#if opts.excludeTagFilter?.length}
                                <p class="text-xs text-danger mt-1">{opts.excludeTagFilter.length} excluded</p>
                              {:else}
                                <p class="text-xs text-theme-text-muted mt-1">None excluded</p>
                              {/if}
                            {:else}
                              <p class="text-xs text-theme-text-muted mt-1">No tags found</p>
                            {/if}
                          </div>
                        </div>
                      </div>
                    {/if}

                    <!-- Last synced info -->
                    {#if currentSource?.lastSyncedAt}
                      <p class="text-xs text-theme-text-muted">
                        Last synced: {new Date(currentSource.lastSyncedAt).toLocaleString()}
                      </p>
                    {/if}
                  </div>

                  <!-- Remove button -->
                  <Button
                    variant="ghost"
                    size="sm"
                    class="text-danger hover:bg-danger/10"
                    onclick={() => removeSource(source.index)}
                  >
                    <Trash size={16} />
                  </Button>
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </div>
    </div>

    <!-- Metrics Sources -->
    <div class="card">
      <div class="card-header flex items-center justify-between">
        <h2 class="font-medium text-theme-text-emphasis">Metrics Sources</h2>
        <Button variant="outline" size="sm" onclick={() => addSource('metrics')}>
          <Plus size={16} class="mr-1" />
          Add
        </Button>
      </div>
      <div class="card-body">
        {#if getSourcesByPurpose('metrics').length === 0}
          <p class="text-sm text-theme-text-muted text-center py-4">
            No metrics sources configured. Live metrics disabled.
          </p>
        {:else}
          <div class="space-y-4">
            {#each getSourcesByPurpose('metrics') as source (source.index)}
              {@const currentSource = getCurrentSource(source.dataSourceId, 'metrics')}
              {@const dataSource = getDataSource(source.dataSourceId)}
              <div class="border border-theme-border rounded-lg p-4">
                <div class="flex items-start justify-between gap-4">
                  <div class="flex-1 space-y-3">
                    <!-- Source selector -->
                    <div>
                      <label for="metrics-source-{source.index}" class="text-xs text-theme-text-muted">Source</label>
                      <select
                        id="metrics-source-{source.index}"
                        class="input mt-1"
                        value={source.dataSourceId}
                        onchange={(e) => updateSource(source.index, { dataSourceId: e.currentTarget.value })}
                      >
                        {#each metricsDataSources as ds}
                          <option value={ds.id}>{ds.name} ({ds.type})</option>
                        {/each}
                      </select>
                    </div>

                    <!-- Mapping link -->
                    {#if currentSource}
                      <a
                        href="/topologies/{topologyId}/mapping"
                        class="text-sm text-primary hover:underline"
                      >
                        Configure Mapping →
                      </a>
                    {/if}
                  </div>

                  <!-- Remove button -->
                  <Button
                    variant="ghost"
                    size="sm"
                    class="text-danger hover:bg-danger/10"
                    onclick={() => removeSource(source.index)}
                  >
                    <Trash size={16} />
                  </Button>
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </div>
    </div>
  {/if}
</div>

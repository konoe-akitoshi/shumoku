<script lang="ts">
  /**
   * Sources — declarative configuration of what data feeds this
   * topology: which data sources are attached, with what sync mode,
   * and how their graphs merge when multiple are present.
   *
   * The "go grab data" actions (Sync now / Sync all) live on the
   * Discovery page — Sources is intentionally declarative-only so
   * "press the button" and "edit the config" are visibly separate.
   *
   * Shared state (currentSources / editableSources / topologyDataSources /
   * metricsDataSources / hasSourceChanges) lives in the topology shell
   * context so the Discovery page sees the same attachments without
   * a second fetch.
   */
  import { CheckCircleIcon, CopyIcon, FloppyDiskIcon, PlusIcon, TrashIcon } from 'phosphor-svelte'
  import { onMount } from 'svelte'
  import { api } from '$lib/api'
  import { Button } from '$lib/components/ui/button'
  import { mappingStore } from '$lib/stores'
  import type { SyncMode, TopologyDataSource, TopologyDataSourceInput } from '$lib/types'
  import { useTopologyCtx } from '../_context.svelte'

  const ctx = useTopologyCtx()

  interface NetBoxOptions {
    groupBy?: string
    siteFilter?: string[]
    tagFilter?: string[]
    roleFilter?: string[]
    excludeRoleFilter?: string[]
    excludeTagFilter?: string[]
  }

  let savingSources = $state(false)
  let copiedSecret = $state<string | null>(null)
  let copiedTimer: ReturnType<typeof setTimeout> | null = null
  let filterOptionsCache = $state<
    Record<
      string,
      {
        sites: { slug: string; name: string }[]
        tags: { slug: string; name: string }[]
        roles?: { slug: string; name: string }[]
      }
    >
  >({})
  let filterOptionsLoading = $state<Record<string, boolean>>({})
  let localError = $state('')

  let topologySources = $derived(ctx.editableSources.filter((s) => s.purpose === 'topology'))
  let metricsSources = $derived(ctx.editableSources.filter((s) => s.purpose === 'metrics'))
  let hasMultipleTopologySources = $derived(topologySources.length >= 2)

  // Load NetBox filter options for any attached NetBox sources.
  onMount(() => {
    for (const s of ctx.editableSources) loadFilterOptions(s.dataSourceId)
  })

  $effect(() => {
    return () => {
      if (copiedTimer) clearTimeout(copiedTimer)
    }
  })

  function getCurrentSource(dataSourceId: string, purpose: string): TopologyDataSource | undefined {
    return ctx.currentSources.find((s) => s.dataSourceId === dataSourceId && s.purpose === purpose)
  }

  function getSourcesByPurpose(purpose: 'topology' | 'metrics') {
    return ctx.editableSources
      .map((s, index) => ({ ...s, index }))
      .filter((s) => s.purpose === purpose)
  }

  function addSource(purpose: 'topology' | 'metrics') {
    const availableSources =
      purpose === 'topology' ? ctx.topologyDataSources : ctx.metricsDataSources
    const existing = ctx.editableSources
      .filter((s) => s.purpose === purpose)
      .map((s) => s.dataSourceId)
    const available = availableSources.filter((ds) => !existing.includes(ds.id))
    if (!available[0]) {
      alert('No data sources available. Create one on /datasources first.')
      return
    }
    ctx.editableSources = [
      ...ctx.editableSources,
      {
        dataSourceId: available[0].id,
        purpose,
        syncMode: 'manual',
        priority: existing.length,
      },
    ]
    ctx.hasSourceChanges = true
  }

  function removeSource(index: number) {
    ctx.editableSources = ctx.editableSources.filter((_, i) => i !== index)
    ctx.hasSourceChanges = true
  }

  function updateSource(index: number, updates: Partial<TopologyDataSourceInput>) {
    ctx.editableSources = ctx.editableSources.map((s, i) =>
      i === index ? { ...s, ...updates } : s,
    )
    ctx.hasSourceChanges = true
    if (updates.dataSourceId) loadFilterOptions(updates.dataSourceId)
  }

  async function loadFilterOptions(dataSourceId: string) {
    if (filterOptionsCache[dataSourceId] || filterOptionsLoading[dataSourceId]) return
    const ds = ctx.getDataSource(dataSourceId)
    if (ds?.type !== 'netbox') return
    filterOptionsLoading = { ...filterOptionsLoading, [dataSourceId]: true }
    try {
      const options = await api.dataSources.getFilterOptions(dataSourceId)
      filterOptionsCache = { ...filterOptionsCache, [dataSourceId]: options }
    } catch {
      // silently fail
    } finally {
      filterOptionsLoading = { ...filterOptionsLoading, [dataSourceId]: false }
    }
  }

  function parseOptions(optionsJson?: string): NetBoxOptions {
    if (!optionsJson) return {}
    try {
      const raw = JSON.parse(optionsJson)
      if (typeof raw.siteFilter === 'string')
        raw.siteFilter = raw.siteFilter ? [raw.siteFilter] : []
      if (typeof raw.tagFilter === 'string') raw.tagFilter = raw.tagFilter ? [raw.tagFilter] : []
      if (typeof raw.roleFilter === 'string')
        raw.roleFilter = raw.roleFilter ? [raw.roleFilter] : []
      if (typeof raw.excludeRoleFilter === 'string')
        raw.excludeRoleFilter = raw.excludeRoleFilter ? [raw.excludeRoleFilter] : []
      if (typeof raw.excludeTagFilter === 'string')
        raw.excludeTagFilter = raw.excludeTagFilter ? [raw.excludeTagFilter] : []
      return raw
    } catch {
      return {}
    }
  }

  function updateOptions(index: number, patch: Partial<NetBoxOptions>) {
    const current = parseOptions(ctx.editableSources[index]?.optionsJson)
    const merged = { ...current, ...patch }
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

  function getWebhookUrl(source: TopologyDataSource): string {
    return `${window.location.origin}/api/webhooks/topology/${source.webhookSecret}`
  }

  async function copyWebhookUrl(source: TopologyDataSource) {
    await navigator.clipboard.writeText(getWebhookUrl(source))
    copiedSecret = source.id
    if (copiedTimer) clearTimeout(copiedTimer)
    copiedTimer = setTimeout(() => {
      copiedSecret = null
      copiedTimer = null
    }, 2000)
  }

  async function handleSaveSources() {
    savingSources = true
    localError = ''
    try {
      // Source merge is governed entirely by `priority` (higher wins each
      // field in resolve()) and per-plugin `optionsJson` — both already live
      // on editableSources, so save them straight through. The old
      // base/overlay Merge-Config injection was retired with merge.ts.
      const updated = await api.topologies.sources.replaceAll(ctx.topologyId, ctx.editableSources)
      ctx.currentSources = updated
      ctx.editableSources = updated.map((s) => ({
        dataSourceId: s.dataSourceId,
        purpose: s.purpose,
        syncMode: s.syncMode,
        priority: s.priority,
        optionsJson: s.optionsJson,
      }))
      ctx.hasSourceChanges = false
      await mappingStore.load(ctx.topologyId, true)
    } catch (e) {
      localError = e instanceof Error ? e.message : 'Failed to save'
    } finally {
      savingSources = false
    }
  }

  // Per-form-control ids — uniquified to avoid label/input mismatches
  // when the same form repeats inside an each block.
  const componentId = $props.id()
  const groupBySelectorId = `${componentId}:groupBy`
</script>

<div class="container mx-auto p-6 max-w-6xl space-y-6">
  {#if localError}
    <div class="p-3 bg-danger/10 border border-danger/20 rounded-lg text-danger text-sm">
      {localError}
    </div>
  {/if}

  <!-- Save button -->
  <div class="flex justify-end">
    <Button onclick={handleSaveSources} disabled={savingSources || !ctx.hasSourceChanges}>
      {#if savingSources}
        <span
          class="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2"
        ></span>
      {:else}
        <FloppyDiskIcon size={16} class="mr-2" />
      {/if}
      Save Changes
    </Button>
  </div>

  <!-- Topology Sources -->
  <div class="card">
    <div class="card-header flex items-center justify-between">
      <h2 class="font-medium text-theme-text-emphasis">Topology Sources</h2>
      <Button variant="outline" size="sm" onclick={() => addSource('topology')}>
        <PlusIcon size={16} class="mr-1" />
        Add
      </Button>
    </div>
    <div class="card-body">
      {#if topologySources.length === 0}
        <p class="text-sm text-theme-text-muted text-center py-4">
          No topology sources configured. Topology is defined manually.
        </p>
      {:else}
        <div class="space-y-4">
          {#each getSourcesByPurpose('topology') as source (source.index)}
            {@const currentSource = getCurrentSource(source.dataSourceId, 'topology')}
            {@const dataSource = ctx.getDataSource(source.dataSourceId)}
            <div class="border border-theme-border rounded-lg p-4">
              <div class="flex items-start justify-between gap-4">
                <div class="flex-1 space-y-3">
                  <div class="flex items-center gap-2">
                    <select
                      class="input flex-1"
                      value={source.dataSourceId}
                      onchange={(e) =>
                        updateSource(source.index, { dataSourceId: e.currentTarget.value })}
                    >
                      {#each ctx.topologyDataSources as ds (ds.id)}
                        <option value={ds.id}>{ds.name} ({ds.type})</option>
                      {/each}
                    </select>
                    <select
                      class="input"
                      style="width: 10rem;"
                      value={source.syncMode}
                      onchange={(e) =>
                        updateSource(source.index, {
                          syncMode: e.currentTarget.value as SyncMode,
                        })}
                    >
                      <option value="manual">Manual</option>
                      <option value="on_view">On View</option>
                      <option value="webhook">Webhook</option>
                    </select>
                  </div>

                  <!-- Merge priority. Higher wins each field in resolve() when
                       sources observe the same device; only meaningful with
                       multiple topology sources. -->
                  {#if hasMultipleTopologySources}
                    <div class="flex items-center gap-2">
                      <span class="text-xs text-theme-text-muted">Priority</span>
                      <input
                        type="number"
                        class="input"
                        style="width: 6rem;"
                        value={source.priority ?? 0}
                        onchange={(e) =>
                          updateSource(source.index, {
                            priority: Number(e.currentTarget.value) || 0,
                          })}
                      >
                      <span class="text-xs text-theme-text-muted">
                        higher wins each field when sources overlap
                      </span>
                    </div>
                  {/if}

                  {#if source.syncMode === 'webhook' && currentSource?.webhookSecret}
                    <div class="flex items-center gap-2">
                      <input
                        type="text"
                        class="input font-mono text-xs flex-1"
                        value={getWebhookUrl(currentSource)}
                        readonly
                      >
                      <Button
                        variant="outline"
                        size="sm"
                        onclick={() => copyWebhookUrl(currentSource)}
                      >
                        {#if copiedSecret === currentSource.id}
                          <CheckCircleIcon size={16} class="text-success" />
                        {:else}
                          <CopyIcon size={16} />
                        {/if}
                      </Button>
                    </div>
                  {/if}

                  <!-- NetBox options -->
                  {#if dataSource?.type === 'netbox'}
                    {@const opts = parseOptions(source.optionsJson)}
                    {@const filterOpts = filterOptionsCache[source.dataSourceId]}
                    {@const isLoading = filterOptionsLoading[source.dataSourceId]}
                    <div class="border-t border-theme-border pt-3 space-y-3">
                      <p class="text-xs font-medium text-theme-text-muted uppercase tracking-wide">
                        NetBox Options
                      </p>
                      <div class="flex items-center gap-4">
                        <label for={groupBySelectorId} class="text-xs text-theme-text-muted">
                          Group By
                        </label>
                        <select
                          id={groupBySelectorId}
                          class="input text-sm"
                          value={opts.groupBy || 'tag'}
                          onchange={(e) =>
                            updateOptions(source.index, { groupBy: e.currentTarget.value })}
                        >
                          <option value="tag">Tag</option>
                          <option value="site">Site</option>
                          <option value="location">Location</option>
                          <option value="prefix">Prefix</option>
                          <option value="none">None</option>
                        </select>
                      </div>
                      {#if filterOpts}
                        <div class="grid grid-cols-3 gap-3">
                          <div>
                            <p class="text-xs text-theme-text-muted mb-1">Site Filter</p>
                            <div class="flex flex-wrap gap-1">
                              {#each filterOpts.sites || [] as site (site.slug)}
                                {@const selected = opts.siteFilter?.includes(site.slug)}
                                <button
                                  type="button"
                                  class="px-2 py-0.5 rounded-full text-xs border cursor-pointer {selected
                                    ? 'bg-primary/15 border-primary/40 text-primary'
                                    : 'border-theme-border text-theme-text-muted hover:border-theme-text-muted'}"
                                  onclick={() =>
                                    updateOptions(source.index, {
                                      siteFilter: toggleArrayOption(opts.siteFilter, site.slug),
                                    })}
                                >
                                  {site.name}
                                </button>
                              {/each}
                            </div>
                          </div>
                          <div>
                            <p class="text-xs text-theme-text-muted mb-1">Tag Filter</p>
                            <div class="flex flex-wrap gap-1">
                              {#each filterOpts.tags || [] as tag (tag.slug)}
                                {@const selected = opts.tagFilter?.includes(tag.slug)}
                                <button
                                  type="button"
                                  class="px-2 py-0.5 rounded-full text-xs border cursor-pointer {selected
                                    ? 'bg-primary/15 border-primary/40 text-primary'
                                    : 'border-theme-border text-theme-text-muted hover:border-theme-text-muted'}"
                                  onclick={() =>
                                    updateOptions(source.index, {
                                      tagFilter: toggleArrayOption(opts.tagFilter, tag.slug),
                                    })}
                                >
                                  {tag.name}
                                </button>
                              {/each}
                            </div>
                          </div>
                          <div>
                            <p class="text-xs text-theme-text-muted mb-1">Role Filter</p>
                            <div class="flex flex-wrap gap-1">
                              {#each filterOpts.roles || [] as role (role.slug)}
                                {@const selected = opts.roleFilter?.includes(role.slug)}
                                <button
                                  type="button"
                                  class="px-2 py-0.5 rounded-full text-xs border cursor-pointer {selected
                                    ? 'bg-primary/15 border-primary/40 text-primary'
                                    : 'border-theme-border text-theme-text-muted hover:border-theme-text-muted'}"
                                  onclick={() =>
                                    updateOptions(source.index, {
                                      roleFilter: toggleArrayOption(opts.roleFilter, role.slug),
                                    })}
                                >
                                  {role.name}
                                </button>
                              {/each}
                            </div>
                          </div>
                        </div>
                        <div class="grid grid-cols-2 gap-3">
                          <div>
                            <p class="text-xs text-danger mb-1">Exclude Roles</p>
                            <div class="flex flex-wrap gap-1">
                              {#each filterOpts.roles || [] as role (role.slug)}
                                {@const selected = opts.excludeRoleFilter?.includes(role.slug)}
                                <button
                                  type="button"
                                  class="px-2 py-0.5 rounded-full text-xs border cursor-pointer {selected
                                    ? 'bg-danger/15 border-danger/40 text-danger'
                                    : 'border-theme-border text-theme-text-muted hover:border-theme-text-muted'}"
                                  onclick={() =>
                                    updateOptions(source.index, {
                                      excludeRoleFilter: toggleArrayOption(
                                        opts.excludeRoleFilter,
                                        role.slug,
                                      ),
                                    })}
                                >
                                  {role.name}
                                </button>
                              {/each}
                            </div>
                          </div>
                          <div>
                            <p class="text-xs text-danger mb-1">Exclude Tags</p>
                            <div class="flex flex-wrap gap-1">
                              {#each filterOpts.tags || [] as tag (tag.slug)}
                                {@const selected = opts.excludeTagFilter?.includes(tag.slug)}
                                <button
                                  type="button"
                                  class="px-2 py-0.5 rounded-full text-xs border cursor-pointer {selected
                                    ? 'bg-danger/15 border-danger/40 text-danger'
                                    : 'border-theme-border text-theme-text-muted hover:border-theme-text-muted'}"
                                  onclick={() =>
                                    updateOptions(source.index, {
                                      excludeTagFilter: toggleArrayOption(
                                        opts.excludeTagFilter,
                                        tag.slug,
                                      ),
                                    })}
                                >
                                  {tag.name}
                                </button>
                              {/each}
                            </div>
                          </div>
                        </div>
                      {:else if isLoading}
                        <p class="text-xs text-theme-text-muted">Loading filter options...</p>
                      {/if}
                    </div>
                  {/if}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  class="text-danger hover:bg-danger/10"
                  onclick={() => removeSource(source.index)}
                >
                  <TrashIcon size={16} />
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
        <PlusIcon size={16} class="mr-1" />
        Add
      </Button>
    </div>
    <div class="card-body">
      {#if metricsSources.length === 0}
        <p class="text-sm text-theme-text-muted text-center py-4">
          No metrics sources configured. Live metrics disabled.
        </p>
      {:else}
        <div class="space-y-3">
          {#each getSourcesByPurpose('metrics') as source (source.index)}
            <div class="flex items-center gap-3 border border-theme-border rounded-lg p-3">
              <select
                class="input flex-1"
                value={source.dataSourceId}
                onchange={(e) =>
                  updateSource(source.index, { dataSourceId: e.currentTarget.value })}
              >
                {#each ctx.metricsDataSources as ds (ds.id)}
                  <option value={ds.id}>{ds.name} ({ds.type})</option>
                {/each}
              </select>
              <Button
                variant="ghost"
                size="sm"
                class="text-danger hover:bg-danger/10"
                onclick={() => removeSource(source.index)}
              >
                <TrashIcon size={16} />
              </Button>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  </div>
</div>

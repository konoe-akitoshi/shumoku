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
  import SchemaForm from '$lib/components/SchemaForm.svelte'
  import { Button } from '$lib/components/ui/button'
  import { mappingStore } from '$lib/stores'
  import type {
    DataSourcePluginInfo,
    PluginConfigSchema,
    SyncMode,
    TopologyDataSource,
    TopologyDataSourceInput,
  } from '$lib/types'
  import { useTopologyCtx } from '../_context.svelte'

  const ctx = useTopologyCtx()

  let savingSources = $state(false)
  let copiedSecret = $state<string | null>(null)
  let copiedTimer: ReturnType<typeof setTimeout> | null = null
  let localError = $state('')

  // Plugin types carry each plugin's optionsSchema; the per-source options form
  // is rendered generically from it (no NetBox-specific UI here anymore).
  let pluginTypes = $state<DataSourcePluginInfo[]>([])
  let optionsState = $state<Record<number, Record<string, unknown>>>({})

  function optionsSchemaFor(type?: string): PluginConfigSchema | undefined {
    return type ? pluginTypes.find((p) => p.type === type)?.optionsSchema : undefined
  }

  let topologySources = $derived(ctx.editableSources.filter((s) => s.purpose === 'topology'))
  let metricsSources = $derived(ctx.editableSources.filter((s) => s.purpose === 'metrics'))
  let hasMultipleTopologySources = $derived(topologySources.length >= 2)

  onMount(async () => {
    try {
      pluginTypes = await api.dataSources.getPluginTypes()
    } catch {
      // Non-fatal: sources whose plugin has no optionsSchema just show no form.
    }
  })

  // Seed per-source options form state from stored optionsJson (after render,
  // so we never mutate $state during rendering).
  $effect(() => {
    for (const [index, s] of ctx.editableSources.entries()) {
      if (!optionsState[index]) optionsState[index] = parseOptions(s.optionsJson)
    }
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
  }

  /** Parse stored optionsJson, coercing legacy string filters to arrays. */
  function parseOptions(optionsJson?: string): Record<string, unknown> {
    if (!optionsJson) return {}
    try {
      const raw = JSON.parse(optionsJson) as Record<string, unknown>
      for (const key of [
        'siteFilter',
        'tagFilter',
        'roleFilter',
        'excludeRoleFilter',
        'excludeTagFilter',
      ]) {
        if (typeof raw[key] === 'string') raw[key] = raw[key] ? [raw[key]] : []
      }
      return raw
    } catch {
      return {}
    }
  }

  /** Persist a source's options form state (pruning empties) to optionsJson. */
  function saveOptions(index: number) {
    const state = optionsState[index]
    if (!state) return
    const pruned: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(state)) {
      if (value == null) continue
      if (typeof value === 'string' && value === '') continue
      if (Array.isArray(value) && value.length === 0) continue
      pruned[key] = value
    }
    const json = Object.keys(pruned).length > 0 ? JSON.stringify(pruned) : undefined
    updateSource(index, { optionsJson: json })
  }

  function getWebhookUrl(source: TopologyDataSource): string {
    // Generic ingress: source id in the path, secret in the query (compared in
    // constant time server-side).
    return `${window.location.origin}/api/webhooks/topology/${source.id}?secret=${source.webhookSecret}`
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
</script>

<div class="p-4 space-y-4">
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

                  <!-- Per-source options, rendered generically from the plugin's
                       optionsSchema (no per-plugin UI here — #270). -->
                  {#if optionsState[source.index]}
                    {@const optSchema = optionsSchemaFor(dataSource?.type)}
                    {#if optSchema}
                      <div class="border-t border-theme-border pt-3 space-y-3">
                        <p
                          class="text-xs font-medium text-theme-text-muted uppercase tracking-wide"
                        >
                          {dataSource?.type}
                          options
                        </p>
                        <SchemaForm
                          schema={optSchema}
                          value={optionsState[source.index] ?? {}}
                          getOptions={(key) =>
                            api.dataSources
                              .getConfigOptions(source.dataSourceId, key)
                              .then((r) => r.options)}
                          onChange={() => saveOptions(source.index)}
                        />
                      </div>
                    {/if}
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

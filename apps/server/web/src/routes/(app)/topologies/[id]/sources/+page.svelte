<script lang="ts">
  /**
   * Sources (Composition stage ①) — what data feeds this topology:
   * which sources are attached, with what sync mode and merge priority.
   *
   * Interaction model: direct manipulation, not form-submit. Each edit
   * (attach / detach / sync-mode / priority / options) applies on commit
   * via the granular `sources.{add,update,remove}` endpoints — there is
   * no editable mirror, no "Save Changes" button, and therefore no
   * "save before you can Sync" wall on Discovery. Attaching/detaching is
   * a deliberate but atomic act; option text debounces before it persists.
   * See `apps/server/docs/design/topology-ui-ia.md` § Interaction model.
   *
   * Side-effectful ingestion (Sync now / Sync all) stays an explicit verb
   * on the Discovery stage — only the *config* is direct here.
   */
  import { CheckCircleIcon, CopyIcon, PlusIcon, TrashIcon } from 'phosphor-svelte'
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
  } from '$lib/types'
  import { useTopologyCtx } from '../_context.svelte'

  const ctx = useTopologyCtx()

  let copiedSecret = $state<string | null>(null)
  let copiedTimer: ReturnType<typeof setTimeout> | null = null
  let localError = $state('')
  // Ids with an in-flight mutation, for a subtle per-row busy state.
  let busy = $state<Set<string>>(new Set())

  // Plugin types carry each plugin's optionsSchema; the per-source options form
  // is rendered generically from it (no per-plugin UI here — #270).
  let pluginTypes = $state<DataSourcePluginInfo[]>([])
  // Options form state, keyed by attachment id (survives list reorders).
  let optionsState = $state<Record<string, Record<string, unknown>>>({})
  const optionsTimers = new Map<string, ReturnType<typeof setTimeout>>()

  function optionsSchemaFor(type?: string): PluginConfigSchema | undefined {
    return type ? pluginTypes.find((p) => p.type === type)?.optionsSchema : undefined
  }

  let topologySources = $derived(ctx.currentSources.filter((s) => s.purpose === 'topology'))
  let metricsSources = $derived(ctx.currentSources.filter((s) => s.purpose === 'metrics'))
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
    for (const s of ctx.currentSources) {
      if (!optionsState[s.id]) optionsState[s.id] = parseOptions(s.optionsJson)
    }
  })

  $effect(() => {
    return () => {
      if (copiedTimer) clearTimeout(copiedTimer)
      for (const t of optionsTimers.values()) clearTimeout(t)
    }
  })

  function setBusy(id: string, on: boolean) {
    const next = new Set(busy)
    if (on) next.add(id)
    else next.delete(id)
    busy = next
  }

  /**
   * Run a direct-apply mutation: optimistic where the caller updates ctx,
   * with server reconcile on failure. `structural` (attach/detach) also
   * refreshes the metrics mapping, since the resolve input set changed.
   */
  async function mutate(
    id: string,
    run: () => Promise<unknown>,
    onOk: (result: unknown) => void,
    opts: { structural?: boolean } = {},
  ) {
    localError = ''
    setBusy(id, true)
    try {
      const result = await run()
      onOk(result)
      if (opts.structural) await mappingStore.load(ctx.topologyId, true)
    } catch (e) {
      localError = e instanceof Error ? e.message : 'Failed to apply change'
      // Reconcile against the server so the UI never shows a stale optimistic state.
      try {
        ctx.currentSources = await api.topologies.sources.list(ctx.topologyId)
      } catch {
        // Leave the error banner; a manual reload will recover.
      }
    } finally {
      setBusy(id, false)
    }
  }

  function attachSource(purpose: 'topology' | 'metrics') {
    const catalog = purpose === 'topology' ? ctx.topologyDataSources : ctx.metricsDataSources
    const taken = new Set(
      ctx.currentSources.filter((s) => s.purpose === purpose).map((s) => s.dataSourceId),
    )
    const pick = catalog.find((ds) => !taken.has(ds.id))
    if (!pick) {
      alert('No data sources available. Create one on /datasources first.')
      return
    }
    const priority = ctx.currentSources.filter((s) => s.purpose === purpose).length
    void mutate(
      `attach:${purpose}`,
      () =>
        api.topologies.sources.add(ctx.topologyId, {
          dataSourceId: pick.id,
          purpose,
          syncMode: 'manual',
          priority,
        }),
      (added) => {
        ctx.currentSources = [...ctx.currentSources, added as TopologyDataSource]
      },
      { structural: true },
    )
  }

  function detachSource(source: TopologyDataSource) {
    void mutate(
      source.id,
      () => api.topologies.sources.remove(ctx.topologyId, source.id),
      () => {
        ctx.currentSources = ctx.currentSources.filter((s) => s.id !== source.id)
      },
      { structural: true },
    )
  }

  function patchSource(
    source: TopologyDataSource,
    updates: { syncMode?: SyncMode; priority?: number; optionsJson?: string },
  ) {
    void mutate(
      source.id,
      () => api.topologies.sources.update(ctx.topologyId, source.id, updates),
      (updated) => {
        ctx.currentSources = ctx.currentSources.map((s) =>
          s.id === source.id ? (updated as TopologyDataSource) : s,
        )
      },
    )
  }

  /** Swap which data source an attachment points at = detach + re-attach
   *  (the attachment's identity *is* its data source). */
  function changeDataSource(source: TopologyDataSource, newId: string) {
    if (newId === source.dataSourceId) return
    void mutate(
      source.id,
      async () => {
        await api.topologies.sources.remove(ctx.topologyId, source.id)
        return api.topologies.sources.add(ctx.topologyId, {
          dataSourceId: newId,
          purpose: source.purpose,
          syncMode: source.syncMode,
          priority: source.priority,
        })
      },
      (added) => {
        const next = added as TopologyDataSource
        ctx.currentSources = ctx.currentSources.map((s) => (s.id === source.id ? next : s))
        delete optionsState[source.id]
      },
      { structural: true },
    )
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

  /** Debounced persist of a source's options form to optionsJson (direct apply). */
  function saveOptions(source: TopologyDataSource) {
    const existing = optionsTimers.get(source.id)
    if (existing) clearTimeout(existing)
    optionsTimers.set(
      source.id,
      setTimeout(() => {
        optionsTimers.delete(source.id)
        const state = optionsState[source.id]
        if (!state) return
        const pruned: Record<string, unknown> = {}
        for (const [key, value] of Object.entries(state)) {
          if (value == null) continue
          if (typeof value === 'string' && value === '') continue
          if (Array.isArray(value) && value.length === 0) continue
          pruned[key] = value
        }
        const json = Object.keys(pruned).length > 0 ? JSON.stringify(pruned) : ''
        patchSource(source, { optionsJson: json })
      }, 500),
    )
  }

  function getWebhookUrl(source: TopologyDataSource): string {
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
</script>

<div class="p-4 space-y-4">
  {#if localError}
    <div class="p-3 bg-danger/10 border border-danger/20 rounded-lg text-danger text-sm">
      {localError}
    </div>
  {/if}

  <!-- Topology Sources -->
  <div class="card">
    <div class="card-header flex items-center justify-between">
      <h2 class="font-medium text-theme-text-emphasis">Topology Sources</h2>
      <Button variant="outline" size="sm" onclick={() => attachSource('topology')}>
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
          {#each topologySources as source (source.id)}
            {@const dataSource = ctx.getDataSource(source.dataSourceId)}
            <div
              class="border border-theme-border rounded-lg p-4 transition-opacity"
              class:opacity-60={busy.has(source.id)}
            >
              <div class="flex items-start justify-between gap-4">
                <div class="flex-1 space-y-3">
                  <div class="flex items-center gap-2">
                    <select
                      class="input flex-1"
                      value={source.dataSourceId}
                      onchange={(e) => changeDataSource(source, e.currentTarget.value)}
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
                        patchSource(source, { syncMode: e.currentTarget.value as SyncMode })}
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
                          patchSource(source, { priority: Number(e.currentTarget.value) || 0 })}
                      >
                      <span class="text-xs text-theme-text-muted">
                        higher wins each field when sources overlap
                      </span>
                    </div>
                  {/if}

                  {#if source.syncMode === 'webhook' && source.webhookSecret}
                    <div class="flex items-center gap-2">
                      <input
                        type="text"
                        class="input font-mono text-xs flex-1"
                        value={getWebhookUrl(source)}
                        readonly
                      >
                      <Button variant="outline" size="sm" onclick={() => copyWebhookUrl(source)}>
                        {#if copiedSecret === source.id}
                          <CheckCircleIcon size={16} class="text-success" />
                        {:else}
                          <CopyIcon size={16} />
                        {/if}
                      </Button>
                    </div>
                  {/if}

                  <!-- Per-source options, rendered generically from the plugin's
                       optionsSchema (no per-plugin UI here — #270). -->
                  {#if optionsState[source.id]}
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
                          value={optionsState[source.id] ?? {}}
                          getOptions={(key) =>
                            api.dataSources
                              .getConfigOptions(source.dataSourceId, key)
                              .then((r) => r.options)}
                          onChange={() => saveOptions(source)}
                        />
                      </div>
                    {/if}
                  {/if}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  class="text-danger hover:bg-danger/10"
                  onclick={() => detachSource(source)}
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
      <Button variant="outline" size="sm" onclick={() => attachSource('metrics')}>
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
          {#each metricsSources as source (source.id)}
            <div
              class="flex items-center gap-3 border border-theme-border rounded-lg p-3 transition-opacity"
              class:opacity-60={busy.has(source.id)}
            >
              <select
                class="input flex-1"
                value={source.dataSourceId}
                onchange={(e) => changeDataSource(source, e.currentTarget.value)}
              >
                {#each ctx.metricsDataSources as ds (ds.id)}
                  <option value={ds.id}>{ds.name} ({ds.type})</option>
                {/each}
              </select>
              <Button
                variant="ghost"
                size="sm"
                class="text-danger hover:bg-danger/10"
                onclick={() => detachSource(source)}
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

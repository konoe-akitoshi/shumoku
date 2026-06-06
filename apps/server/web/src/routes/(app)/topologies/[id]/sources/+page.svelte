<script lang="ts">
  /**
   * Sources (zone ①) — the input end-to-end: which sources feed this topology
   * (attach, priority, sync mode), AND their ingestion — **Sync** and **scope**.
   *
   * Sync and scope live here (not on a separate "Discovery" surface) so the
   * config and the action that consumes it sit together: no cross-surface seam,
   * and scope is faceted from the source right next to the Sync that applies it.
   * See `topology-ui-ia.md` § "the filter seam".
   *
   * Config edits apply directly (granular partial updates → never clobber each
   * other); Sync / Rebuild are explicit verbs; scope text debounces. Curation of
   * what came back lives in the Composition zone.
   */
  import {
    ArrowsClockwiseIcon,
    CheckCircleIcon,
    CopyIcon,
    EraserIcon,
    PlusIcon,
    SlidersHorizontalIcon,
    TrashIcon,
  } from 'phosphor-svelte'
  import { api } from '$lib/api'
  import SchemaForm from '$lib/components/SchemaForm.svelte'
  import { Button } from '$lib/components/ui/button'
  import { mappingStore, topologies } from '$lib/stores'
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
  let busy = $state<Set<string>>(new Set())

  // Sync state.
  let perSourceSync = $state<
    Record<
      string,
      {
        status: 'ok' | 'partial' | 'failed' | 'empty'
        nodeCount: number
        linkCount: number
        message?: string
        at: number
      }
    >
  >({})
  let syncingSourceId = $state<string | null>(null)
  let syncingAll = $state(false)
  let rebuilding = $state(false)

  // Scope (faceted ingestion filters), keyed by attachment id.
  let pluginTypes = $state<DataSourcePluginInfo[]>([])
  let scopeState = $state<Record<string, Record<string, unknown>>>({})
  let scopeOpen = $state<Set<string>>(new Set())
  const scopeTimers = new Map<string, ReturnType<typeof setTimeout>>()

  let topologySources = $derived(ctx.currentSources.filter((s) => s.purpose === 'topology'))
  let metricsSources = $derived(ctx.currentSources.filter((s) => s.purpose === 'metrics'))
  let hasMultipleTopologySources = $derived(topologySources.length >= 2)

  let pluginTypesLoaded = false
  $effect(() => {
    if (pluginTypesLoaded) return
    pluginTypesLoaded = true
    api.dataSources
      .getPluginTypes()
      .then((t) => {
        pluginTypes = t
      })
      .catch(() => {})
  })

  $effect(() => {
    for (const s of ctx.currentSources) {
      if (!scopeState[s.id]) scopeState[s.id] = parseScope(s.optionsJson)
    }
  })

  $effect(() => {
    return () => {
      if (copiedTimer) clearTimeout(copiedTimer)
      for (const t of scopeTimers.values()) clearTimeout(t)
    }
  })

  function setBusy(id: string, on: boolean) {
    const next = new Set(busy)
    if (on) next.add(id)
    else next.delete(id)
    busy = next
  }

  function optionsSchemaFor(type?: string): PluginConfigSchema | undefined {
    return type ? pluginTypes.find((p) => p.type === type)?.optionsSchema : undefined
  }

  function formatAgo(ts: number): string {
    const diff = Date.now() - ts
    if (diff < 60_000) return 'just now'
    if (diff < 3600_000) return `${Math.floor(diff / 60_000)}m ago`
    if (diff < 86400_000) return `${Math.floor(diff / 3600_000)}h ago`
    return new Date(ts).toLocaleString()
  }

  // --- Config (direct apply) ------------------------------------------------

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
      if (opts.structural) {
        await mappingStore.load(ctx.topologyId, true)
        ctx.bumpRevision()
      }
    } catch (e) {
      localError = e instanceof Error ? e.message : 'Failed to apply change'
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
    updates: { syncMode?: SyncMode; priority?: number },
    structural = false,
  ) {
    void mutate(
      source.id,
      () => api.topologies.sources.update(ctx.topologyId, source.id, updates),
      (updated) => {
        ctx.currentSources = ctx.currentSources.map((s) =>
          s.id === source.id ? (updated as TopologyDataSource) : s,
        )
      },
      { structural },
    )
  }

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
        ctx.currentSources = ctx.currentSources.map((s) =>
          s.id === source.id ? (added as TopologyDataSource) : s,
        )
      },
      { structural: true },
    )
  }

  // --- Scope (faceted, debounced direct apply) ------------------------------

  function toggleScope(id: string) {
    const next = new Set(scopeOpen)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    scopeOpen = next
  }

  function parseScope(optionsJson?: string): Record<string, unknown> {
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

  function saveScope(source: TopologyDataSource) {
    const existing = scopeTimers.get(source.id)
    if (existing) clearTimeout(existing)
    scopeTimers.set(
      source.id,
      setTimeout(async () => {
        scopeTimers.delete(source.id)
        const state = scopeState[source.id]
        if (!state) return
        const pruned: Record<string, unknown> = {}
        for (const [key, value] of Object.entries(state)) {
          if (value == null) continue
          if (typeof value === 'string' && value === '') continue
          if (Array.isArray(value) && value.length === 0) continue
          pruned[key] = value
        }
        const json = Object.keys(pruned).length > 0 ? JSON.stringify(pruned) : ''
        try {
          const updated = await api.topologies.sources.update(ctx.topologyId, source.id, {
            optionsJson: json,
          })
          ctx.currentSources = ctx.currentSources.map((s) => (s.id === source.id ? updated : s))
        } catch (e) {
          localError = e instanceof Error ? e.message : 'Failed to save scope'
        }
      }, 500),
    )
  }

  // --- Sync (explicit verbs) ------------------------------------------------

  async function handleSyncOne(source: TopologyDataSource) {
    syncingSourceId = source.dataSourceId
    try {
      const result = await api.topologies.sources.syncOne(ctx.topologyId, source.dataSourceId)
      const g = result.snapshot.graph ?? { nodes: [], links: [] }
      perSourceSync = {
        ...perSourceSync,
        [source.dataSourceId]: {
          status: result.snapshot.status,
          nodeCount: g.nodes?.length ?? 0,
          linkCount: g.links?.length ?? 0,
          message: result.snapshot.statusMessage,
          at: Date.now(),
        },
      }
      const updated = await api.topologies.get(ctx.topologyId)
      ctx.topology = updated
      topologies.upsert(updated)
      ctx.bumpRevision()
    } catch (e) {
      perSourceSync = {
        ...perSourceSync,
        [source.dataSourceId]: {
          status: 'failed',
          nodeCount: 0,
          linkCount: 0,
          message: e instanceof Error ? e.message : 'Sync failed',
          at: Date.now(),
        },
      }
    } finally {
      syncingSourceId = null
    }
  }

  async function handleSyncAll() {
    syncingAll = true
    try {
      await api.topologies.sources.syncAll(ctx.topologyId)
      const updated = await api.topologies.get(ctx.topologyId)
      ctx.topology = updated
      topologies.upsert(updated)
      ctx.bumpRevision()
    } catch (e) {
      localError = e instanceof Error ? e.message : 'Sync all failed'
    } finally {
      syncingAll = false
    }
  }

  /** Reset the human curation layer only (authored attachments, names, hidden
   *  nodes). Does NOT re-sync — that's a separate, explicit Sync all. Splitting
   *  the old combined "Rebuild" keeps data-reset and override-reset independent. */
  async function handleResetOverrides() {
    const ok = confirm(
      'Reset overrides discards every manual change you made (names, community, ' +
        'hidden nodes) and falls back to what the sources observe. The source data ' +
        'itself is kept. This cannot be undone. Continue?',
    )
    if (!ok) return
    rebuilding = true
    try {
      await api.topologies.discoveryPolicy.rebuild(ctx.topologyId)
      const updated = await api.topologies.get(ctx.topologyId)
      ctx.topology = updated
      topologies.upsert(updated)
      ctx.bumpRevision()
    } catch (e) {
      localError = e instanceof Error ? e.message : 'Reset overrides failed'
    } finally {
      rebuilding = false
    }
  }

  /** Clear one source's contribution (delete its observations); the attachment
   *  and its config stay. resolve() re-stitches from the remaining sources. */
  async function handleClearOne(source: TopologyDataSource) {
    const name = ctx.getDataSource(source.dataSourceId)?.name ?? source.dataSourceId
    const ok = confirm(
      `Clear all data contributed by "${name}"? The source stays attached (and its ` +
        `scope/priority kept); only what it observed is removed. Re-sync to repopulate.`,
    )
    if (!ok) return
    setBusy(source.id, true)
    localError = ''
    try {
      await api.topologies.sources.clear(ctx.topologyId, source.dataSourceId)
      const { [source.dataSourceId]: _cleared, ...rest } = perSourceSync
      perSourceSync = rest
      const updated = await api.topologies.get(ctx.topologyId)
      ctx.topology = updated
      topologies.upsert(updated)
      await mappingStore.load(ctx.topologyId, true)
      ctx.bumpRevision()
    } catch (e) {
      localError = e instanceof Error ? e.message : 'Clear failed'
    } finally {
      setBusy(source.id, false)
    }
  }

  // --- Webhook --------------------------------------------------------------

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
    <div class="card-header flex items-center justify-between gap-2">
      <h2 class="font-medium text-theme-text-emphasis">Topology Sources</h2>
      <div class="flex items-center gap-1.5">
        {#if topologySources.length > 0}
          <Button
            variant="outline"
            size="sm"
            disabled={syncingAll || rebuilding}
            onclick={handleSyncAll}
          >
            {syncingAll ? 'Syncing…' : '⟳ Sync all'}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            class="text-muted-foreground hover:text-destructive"
            disabled={rebuilding || syncingAll}
            title="Discard manual overrides (names, hidden nodes); keeps source data"
            onclick={handleResetOverrides}
          >
            {rebuilding ? 'Resetting…' : 'Reset overrides'}
          </Button>
        {/if}
        <Button variant="outline" size="sm" onclick={() => attachSource('topology')}>
          <PlusIcon size={16} class="mr-1" />
          Add
        </Button>
      </div>
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
            {@const lastResult = perSourceSync[source.dataSourceId]}
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
                      style="width: 9rem;"
                      value={source.syncMode}
                      onchange={(e) =>
                        patchSource(source, { syncMode: e.currentTarget.value as SyncMode })}
                    >
                      <option value="manual">Manual</option>
                      <option value="on_view">On View</option>
                      <option value="webhook">Webhook</option>
                    </select>
                  </div>

                  {#if hasMultipleTopologySources}
                    <div class="flex items-center gap-2">
                      <span class="text-xs text-theme-text-muted">Priority</span>
                      <input
                        type="number"
                        class="input"
                        style="width: 6rem;"
                        value={source.priority ?? 0}
                        onchange={(e) =>
                          patchSource(source, { priority: Number(e.currentTarget.value) || 0 }, true)}
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

                  <!-- Sync result + last-synced -->
                  <p class="text-xs text-theme-text-muted">
                    {#if lastResult}
                      {#if lastResult.status === 'ok'}
                        ✓ {lastResult.nodeCount} nodes / {lastResult.linkCount} links ·
                        {formatAgo(
                          lastResult.at,
                        )}
                      {:else if lastResult.status === 'partial'}
                        <span class="text-amber-600 dark:text-amber-400" title={lastResult.message}>
                          ⚠ partial · {formatAgo(lastResult.at)}
                        </span>
                      {:else if lastResult.status === 'empty'}
                        no devices observed · {formatAgo(lastResult.at)}
                      {:else}
                        <span class="text-red-500" title={lastResult.message}>
                          ✗ {lastResult.message ?? 'failed'}
                        </span>
                      {/if}
                    {:else if source.lastSyncedAt}
                      last synced {formatAgo(source.lastSyncedAt)}
                    {:else}
                      never synced
                    {/if}
                  </p>

                  <!-- Scope (faceted ingestion filter) -->
                  {#if scopeOpen.has(source.id)}
                    {@const optSchema = optionsSchemaFor(dataSource?.type)}
                    {#if optSchema && scopeState[source.id]}
                      <div class="border-t border-theme-border pt-3 space-y-2">
                        <p class="text-xs text-theme-text-muted">
                          Narrow what this source contributes. Takes effect on the next Sync.
                        </p>
                        <SchemaForm
                          schema={optSchema}
                          value={scopeState[source.id] ?? {}}
                          getOptions={(key) =>
                            api.dataSources
                              .getConfigOptions(source.dataSourceId, key)
                              .then((r) => r.options)}
                          onChange={() => saveScope(source)}
                        />
                      </div>
                    {:else}
                      <p class="text-xs text-theme-text-muted border-t border-theme-border pt-2">
                        This source has no scope options.
                      </p>
                    {/if}
                  {/if}
                </div>

                <div class="flex flex-col items-end gap-1.5 shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    onclick={() => handleSyncOne(source)}
                    disabled={syncingSourceId === source.dataSourceId}
                  >
                    {#if syncingSourceId === source.dataSourceId}
                      <span
                        class="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin mr-1"
                      ></span>
                      Syncing…
                    {:else}
                      <ArrowsClockwiseIcon size={12} class="mr-1" />
                      Sync now
                    {/if}
                  </Button>
                  {#if optionsSchemaFor(dataSource?.type)}
                    <Button
                      variant="ghost"
                      size="sm"
                      onclick={() => toggleScope(source.id)}
                      aria-expanded={scopeOpen.has(source.id)}
                    >
                      <SlidersHorizontalIcon size={14} class="mr-1" />
                      Scope
                    </Button>
                  {/if}
                  <Button
                    variant="ghost"
                    size="sm"
                    class="text-theme-text-muted hover:text-destructive"
                    title="Clear this source's data (keeps the attachment + config)"
                    onclick={() => handleClearOne(source)}
                  >
                    <EraserIcon size={14} class="mr-1" />
                    Clear
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    class="text-danger hover:bg-danger/10"
                    title="Detach this source"
                    onclick={() => detachSource(source)}
                  >
                    <TrashIcon size={16} />
                  </Button>
                </div>
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

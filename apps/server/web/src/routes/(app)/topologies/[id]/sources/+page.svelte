<script lang="ts">
  import { DropdownMenu } from 'bits-ui'
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
    CaretDownIcon,
    CaretRightIcon,
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
  import { topologies } from '$lib/stores'
  import type {
    DataSourcePluginInfo,
    LinkContribution,
    NodeContribution,
    PluginConfigSchema,
    ScopeMode,
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

  // Which source cards are expanded to show config + scope + danger actions.
  let expanded = $state<Set<string>>(new Set())
  // Scope (faceted ingestion filters), keyed by attachment id.
  let pluginTypes = $state<DataSourcePluginInfo[]>([])
  let scopeState = $state<Record<string, Record<string, unknown>>>({})
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

  // Config edits are cheap + LOCAL: they never hit live sources (no metrics-host
  // fetch) and never pull data. `reflect: true` only when the change alters how
  // *existing* data resolves (detach / priority / swap) → the diagram re-renders
  // the materialized graph (one cached recompute, no upstream call). Attaching
  // does NOT reflect — a new source shows nothing until you Sync.
  async function mutate(
    id: string,
    run: () => Promise<unknown>,
    onOk: (result: unknown) => void,
    opts: { reflect?: boolean } = {},
  ) {
    localError = ''
    setBusy(id, true)
    try {
      const result = await run()
      onOk(result)
      if (opts.reflect) ctx.bumpRevision()
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

  /** Data sources of `purpose` not already attached — the Add menu's candidates. */
  function availableFor(purpose: 'topology' | 'metrics') {
    const catalog = purpose === 'topology' ? ctx.topologyDataSources : ctx.metricsDataSources
    const taken = new Set(
      ctx.currentSources.filter((s) => s.purpose === purpose).map((s) => s.dataSourceId),
    )
    return catalog.filter((ds) => !taken.has(ds.id))
  }

  /** Attach a specific data source chosen from the Add menu. */
  function attachSpecific(purpose: 'topology' | 'metrics', dataSourceId: string) {
    const priority = ctx.currentSources.filter((s) => s.purpose === purpose).length
    void mutate(
      `attach:${dataSourceId}`,
      () =>
        api.topologies.sources.add(ctx.topologyId, {
          dataSourceId,
          purpose,
          syncMode: 'manual',
          priority,
        }),
      (added) => {
        ctx.currentSources = [...ctx.currentSources, added as TopologyDataSource]
      },
      // Attach is config only — no data until the user Syncs, so don't reflect.
      {},
    )
  }

  function detachSource(source: TopologyDataSource) {
    const name = ctx.getDataSource(source.dataSourceId)?.name ?? source.dataSourceId
    if (
      !confirm(
        `Detach "${name}" from this topology? Its observed data is removed from the view. ` +
          `The data source itself is not deleted.`,
      )
    )
      return
    void mutate(
      source.id,
      () => api.topologies.sources.remove(ctx.topologyId, source.id),
      () => {
        ctx.currentSources = ctx.currentSources.filter((s) => s.id !== source.id)
      },
      // Detaching removes a contributing source → its data leaves the resolved
      // graph; reflect it.
      { reflect: true },
    )
  }

  function patchSource(
    source: TopologyDataSource,
    updates: { syncMode?: SyncMode; priority?: number },
    reflect = false,
  ) {
    void mutate(
      source.id,
      () => api.topologies.sources.update(ctx.topologyId, source.id, updates),
      (updated) => {
        ctx.currentSources = ctx.currentSources.map((s) =>
          s.id === source.id ? (updated as TopologyDataSource) : s,
        )
      },
      { reflect },
    )
  }

  // Composition role = how THIS source behaves in the topology. Two presets over
  // the per-source knobs (scope is NOT here — it's a topology-level decision):
  //   Additive   = scoop + add  (assert nodes & links)
  //   Enrichment = anchor + update (fill fields only, claim nothing new)
  type CompositionRole = 'additive' | 'enrichment'
  function roleOf(s: TopologyDataSource): CompositionRole {
    return s.nodeContribution === 'anchor' ? 'enrichment' : 'additive'
  }
  function setRole(source: TopologyDataSource, role: CompositionRole) {
    const updates: {
      nodeContribution: NodeContribution
      linkContribution: LinkContribution
    } =
      role === 'enrichment'
        ? { nodeContribution: 'anchor', linkContribution: 'update' }
        : { nodeContribution: 'scoop', linkContribution: 'add' }
    void mutate(
      source.id,
      () => api.topologies.sources.update(ctx.topologyId, source.id, updates),
      (updated) => {
        ctx.currentSources = ctx.currentSources.map((s) =>
          s.id === source.id ? (updated as TopologyDataSource) : s,
        )
      },
      { reflect: true },
    )
  }

  // Topology-level scope (composition). Single decision: which region set closes
  // the world. 'auto' = highest-priority topology source; 'open' = no scoping;
  // 'closed' = the chosen scopeSourceId's regions.
  let scopeMode = $state<ScopeMode>('auto')
  let scopeSourceId = $state<string | undefined>(undefined)
  $effect(() => {
    scopeMode = ctx.topology?.scopeMode ?? 'auto'
    scopeSourceId = ctx.topology?.scopeSourceId
  })
  // Topology-purpose sources, the candidates for 'closed-to'.
  const topologySourceChoices = $derived(
    ctx.currentSources
      .filter((s) => s.purpose === 'topology')
      .map((s) => ({
        id: s.dataSourceId,
        name: ctx.getDataSource(s.dataSourceId)?.name ?? s.dataSourceId,
      })),
  )
  async function applyScope(mode: ScopeMode, sourceId?: string) {
    scopeMode = mode
    scopeSourceId = sourceId
    try {
      const res = await api.topologies.composition.set(ctx.topologyId, {
        scopeMode: mode,
        scopeSourceId: mode === 'closed' ? (sourceId ?? null) : null,
      })
      if (ctx.topology) ctx.topology = { ...ctx.topology, ...res }
      ctx.bumpRevision()
    } catch (e) {
      localError = e instanceof Error ? e.message : String(e)
    }
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
      // Swapping the underlying source changes resolved output → reflect.
      { reflect: true },
    )
  }

  // --- Scope (faceted, debounced direct apply) ------------------------------

  function toggleExpand(id: string) {
    const next = new Set(expanded)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    expanded = next
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
        <DropdownMenu.Root>
          <DropdownMenu.Trigger
            class="inline-flex items-center gap-1 rounded-md border border-theme-border px-2.5 py-1.5 text-sm font-medium hover:text-primary hover:border-primary transition-colors"
          >
            <PlusIcon size={16} />
            Add
          </DropdownMenu.Trigger>
          <DropdownMenu.Content
            sideOffset={6}
            align="end"
            class="z-50 min-w-[16rem] rounded-md border border-border bg-popover p-1 shadow-lg"
          >
            {#each availableFor('topology') as ds (ds.id)}
              <DropdownMenu.Item
                onSelect={() => attachSpecific('topology', ds.id)}
                class="flex items-center justify-between gap-3 rounded-sm px-2.5 py-2 text-left cursor-pointer outline-none data-[highlighted]:bg-accent"
              >
                <span class="text-sm font-medium">{ds.name}</span>
                <span class="text-[10px] uppercase tracking-wide font-mono text-muted-foreground">
                  {ds.type}
                </span>
              </DropdownMenu.Item>
            {:else}
              <div class="px-2.5 py-2 text-sm text-muted-foreground">
                No more sources to add.
                <a href="/datasources" class="text-primary hover:underline">Create one</a>.
              </div>
            {/each}
          </DropdownMenu.Content>
        </DropdownMenu.Root>
      </div>
    </div>
    <div class="card-body">
      {#if topologySources.length > 0}
        <!-- Topology-level scope: ONE decision for the whole topology — which
             region set closes the world. Not a per-source property. -->
        <div class="mb-4 flex flex-wrap items-center gap-2 rounded-lg bg-theme-bg-subtle p-3">
          <span class="text-xs font-medium text-theme-text-emphasis">Scope</span>
          <select
            class="input"
            style="width: 11rem;"
            title="Which region set closes the world for this topology"
            value={scopeMode}
            onchange={(e) =>
              applyScope(
                e.currentTarget.value as ScopeMode,
                e.currentTarget.value === 'closed' ? scopeSourceId : undefined,
              )}
          >
            <option value="auto">Auto (top source)</option>
            <option value="open">Open (union)</option>
            <option value="closed">Closed to…</option>
          </select>
          {#if scopeMode === 'closed'}
            <select
              class="input"
              style="width: 12rem;"
              value={scopeSourceId ?? ''}
              onchange={(e) => applyScope('closed', e.currentTarget.value || undefined)}
            >
              <option value="" disabled>Select a source…</option>
              {#each topologySourceChoices as choice (choice.id)}
                <option value={choice.id}>{choice.name}</option>
              {/each}
            </select>
          {/if}
          <span class="text-xs text-theme-text-muted">
            {scopeMode === 'open'
              ? 'all sources merged, nothing dropped'
              : 'nodes outside the closed region are dropped'}
          </span>
        </div>
      {/if}
      {#if topologySources.length === 0}
        <p class="text-sm text-theme-text-muted text-center py-4">
          No topology sources configured. Topology is defined manually.
        </p>
      {:else}
        <div class="space-y-4">
          {#each topologySources as source (source.id)}
            {@const dataSource = ctx.getDataSource(source.dataSourceId)}
            {@const lastResult = perSourceSync[source.dataSourceId]}
            {@const isOpen = expanded.has(source.id)}
            <div
              class="border border-theme-border rounded-lg transition-opacity"
              class:opacity-60={busy.has(source.id)}
            >
              <!-- Collapsed header: identity + status + last sync + Sync now -->
              <div class="flex items-center gap-3 p-3">
                <button
                  type="button"
                  class="text-theme-text-muted hover:text-theme-text shrink-0"
                  onclick={() => toggleExpand(source.id)}
                  aria-expanded={isOpen}
                  aria-label={isOpen ? 'Collapse' : 'Expand'}
                >
                  {#if isOpen}
                    <CaretDownIcon size={16} />
                  {:else}
                    <CaretRightIcon size={16} />
                  {/if}
                </button>
                <div class="min-w-0 flex-1">
                  <div class="flex items-center gap-2 flex-wrap">
                    <span class="text-sm font-medium text-theme-text-emphasis truncate">
                      {dataSource?.name ?? source.dataSourceId}
                    </span>
                    <span
                      class="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-theme-bg font-mono text-theme-text-muted"
                    >
                      {dataSource?.type ?? '—'}
                    </span>
                    {#if source.syncMode !== 'manual'}
                      <span class="text-[10px] text-theme-text-muted">· {source.syncMode}</span>
                    {/if}
                  </div>
                  <p class="text-xs text-theme-text-muted mt-0.5 truncate">
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
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  class="shrink-0"
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
                    Sync
                  {/if}
                </Button>
              </div>

              <!-- Expanded detail: config + scope + danger actions -->
              {#if isOpen}
                {@const optSchema = optionsSchemaFor(dataSource?.type)}
                <div class="border-t border-theme-border p-3 space-y-3">
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
                    <select
                      class="input"
                      style="width: 10rem;"
                      title="How this source behaves in the topology"
                      value={roleOf(source)}
                      onchange={(e) => setRole(source, e.currentTarget.value as CompositionRole)}
                    >
                      <option value="additive">Additive</option>
                      <option value="enrichment">Enrichment</option>
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
                      <span class="text-xs text-theme-text-muted">higher wins on overlap</span>
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

                  <!-- Scope (faceted ingestion filter) -->
                  {#if optSchema && scopeState[source.id]}
                    <div class="border-t border-theme-border pt-3 space-y-2">
                      <p
                        class="text-xs font-medium text-theme-text-muted uppercase tracking-wide flex items-center gap-1"
                      >
                        <SlidersHorizontalIcon size={12} />
                        Scope
                      </p>
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
                  {/if}

                  <!-- Danger actions -->
                  <div class="flex items-center gap-2 border-t border-theme-border pt-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      class="text-theme-text-muted hover:text-destructive"
                      title="Clear this source's data (keeps the attachment + config)"
                      onclick={() => handleClearOne(source)}
                    >
                      <EraserIcon size={14} class="mr-1" />
                      Clear data
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      class="text-danger hover:bg-danger/10"
                      onclick={() => detachSource(source)}
                    >
                      <TrashIcon size={14} class="mr-1" />
                      Detach
                    </Button>
                  </div>
                </div>
              {/if}
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
      <DropdownMenu.Root>
        <DropdownMenu.Trigger
          class="inline-flex items-center gap-1 rounded-md border border-theme-border px-2.5 py-1.5 text-sm font-medium hover:text-primary hover:border-primary transition-colors"
        >
          <PlusIcon size={16} />
          Add
        </DropdownMenu.Trigger>
        <DropdownMenu.Content
          sideOffset={6}
          align="end"
          class="z-50 min-w-[16rem] rounded-md border border-border bg-popover p-1 shadow-lg"
        >
          {#each availableFor('metrics') as ds (ds.id)}
            <DropdownMenu.Item
              onSelect={() => attachSpecific('metrics', ds.id)}
              class="flex items-center justify-between gap-3 rounded-sm px-2.5 py-2 text-left cursor-pointer outline-none data-[highlighted]:bg-accent"
            >
              <span class="text-sm font-medium">{ds.name}</span>
              <span class="text-[10px] uppercase tracking-wide font-mono text-muted-foreground">
                {ds.type}
              </span>
            </DropdownMenu.Item>
          {:else}
            <div class="px-2.5 py-2 text-sm text-muted-foreground">
              No more sources to add.
              <a href="/datasources" class="text-primary hover:underline">Create one</a>.
            </div>
          {/each}
        </DropdownMenu.Content>
      </DropdownMenu.Root>
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

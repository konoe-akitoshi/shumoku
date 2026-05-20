<script lang="ts">
  import type { NetworkGraph, Provenance } from '@shumoku/core'
  import { onMount } from 'svelte'
  import { api } from '$lib/api'
  import { Button } from '$lib/components/ui/button'

  /**
   * Surfaces the observation-model state of a topology:
   *   - resolved graph from GET /resolved (each element has provenance.state)
   *   - recent snapshots list from GET /observations
   *   - per-source "Scan now" button
   *
   * This is the v1 stand-in for the eventual rich Element inspector + scan
   * triggers integrated directly into the SVG viewer. The renderer doesn 't
   * yet decorate elements by state, so this panel makes the same data
   * discoverable in tabular form.
   */
  interface Props {
    topologyId: string
  }
  let { topologyId }: Props = $props()

  type State = NonNullable<Provenance['state']>

  let resolved = $state<NetworkGraph | null>(null)
  let snapshotCount = $state(0)
  let observations = $state<
    Array<{
      id: string
      sourceId: string
      capturedAt: number
      status: 'ok' | 'partial' | 'failed' | 'empty'
      statusMessage?: string
      nodeCount: number
      linkCount: number
      portCount: number
    }>
  >([])
  let sources = $state<
    Array<{ id: string; dataSourceId: string; dataSource?: { name: string; type: string } }>
  >([])
  let loading = $state(true)
  let error = $state('')
  let scanningSourceId = $state<string | null>(null)
  /** Selected element for the inline mini-inspector. */
  let selected = $state<{ kind: 'node' | 'link'; id: string } | null>(null)
  /** Filter the element table by state. */
  let stateFilter = $state<State | 'all'>('all')

  async function refresh() {
    loading = true
    error = ''
    try {
      const [resolvedResp, obsList, srcList] = await Promise.all([
        api.topologies.getResolved(topologyId),
        api.topologies.listObservations(topologyId, 20),
        api.topologies.sources.list(topologyId),
      ])
      resolved = resolvedResp.graph
      snapshotCount = resolvedResp.snapshotCount
      observations = obsList
      sources = srcList
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to load observations'
    } finally {
      loading = false
    }
  }

  onMount(() => {
    void refresh()
  })

  async function handleScan(sourceId: string) {
    scanningSourceId = sourceId
    try {
      await api.dataSources.scan(sourceId, { topologyId })
      // Refresh both the resolved graph and the observation history.
      await refresh()
    } catch (e) {
      error = e instanceof Error ? e.message : 'Scan failed'
    } finally {
      scanningSourceId = null
    }
  }

  function formatAgo(ts: number): string {
    const diff = Date.now() - ts
    if (diff < 60_000) return 'just now'
    if (diff < 3600_000) return `${Math.floor(diff / 60_000)}m ago`
    if (diff < 86400_000) return `${Math.floor(diff / 3600_000)}h ago`
    return new Date(ts).toLocaleString()
  }

  function stateLabel(s: State | undefined): string {
    if (!s) return 'unset'
    if (s === 'authored-only') return 'authored only'
    if (s === 'discovered-only') return 'discovered only'
    return s
  }

  function stateClass(s: State | undefined): string {
    switch (s) {
      case 'confirmed':
        return 'text-green-600 dark:text-green-400'
      case 'conflicting':
        return 'text-amber-600 dark:text-amber-400'
      case 'discovered-only':
        return 'text-blue-500 dark:text-blue-400'
      case 'authored-only':
        return 'text-theme-text-muted'
      default:
        return 'text-theme-text-muted'
    }
  }

  /** Flatten resolved nodes into the table rows we show. */
  let nodeRows = $derived.by(() => {
    if (!resolved) return []
    return (resolved.nodes ?? []).map((n) => ({
      kind: 'node' as const,
      id: n.id,
      label: Array.isArray(n.label) ? n.label.join(' ') : (n.label ?? '(unnamed)'),
      state: n.provenance?.state,
      source: n.provenance?.source ?? '—',
      identity: n.identity,
      observedAt: n.provenance?.observedAt,
      portCount: n.ports?.length ?? 0,
    }))
  })

  let filteredRows = $derived(
    stateFilter === 'all' ? nodeRows : nodeRows.filter((r) => r.state === stateFilter),
  )

  let counts = $derived.by(() => {
    const byState: Record<string, number> = {
      confirmed: 0,
      conflicting: 0,
      'discovered-only': 0,
      'authored-only': 0,
    }
    for (const r of nodeRows) {
      if (r.state) byState[r.state] = (byState[r.state] ?? 0) + 1
    }
    return byState
  })

  let selectedNode = $derived.by(() => {
    const sel = selected
    if (!sel || sel.kind !== 'node') return null
    return nodeRows.find((r) => r.id === sel.id) ?? null
  })
</script>

<div class="observation-panel space-y-4">
  <header class="flex items-center justify-between gap-2">
    <div>
      <h2 class="text-base font-semibold">Observations</h2>
      <p class="text-xs text-theme-text-muted">
        {snapshotCount}
        active snapshot{snapshotCount === 1 ? '' : 's'}
        · resolver state per element
      </p>
    </div>
    <Button variant="outline" size="sm" onclick={refresh} disabled={loading}>
      {loading ? 'Loading…' : 'Refresh'}
    </Button>
  </header>

  {#if error}
    <div class="rounded border border-red-500/50 bg-red-500/10 p-2 text-xs text-red-500">
      {error}
    </div>
  {/if}

  <!-- Per-source scan controls -->
  {#if sources.length > 0}
    <section class="rounded border border-theme-border p-3">
      <h3 class="text-sm font-medium mb-2">Sources attached</h3>
      <ul class="space-y-1">
        {#each sources as src (src.id)}
          <li class="flex items-center justify-between gap-2 text-sm">
            <span>
              <span class="font-mono text-xs">{src.dataSource?.type ?? '—'}</span>
              <span class="ml-2">{src.dataSource?.name ?? src.dataSourceId}</span>
            </span>
            <Button
              variant="outline"
              size="sm"
              onclick={() => handleScan(src.dataSourceId)}
              disabled={scanningSourceId === src.dataSourceId}
            >
              {scanningSourceId === src.dataSourceId ? 'Scanning…' : 'Scan now'}
            </Button>
          </li>
        {/each}
      </ul>
    </section>
  {/if}

  <!-- State summary -->
  <section class="grid grid-cols-4 gap-2 text-center text-xs">
    {#each [['confirmed', 'Confirmed'], ['conflicting', 'Conflicting'], ['discovered-only', 'Discovered only'], ['authored-only', 'Authored only']] as [ k, label ] (k)}
      <button
        class="rounded border p-2 transition-colors {stateFilter === k
          ? 'border-blue-500 bg-blue-500/10'
          : 'border-theme-border hover:bg-theme-surface-hover'}"
        onclick={() => {
          stateFilter = stateFilter === k ? 'all' : (k as State)
        }}
      >
        <div class="text-lg font-semibold {stateClass(k as State)}">{counts[k as string] ?? 0}</div>
        <div class="text-theme-text-muted">{label}</div>
      </button>
    {/each}
  </section>

  <!-- Element table -->
  <section>
    <div class="flex items-center justify-between mb-1">
      <h3 class="text-sm font-medium">
        Nodes
        {#if stateFilter !== 'all'}
          <span class="text-xs text-theme-text-muted">filter: {stateFilter}</span>
        {/if}
      </h3>
      {#if stateFilter !== 'all'}
        <button class="text-xs text-blue-500 hover:underline" onclick={() => (stateFilter = 'all')}>
          Clear filter
        </button>
      {/if}
    </div>
    <div class="rounded border border-theme-border max-h-72 overflow-auto">
      <table class="w-full text-xs">
        <thead class="sticky top-0 bg-theme-surface">
          <tr class="text-left">
            <th class="p-1.5 font-medium">Label</th>
            <th class="p-1.5 font-medium">State</th>
            <th class="p-1.5 font-medium">Source</th>
            <th class="p-1.5 font-medium">mgmtIp</th>
            <th class="p-1.5 font-medium text-right">Ports</th>
          </tr>
        </thead>
        <tbody>
          {#each filteredRows as r (r.id)}
            <tr
              class="border-t border-theme-border cursor-pointer hover:bg-theme-surface-hover {selected?.id ===
              r.id
                ? 'bg-theme-surface-hover'
                : ''}"
              onclick={() => (selected = { kind: 'node', id: r.id })}
            >
              <td class="p-1.5 font-medium">{r.label}</td>
              <td class="p-1.5 {stateClass(r.state)}">{stateLabel(r.state)}</td>
              <td class="p-1.5 font-mono text-theme-text-muted">{r.source}</td>
              <td class="p-1.5 font-mono text-theme-text-muted">{r.identity?.mgmtIp ?? ''}</td>
              <td class="p-1.5 text-right">{r.portCount}</td>
            </tr>
          {/each}
          {#if filteredRows.length === 0}
            <tr>
              <td colspan="5" class="p-3 text-center text-theme-text-muted">
                {nodeRows.length === 0
                  ? 'No nodes resolved yet — attach a source and scan.'
                  : 'No nodes match this filter.'}
              </td>
            </tr>
          {/if}
        </tbody>
      </table>
    </div>
  </section>

  <!-- Mini inspector for selected element -->
  {#if selectedNode}
    <section class="rounded border border-theme-border p-3 text-xs space-y-2">
      <div class="flex items-center justify-between">
        <h3 class="text-sm font-medium">
          {selectedNode.label}
          <span class="ml-2 {stateClass(selectedNode.state)}"
            >{stateLabel(selectedNode.state)}</span
          >
        </h3>
        <button
          class="text-theme-text-muted hover:text-theme-text"
          onclick={() => (selected = null)}
        >
          ✕
        </button>
      </div>
      <dl class="grid grid-cols-[120px_1fr] gap-x-2 gap-y-1">
        <dt class="text-theme-text-muted">source</dt>
        <dd class="font-mono">{selectedNode.source}</dd>
        {#if selectedNode.observedAt}
          <dt class="text-theme-text-muted">observed</dt>
          <dd>{formatAgo(selectedNode.observedAt)}</dd>
        {/if}
        {#if selectedNode.identity}
          {#if selectedNode.identity.mgmtIp}
            <dt class="text-theme-text-muted">mgmtIp</dt>
            <dd class="font-mono">{selectedNode.identity.mgmtIp}</dd>
          {/if}
          {#if selectedNode.identity.chassisId}
            <dt class="text-theme-text-muted">chassisId</dt>
            <dd class="font-mono">{selectedNode.identity.chassisId}</dd>
          {/if}
          {#if selectedNode.identity.sysName}
            <dt class="text-theme-text-muted">sysName</dt>
            <dd>{selectedNode.identity.sysName}</dd>
          {/if}
          {#if selectedNode.identity.vendorIds}
            <dt class="text-theme-text-muted">vendorIds</dt>
            <dd class="font-mono">
              {Object.entries(selectedNode.identity.vendorIds)
                .map(([k, v]) => `${k}=${v}`)
                .join(', ')}
            </dd>
          {/if}
        {/if}
        <dt class="text-theme-text-muted">ports</dt>
        <dd>{selectedNode.portCount}</dd>
      </dl>
    </section>
  {/if}

  <!-- Observation history -->
  <section>
    <h3 class="text-sm font-medium mb-1">Recent snapshots</h3>
    {#if observations.length === 0}
      <div class="text-xs text-theme-text-muted py-2">No observations yet.</div>
    {:else}
      <div class="rounded border border-theme-border max-h-56 overflow-auto">
        <table class="w-full text-xs">
          <thead class="sticky top-0 bg-theme-surface">
            <tr class="text-left">
              <th class="p-1.5 font-medium">Time</th>
              <th class="p-1.5 font-medium">Source</th>
              <th class="p-1.5 font-medium">Status</th>
              <th class="p-1.5 font-medium text-right">Nodes</th>
              <th class="p-1.5 font-medium text-right">Links</th>
              <th class="p-1.5 font-medium text-right">Ports</th>
            </tr>
          </thead>
          <tbody>
            {#each observations as o (o.id)}
              <tr class="border-t border-theme-border">
                <td class="p-1.5">{formatAgo(o.capturedAt)}</td>
                <td class="p-1.5 font-mono text-theme-text-muted">{o.sourceId}</td>
                <td class="p-1.5">
                  {#if o.status === 'ok'}
                    <span class="text-green-600 dark:text-green-400">✓ ok</span>
                  {:else if o.status === 'partial'}
                    <span class="text-amber-600 dark:text-amber-400">⚠ partial</span>
                  {:else if o.status === 'empty'}
                    <span class="text-theme-text-muted">empty</span>
                  {:else}
                    <span class="text-red-500" title={o.statusMessage}>✗ failed</span>
                  {/if}
                </td>
                <td class="p-1.5 text-right">{o.nodeCount}</td>
                <td class="p-1.5 text-right">{o.linkCount}</td>
                <td class="p-1.5 text-right">{o.portCount}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  </section>
</div>

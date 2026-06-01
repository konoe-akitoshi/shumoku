<script lang="ts">
  /**
   * Discovery — the workspace for "what was discovered, how reliably,
   * and what the scheduler is going to do with it". Combines:
   *
   *   - Summary strip: 6 clickable chips (3 identity-binding counts +
   *     3 scheduler-mode counts), each doubles as a filter for the grid.
   *   - Grabbed-nodes grid with mode badges, search, bulk-select.
   *   - Per-source Sync now controls + per-source last-result chips.
   *   - Recent observations table.
   *
   * Imperative counterpart to Sources, which is declarative. "Press the
   * button" and "edit the config" are intentionally separate surfaces.
   */
  import { nodeIdentityQuality } from '@shumoku/core'
  import { ArrowsClockwiseIcon } from 'phosphor-svelte'
  import { goto } from '$app/navigation'
  import { type Attachment, api, type DiscoveryMode } from '$lib/api'
  import DiscoveryNodeDetail from '$lib/components/DiscoveryNodeDetail.svelte'
  import { Button } from '$lib/components/ui/button'
  import { topologies } from '$lib/stores'
  import type { TopologyDataSource } from '$lib/types'
  import { useTopologyCtx } from '../_context.svelte'

  const ctx = useTopologyCtx()

  type DiscoveredCard = {
    id: string
    label: string
    sysDescr?: string
    model?: string
    vendor?: string
    mgmtIp?: string
    sysName?: string
    chassisId?: string
    sysObjectID?: string
    catalogId?: string
    quality: 'stable' | 'weak' | 'unbound'
    /** 'notice' = reachable but not yet readable over SNMP (needs a
     *  credential); 'synced' = fully walked. Undefined for sources that
     *  don't distinguish (e.g. non-SNMP plugins). */
    syncState?: 'synced' | 'notice'
    /** Protocol the node was actually read with (from the snapshot), e.g.
     *  'snmp'. Absent for notice / unread nodes. */
    readVia?: string
    /** Authored overlay (access / policy) on this node, for the detail modal. */
    attachments?: Attachment[]
    sourceId?: string
    sourceName?: string
    sourceType?: string
    observedAt?: number
  }

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
  let identityQuality = $state<{ stable: number; weak: number; unbound: number; total: number }>({
    stable: 0,
    weak: 0,
    unbound: 0,
    total: 0,
  })
  let discoveredNodes = $state<DiscoveredCard[]>([])
  let detailNode = $state<DiscoveredCard | null>(null)
  let recentObservations = $state<
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
  let discoveryLoading = $state(false)
  let policyView = $state<{
    topologyDefault: Attachment[] | null
    runtimeDefault: { mode: import('$lib/api').DiscoveryMode; intervalMs: number }
    nodes: Record<string, import('$lib/api').EffectivePolicy>
    subgraphs: Record<string, import('$lib/api').EffectivePolicy>
  } | null>(null)
  let discoverySearch = $state('')
  let modeFilter = $state<'all' | 'auto' | 'observe' | 'disabled'>('all')
  let qualityFilter = $state<'all' | 'stable' | 'weak' | 'unbound'>('all')
  let policyPatching = $state<Record<string, boolean>>({})
  let policyError = $state<Record<string, string>>({})
  let bulkSelection = $state<Set<string>>(new Set())
  let bulkApplying = $state(false)
  let probingNodeId = $state<string | null>(null)

  let topologySources = $derived(ctx.currentSources.filter((s) => s.purpose === 'topology'))

  let filteredDiscoveredNodes = $derived.by(() => {
    const q = discoverySearch.trim().toLowerCase()
    return discoveredNodes.filter((c) => {
      if (qualityFilter !== 'all' && c.quality !== qualityFilter) return false
      if (modeFilter !== 'all') {
        const eff = policyView?.nodes[c.id]
        if ((eff?.mode ?? policyView?.runtimeDefault.mode) !== modeFilter) return false
      }
      if (!q) return true
      const hay = [c.label, c.model, c.vendor, c.mgmtIp, c.sysName]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return hay.includes(q)
    })
  })

  let modeCounts = $derived.by(() => {
    const out = { auto: 0, observe: 0, disabled: 0 }
    for (const c of discoveredNodes) {
      const m = policyView?.nodes[c.id]?.mode ?? policyView?.runtimeDefault.mode ?? 'auto'
      if (m === 'auto' || m === 'observe' || m === 'disabled') out[m]++
    }
    return out
  })

  // Refresh whenever the layout has finished loading (so we have a
  // topology id) and on subsequent topology switches.
  $effect(() => {
    if (ctx.topology && ctx.topologyId) void refreshDiscovery()
  })

  async function refreshDiscovery() {
    if (!ctx.topologyId) return
    discoveryLoading = true
    try {
      const [graphResp, obsList, policy] = await Promise.all([
        api.topologies.getGraph(ctx.topologyId),
        api.topologies.listObservations(ctx.topologyId, 20),
        api.topologies.discoveryPolicy.get(ctx.topologyId),
      ])
      policyView = policy
      // Segment nodes (synthetic L2 transit) are virtual stand-ins for
      // unknown L2 fabric, not "grabbed" devices. Skip them in both
      // gauge and grid so the counts mean what they appear to.
      const counts = { stable: 0, weak: 0, unbound: 0, total: 0 }
      const cards: DiscoveredCard[] = []
      for (const node of graphResp.graph.nodes ?? []) {
        const isSegment =
          node.spec?.kind === 'hardware' && (node.spec as { type?: string }).type === 'segment'
        if (isSegment) continue
        const q = nodeIdentityQuality(node.identity)
        counts[q]++
        counts.total++
        const md = (node.metadata ?? {}) as Record<string, unknown>
        const label = Array.isArray(node.label) ? node.label.join(' ') : (node.label ?? node.id)
        // Prefer the observing source: once a node has an authored override
        // its provenance.source flips to 'authored', but discovery still
        // needs the source that saw it (resolve stamps `observedSource`).
        const sourceId =
          (typeof md['observedSource'] === 'string'
            ? (md['observedSource'] as string)
            : undefined) ?? node.provenance?.source
        const sourceDs = sourceId ? ctx.getDataSource(sourceId) : undefined
        cards.push({
          id: node.id,
          label,
          sysDescr: typeof md['sysDescr'] === 'string' ? (md['sysDescr'] as string) : undefined,
          model:
            typeof md['chassisModel'] === 'string' ? (md['chassisModel'] as string) : undefined,
          vendor: typeof md['vendor'] === 'string' ? (md['vendor'] as string) : undefined,
          mgmtIp: node.identity?.mgmtIp,
          sysName: node.identity?.sysName,
          chassisId: node.identity?.chassisId,
          sysObjectID:
            typeof md['sysObjectID'] === 'string' ? (md['sysObjectID'] as string) : undefined,
          catalogId: typeof md['catalogId'] === 'string' ? (md['catalogId'] as string) : undefined,
          quality: q,
          syncState:
            md['syncState'] === 'notice'
              ? 'notice'
              : md['syncState'] === 'synced'
                ? 'synced'
                : undefined,
          readVia: typeof md['readVia'] === 'string' ? (md['readVia'] as string) : undefined,
          attachments: (node as { attachments?: Attachment[] }).attachments,
          sourceId,
          sourceName: sourceDs?.name,
          sourceType: sourceDs?.type,
          observedAt: node.provenance?.observedAt,
        })
      }
      identityQuality = counts
      discoveredNodes = cards
      recentObservations = obsList
    } catch (e) {
      console.error('[Discovery] failed to refresh', e)
    } finally {
      discoveryLoading = false
    }
  }

  async function handleSyncOne(source: TopologyDataSource) {
    syncingSourceId = source.dataSourceId
    try {
      const result = await api.topologies.sources.syncOne(ctx.topologyId, source.dataSourceId)
      const counts = result.snapshot.graph ?? { nodes: [], links: [] }
      perSourceSync = {
        ...perSourceSync,
        [source.dataSourceId]: {
          status: result.snapshot.status,
          nodeCount: counts.nodes?.length ?? 0,
          linkCount: counts.links?.length ?? 0,
          message: result.snapshot.statusMessage,
          at: Date.now(),
        },
      }
      const updatedTopology = await api.topologies.get(ctx.topologyId)
      ctx.topology = updatedTopology
      topologies.upsert(updatedTopology)
      await refreshDiscovery()
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

  /** Replace a node's authored overlay wholesale (empty = clear). */
  async function setNodeAttachments(
    nodeId: string,
    attachments: Attachment[],
  ): Promise<{ ok: true } | { ok: false; reason: string }> {
    policyPatching = { ...policyPatching, [nodeId]: true }
    try {
      await api.topologies.discoveryPolicy.patch(ctx.topologyId, {
        scope: 'node',
        id: nodeId,
        attachments: attachments.length > 0 ? attachments : null,
      })
      if (policyError[nodeId]) {
        const next = { ...policyError }
        delete next[nodeId]
        policyError = next
      }
      return { ok: true }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'patch failed'
      policyError = { ...policyError, [nodeId]: msg }
      return { ok: false, reason: msg }
    } finally {
      policyPatching = { ...policyPatching, [nodeId]: false }
    }
  }

  /** Set/clear the policy attachment's mode, preserving other attachments. */
  function withMode(attachments: Attachment[], mode: DiscoveryMode | 'inherit'): Attachment[] {
    const rest = attachments.filter((a) => a.kind !== 'policy')
    if (mode === 'inherit') return rest
    const policy = attachments.find((a) => a.kind === 'policy')
    return [
      ...rest,
      { kind: 'policy', mode, ...(policy?.intervalMs ? { intervalMs: policy.intervalMs } : {}) },
    ]
  }

  async function handleBulkSetMode(mode: DiscoveryMode | 'inherit'): Promise<void> {
    if (bulkSelection.size === 0) return
    bulkApplying = true
    try {
      const ids = [...bulkSelection]
      await Promise.all(
        ids.map((id) => {
          const card = discoveredNodes.find((c) => c.id === id)
          return setNodeAttachments(id, withMode(card?.attachments ?? [], mode))
        }),
      )
      await refreshDiscovery()
    } finally {
      bulkApplying = false
    }
  }

  function toggleBulkSelection(nodeId: string): void {
    const next = new Set(bulkSelection)
    if (next.has(nodeId)) next.delete(nodeId)
    else next.add(nodeId)
    bulkSelection = next
  }

  function toggleBulkSelectAll(): void {
    const visible = filteredDiscoveredNodes.map((c) => c.id)
    const allSelected = visible.every((id) => bulkSelection.has(id))
    const next = new Set(bulkSelection)
    if (allSelected) for (const id of visible) next.delete(id)
    else for (const id of visible) next.add(id)
    bulkSelection = next
  }

  /** Modal callback: the detail panel emits the node's full desired
   *  attachment list; we replace the overlay and refresh. */
  async function handleSetAttachments(attachments: Attachment[]): Promise<void> {
    if (!detailNode) return
    const id = detailNode.id
    const result = await setNodeAttachments(id, attachments)
    if (!result.ok) {
      console.warn('[Discovery] attachment patch failed:', result.reason)
      return
    }
    await refreshDiscovery()
    const refreshed = discoveredNodes.find((c) => c.id === id)
    if (refreshed) detailNode = refreshed
  }

  /** Modal callback: set/clear the open node's authored name override. */
  async function handleSetLabel(label: string | null): Promise<void> {
    if (!detailNode) return
    const id = detailNode.id
    policyPatching = { ...policyPatching, [id]: true }
    try {
      await api.topologies.discoveryPolicy.patch(ctx.topologyId, {
        scope: 'node',
        id,
        label,
      })
      if (policyError[id]) {
        const next = { ...policyError }
        delete next[id]
        policyError = next
      }
    } catch (e) {
      policyError = { ...policyError, [id]: e instanceof Error ? e.message : 'rename failed' }
      return
    } finally {
      policyPatching = { ...policyPatching, [id]: false }
    }
    await refreshDiscovery()
    const refreshed = discoveredNodes.find((c) => c.id === id)
    if (refreshed) detailNode = refreshed
  }

  async function handleProbeNode(card: DiscoveredCard) {
    if (!card.sourceId || !card.mgmtIp) return
    probingNodeId = card.id
    try {
      await api.topologies.sources.probe(ctx.topologyId, card.sourceId, [card.mgmtIp])
      await refreshDiscovery()
      if (detailNode?.id === card.id) {
        const refreshed = discoveredNodes.find((c) => c.id === card.id)
        if (refreshed) detailNode = refreshed
      }
    } catch (e) {
      console.error('[Discovery] probe failed', e)
    } finally {
      probingNodeId = null
    }
  }

  function formatAgo(ts: number): string {
    const diff = Date.now() - ts
    if (diff < 60_000) return 'just now'
    if (diff < 3600_000) return `${Math.floor(diff / 60_000)}m ago`
    if (diff < 86400_000) return `${Math.floor(diff / 3600_000)}h ago`
    return new Date(ts).toLocaleString()
  }
</script>

<div class="container mx-auto p-6 max-w-6xl space-y-6">
  {#if topologySources.length === 0}
    <div class="card p-8 text-center space-y-2">
      <p class="text-theme-text-emphasis font-medium">No sources to discover from</p>
      <p class="text-sm text-theme-text-muted">
        Discovery runs against attached topology sources — NetBox, Network Discovery, Zabbix and so
        on. Attach one first.
      </p>
      <div class="pt-2">
        <Button
          variant="secondary"
          size="sm"
          onclick={() => goto(`/topologies/${ctx.topologyId}/sources`)}
        >
          Go to Sources →
        </Button>
      </div>
    </div>
  {:else}
    <!-- Summary strip -->
    <div class="card">
      <div class="card-header flex items-center justify-between gap-3">
        <div>
          <h2 class="font-medium text-theme-text-emphasis">Overview</h2>
          <p class="text-xs text-theme-text-muted mt-0.5">
            Identity binding (掴み) on the left, scheduler policy on the right. Click a chip to
            filter the grid below.
          </p>
        </div>
        {#if policyView}
          {@const topoPolicy = policyView.topologyDefault?.find((a) => a.kind === 'policy')}
          {@const def =
            (topoPolicy?.kind === 'policy' ? topoPolicy.mode : undefined) ??
            policyView.runtimeDefault.mode}
          <span class="text-xs text-theme-text-muted whitespace-nowrap">
            topology default: <span class="font-mono">{def}</span>
          </span>
        {/if}
      </div>
      <div class="card-body">
        <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 text-center">
          <button
            type="button"
            class="rounded-lg border p-3 transition-colors cursor-pointer text-left {qualityFilter ===
            'stable'
              ? 'border-primary ring-1 ring-primary/40'
              : 'border-theme-border hover:border-theme-text-muted'}"
            onclick={() => (qualityFilter = qualityFilter === 'stable' ? 'all' : 'stable')}
          >
            <p class="text-2xl font-semibold text-green-600 dark:text-green-400">
              {identityQuality.stable}
            </p>
            <p class="text-xs text-theme-text-muted mt-1">🟢 stable</p>
          </button>
          <button
            type="button"
            class="rounded-lg border p-3 transition-colors cursor-pointer text-left {qualityFilter ===
            'weak'
              ? 'border-primary ring-1 ring-primary/40'
              : 'border-theme-border hover:border-theme-text-muted'}"
            onclick={() => (qualityFilter = qualityFilter === 'weak' ? 'all' : 'weak')}
          >
            <p class="text-2xl font-semibold text-amber-600 dark:text-amber-400">
              {identityQuality.weak}
            </p>
            <p class="text-xs text-theme-text-muted mt-1">🟡 weak</p>
          </button>
          <button
            type="button"
            class="rounded-lg border p-3 transition-colors cursor-pointer text-left {qualityFilter ===
            'unbound'
              ? 'border-primary ring-1 ring-primary/40'
              : 'border-theme-border hover:border-theme-text-muted'}"
            onclick={() => (qualityFilter = qualityFilter === 'unbound' ? 'all' : 'unbound')}
          >
            <p class="text-2xl font-semibold text-theme-text-muted">{identityQuality.unbound}</p>
            <p class="text-xs text-theme-text-muted mt-1">🔴 unbound</p>
          </button>
          <button
            type="button"
            class="rounded-lg border p-3 transition-colors cursor-pointer text-left {modeFilter ===
            'auto'
              ? 'border-primary ring-1 ring-primary/40'
              : 'border-theme-border hover:border-theme-text-muted'}"
            onclick={() => (modeFilter = modeFilter === 'auto' ? 'all' : 'auto')}
          >
            <p class="text-2xl font-semibold text-sky-600 dark:text-sky-400">{modeCounts.auto}</p>
            <p class="text-xs text-theme-text-muted mt-1">auto</p>
          </button>
          <button
            type="button"
            class="rounded-lg border p-3 transition-colors cursor-pointer text-left {modeFilter ===
            'observe'
              ? 'border-primary ring-1 ring-primary/40'
              : 'border-theme-border hover:border-theme-text-muted'}"
            onclick={() => (modeFilter = modeFilter === 'observe' ? 'all' : 'observe')}
          >
            <p class="text-2xl font-semibold text-violet-600 dark:text-violet-400">
              {modeCounts.observe}
            </p>
            <p class="text-xs text-theme-text-muted mt-1">observe</p>
          </button>
          <button
            type="button"
            class="rounded-lg border p-3 transition-colors cursor-pointer text-left {modeFilter ===
            'disabled'
              ? 'border-primary ring-1 ring-primary/40'
              : 'border-theme-border hover:border-theme-text-muted'}"
            onclick={() => (modeFilter = modeFilter === 'disabled' ? 'all' : 'disabled')}
          >
            <p class="text-2xl font-semibold text-theme-text-muted">{modeCounts.disabled}</p>
            <p class="text-xs text-theme-text-muted mt-1">disabled</p>
          </button>
        </div>
        {#if identityQuality.total === 0 && !discoveryLoading}
          <p class="text-xs text-theme-text-muted text-center mt-3">
            No nodes resolved yet. Sync a source below to populate.
          </p>
        {/if}
      </div>
    </div>

    {#if discoveredNodes.length > 0}
      <div class="card">
        <div class="card-header flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h2 class="font-medium text-theme-text-emphasis">
              Grabbed nodes
              <span class="text-xs text-theme-text-muted ml-2">
                {#if filteredDiscoveredNodes.length === discoveredNodes.length}
                  ({discoveredNodes.length})
                {:else}
                  ({filteredDiscoveredNodes.length}
                  of {discoveredNodes.length})
                {/if}
              </span>
            </h2>
            <p class="text-xs text-theme-text-muted mt-0.5">
              Click to see identity / rescan / change discovery mode.
            </p>
          </div>
          <div class="flex items-center gap-2">
            <input
              type="text"
              bind:value={discoverySearch}
              placeholder="Search by name, IP, model…"
              class="text-sm rounded border border-theme-border bg-theme-bg px-2 py-1 w-56 placeholder:text-theme-text-muted/70"
            >
            {#if modeFilter !== 'all' || qualityFilter !== 'all' || discoverySearch}
              <button
                type="button"
                class="text-xs text-theme-text-muted hover:text-theme-text-emphasis"
                onclick={() => {
                  modeFilter = 'all'
                  qualityFilter = 'all'
                  discoverySearch = ''
                }}
              >
                Clear filters
              </button>
            {/if}
          </div>
        </div>
        <div class="card-body">
          {#if filteredDiscoveredNodes.length === 0}
            <p class="text-xs text-theme-text-muted text-center py-6">
              No nodes match the current filters.
            </p>
          {:else}
            <div class="flex items-center justify-between gap-3 mb-3 text-xs flex-wrap">
              <button
                type="button"
                class="text-theme-text-muted hover:text-theme-text-emphasis"
                onclick={toggleBulkSelectAll}
              >
                {filteredDiscoveredNodes.every((c) => bulkSelection.has(c.id))
                  ? 'Deselect all'
                  : `Select all (${filteredDiscoveredNodes.length})`}
              </button>
              {#if bulkSelection.size > 0}
                <div class="flex items-center gap-2 ml-auto">
                  <span class="text-theme-text-muted">
                    {bulkSelection.size}
                    selected → set mode:
                  </span>
                  <button
                    type="button"
                    class="px-2 py-1 rounded border border-theme-border hover:border-primary disabled:opacity-50"
                    disabled={bulkApplying}
                    onclick={() => handleBulkSetMode('auto')}
                  >
                    auto
                  </button>
                  <button
                    type="button"
                    class="px-2 py-1 rounded border border-theme-border hover:border-primary disabled:opacity-50"
                    disabled={bulkApplying}
                    onclick={() => handleBulkSetMode('observe')}
                  >
                    observe
                  </button>
                  <button
                    type="button"
                    class="px-2 py-1 rounded border border-theme-border hover:border-primary disabled:opacity-50"
                    disabled={bulkApplying}
                    onclick={() => handleBulkSetMode('disabled')}
                  >
                    disabled
                  </button>
                  <button
                    type="button"
                    class="px-2 py-1 rounded border border-theme-border hover:border-primary disabled:opacity-50 text-theme-text-muted"
                    disabled={bulkApplying}
                    onclick={() => handleBulkSetMode('inherit')}
                  >
                    inherit
                  </button>
                  <button
                    type="button"
                    class="text-theme-text-muted hover:text-theme-text-emphasis ml-1"
                    disabled={bulkApplying}
                    onclick={() => (bulkSelection = new Set())}
                  >
                    clear
                  </button>
                  {#if bulkApplying}
                    <span class="text-theme-text-muted">applying…</span>
                  {/if}
                </div>
              {/if}
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {#each filteredDiscoveredNodes as card (card.id)}
                {@const qualityColor =
                  card.quality === 'stable'
                    ? 'bg-green-500'
                    : card.quality === 'weak'
                      ? 'bg-amber-500'
                      : 'bg-neutral-500'}
                {@const eff = policyView?.nodes[card.id]}
                {@const effMode = eff?.mode ?? policyView?.runtimeDefault.mode ?? 'auto'}
                {@const modeTone =
                  effMode === 'disabled'
                    ? 'text-theme-text-muted bg-theme-bg-canvas/60'
                    : effMode === 'observe'
                      ? 'text-violet-700 dark:text-violet-300 bg-violet-500/10'
                      : 'text-sky-700 dark:text-sky-300 bg-sky-500/10'}
                {@const inherited = eff && eff.source.mode !== 'node'}
                {@const selected = bulkSelection.has(card.id)}
                <div
                  class="relative rounded-lg border p-3 hover:border-primary hover:bg-theme-bg-canvas/30 transition-colors {selected
                    ? 'border-primary ring-1 ring-primary/30'
                    : 'border-theme-border'} {effMode === 'disabled' ? 'opacity-70' : ''}"
                >
                  <input
                    type="checkbox"
                    class="absolute top-2 right-2 cursor-pointer"
                    checked={selected}
                    onclick={(e) => {
                      e.stopPropagation()
                      toggleBulkSelection(card.id)
                    }}
                    aria-label="Select {card.label}"
                  >
                  <button
                    type="button"
                    class="text-left w-full cursor-pointer"
                    onclick={() => {
                      detailNode = card
                    }}
                  >
                    <div class="flex items-start gap-2 pr-6">
                      <span
                        class="inline-block w-2 h-2 rounded-full mt-1.5 flex-shrink-0 {qualityColor}"
                        title={card.quality}
                      ></span>
                      <div class="min-w-0 flex-1">
                        <p class="font-medium text-sm text-theme-text-emphasis truncate">
                          {card.label}
                          {#if card.syncState === 'notice'}
                            <span
                              class="ml-1 align-middle text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-700 dark:text-amber-300"
                              title="Reachable but not readable over SNMP — assign a credential to sync"
                            >
                              notice
                            </span>
                          {/if}
                        </p>
                        <p class="text-xs text-theme-text-muted truncate">
                          {card.model ?? card.vendor ?? card.sysDescr?.split(',')[0] ?? '—'}
                        </p>
                        <p class="text-xs text-theme-text-muted font-mono mt-0.5">
                          {card.mgmtIp ?? '—'}
                        </p>
                      </div>
                      <span
                        class="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded {modeTone} whitespace-nowrap"
                        title={inherited
                          ? `inherited from ${eff?.source.mode}`
                          : 'per-node override'}
                      >
                        {effMode}
                        {#if inherited}
                          <span class="ml-0.5 opacity-60">·inh</span>
                        {/if}
                      </span>
                    </div>
                    <div
                      class="mt-3 pt-2 border-t border-theme-border/50 text-xs text-theme-text-muted"
                    >
                      {card.quality}
                      {#if card.observedAt}
                        · {formatAgo(card.observedAt)}
                      {/if}
                    </div>
                  </button>
                </div>
              {/each}
            </div>
          {/if}
        </div>
      </div>
    {/if}

    <!-- Per-source sync -->
    <div class="card">
      <div class="card-header">
        <h2 class="font-medium text-theme-text-emphasis">Sources</h2>
        <p class="text-xs text-theme-text-muted mt-0.5">
          Drive each attached source. Results land as observation snapshots and the diagram
          re-renders through the resolver.
        </p>
      </div>
      {#if ctx.hasSourceChanges}
        <div class="px-4 py-2 bg-warning/10 border-t border-warning/20 text-warning text-sm">
          You have unsaved changes on the Sources page. Save them before syncing.
        </div>
      {/if}
      <div class="card-body space-y-2">
        {#each topologySources as source (source.id)}
          {@const dataSource = ctx.getDataSource(source.dataSourceId)}
          {@const lastResult = perSourceSync[source.dataSourceId]}
          <div class="rounded-lg border border-theme-border p-3 space-y-2">
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-2 flex-wrap">
                  <h3 class="text-sm font-medium text-theme-text-emphasis truncate">
                    {dataSource?.name ?? source.dataSourceId}
                  </h3>
                  <span
                    class="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-theme-bg font-mono text-theme-text-muted"
                  >
                    {dataSource?.type ?? '—'}
                  </span>
                  {#if dataSource?.status === 'connected'}
                    <span class="badge badge-success text-xs">connected</span>
                  {:else if dataSource?.status === 'disconnected'}
                    <span class="badge badge-danger text-xs" title={dataSource.statusMessage}>
                      disconnected
                    </span>
                  {:else}
                    <span class="badge badge-secondary text-xs">unknown</span>
                  {/if}
                </div>
                <p class="text-xs text-theme-text-muted mt-1">
                  {#if source.lastSyncedAt}
                    last synced {formatAgo(source.lastSyncedAt)}
                  {:else}
                    never synced
                  {/if}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onclick={() => handleSyncOne(source)}
                disabled={syncingSourceId === source.dataSourceId || ctx.hasSourceChanges}
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
            </div>
            {#if lastResult}
              <p class="text-xs">
                {#if lastResult.status === 'ok'}
                  <span class="text-theme-text-muted">
                    ✓ {lastResult.nodeCount} nodes / {lastResult.linkCount} links ·
                    {formatAgo(lastResult.at)}
                  </span>
                {:else if lastResult.status === 'partial'}
                  <span class="text-amber-600 dark:text-amber-400" title={lastResult.message}>
                    ⚠ partial: {lastResult.nodeCount} nodes / {lastResult.linkCount} links ·
                    {formatAgo(lastResult.at)}
                  </span>
                {:else if lastResult.status === 'empty'}
                  <span class="text-theme-text-muted">
                    no devices observed · {formatAgo(lastResult.at)}
                  </span>
                {:else}
                  <span class="text-red-500" title={lastResult.message}>
                    ✗ {lastResult.message ?? 'failed'}
                  </span>
                {/if}
              </p>
            {/if}
          </div>
        {/each}
      </div>
    </div>

    <!-- Observation history -->
    <div class="card">
      <div class="card-header">
        <h2 class="font-medium text-theme-text-emphasis">Recent observations</h2>
        <p class="text-xs text-theme-text-muted mt-0.5">Last 20 snapshots across all sources.</p>
      </div>
      <div class="card-body">
        {#if recentObservations.length === 0}
          <p class="text-xs text-theme-text-muted text-center py-4">
            No observations yet. Sync a source above to record one.
          </p>
        {:else}
          <div class="overflow-x-auto">
            <table class="w-full text-xs">
              <thead>
                <tr class="border-b border-theme-border text-left text-theme-text-muted">
                  <th class="py-1.5 font-medium">When</th>
                  <th class="py-1.5 font-medium">Source</th>
                  <th class="py-1.5 font-medium">Status</th>
                  <th class="py-1.5 font-medium text-right">Nodes</th>
                  <th class="py-1.5 font-medium text-right">Links</th>
                  <th class="py-1.5 font-medium text-right">Ports</th>
                </tr>
              </thead>
              <tbody>
                {#each recentObservations as o (o.id)}
                  {@const ds = ctx.getDataSource(o.sourceId)}
                  <tr class="border-b border-theme-border last:border-0">
                    <td class="py-1.5">{formatAgo(o.capturedAt)}</td>
                    <td class="py-1.5 font-mono text-theme-text-muted">{ds?.name ?? o.sourceId}</td>
                    <td class="py-1.5">
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
                    <td class="py-1.5 text-right">{o.nodeCount}</td>
                    <td class="py-1.5 text-right">{o.linkCount}</td>
                    <td class="py-1.5 text-right">{o.portCount}</td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {/if}
      </div>
    </div>
  {/if}
</div>

<DiscoveryNodeDetail
  open={detailNode !== null}
  onOpenChange={(v) => {
    if (!v) detailNode = null
  }}
  node={detailNode}
  attachments={detailNode?.attachments ?? []}
  probing={detailNode !== null && probingNodeId === detailNode.id}
  effectivePolicy={detailNode ? (policyView?.nodes[detailNode.id] ?? null) : null}
  patchingPolicy={detailNode !== null && policyPatching[detailNode.id] === true}
  policyErrorMessage={detailNode ? (policyError[detailNode.id] ?? null) : null}
  {formatAgo}
  onProbe={() => {
    if (detailNode) handleProbeNode(detailNode)
  }}
  onSetAttachments={handleSetAttachments}
  onSetLabel={handleSetLabel}
/>

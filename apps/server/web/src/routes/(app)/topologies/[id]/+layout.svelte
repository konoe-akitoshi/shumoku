<script lang="ts">
  /**
   * Shell for everything under `/topologies/[id]/*`.
   *
   * IA: "A+" — a Diagram-resident canvas (表) with an on-demand
   * Composition drawer (裏). The canvas (`TopologyCanvas`) is rendered
   * once here and stays mounted; the composition stages
   * (Sources / Discovery / Mapping / Resolved) live in a right-edge,
   * non-modal slide-over so editing them keeps the diagram in view
   * (focus + context). Settings is a gear, not a peer tab.
   * See `apps/server/docs/design/topology-ui-ia.md`.
   *
   * Each stage is still a real subroute (back/forward + Ctrl-click +
   * deep links keep working); the drawer is just chrome around the
   * active child. Shared state lives in `_context.svelte.ts`.
   */
  import { ArrowsClockwiseIcon, GearSixIcon, StackIcon, XIcon } from 'phosphor-svelte'
  import { onMount } from 'svelte'
  import { goto } from '$app/navigation'
  import { page } from '$app/stores'
  import { api } from '$lib/api'
  import ShareButton from '$lib/components/ShareButton.svelte'
  import { topologies } from '$lib/stores'
  import { createTopologyCtx } from './_context.svelte'
  import TopologyCanvas from './TopologyCanvas.svelte'

  let { children } = $props()

  const ctx = createTopologyCtx()

  $effect(() => {
    // biome-ignore lint/style/noNonNullAssertion: param is always set on this route
    ctx.topologyId = $page.params.id!
  })

  /**
   * The Composition pipeline stages, in dataflow order (① → ④). These
   * are the drawer's stepper. Settings is intentionally NOT here — it's
   * reached via the gear.
   */
  const STAGES = [
    { slug: 'sources', label: 'Sources', step: '1' },
    { slug: 'discovery', label: 'Discovery', step: '2' },
    { slug: 'mapping', label: 'Mapping', step: '3' },
    { slug: 'resolved', label: 'Resolved', step: '4' },
  ] as const

  let activeSlug = $derived.by(() => {
    const m = $page.url.pathname.match(/\/topologies\/[^/]+\/?([^/]*)/)
    return m?.[1] ?? ''
  })

  // The drawer is open whenever a stage (or Settings) subroute is active.
  const KNOWN_SLUGS = ['sources', 'discovery', 'mapping', 'resolved', 'settings']
  let drawerOpen = $derived(KNOWN_SLUGS.includes(activeSlug))
  let onSettings = $derived(activeSlug === 'settings')
  let activeStage = $derived(STAGES.find((s) => s.slug === activeSlug))

  const base = $derived(`/topologies/${ctx.topologyId}`)

  function openComposition() {
    // Open at the active stage if already on one, else the first stage.
    if (!drawerOpen) goto(`${base}/sources`)
  }
  function closeDrawer() {
    goto(base)
  }

  async function handleShare() {
    if (!ctx.topology) return
    ctx.topology = await topologies.share(ctx.topologyId)
  }
  async function handleUnshare() {
    if (!ctx.topology) return
    ctx.topology = await topologies.unshare(ctx.topologyId)
  }

  onMount(async () => {
    // Honor legacy `/settings#X` deep links (the old IA baked the tab into
    // a hash fragment); map them onto the new stage subroutes / drawer.
    if (typeof window !== 'undefined') {
      const hash = window.location.hash.slice(1)
      const onLegacySettings = /\/topologies\/[^/]+\/settings\/?$/.test(window.location.pathname)
      if (onLegacySettings && hash) {
        const legacyMap: Record<string, string> = {
          general: 'settings',
          sources: 'sources',
          discovery: 'discovery',
          mapping: 'mapping',
          resolved: 'resolved',
        }
        const dest = legacyMap[hash]
        if (dest && dest !== 'settings') {
          await goto(`/topologies/${ctx.topologyId}/${dest}`, { replaceState: true })
          return
        }
        if (dest === 'settings') {
          history.replaceState(null, '', window.location.pathname)
        }
      }
    }
    await loadShared()
  })

  async function loadShared() {
    const id = ctx.topologyId
    if (!id) return
    ctx.loading = true
    ctx.error = ''
    try {
      const [topoData, renderResponse, sources, topoSources, metricsSrcs] = await Promise.all([
        api.topologies.get(id),
        fetch(`/api/topologies/${id}/render`).then((r) => r.json()),
        api.topologies.sources.list(id),
        api.dataSources.listByCapability('topology'),
        api.dataSources.listByCapability('metrics'),
      ])
      ctx.topology = topoData
      topologies.upsert(topoData)
      ctx.renderData = {
        nodeCount: renderResponse.nodeCount,
        edgeCount: renderResponse.edgeCount,
      }
      ctx.currentSources = sources
      ctx.topologyDataSources = topoSources
      ctx.metricsDataSources = metricsSrcs
    } catch (e) {
      ctx.error = e instanceof Error ? e.message : 'Failed to load topology'
    } finally {
      ctx.loading = false
    }
  }
</script>

<svelte:head>
  {#if ctx.topology}
    <title>
      {ctx.topology.name}
      {onSettings
        ? ' · Settings'
        : activeStage
          ? ` · ${activeStage.label}`
          : ''}
      - Shumoku
    </title>
  {/if}
</svelte:head>

<div class="h-full relative min-h-0">
  <!-- 表: the diagram canvas, always mounted underneath everything. -->
  <TopologyCanvas />

  <!-- Top-right control cluster — belongs to the CLOSED (diagram) state.
       When the drawer is open it owns its own top-right chrome (gear + X),
       so this is hidden to avoid stacking two clusters in one corner. The
       canvas only owns the top-left status + bottom-right zoom; the app
       breadcrumb carries the title. -->
  {#if !drawerOpen}
    <div class="absolute top-4 right-4 z-20 flex items-center gap-2">
      {#if ctx.loading}
        <span class="text-xs text-theme-text-muted inline-flex items-center gap-1">
          <ArrowsClockwiseIcon size={12} class="animate-spin" />
          loading
        </span>
      {/if}
      {#if ctx.topology}
        <ShareButton
          shareToken={ctx.topology.shareToken}
          shareType="topologies"
          onShare={handleShare}
          onUnshare={handleUnshare}
        />
      {/if}
      <button
        type="button"
        onclick={openComposition}
        class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors bg-theme-bg-elevated/90 backdrop-blur border-theme-border text-theme-text hover:text-primary"
        aria-expanded={false}
      >
        <StackIcon size={16} />
        Composition
      </button>
      <a
        href={`${base}/settings`}
        class="inline-flex items-center justify-center w-8 h-8 rounded-lg border transition-colors bg-theme-bg-elevated/90 backdrop-blur border-theme-border text-theme-text-muted hover:text-theme-text"
        aria-label="Topology settings"
      >
        <GearSixIcon size={16} />
      </a>
    </div>
  {/if}

  <!-- 裏: the Composition drawer. Non-modal (no backdrop) so the canvas
       stays pannable while you tune the machinery. -->
  {#if drawerOpen}
    <aside
      class="absolute top-0 right-0 bottom-0 z-10 w-full max-w-[30rem] flex flex-col bg-theme-bg-canvas border-l border-theme-border shadow-xl"
      aria-label={onSettings ? 'Settings' : 'Composition'}
    >
      <header class="flex-shrink-0 border-b border-theme-border px-4 pt-3 pb-0">
        <div class="flex items-center justify-between mb-2">
          <span class="text-sm font-semibold text-theme-text">
            {onSettings ? 'Settings' : 'Composition'}
          </span>
          <div class="flex items-center gap-1">
            {#if !onSettings}
              <a
                href={`${base}/settings`}
                class="inline-flex items-center justify-center w-7 h-7 rounded-md text-theme-text-muted hover:text-theme-text hover:bg-theme-bg-elevated"
                aria-label="Topology settings"
              >
                <GearSixIcon size={16} />
              </a>
            {/if}
            <button
              type="button"
              onclick={closeDrawer}
              class="inline-flex items-center justify-center w-7 h-7 rounded-md text-theme-text-muted hover:text-theme-text hover:bg-theme-bg-elevated"
              aria-label="Close"
            >
              <XIcon size={16} />
            </button>
          </div>
        </div>
        {#if !onSettings}
          <!-- Pipeline stepper (sources → discovery → mapping → resolved). -->
          <nav class="flex gap-1 -mb-px overflow-x-auto">
            {#each STAGES as stage (stage.slug)}
              <a
                href={`${base}/${stage.slug}`}
                class="flex items-center gap-1.5 px-2.5 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors {activeSlug ===
                stage.slug
                  ? 'text-primary border-primary'
                  : 'text-theme-text-muted border-transparent hover:text-theme-text'}"
              >
                <span
                  class="inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] {activeSlug ===
                  stage.slug
                    ? 'bg-primary text-white'
                    : 'bg-theme-bg-elevated text-theme-text-muted'}"
                >
                  {stage.step}
                </span>
                {stage.label}
              </a>
            {/each}
          </nav>
        {/if}
      </header>

      <div class="flex-1 min-h-0 overflow-auto">
        {#if ctx.error && !ctx.topology}
          <div class="p-4">
            <div class="p-3 bg-danger/10 border border-danger/20 rounded-lg text-danger text-sm">
              {ctx.error}
            </div>
          </div>
        {:else}
          {@render children?.()}
        {/if}
      </div>
    </aside>
  {/if}
</div>

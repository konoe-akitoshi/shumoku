<script lang="ts">
  /**
   * Shell for everything under `/topologies/[id]/*`.
   *
   * IA (agreed 3-zone model — see topology-ui-ia.md / composition-store doc):
   *   - Diagram (表) — the resident canvas (`TopologyCanvas`), always mounted.
   *   - Sources — inputs: attached sources, priority, sync, scope.
   *   - Composition — curation of the resolved entities (the old Discovery,
   *     renamed); Mapping + Resolved are subviews within it.
   * Sources and Composition open in a right-edge, non-modal drawer via a
   * two-way zone switch. There is NO "Discovery" / "Mapping" / "Resolved"
   * top-level tab. Settings is a gear.
   *
   * Each zone/subview is still a real subroute (deep links work); the drawer
   * is chrome around the active child. Shared state lives in `_context`.
   */
  import { GearSixIcon, XIcon } from 'phosphor-svelte'
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

  let activeSlug = $derived.by(() => {
    const m = $page.url.pathname.match(/\/topologies\/[^/]+\/?([^/]*)/)
    return m?.[1] ?? ''
  })

  // The Composition zone owns three subviews (Entities / Mapping / Resolved).
  const COMPOSITION_SLUGS = ['composition', 'mapping', 'resolved']
  const SUBVIEWS = [
    { slug: 'composition', label: 'Entities' },
    { slug: 'mapping', label: 'Mapping' },
    { slug: 'resolved', label: 'Resolved' },
  ] as const

  let zone = $derived.by<'sources' | 'composition' | 'settings' | 'edit' | null>(() => {
    if (activeSlug === 'sources') return 'sources'
    if (activeSlug === 'settings') return 'settings'
    if (activeSlug === 'edit') return 'edit'
    if (COMPOSITION_SLUGS.includes(activeSlug)) return 'composition'
    return null
  })
  let drawerOpen = $derived(zone !== null)
  let onSettings = $derived(zone === 'settings')

  const base = $derived(`/topologies/${ctx.topologyId}`)

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
    // Honor legacy deep links: the old IA had Discovery/Mapping/Resolved as
    // peer tabs and baked Settings sub-tabs into a hash. Map both onto the
    // new zones (Discovery → Composition).
    if (typeof window !== 'undefined') {
      const path = window.location.pathname
      if (/\/topologies\/[^/]+\/discovery\/?$/.test(path)) {
        await goto(`${base}/composition`, { replaceState: true })
        return
      }
      const hash = window.location.hash.slice(1)
      const onLegacySettings = /\/topologies\/[^/]+\/settings\/?$/.test(path)
      if (onLegacySettings && hash) {
        const legacyMap: Record<string, string> = {
          general: 'settings',
          sources: 'sources',
          discovery: 'composition',
          mapping: 'mapping',
          resolved: 'resolved',
        }
        const dest = legacyMap[hash]
        if (dest && dest !== 'settings') {
          await goto(`${base}/${dest}`, { replaceState: true })
          return
        }
        if (dest === 'settings') {
          history.replaceState(null, '', path)
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

  const zoneTitle = $derived(
    zone === 'sources' ? 'Sources' : zone === 'settings' ? 'Settings' : 'Composition',
  )

  // Top-right zone toggles (shown on the diagram). Each opens the drawer to
  // its zone; the active one is highlighted.
  const ZONES = [
    { key: 'sources', label: 'Sources', href: 'sources' },
    { key: 'composition', label: 'Composition', href: 'composition' },
  ] as const
</script>

<svelte:head>
  {#if ctx.topology}
    <title>{ctx.topology.name}{drawerOpen ? ` · ${zoneTitle}` : ''} - Shumoku</title>
  {/if}
</svelte:head>

<div class="h-full relative min-h-0">
  <!-- 表: the diagram canvas, always mounted underneath everything. -->
  <TopologyCanvas />

  <!-- Top-right control cluster — the diagram (drawer-closed) state. Hidden
       when the drawer is open so it never stacks on the drawer's own header. -->
  {#if !drawerOpen}
    <div class="absolute top-4 right-4 z-20 flex items-center gap-2">
      {#if ctx.topology}
        <ShareButton
          shareToken={ctx.topology.shareToken}
          shareType="topologies"
          onShare={handleShare}
          onUnshare={handleUnshare}
        />
      {/if}
      {#each ZONES as z (z.key)}
        <a
          href={`${base}/${z.href}`}
          class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors bg-theme-bg-elevated/90 backdrop-blur border-theme-border text-theme-text hover:text-primary"
        >
          {z.label}
        </a>
      {/each}
      <a
        href={`${base}/settings`}
        class="inline-flex items-center justify-center w-8 h-8 rounded-lg border transition-colors bg-theme-bg-elevated/90 backdrop-blur border-theme-border text-theme-text-muted hover:text-theme-text"
        aria-label="Topology settings"
      >
        <GearSixIcon size={16} />
      </a>
    </div>
  {/if}

  <!-- 裏: the drawer. Non-modal (no backdrop) so the canvas stays pannable. -->
  {#if drawerOpen}
    <aside
      class="absolute top-0 right-0 bottom-0 z-10 w-full max-w-[30rem] flex flex-col bg-theme-bg-canvas border-l border-theme-border shadow-xl"
      aria-label={zoneTitle}
    >
      <header class="flex-shrink-0 border-b border-theme-border px-4 pt-3 pb-0">
        <div class="flex items-center justify-between mb-2">
          <!-- Two-way zone switch: Sources | Composition (hidden on Settings). -->
          {#if onSettings}
            <span class="text-sm font-semibold text-theme-text">Settings</span>
          {:else}
            <div class="flex items-center gap-1">
              {#each ZONES as z (z.key)}
                <a
                  href={`${base}/${z.href}`}
                  class="px-2.5 py-1 rounded-md text-sm font-medium transition-colors {zone ===
                  z.key
                    ? 'bg-primary/10 text-primary'
                    : 'text-theme-text-muted hover:text-theme-text'}"
                >
                  {z.label}
                </a>
              {/each}
            </div>
          {/if}
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
        <!-- Composition subviews: Entities / Mapping / Resolved. -->
        {#if zone === 'composition'}
          <nav class="flex gap-1 -mb-px overflow-x-auto">
            {#each SUBVIEWS as sv (sv.slug)}
              <a
                href={`${base}/${sv.slug}`}
                class="px-2.5 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors {activeSlug ===
                sv.slug
                  ? 'text-primary border-primary'
                  : 'text-theme-text-muted border-transparent hover:text-theme-text'}"
              >
                {sv.label}
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

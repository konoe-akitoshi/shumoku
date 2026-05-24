<script lang="ts">
  /**
   * Shell for everything under `/topologies/[id]/*`.
   *
   * The previous shape parked Sources / Discovery / Mapping / Resolved
   * inside a "Settings" page as tabs. That was honest for General +
   * danger zone, but Discovery and Mapping are full-screen workspaces,
   * not "settings". This layout treats them as peers of the diagram:
   *
   *   Diagram · Sources · Discovery · Mapping · Resolved · Settings
   *
   * Each is a real subroute (so back/forward + Ctrl-click + deep
   * links all work). The diagram is the default (`+page.svelte`).
   *
   * Shared state lives in `_context.svelte.ts` so tab pages don't
   * each re-fetch the topology and source list independently.
   */
  import { ArrowsClockwiseIcon } from 'phosphor-svelte'
  import { onMount } from 'svelte'
  import { goto } from '$app/navigation'
  import { page } from '$app/stores'
  import { api } from '$lib/api'
  import { topologies } from '$lib/stores'
  import { createTopologyCtx } from './_context.svelte'

  let { children } = $props()

  const ctx = createTopologyCtx()

  $effect(() => {
    // biome-ignore lint/style/noNonNullAssertion: param is always set on this route
    ctx.topologyId = $page.params.id!
  })

  /**
   * The tabs. Diagram first (it's the default workspace), Settings
   * last (least-frequent action). Order is the operator's mental
   * model — "look at it" → "configure what feeds it" → "see what
   * was discovered" → "wire metrics to nodes" → "inspect the result"
   * → "tune display / delete".
   */
  const TABS = [
    { slug: '', label: 'Diagram' },
    { slug: 'sources', label: 'Sources' },
    { slug: 'discovery', label: 'Discovery' },
    { slug: 'mapping', label: 'Mapping' },
    { slug: 'resolved', label: 'Resolved' },
    { slug: 'settings', label: 'Settings' },
  ] as const

  let activeSlug = $derived.by(() => {
    const m = $page.url.pathname.match(/\/topologies\/[^/]+\/?([^/]*)/)
    return m?.[1] ?? ''
  })

  onMount(async () => {
    // Honor legacy `/settings#X` deep links. The old route baked the
    // tab into a hash fragment; the tabs are now real subroutes, so
    // bookmarks and external links keep working via this redirect.
    // `#general` collapses to the (now small) Settings page itself.
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
          // Clear the hash but stay on /settings.
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
      ctx.editableSources = sources.map((s) => ({
        dataSourceId: s.dataSourceId,
        purpose: s.purpose,
        syncMode: s.syncMode,
        priority: s.priority,
        optionsJson: s.optionsJson,
      }))
      ctx.hasSourceChanges = false
    } catch (e) {
      ctx.error = e instanceof Error ? e.message : 'Failed to load topology'
    } finally {
      ctx.loading = false
    }
  }
</script>

<svelte:head>
  {#if ctx.topology}
    {@const tab = TABS.find((t) => t.slug === activeSlug)}
    <title>{ctx.topology.name}{tab && tab.slug ? ` · ${tab.label}` : ''} - Shumoku</title>
  {/if}
</svelte:head>

<div class="h-full flex flex-col min-h-0">
  <!-- Tab bar — shown on every topology route, including the Diagram,
       so the operator never loses their navigation handle. Costs ~40px
       of vertical on the Diagram canvas; in exchange the IA stays
       consistent. The (app) layout's breadcrumb already carries
       "Topologies › <name>", so a second in-page breadcrumb would
       just be noise. -->
  <header class="border-b border-theme-border bg-theme-bg-canvas px-6 pt-3 flex-shrink-0">
    {#if ctx.loading}
      <div class="text-xs text-theme-text-muted inline-flex items-center gap-1 mb-1">
        <ArrowsClockwiseIcon size={12} class="animate-spin" />
        loading
      </div>
    {/if}
    <nav class="flex gap-1 -mb-px">
      {#each TABS as tab (tab.slug)}
        {@const href = `/topologies/${ctx.topologyId}${tab.slug ? `/${tab.slug}` : ''}`}
        <a
          {href}
          class="px-3 py-2 text-sm font-medium transition-colors border-b-2 {activeSlug ===
          tab.slug
            ? 'text-primary border-primary'
            : 'text-theme-text-muted border-transparent hover:text-theme-text'}"
        >
          {tab.label}
        </a>
      {/each}
    </nav>
  </header>

  {#if ctx.error && !ctx.topology}
    <div class="p-6">
      <div class="p-3 bg-danger/10 border border-danger/20 rounded-lg text-danger text-sm">
        {ctx.error}
      </div>
    </div>
  {:else}
    <main class="flex-1 min-h-0 overflow-auto">{@render children?.()}</main>
  {/if}
</div>

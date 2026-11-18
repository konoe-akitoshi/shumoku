<script lang="ts">
  import { page } from '$app/state'
  import { api, sharedTopologyStreamUrl } from '$lib/api'
  import InteractiveSvgDiagram from '$lib/components/InteractiveSvgDiagram.svelte'
  import Logo from '$lib/components/Logo.svelte'
  import ThemeToggle from '$lib/components/ThemeToggle.svelte'

  let name = $state('')
  let loading = $state(true)
  let error = $state('')

  const token = $derived(page.params.token)
  // /view carries the scene the Server baked beside the graph, so the shared viewer never lays
  // a network out itself. Its live metrics come from the token-scoped SSE stream, which also
  // says when the topology was drawn again; the diagram then loads the view again.
  const loadShared = $derived(() => api.shared.getTopologyView(token ?? ''))
  const liveSource = $derived(
    token ? { kind: 'sse' as const, url: sharedTopologyStreamUrl(token) } : null,
  )

  $effect(() => {
    const currentToken = token
    if (!currentToken) return
    let cancelled = false
    loading = true
    error = ''
    name = ''
    api.shared
      .getTopology(currentToken)
      .then((data) => {
        if (!cancelled) name = data.name || 'Shared Topology'
      })
      .catch(() => {
        if (!cancelled) error = 'Failed to load topology'
      })
      .finally(() => {
        if (!cancelled) loading = false
      })
    return () => {
      cancelled = true
    }
  })
</script>

<svelte:head> <title>{name || 'Shared Topology'} - Shumoku</title> </svelte:head>

<div class="h-screen flex flex-col bg-theme-bg-canvas">
  <!-- Header -->
  <div
    class="flex items-center justify-between px-4 py-3 border-b border-theme-border bg-theme-bg-elevated"
  >
    <div class="flex items-center gap-2">
      <Logo size={28} class="flex-shrink-0" />
      <span class="text-sm font-medium text-theme-text-emphasis">{name}</span>
      <span class="text-xs text-theme-text-muted px-2 py-0.5 bg-theme-bg rounded-full">Shared</span>
    </div>
    <ThemeToggle />
  </div>

  <!-- Content -->
  <div class="flex-1 relative min-h-0">
    {#if loading}
      <div class="absolute inset-0 flex items-center justify-center">
        <div
          class="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"
        ></div>
      </div>
    {:else if error}
      <div class="absolute inset-0 flex items-center justify-center">
        <p class="text-theme-text-muted">{error}</p>
      </div>
    {:else}
      <div class="absolute inset-0">
        <InteractiveSvgDiagram graphLoader={loadShared} {liveSource} />
      </div>
    {/if}
  </div>
</div>
